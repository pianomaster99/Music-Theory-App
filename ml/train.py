"""Train the lightweight pitch CRNN on ALL labeled sources at once (batch train).

Reads every 'final' clip from the manifest (each source's original + noised
variations, all sharing the AI-cleaned + octave-repaired note label), builds
log-mel inputs and per-frame (88-key + voicing) targets, and trains the
streaming CRNN.

Optimizations vs the first pass (which overfit train ~100% / val ~63%):
  * batch across all sources (no lazy loading), split val by *singer* so the
    held-out voices are genuinely unseen (no clip leakage within a singer);
  * Gaussian soft pitch targets (sigma ~= 1 semitone): lenient on +/-1 errors,
    but an octave miss is ~12 sigma away -> heavily penalised, attacking the
    octave-jump failure mode directly;
  * per-frame confidence weighting from the CREPE teacher (trust clean frames);
  * SpecAugment (time/freq masking) + input noise for input regularisation;
  * dropout in the model + AdamW weight decay + grad clipping.

Usage:
    python train.py [--epochs 120] [--window 300] [--batch 16]
"""
from __future__ import annotations

import argparse
import json

import numpy as np
import soundfile as sf
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

import config as C
import dataset_common as dc
import features
import pitch
from model import PitchCRNN

IGNORE = -100
# Width of the Gaussian soft pitch target (semitones). 1.0 is forgiving on +/-1
# while still strongly penalising octave errors (~12 sigma) — a good default now
# that we want tolerant, robust labels rather than razor-sharp exactness.
PITCH_SIGMA = 1.0


def _clip_frames(rec):
    y, _ = sf.read(C.ML_DIR / rec["audio_path"])
    lm = features.log_mel(np.asarray(y, dtype=np.float32))
    lm = (lm - lm.mean()) / (lm.std() + 1e-5)
    d = np.load(C.ML_DIR / rec["label_path"])
    f0, voiced = d["f0"], d["voiced"]
    conf = d["conf"] if "conf" in d else np.ones(len(f0), dtype=np.float32)
    T = min(len(lm), len(f0), len(conf))
    lm, f0, voiced, conf = lm[:T], f0[:T], voiced[:T], conf[:T]
    cls = pitch.hz_to_class(f0).astype(np.int64)
    cls = np.where(voiced, cls, IGNORE)
    # confidence -> per-frame loss weight (trust confident teacher frames more)
    w = np.clip(conf.astype(np.float32), 0.1, 1.0)
    return lm.astype(np.float32), cls, voiced.astype(np.float32), w


def _spec_augment(lm, rng, n_freq=2, n_time=2, f_max=14, t_max=28, noise=0.1):
    """In-place-ish SpecAugment on a (T, F) log-mel window (normalised ~N(0,1))."""
    lm = lm + rng.normal(0, noise, size=lm.shape).astype(np.float32)
    T, Fdim = lm.shape
    for _ in range(rng.integers(0, n_freq + 1)):
        w = int(rng.integers(1, f_max + 1))
        f0 = int(rng.integers(0, max(1, Fdim - w)))
        lm[:, f0:f0 + w] = 0.0
    for _ in range(rng.integers(0, n_time + 1)):
        w = int(rng.integers(1, t_max + 1))
        t0 = int(rng.integers(0, max(1, T - w)))
        lm[t0:t0 + w, :] = 0.0
    return lm


class FrameWindows(Dataset):
    def __init__(self, recs, window=300, hop=150, augment=False, seed=0):
        self.items = []
        self.ds = []  # dataset label per window (for balanced batching)
        self.window = window
        self.augment = augment
        self.rng = np.random.default_rng(seed)
        for rec in recs:
            lm, cls, v, w = _clip_frames(rec)
            T = len(lm)
            if T == 0:
                continue
            ds = rec.get("extra", {}).get("dataset", "?")
            starts = list(range(0, max(1, T - window + 1), hop)) or [0]
            if starts[-1] + window < T:
                starts.append(T - window)
            for s in starts:
                e = min(s + window, T)
                self.items.append((lm[s:e], cls[s:e], v[s:e], w[s:e]))
                self.ds.append(ds)

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        lm, cls, v, w = self.items[i]
        lm = lm.copy()
        if self.augment:
            lm = _spec_augment(lm, self.rng)
        T = len(lm)
        pad = self.window - T
        if pad > 0:
            lm = np.pad(lm, ((0, pad), (0, 0)))
            cls = np.pad(cls, (0, pad), constant_values=IGNORE)
            v = np.pad(v, (0, pad))
            w = np.pad(w, (0, pad))
            mask = np.concatenate([np.ones(T), np.zeros(pad)])
        else:
            mask = np.ones(T)
        return (torch.from_numpy(lm.astype(np.float32)),
                torch.from_numpy(cls), torch.from_numpy(v).float(),
                torch.from_numpy(w.astype(np.float32)),
                torch.from_numpy(mask).float())


