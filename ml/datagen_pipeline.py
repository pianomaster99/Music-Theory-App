"""Updated data-generation pipeline (spec 'Updated Data Generation Plan').

For each unlabeled audio clip:
  1. make robustness variations: original + general-aug + background-noise
     (noise does NOT change pitch, so all variations share one label);
  2. label the clean original with CREPE (fine, per-frame f0 + confidence);
  3. coarsen the fine labels with an AI agent (OpenAI) -> clean, stable notes
     (wavers/transitions removed; a pitch must hold >= MIN_FRAMES to count);
  4. write the variations + the shared FINAL (coarse) label to data/final/ and
     the manifest (method='final').

This is the lazy "first batch" - rerun with a larger --clips / track range to
add more data when training loss isn't low enough.

Usage:
    python datagen_pipeline.py --clips 12 --coarsen llm [--clear]
"""
from __future__ import annotations

import argparse
import json
import time
from dataclasses import asdict

import numpy as np
import soundfile as sf

import augment
import coarsen as coarsen_mod
import config as C
import dataset_common as dc
import datasets_real
import distill
import pitch


def _save(clip_id, variant, audio, label_rel, source, license, extra):
    audio = np.asarray(audio, dtype=np.float32)
    peak = float(np.max(np.abs(audio))) or 1.0
    if peak > 1.0:
        audio = audio / peak
    audio_rel = f"data/final/audio/{clip_id}__{variant}.wav"
    (C.ML_DIR / audio_rel).parent.mkdir(parents=True, exist_ok=True)
    sf.write(C.ML_DIR / audio_rel, audio, C.SR, subtype="PCM_16")
    return dc.ClipRecord(
        clip_id=f"{clip_id}__{variant}", method="final", source=f"{source}:{variant}",
        license=license, audio_path=audio_rel, label_path=label_rel,
        duration_s=round(len(audio) / C.SR, 4), n_frames=int(extra["n_frames"]),
        f0_min_hz=extra["f0_min"], f0_max_hz=extra["f0_max"],
        voiced_frac=extra["coarse_voiced_frac"], augmented=(variant != "orig"),
        extra={**extra, "variant": variant},
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clips", type=int, default=12)
    ap.add_argument("--source", choices=list(datasets_real.UNLABELED_SOURCES),
                    default="vocadito")
    ap.add_argument("--coarsen", choices=["llm", "rules"], default="llm")
    ap.add_argument("--coarsen-model", default="gpt-5.5")
    ap.add_argument("--teacher", choices=["crepe", "pyin"], default="crepe")
    ap.add_argument("--conf", type=float, default=0.4)
    ap.add_argument("--segment-s", type=float, default=4.0)
    ap.add_argument("--track-start", type=int, default=0)
    ap.add_argument("--noise-dir", type=str, default=None)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--clear", action="store_true")
    args = ap.parse_args()

    C.ensure_dirs()
    (C.DATA_DIR / "final" / "audio").mkdir(parents=True, exist_ok=True)
    (C.DATA_DIR / "final" / "labels").mkdir(parents=True, exist_ok=True)
    if args.clear:
        dc.clear_method("final")

    teacher, tname = distill.make_teacher(args.teacher, conf_threshold=args.conf)
    print(f"teacher={tname}  coarsen={args.coarsen}({args.coarsen_model})", flush=True)

    gen_aug = augment.build_waveform_augment(
        augment.AugmentConfig(noise_dir=args.noise_dir, p_noise=0.7,
                              snr_db_range=(10.0, 25.0), p_reverb=0.3, seed=args.seed))
    bg_aug = augment.build_background_augment(noise_dir=args.noise_dir, seed=args.seed)

    records = []
    n = 0
    t0 = time.time()
    src_fn = datasets_real.UNLABELED_SOURCES[args.source]
    print(f"source={args.source} (skip first {args.track_start})", flush=True)
    segs = src_fn(segment_s=args.segment_s, stride_s=args.segment_s, track_start=args.track_start)
    for clip_id_raw, audio, meta in segs:
        if n >= args.clips:
            break
        # 2. fine CREPE labels on the clean original
        f0, conf, voiced = teacher.label(audio)
        if voiced.mean() < 0.05:
            continue
        # 3. AI coarsening -> final clean notes (volume-aware)
        energy = coarsen_mod.frame_rms(audio, len(f0))
        coarse, notes = coarsen_mod.coarsen(f0, voiced, conf, energy,
                                            method=args.coarsen, model=args.coarsen_model,
                                            conf_thresh=args.conf)
        coarse_voiced = coarse >= 0
        coarse_f0 = np.where(coarse_voiced, pitch.class_to_hz(np.where(coarse >= 0, coarse, 0)), 0.0)
        coarse_f0 = coarse_f0.astype(np.float32)

        clip_id = f"final_{clip_id_raw}"
        label_rel = f"data/final/labels/{clip_id}.npz"
        np.savez_compressed(
            C.ML_DIR / label_rel,
            f0=coarse_f0, voiced=coarse_voiced, conf=conf.astype(np.float32),
            fine_f0=f0.astype(np.float32), fine_voiced=voiced, energy=energy.astype(np.float32),
            notes=np.array(notes, dtype=np.int32) if notes else np.zeros((0, 3), np.int32),
        )
        vf0 = coarse_f0[coarse_voiced]
        extra = {
            **meta, "teacher": tname, "coarsen": args.coarsen, "n_notes": len(notes),
            "n_frames": int(len(coarse_f0)),
            "fine_voiced_frac": round(float(voiced.mean()), 3),
            "coarse_voiced_frac": round(float(coarse_voiced.mean()), 3),
            "f0_min": float(vf0.min()) if vf0.size else 0.0,
            "f0_max": float(vf0.max()) if vf0.size else 0.0,
        }
        license = f"{args.source} audio + CREPE+AI pseudo-labels"
        src_tag = f"final:{args.source}"

        # 1. variations (share the same label)
        records.append(_save(clip_id, "orig", audio, label_rel, src_tag, license, extra))
        records.append(_save(clip_id, "aug", augment.apply_waveform_augment(gen_aug, audio),
                             label_rel, src_tag, license, extra))
        records.append(_save(clip_id, "bg", augment.apply_waveform_augment(bg_aug, audio),
                             label_rel, src_tag, license, extra))
        n += 1
        print(f"  [{n}/{args.clips}] {clip_id}: {len(notes)} notes, "
              f"fine {extra['fine_voiced_frac']*100:.0f}% -> coarse "
              f"{extra['coarse_voiced_frac']*100:.0f}% voiced ({time.time()-t0:.0f}s)", flush=True)

    dc.append_manifest(records)
    print(f"\nMethod 'final': {len(records)} clips ({n} sources x 3 variations), "
          f"{sum(r.duration_s for r in records)/60:.1f} min, {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
