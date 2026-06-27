"""Evaluate the trained pitch CRNN on the held-out (unseen-singer) validation set.

Rebuilds the *exact* same train/val split as ``train.py`` (split_by_source,
seed 0), runs the saved best model over each validation clip, prints aggregate
metrics, and renders prediction-vs-ground-truth plots so the results are visible.

Usage:
    python eval_val.py [--n-plots 8] [--seed 0]
"""
from __future__ import annotations

import argparse
import collections

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import soundfile as sf
import torch

import config as C
import dataset_common as dc
import features
import pitch
from model import PitchCRNN
from train import split_by_source

IGNORE = -100
HOP_S = C.HOP_LENGTH / C.SR


def _key_name(cls: int) -> str:
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    midi = cls + C.PIANO_MIDI_MIN
    return f"{names[midi % 12]}{midi // 12 - 1}"


def load_clip(rec):
    y, _ = sf.read(C.ML_DIR / rec["audio_path"])
    lm = features.log_mel(np.asarray(y, dtype=np.float32))
    lm = (lm - lm.mean()) / (lm.std() + 1e-5)
    d = np.load(C.ML_DIR / rec["label_path"])
    f0, voiced = d["f0"], d["voiced"]
    T = min(len(lm), len(f0))
    return (np.asarray(y, np.float32), lm[:T].astype(np.float32),
            f0[:T], voiced[:T].astype(bool))


@torch.no_grad()
def predict(model, lm):
    x = torch.from_numpy(lm).unsqueeze(0)  # (1, T, F)
    p_logits, v_logits, _ = model(x)
    pred_cls = p_logits.argmax(-1)[0].numpy()
    voice_prob = torch.sigmoid(v_logits)[0].numpy()
    return pred_cls, voice_prob


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n-plots", type=int, default=8)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--ckpt", default=str(C.DATA_DIR / "model" / "pitch_crnn.pt"))
    args = ap.parse_args()

    ckpt = torch.load(args.ckpt, map_location="cpu")
    model = PitchCRNN()
    model.load_state_dict(ckpt["model"])
    model.eval()

    recs = [r for r in dc.read_manifest() if r["method"] == "final"]
    _, val_recs, val_src = split_by_source(recs, seed=args.seed)
    # Evaluate on the clean 'orig' variant of each held-out source.
    val_orig = [r for r in val_recs if r.get("extra", {}).get("variant") == "orig"]
    print(f"val sources: {len(val_src)} (unseen singers) | clips (orig): {len(val_orig)}")

    agg = collections.Counter()
    per_source = collections.defaultdict(lambda: collections.Counter())
    plot_items = []
    for rec in val_orig:
        y, lm, f0, voiced = load_clip(rec)
        gt_cls = pitch.hz_to_class(f0).astype(np.int64)
        pred_cls, voice_prob = predict(model, lm)
        T = min(len(gt_cls), len(pred_cls))
        gt_cls, pred_cls, voiced = gt_cls[:T], pred_cls[:T], voiced[:T]
        voice_prob = voice_prob[:T]

        # voicing accuracy over all frames
        vpred = voice_prob > 0.5
        agg["v_correct"] += int((vpred == voiced).sum())
        agg["v_n"] += T
        # pitch accuracy on GT-voiced frames
        vm = voiced
        if vm.sum():
            agg["p_correct"] += int(((pred_cls == gt_cls) & vm).sum())
            agg["p_tol1"] += int(((np.abs(pred_cls - gt_cls) <= 1) & vm).sum())
            agg["p_n"] += int(vm.sum())
        ds = rec.get("extra", {}).get("dataset", "?")
        per_source[ds]["p_correct"] += int(((pred_cls == gt_cls) & vm).sum())
        per_source[ds]["p_tol1"] += int(((np.abs(pred_cls - gt_cls) <= 1) & vm).sum())
        per_source[ds]["p_n"] += int(vm.sum())
        plot_items.append((rec, y, lm, gt_cls, pred_cls, voiced, voice_prob))

    print("\n=== Validation metrics (held-out unseen singers) ===")
    print(f"voicing acc      : {agg['v_correct']/max(agg['v_n'],1)*100:5.1f}%")
    print(f"pitch exact (88) : {agg['p_correct']/max(agg['p_n'],1)*100:5.1f}%")
    print(f"pitch ±1 semitone: {agg['p_tol1']/max(agg['p_n'],1)*100:5.1f}%")
    print("\nper-source pitch (exact / ±1):")
    for ds, c in sorted(per_source.items()):
        n = max(c["p_n"], 1)
        print(f"  {ds:10s}: {c['p_correct']/n*100:5.1f}% / {c['p_tol1']/n*100:5.1f}%  ({c['p_n']} voiced frames)")

    # --- plots: spectrogram + pitch comparison, one row per clip ---
    n = min(args.n_plots, len(plot_items))
    # spread across sources
    by_ds = collections.defaultdict(list)
    for it in plot_items:
        by_ds[it[0].get("extra", {}).get("dataset", "?")].append(it)
    picks, i = [], 0
    while len(picks) < n and any(by_ds.values()):
        for ds in list(by_ds):
            if by_ds[ds] and len(picks) < n:
                picks.append(by_ds[ds].pop(0))
    fig, axes = plt.subplots(n, 1, figsize=(13, 2.6 * n), squeeze=False)
    for ax, (rec, y, lm, gt_cls, pred_cls, voiced, vprob) in zip(axes[:, 0], picks):
        T = len(gt_cls)
        t = np.arange(T) * HOP_S
        # background spectrogram (log-mel), faint
        ax.imshow(lm.T, origin="lower", aspect="auto",
                  extent=[0, T * HOP_S, 0, C.N_PITCH_CLASSES], cmap="Greys", alpha=0.35)
        gt = np.where(voiced, gt_cls, np.nan)
        vpred = vprob > 0.5
        pr = np.where(vpred, pred_cls, np.nan)
        ax.plot(t, gt, ".", color="#d62728", ms=4, label="ground truth (AI label)")
        ax.plot(t, pr, ".", color="#17becf", ms=2.5, label="model prediction")
        ds = rec.get("extra", {}).get("dataset", "?")
        sid = rec.get("extra", {}).get("singer_id", "?")
        vm = voiced
        acc = ((pred_cls == gt_cls) & vm).sum() / max(vm.sum(), 1) * 100
        tol = ((np.abs(pred_cls - gt_cls) <= 1) & vm).sum() / max(vm.sum(), 1) * 100
        ax.set_title(f"{ds} / {sid}  —  pitch {acc:.0f}% exact, {tol:.0f}% ±1",
                     fontsize=9, loc="left")
        ax.set_ylabel("piano key")
        ax.set_xlim(0, T * HOP_S)
        lo = np.nanmin([np.nanmin(gt) if np.isfinite(gt).any() else 40,
                        np.nanmin(pr) if np.isfinite(pr).any() else 40])
        hi = np.nanmax([np.nanmax(gt) if np.isfinite(gt).any() else 60,
                        np.nanmax(pr) if np.isfinite(pr).any() else 60])
        ax.set_ylim(max(0, lo - 4), min(C.N_PITCH_CLASSES, hi + 4))
    axes[0, 0].legend(loc="upper right", fontsize=8)
    axes[-1, 0].set_xlabel("time (s)")
    fig.tight_layout()
    out = C.DATA_DIR / "val_eval.png"
    fig.savefig(out, dpi=110)
    print(f"\nsaved plot: {out}")


if __name__ == "__main__":
    main()
