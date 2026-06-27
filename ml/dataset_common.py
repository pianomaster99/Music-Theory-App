"""Common on-disk dataset format shared by all three generation methods.

Each clip is stored as:
  data/<method>/audio/<clip_id>.wav        16 kHz mono float32
  data/<method>/labels/<clip_id>.npz       f0 (Hz), voiced (bool), conf (0..1)
                                           all on the 10 ms frame grid

and appended as one JSON line to data/manifest.jsonl. The frame grid length is
``features.n_frames_for(num_samples)`` so labels align with the log-mel frames.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from pathlib import Path

import numpy as np
import soundfile as sf

import config as C
import features


@dataclass
class ClipRecord:
    clip_id: str
    method: str            # one of config.METHODS
    source: str            # e.g. "synthetic:vowel_a", "vocadito", "distill:vocalset"
    license: str
    audio_path: str        # relative to ML_DIR
    label_path: str        # relative to ML_DIR
    duration_s: float
    n_frames: int
    f0_min_hz: float
    f0_max_hz: float
    voiced_frac: float
    augmented: bool
    extra: dict


def resample_f0_to_grid(
    times: np.ndarray,
    f0_hz: np.ndarray,
    num_samples: int,
    voiced: np.ndarray | None = None,
):
    """Resample an (times, f0) annotation onto our 10 ms frame grid.

    ``times`` are seconds for each given f0 value. Returns ``(f0_grid, voiced_grid)``
    of length ``features.n_frames_for(num_samples)``. Unvoiced (f0<=0) is kept as 0.
    Nearest-neighbour mapping avoids interpolating across voiced/unvoiced edges.
    """
    n = features.n_frames_for(num_samples)
    grid_t = np.arange(n) * (C.HOP_LENGTH / C.SR)
    f0_hz = np.asarray(f0_hz, dtype=np.float64)
    times = np.asarray(times, dtype=np.float64)
    if voiced is None:
        voiced = f0_hz > 0
    voiced = np.asarray(voiced, dtype=bool)

    if len(times) == 0:
        return np.zeros(n), np.zeros(n, dtype=bool)

    order = np.argsort(times)
    times, f0_hz, voiced = times[order], f0_hz[order], voiced[order]
    idx = np.searchsorted(times, grid_t)
    idx = np.clip(idx, 0, len(times) - 1)
    # Snap to the closer of idx and idx-1.
    left = np.clip(idx - 1, 0, len(times) - 1)
    choose_left = np.abs(times[left] - grid_t) < np.abs(times[idx] - grid_t)
    nn = np.where(choose_left, left, idx)

    f0_grid = np.where(voiced[nn], f0_hz[nn], 0.0)
    voiced_grid = voiced[nn] & (f0_grid > 0)
    return f0_grid, voiced_grid


def save_clip(
    clip_id: str,
    method: str,
    audio: np.ndarray,
    f0_hz: np.ndarray,
    voiced: np.ndarray,
    *,
    source: str,
    license: str,
    conf: np.ndarray | None = None,
    augmented: bool = False,
    extra: dict | None = None,
) -> ClipRecord:
    """Write audio + labels to disk and return a manifest record (not yet written)."""
    audio = np.asarray(audio, dtype=np.float32)
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 1.0:
        audio = audio / peak

    audio_rel = Path("data") / method / "audio" / f"{clip_id}.wav"
    label_rel = Path("data") / method / "labels" / f"{clip_id}.npz"
    (C.ML_DIR / audio_rel).parent.mkdir(parents=True, exist_ok=True)
    (C.ML_DIR / label_rel).parent.mkdir(parents=True, exist_ok=True)

    sf.write(C.ML_DIR / audio_rel, audio, C.SR, subtype="PCM_16")

    f0_hz = np.asarray(f0_hz, dtype=np.float32)
    voiced = np.asarray(voiced, dtype=bool)
    if conf is None:
        conf = voiced.astype(np.float32)
    np.savez_compressed(
        C.ML_DIR / label_rel,
        f0=f0_hz,
        voiced=voiced,
        conf=np.asarray(conf, dtype=np.float32),
    )

    voiced_f0 = f0_hz[voiced & (f0_hz > 0)]
    return ClipRecord(
        clip_id=clip_id,
        method=method,
        source=source,
        license=license,
        audio_path=str(audio_rel),
        label_path=str(label_rel),
        duration_s=round(len(audio) / C.SR, 4),
        n_frames=int(len(f0_hz)),
        f0_min_hz=float(voiced_f0.min()) if voiced_f0.size else 0.0,
        f0_max_hz=float(voiced_f0.max()) if voiced_f0.size else 0.0,
        voiced_frac=float(voiced.mean()) if voiced.size else 0.0,
        augmented=augmented,
        extra=extra or {},
    )


def append_manifest(records: list[ClipRecord]) -> None:
    C.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(C.MANIFEST_PATH, "a") as fh:
        for r in records:
            fh.write(json.dumps(asdict(r)) + "\n")


def read_manifest() -> list[dict]:
    if not C.MANIFEST_PATH.exists():
        return []
    with open(C.MANIFEST_PATH) as fh:
        return [json.loads(line) for line in fh if line.strip()]


def load_labels(label_path: str):
    d = np.load(C.ML_DIR / label_path)
    return d["f0"], d["voiced"], d["conf"]


def clear_method(method: str) -> None:
    """Remove a method's clips from disk and prune it from the manifest."""
    import shutil

    method_dir = C.DATA_DIR / method
    if method_dir.exists():
        shutil.rmtree(method_dir)
    (method_dir / "audio").mkdir(parents=True, exist_ok=True)
    (method_dir / "labels").mkdir(parents=True, exist_ok=True)

    rows = [r for r in read_manifest() if r.get("method") != method]
    with open(C.MANIFEST_PATH, "w") as fh:
        for r in rows:
            fh.write(json.dumps(r) + "\n")
