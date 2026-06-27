"""Method 2 driver: real labeled datasets + noise augmentation.

For each labeled clip we save the clean version and one or more noised/reverbed
variants (spec: "add noise to make the dataset more robust"). f0 labels are
preserved because the waveform augmentations here do not change pitch/timing.

Usage:
    python datagen_real.py [--max-clips 120] [--aug-per-clip 1] [--clear]
                           [--noise-dir DIR] [--ir-dir DIR]
"""
from __future__ import annotations

import argparse
import time

import numpy as np

import augment
import config as C
import dataset_common as dc
import datasets_real


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate real labeled data (Method 2)")
    ap.add_argument("--max-clips", type=int, default=120, help="max CLEAN clips kept")
    ap.add_argument("--aug-per-clip", type=int, default=1, help="noised variants per clean clip")
    ap.add_argument("--segment-s", type=float, default=4.0)
    ap.add_argument("--stride-s", type=float, default=3.0)
    ap.add_argument("--noise-dir", type=str, default=None)
    ap.add_argument("--ir-dir", type=str, default=None)
    ap.add_argument("--sources", nargs="*", default=["vocadito"])
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--clear", action="store_true")
    args = ap.parse_args()

    C.ensure_dirs()
    if args.clear:
        dc.clear_method("real_labeled")

    rng = np.random.default_rng(args.seed)
    aug_cfg = augment.AugmentConfig(noise_dir=args.noise_dir, ir_dir=args.ir_dir, seed=args.seed)
    compose = augment.build_waveform_augment(aug_cfg)

    records = []
    n_clean = 0
    t0 = time.time()
    for src in args.sources:
        if src not in datasets_real.REAL_SOURCES:
            print(f"  ! unknown source '{src}', skipping")
            continue
        loader = datasets_real.REAL_SOURCES[src]
        try:
            gen = loader(segment_s=args.segment_s, stride_s=args.stride_s)
            for clip in gen:
                if n_clean >= args.max_clips:
                    break
                # clean
                records.append(dc.save_clip(
                    clip.clip_id, "real_labeled", clip.audio, clip.f0, clip.voiced,
                    source=clip.source, license=clip.license,
                    conf=clip.voiced.astype("float32"), augmented=False, extra=clip.meta,
                ))
                n_clean += 1
                # noised variants
                for j in range(args.aug_per_clip):
                    ya = augment.apply_waveform_augment(compose, clip.audio)
                    records.append(dc.save_clip(
                        f"{clip.clip_id}_aug{j}", "real_labeled", ya, clip.f0, clip.voiced,
                        source=clip.source + "+aug", license=clip.license,
                        conf=clip.voiced.astype("float32"), augmented=True,
                        extra={**clip.meta, "aug": True},
                    ))
                if n_clean % 20 == 0:
                    print(f"  [{src}] {n_clean} clean clips", flush=True)
        except Exception as e:
            print(f"  ! source '{src}' failed: {type(e).__name__}: {e}")

    dc.append_manifest(records)
    dur = sum(r.duration_s for r in records)
    print(f"Method 2 (real_labeled): {len(records)} clips ({n_clean} clean), "
          f"{dur / 60:.1f} min audio, {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
