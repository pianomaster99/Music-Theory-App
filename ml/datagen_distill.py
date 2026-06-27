"""Method 3 driver: real *unlabeled* vocals + AI (teacher) labeling + augmentation.

Uses vocadito audio as the unlabeled pool but a DISJOINT track range from
Method 2 (so the ground-truth labels are never used and there's no leakage). A
CREPE 'full' teacher produces pseudo f0 + confidence; low-confidence frames are
dropped. Each clip is saved clean + noised variants.

Usage:
    python datagen_distill.py [--max-clips 120] [--teacher crepe|pyin]
                              [--track-start 24] [--conf 0.5] [--clear]
"""
from __future__ import annotations

import argparse
import time

import numpy as np

import augment
import config as C
import dataset_common as dc
import datasets_real
import distill


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate distilled pseudo-labeled data (Method 3)")
    ap.add_argument("--max-clips", type=int, default=120, help="max CLEAN clips kept")
    ap.add_argument("--aug-per-clip", type=int, default=1)
    ap.add_argument("--teacher", choices=["crepe", "pyin"], default="crepe")
    ap.add_argument("--conf", type=float, default=0.5, help="teacher confidence gate")
    ap.add_argument("--segment-s", type=float, default=4.0)
    ap.add_argument("--stride-s", type=float, default=3.0)
    ap.add_argument("--track-start", type=int, default=24,
                    help="use vocadito tracks from here on as the unlabeled pool")
    ap.add_argument("--noise-dir", type=str, default=None)
    ap.add_argument("--ir-dir", type=str, default=None)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--clear", action="store_true")
    args = ap.parse_args()

    C.ensure_dirs()
    if args.clear:
        dc.clear_method("distilled")

    teacher, teacher_name = distill.make_teacher(args.teacher, conf_threshold=args.conf)
    print(f"  teacher: {teacher_name}", flush=True)

    aug_cfg = augment.AugmentConfig(noise_dir=args.noise_dir, ir_dir=args.ir_dir, seed=args.seed)
    compose = augment.build_waveform_augment(aug_cfg)

    records = []
    n_clean = 0
    t0 = time.time()
    segs = datasets_real.vocadito_audio_segments(
        segment_s=args.segment_s, stride_s=args.stride_s, track_start=args.track_start
    )
    for clip_id, audio, meta in segs:
        if n_clean >= args.max_clips:
            break
        f0, conf, voiced = teacher.label(audio)
        if voiced.mean() < 0.05:
            continue  # teacher found ~no pitched content; skip

        cid = f"distill_{clip_id}"
        extra = {**meta, "teacher": teacher_name,
                 "teacher_conf_mean": round(float(conf[voiced].mean()) if voiced.any() else 0.0, 3)}
        records.append(dc.save_clip(
            cid, "distilled", audio, f0, voiced,
            source=f"distill:vocadito:{teacher_name}", license="CC BY 4.0 (audio) + pseudo-labels",
            conf=conf, augmented=False, extra=extra,
        ))
        n_clean += 1
        for j in range(args.aug_per_clip):
            ya = augment.apply_waveform_augment(compose, audio)
            records.append(dc.save_clip(
                f"{cid}_aug{j}", "distilled", ya, f0, voiced,
                source=f"distill:vocadito:{teacher_name}+aug",
                license="CC BY 4.0 (audio) + pseudo-labels",
                conf=conf, augmented=True, extra={**extra, "aug": True},
            ))
        if n_clean % 10 == 0:
            print(f"  [{teacher_name}] {n_clean} clean clips "
                  f"({time.time() - t0:.0f}s)", flush=True)

    dc.append_manifest(records)
    dur = sum(r.duration_s for r in records)
    print(f"Method 3 (distilled): {len(records)} clips ({n_clean} clean), "
          f"{dur / 60:.1f} min audio, {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
