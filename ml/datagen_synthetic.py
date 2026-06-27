"""Method 1 driver: generate synthetic singing clips with exact f0 labels.

Usage:
    python datagen_synthetic.py --clips 200 [--seed 0] [--clear]
"""
from __future__ import annotations

import argparse
import time

import numpy as np

import config as C
import dataset_common as dc
import synth

LICENSE = "synthetic (generated, no restrictions)"


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate synthetic singing data (Method 1)")
    ap.add_argument("--clips", type=int, default=200)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--clear", action="store_true", help="wipe existing synthetic clips first")
    args = ap.parse_args()

    C.ensure_dirs()
    if args.clear:
        dc.clear_method("synthetic")

    rng = np.random.default_rng(args.seed)
    records = []
    t0 = time.time()
    for i in range(args.clips):
        audio, f0, voiced, meta = synth.synthesize_clip(rng)
        clip_id = f"synth_{i:05d}"
        rec = dc.save_clip(
            clip_id, "synthetic", audio, f0, voiced,
            source=f"synthetic:{meta['voice']}:{meta['vowel']}",
            license=LICENSE,
            conf=voiced.astype("float32"),
            augmented=False,
            extra=meta,
        )
        records.append(rec)
        if (i + 1) % 25 == 0 or i + 1 == args.clips:
            print(f"  [{i + 1}/{args.clips}] clips generated", flush=True)

    dc.append_manifest(records)
    dur = sum(r.duration_s for r in records)
    print(f"Method 1 (synthetic): {len(records)} clips, {dur / 60:.1f} min audio, "
          f"{time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