class DatasetBalancedBatchSampler:
    """Yield batches where every batch contains windows from *each* dataset.

    Per-batch quota for a dataset is proportional to its window count but never
    below 1, so a tiny source (e.g. one GTSinger voice) still appears in every
    batch without dominating it. Each dataset is drawn without replacement and
    reshuffled when exhausted, so big sources are well covered across an epoch.
    """

    def __init__(self, ds_labels, batch_size, seed=0):
        self.groups: dict = {}
        for i, d in enumerate(ds_labels):
            self.groups.setdefault(d, []).append(i)
        self.names = list(self.groups)
        self.batch_size = batch_size
        self.rng = np.random.default_rng(seed)
        self.total = len(ds_labels)
        sizes = np.array([len(self.groups[n]) for n in self.names], dtype=float)
        quota = np.maximum(1, np.round(sizes / sizes.sum() * batch_size)).astype(int)
        while quota.sum() > batch_size and quota.max() > 1:
            quota[np.argmax(quota)] -= 1
        while quota.sum() < batch_size:
            quota[np.argmax(sizes)] += 1
        self.quota = dict(zip(self.names, quota))
        self.n_batches = max(1, self.total // batch_size)

    def _cycle(self, name):
        idx = self.groups[name][:]
        self.rng.shuffle(idx)
        while True:
            for i in idx:
                yield i
            self.rng.shuffle(idx)

    def __iter__(self):
        gens = {n: self._cycle(n) for n in self.names}
        for _ in range(self.n_batches):
            batch = []
            for n in self.names:
                for _ in range(self.quota[n]):
                    batch.append(next(gens[n]))
            self.rng.shuffle(batch)
            yield batch

    def __len__(self):
        return self.n_batches


def _singer_key(rec):
    e = rec.get("extra", {})
    ds, sid = e.get("dataset"), e.get("singer_id")
    if ds is not None and sid is not None:
        return f"{ds}:{sid}"
    return rec["clip_id"].rsplit("__", 1)[0]  # fallback: per-clip


def split_by_source(recs, val_frac=0.25, seed=0):
    """Hold out whole SINGERS (not clips) so validation voices are truly unseen."""
    singers = sorted({_singer_key(r) for r in recs})
    rng = np.random.default_rng(seed)
    rng.shuffle(singers)
    n_val = max(1, int(len(singers) * val_frac))
    val_set = set(singers[:n_val])
    train = [r for r in recs if _singer_key(r) not in val_set]
    val = [r for r in recs if _singer_key(r) in val_set]
    return train, val, sorted(val_set)


# Precomputed class index row for building Gaussian soft targets.
_CLASS_IDX = torch.arange(C.N_PITCH_CLASSES).float()


def soft_pitch_loss(logits, cls, weight, sigma=PITCH_SIGMA):
    """Confidence-weighted cross-entropy against a Gaussian-in-pitch soft target.

    ``logits`` (N, K), ``cls`` (N,) integer true class, ``weight`` (N,). A miss of
    d semitones costs ~ (d/sigma)^2 in the target's log-prob, so +/-1 is cheap and
    an octave (12) is enormous -> directly discourages octave errors.
    """
    if logits.numel() == 0:
        return logits.sum() * 0.0
    idx = _CLASS_IDX.to(logits.device)
    diff = idx[None, :] - cls[:, None].float()
    tgt = torch.exp(-0.5 * (diff / sigma) ** 2)
    tgt = tgt / tgt.sum(-1, keepdim=True).clamp_min(1e-8)
    logp = F.log_softmax(logits, dim=-1)
    per = -(tgt * logp).sum(-1)
    return (per * weight).sum() / weight.sum().clamp_min(1e-6)


def run_epoch(model, loader, opt, dev, train=True):
    bce = torch.nn.BCEWithLogitsLoss()
    model.train(train)
    tot = {"loss": 0.0, "n": 0, "v_correct": 0, "v_n": 0,
           "p_correct": 0, "p_tol": 0, "p_n": 0}
    for lm, cls, v, w, mask in loader:
        lm, cls, v, w, mask = (lm.to(dev), cls.to(dev), v.to(dev),
                               w.to(dev), mask.to(dev))
        with torch.set_grad_enabled(train):
            p_logits, v_logits, _ = model(lm)
            m = mask.bool()
            voiced_m = m & (cls != IGNORE)
            vsel = voiced_m.reshape(-1)
            pl = p_logits.reshape(-1, p_logits.shape[-1])[vsel]
            cl = cls.reshape(-1)[vsel]
            wl = w.reshape(-1)[vsel]
            loss_p = soft_pitch_loss(pl, cl, wl)
            loss_v = bce(v_logits[m], v[m])
            loss = loss_p + loss_v
            if train:
                opt.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
                opt.step()
        tot["loss"] += float(loss.detach()) * int(m.sum())
        tot["n"] += int(m.sum())
        vpred = (torch.sigmoid(v_logits) > 0.5).float()
        tot["v_correct"] += int(((vpred == v) & m).sum())
        tot["v_n"] += int(m.sum())
        if int(voiced_m.sum()) > 0:
            ppred = p_logits.argmax(-1)
            tot["p_correct"] += int(((ppred == cls) & voiced_m).sum())
            tot["p_tol"] += int(((ppred - cls).abs() <= 1).logical_and(voiced_m).sum())
            tot["p_n"] += int(voiced_m.sum())
    n = max(tot["n"], 1)
    return {
        "loss": tot["loss"] / n,
        "voicing_acc": tot["v_correct"] / max(tot["v_n"], 1),
        "pitch_acc": tot["p_correct"] / max(tot["p_n"], 1),
        "pitch_acc_tol1": tot["p_tol"] / max(tot["p_n"], 1),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=120, help="max epochs (early-stops sooner)")
    ap.add_argument("--patience", type=int, default=15,
                    help="stop if val loss doesn't improve for this many epochs")
    ap.add_argument("--window", type=int, default=300)
    ap.add_argument("--batch", type=int, default=48)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--weight-decay", type=float, default=1e-4)
    ap.add_argument("--dropout", type=float, default=0.3)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    dev = "cpu"

    recs = [r for r in dc.read_manifest() if r["method"] == "final"]
    if not recs:
        print("No 'final' data. Run datagen_pipeline.py first.")
        return
    train_recs, val_recs, val_src = split_by_source(recs, seed=args.seed)
    tr = FrameWindows(train_recs, args.window, augment=True, seed=args.seed)
    va = FrameWindows(val_recs, args.window, augment=False)
    print(f"clips: {len(recs)} ({len(train_recs)} train / {len(val_recs)} val); "
          f"windows: {len(tr)} train / {len(va)} val; "
          f"held-out singers ({len(val_src)}): {val_src}")

    sampler = DatasetBalancedBatchSampler(tr.ds, args.batch, seed=args.seed)
    print(f"batch={args.batch} balanced across datasets; per-batch quota: {sampler.quota}")
    tl = DataLoader(tr, batch_sampler=sampler)
    vl = DataLoader(va, batch_size=args.batch)
    model = PitchCRNN(dropout=args.dropout).to(dev)
    print(f"model params: {model.num_params():,}")
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, args.epochs)

    best = {"loss": 1e9}
    out_dir = C.DATA_DIR / "model"
    out_dir.mkdir(parents=True, exist_ok=True)
    hist = []
    since_improve = 0
    for ep in range(1, args.epochs + 1):
        trm = run_epoch(model, tl, opt, dev, train=True)
        vam = run_epoch(model, vl, opt, dev, train=False) if len(va) else trm
        sched.step()
        hist.append({"epoch": ep, "train": trm, "val": vam})
        improved = vam["loss"] < best["loss"] - 1e-4
        if ep % 5 == 0 or ep == 1 or improved:
            tag = "  <-- best" if improved else ""
            print(f"ep {ep:3d} | train loss {trm['loss']:.3f} pitch {trm['pitch_acc']*100:4.1f}% "
                  f"(±1 {trm['pitch_acc_tol1']*100:4.1f}%) voice {trm['voicing_acc']*100:4.1f}% "
                  f"|| val loss {vam['loss']:.3f} pitch {vam['pitch_acc']*100:4.1f}% "
                  f"(±1 {vam['pitch_acc_tol1']*100:4.1f}%) voice {vam['voicing_acc']*100:4.1f}%{tag}",
                  flush=True)
        if improved:
            best = {"loss": vam["loss"], "epoch": ep, **vam}
            since_improve = 0
            torch.save({"model": model.state_dict(), "config": {
                "n_mels": C.N_MELS, "n_classes": C.N_PITCH_CLASSES,
                "dropout": args.dropout}}, out_dir / "pitch_crnn.pt")
        else:
            since_improve += 1
            if since_improve >= args.patience:
                print(f"early stop at ep {ep} (no val improvement for {args.patience} epochs)",
                      flush=True)
                break

    (out_dir / "history.json").write_text(json.dumps(hist, indent=2))
    print(f"\nbest val: loss {best['loss']:.3f} @ ep {best.get('epoch')}, "
          f"pitch {best.get('pitch_acc',0)*100:.1f}% (±1 {best.get('pitch_acc_tol1',0)*100:.1f}%), "
          f"voicing {best.get('voicing_acc',0)*100:.1f}%")
    print(f"saved: {out_dir / 'pitch_crnn.pt'}")


if __name__ == "__main__":
    main()
