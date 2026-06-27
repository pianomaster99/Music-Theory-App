"""Method 3 teacher: pseudo-label unlabeled vocals with a strong pitch model.

We distil a powerful teacher (CREPE 'full' via torchcrepe) into pseudo f0 labels
for unlabeled audio, so a future lightweight student can be trained on far more
data than the small hand-labeled corpora provide. pYIN (librosa) is a no-torch
fallback teacher.

All outputs are aligned to the project 10 ms frame grid.
"""
from __future__ import annotations

import numpy as np

import config as C
import features


def _to_grid(values: np.ndarray, num_samples: int, fill: float = 0.0) -> np.ndarray:
    """Trim/pad a per-frame teacher output to ``n_frames_for(num_samples)``."""
    n = features.n_frames_for(num_samples)
    out = np.full(n, fill, dtype=np.float32)
    m = min(n, len(values))
    out[:m] = values[:m]
    return out


class CrepeTeacher:
    """torchcrepe-based teacher. ``model='full'`` is the strong/slow setting."""

    def __init__(self, model: str = "full", fmin: float = 55.0, fmax: float = 1100.0,
                 conf_threshold: float = 0.5, device: str | None = None, batch_size: int = 512):
        import torch  # noqa: F401
        self.model = model
        self.fmin = fmin
        self.fmax = fmax
        self.conf_threshold = conf_threshold
        self.batch_size = batch_size
        self.device = device or "cpu"

    def label(self, audio16: np.ndarray):
        import torch
        import torchcrepe

        y = torch.tensor(np.asarray(audio16, dtype=np.float32))[None]
        pitch, periodicity = torchcrepe.predict(
            y, C.SR, hop_length=C.HOP_LENGTH,
            fmin=self.fmin, fmax=self.fmax, model=self.model,
            return_periodicity=True, device=self.device, batch_size=self.batch_size,
        )
        # Light cleanup: median filter + silence/periodicity gating (torchcrepe API).
        try:
            periodicity = torchcrepe.filter.median(periodicity, 3)
            pitch = torchcrepe.filter.mean(pitch, 3)
            pitch = torchcrepe.threshold.At(self.conf_threshold)(pitch, periodicity)
        except Exception:
            pass

        f0 = pitch[0].cpu().numpy().astype(np.float32)
        conf = periodicity[0].cpu().numpy().astype(np.float32)
        f0 = np.nan_to_num(f0, nan=0.0)

        f0 = _to_grid(f0, len(audio16))
        conf = _to_grid(conf, len(audio16))
        voiced = (conf >= self.conf_threshold) & (f0 >= C.F0_FLOOR_HZ) & (f0 <= C.F0_CEIL_HZ)
        f0 = np.where(voiced, f0, 0.0).astype(np.float32)
        return f0, conf, voiced


class PyinTeacher:
    """librosa pYIN fallback teacher (no torch/torchaudio needed)."""

    def __init__(self, fmin: float = 65.0, fmax: float = 1100.0, conf_threshold: float = 0.5):
        self.fmin = fmin
        self.fmax = fmax
        self.conf_threshold = conf_threshold

    def label(self, audio16: np.ndarray):
        import librosa

        f0, voiced_flag, voiced_prob = librosa.pyin(
            np.asarray(audio16, dtype=np.float32), sr=C.SR,
            fmin=self.fmin, fmax=self.fmax,
            frame_length=C.WIN_LENGTH, hop_length=C.HOP_LENGTH, center=True,
        )
        f0 = np.nan_to_num(f0, nan=0.0).astype(np.float32)
        conf = np.nan_to_num(voiced_prob, nan=0.0).astype(np.float32)
        f0 = _to_grid(f0, len(audio16))
        conf = _to_grid(conf, len(audio16))
        voiced = (conf >= self.conf_threshold) & (f0 >= C.F0_FLOOR_HZ) & (f0 <= C.F0_CEIL_HZ)
        f0 = np.where(voiced, f0, 0.0).astype(np.float32)
        return f0, conf, voiced


def make_teacher(prefer: str = "crepe", **kw):
    """Return a teacher, falling back to pYIN if CREPE/torch is unavailable."""
    if prefer == "crepe":
        try:
            return CrepeTeacher(**kw), "crepe_full"
        except Exception as e:  # pragma: no cover
            print(f"  ! CREPE unavailable ({e}); falling back to pYIN")
    return PyinTeacher(**{k: v for k, v in kw.items()
                          if k in ("fmin", "fmax", "conf_threshold")}), "pyin"
