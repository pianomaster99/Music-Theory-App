"""Label-exact pitch-shift augmentation for the FINAL dataset.

The model nails the pitch *contour* on held-out singers (val ±1 semitone ~100%)
but is often off by exactly one semitone (val exact ~76%). That is a pitch/timbre
disentanglement gap: each training singer is only ever heard at their own pitches,
so the net can't separate "which note" from "which voice" on a NEW timbre.

Fix: for every original clip, synthesize pitch-shifted copies (+/- a few semitones)
and shift the labels by the SAME integer number of semitones. Pitch shifting f0 by
k semitones is f0 * 2**(k/12), which moves every piano-key class by exactly k, so
the labels stay exact. This multiplies effective pitch coverage per timbre and
directly attacks the one-semitone confusion.

Singer grouping is preserved (same extra.dataset / singer_id), so the singer-level
train/val split keeps a singer's shifted copies on the same side (no leakage).

Usage:  python pitch_augment.py [--shifts -2 -1 1 2] [--clear]
"""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict

import librosa
import numpy as np
import soundfile as sf

import coarsen as coarsen_mod
import config as C
import dataset_common as dc
import pitch

PS_TAG = "ps"  # variant marker so we can clear/identify pitch-shifted clips


def _is_ps(rec) -> bool:
    return rec.get("extra", {}).get("variant", "").startswith(PS_TAG)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shifts", type=int, nargs="+", default=[-2, -1, 1, 2])
    ap.add_argument("--clear", action="store_true",
                    help="remove existing pitch-shift clips before regenerating")
    args = ap.parse_args()

    rows = dc.read_manifest()
    if args.clear:
        removed = 0
        kept = []
        for r in rows:
            if r.get("method") == "final" and _is_ps(r):
                for rel in (r["audio_path"], r["label_path"]):
                    p = C.ML_DIR / rel
                    if p.exists():
                        p.unlink()
                removed += 1
            else:
                kept.append(r)
        with open(C.MANIFEST_PATH, "w") as fh:
            for r in kept:
                fh.write(json.dumps(r) + "\n")
        rows = kept
        print(f"cleared {removed} existing pitch-shift clips")

    orig = [r for r in rows if r.get("method") == "final"
            and r.get("extra", {}).get("variant") == "orig"]
    print(f"augmenting {len(orig)} original clips with shifts {args.shifts}", flush=True)

    new_records: list = []
    for ri, rec in enumerate(orig):
        base = rec["clip_id"].rsplit("__", 1)[0]
        y, _ = sf.read(C.ML_DIR / rec["audio_path"])
        y = np.asarray(y, dtype=np.float32)
        d = dict(np.load(C.ML_DIR / rec["label_path"]))
        f0, voiced = d["f0"].astype(np.float64), d["voiced"].astype(bool)
        conf = d["conf"] if "conf" in d else voiced.astype(np.float32)
        notes = d["notes"] if "notes" in d else np.zeros((0, 3), np.int32)

        for k in args.shifts:
            ratio = 2.0 ** (k / 12.0)
            y_sh = librosa.effects.pitch_shift(y, sr=C.SR, n_steps=k).astype(np.float32)
            n = len(f0)
            # Shift label pitch by exactly k semitones; drop frames pushed out of range.
            f0_sh = np.where(voiced, f0 * ratio, 0.0)
            cls = pitch.hz_to_class(f0_sh)
            v_sh = voiced & (cls >= 0)
            f0_sh = np.where(v_sh, f0_sh, 0.0).astype(np.float32)
            energy = coarsen_mod.frame_rms(y_sh, n).astype(np.float32)
            # Shift the note list too (clamp out-of-range notes away).
            notes_sh = []
            for s, e, c in np.asarray(notes).reshape(-1, 3):
                c2 = int(c) + k
                if 0 <= c2 < C.N_PITCH_CLASSES:
                    notes_sh.append([int(s), int(e), c2])
            notes_sh = (np.array(notes_sh, dtype=np.int32)
                        if notes_sh else np.zeros((0, 3), np.int32))

            variant = f"{PS_TAG}{k:+d}"
            clip_id = f"{base}__{variant}"
            audio_rel = f"data/final/audio/{clip_id}.wav"
            label_rel = f"data/final/labels/{clip_id}.npz"
            sf.write(C.ML_DIR / audio_rel, y_sh, C.SR, subtype="PCM_16")
            out = {**d}
            out.update(f0=f0_sh, voiced=v_sh,
                       conf=np.asarray(conf, np.float32)[:n],
                       energy=energy, notes=notes_sh)
            np.savez_compressed(C.ML_DIR / label_rel, **out)

            extra = {**rec.get("extra", {}), "variant": variant, "pitch_shift": k}
            vf = float(v_sh.mean()) if n else 0.0
            vhz = f0_sh[v_sh]
            new_records.append(dc.ClipRecord(
                clip_id=clip_id, method="final",
                source=f"final:{rec['extra'].get('dataset','?')}:{variant}",
                license=rec["license"], audio_path=audio_rel, label_path=label_rel,
                duration_s=round(len(y_sh) / C.SR, 4), n_frames=int(n),
                f0_min_hz=float(vhz.min()) if vhz.size else 0.0,
                f0_max_hz=float(vhz.max()) if vhz.size else 0.0,
                voiced_frac=round(vf, 3), augmented=True, extra=extra,
            ))
        if (ri + 1) % 25 == 0:
            print(f"  {ri+1}/{len(orig)} clips", flush=True)

    dc.append_manifest(new_records)
    print(f"added {len(new_records)} pitch-shifted clips "
          f"({len(orig)} x {len(args.shifts)} shifts)")


if __name__ == "__main__":
    main()
