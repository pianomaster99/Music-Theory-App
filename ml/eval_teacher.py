"""Evaluate the Method-3 teacher (the 'AI agent' labeler) against ground truth.

Runs the teacher on vocadito clips -- which ship human-corrected frame-level f0 --
and reports how good the pseudo-labels are, in the DISCRETE 88-piano-key scheme:

  * Voicing accuracy / precision / recall (is a note being sung?)
  * Exact piano-key accuracy (pred key == GT key) on GT-voiced frames
  * Raw Pitch Accuracy @50 cents (within half a semitone)
  * Chroma accuracy (octave-insensitive)
  * Mean absolute cents error

Usage:
    python eval_teacher.py [--teacher crepe|pyin] [--model full|tiny] [--max-clips 20]
"""
from __future__ import annotations

import argparse
import json
import time

import numpy as np

import config as C
import datasets_real
import distill
import pitch


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--teacher", choices=["crepe", "pyin"], default="crepe")
    ap.add_argument("--model", default="full", help="crepe model: full|tiny")
    ap.add_argument("--max-clips", type=int, default=20)
    ap.add_argument("--conf", type=float, default=0.5)
    ap.add_argument("--segment-s", type=float, default=4.0)
    args = ap.parse_args()

    kw = {"conf_threshold": args.conf}
    if args.teacher == "crepe":
        kw["model"] = args.model
    teacher, name = distill.make_teacher(args.teacher, **kw)
    print(f"teacher = {name}", flush=True)

    # Accumulators (frame-weighted).
    vt = vf = ft = ff = 0          # voicing confusion: gt voiced/unvoiced x pred
    tp = fp = fn = tn = 0
    n_both = 0                      # frames voiced in BOTH gt and pred
    exact = rpa50 = chroma = 0
    cents_err_sum = 0.0
    n_gt_voiced = 0

    t0 = time.time()
    n = 0
    for clip in datasets_real.vocadito_clips(segment_s=args.segment_s, stride_s=args.segment_s):
        if n >= args.max_clips:
            break
        f0_gt, v_gt = clip.f0, clip.voiced
        f0_pr, conf, v_pr = teacher.label(clip.audio)
        T = min(len(f0_gt), len(f0_pr))
        f0_gt, v_gt, f0_pr, v_pr = f0_gt[:T], v_gt[:T], f0_pr[:T], v_pr[:T]

        # voicing confusion
        tp += int(np.sum(v_gt & v_pr))
        fp += int(np.sum(~v_gt & v_pr))
        fn += int(np.sum(v_gt & ~v_pr))
        tn += int(np.sum(~v_gt & ~v_pr))

        # pitch metrics on GT-voiced frames
        gv = v_gt & (f0_gt > 0)
        n_gt_voiced += int(gv.sum())
        both = gv & v_pr & (f0_pr > 0)
        if both.any():
            midi_gt = pitch.hz_to_midi(f0_gt[both])
            midi_pr = pitch.hz_to_midi(f0_pr[both])
            cls_gt = np.round(midi_gt)
            cls_pr = np.round(midi_pr)
            exact += int(np.sum(cls_gt == cls_pr))
            d = np.abs(midi_gt - midi_pr)
            rpa50 += int(np.sum(d <= 0.5))
            chroma += int(np.sum((cls_gt - cls_pr) % 12 == 0))
            cents_err_sum += float(np.sum(d * 100.0))
            n_both += int(both.sum())
        n += 1
        if n % 5 == 0:
            print(f"  {n} clips ({time.time()-t0:.0f}s)", flush=True)

    total = tp + fp + fn + tn
    res = {
        "teacher": name,
        "clips": n,
        "frames": total,
        "voicing_accuracy": round((tp + tn) / max(1, total), 3),
        "voicing_precision": round(tp / max(1, tp + fp), 3),
        "voicing_recall": round(tp / max(1, tp + fn), 3),
        "gt_voiced_frames": n_gt_voiced,
        "scored_frames(both_voiced)": n_both,
        "exact_key_acc": round(exact / max(1, n_both), 3),
        "raw_pitch_acc_50cents": round(rpa50 / max(1, n_both), 3),
        "chroma_acc": round(chroma / max(1, n_both), 3),
        "mean_abs_cents_err": round(cents_err_sum / max(1, n_both), 1),
        "seconds": round(time.time() - t0, 1),
    }
    print("\n=== Teacher labeling quality vs vocadito ground truth ===")
    for k, v in res.items():
        print(f"  {k}: {v}")
    out = C.DATA_DIR / "teacher_eval.json"
    C.DATA_DIR.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=2))
    print(f"\nsaved {out}")


if __name__ == "__main__":
    main()
