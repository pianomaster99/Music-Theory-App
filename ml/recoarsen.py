"""Re-coarsen existing 'final' labels from saved CREPE output (no CREPE/API rerun).

Lets us iterate on the coarsening rules quickly: it reloads each clip's fine
CREPE arrays + original audio (for volume), reruns the volume-aware deterministic
coarsener, and rewrites the coarse label + notes in place.

Usage:  python recoarsen.py
"""
from __future__ import annotations

import json

import numpy as np
import soundfile as sf

import coarsen as coarsen_mod
import config as C
import dataset_common as dc
import pitch


def main() -> None:
    all_rows = dc.read_manifest()
    rows = [r for r in all_rows if r["method"] == "final"]
    stats: dict[str, tuple[int, float]] = {}
    seen = set()
    for r in rows:
        lbl = r["label_path"]
        if lbl in seen:
            continue
        seen.add(lbl)
        d = dict(np.load(C.ML_DIR / lbl))
        fine_f0, fine_voiced, conf = d["fine_f0"], d["fine_voiced"], d["conf"]
        if "energy" in d:
            energy = d["energy"]
        else:
            base = r["clip_id"].rsplit("__", 1)[0]
            orig = next((x["audio_path"] for x in rows
                         if x["clip_id"] == f"{base}__orig"), r["audio_path"])
            y, _ = sf.read(C.ML_DIR / orig)
            energy = coarsen_mod.frame_rms(np.asarray(y, np.float32), len(fine_f0))

        coarse, notes = coarsen_mod.coarsen_rules(fine_f0, fine_voiced, conf, energy)
        cv = coarse >= 0
        cf0 = np.where(cv, pitch.class_to_hz(np.where(coarse >= 0, coarse, 0)), 0.0).astype(np.float32)
        d.update(f0=cf0, voiced=cv, energy=energy.astype(np.float32),
                 notes=np.array(notes, dtype=np.int32) if notes else np.zeros((0, 3), np.int32))
        np.savez_compressed(C.ML_DIR / lbl, **d)
        stats[lbl] = (len(notes), float(cv.mean()))
        print(f"  {lbl.split('/')[-1]}: {len(notes)} notes, "
              f"coarse voiced {100*cv.mean():.0f}%")

    # sync manifest stats for final rows so the gallery header matches
    for r in all_rows:
        if r["method"] == "final" and r["label_path"] in stats:
            n_notes, cvf = stats[r["label_path"]]
            r["voiced_frac"] = round(cvf, 3)
            r.setdefault("extra", {})
            r["extra"]["n_notes"] = n_notes
            r["extra"]["coarse_voiced_frac"] = round(cvf, 3)
    with open(C.MANIFEST_PATH, "w") as fh:
        for r in all_rows:
            fh.write(json.dumps(r) + "\n")
    print(f"re-coarsened {len(seen)} clips")


if __name__ == "__main__":
    main()
