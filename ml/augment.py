"""Audio augmentation for robustness (used by Methods 2 and 3).

Two layers:
  * waveform-domain (audiomentations): additive noise, reverb, gain/EQ,
    band-limiting, codec artifacts. Real noise/IR corpora are used when present,
    otherwise we fall back to synthetic noise so the pipeline always works offline.
  * label-aware transforms: formant/VTLP shift (pitch-preserving -> labels
    unchanged) and pitch shift (labels scaled with the shift).
  * spectrogram-domain: mild SpecAugment time/frequency masking.

The key invariant for a pitch task: any transform that changes f0 MUST return
updated f0 labels. Helpers here enforce that.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

import config as C

try:
    import librosa
except Exception:  # pragma: no cover
    librosa = None


# --------------------------------------------------------------------------
# Waveform-domain pipeline (label-preserving: no pitch/time change)
# --------------------------------------------------------------------------
@dataclass
class AugmentConfig:
    noise_dir: str | None = None      # dir of noise wavs (e.g. MUSAN/ESC-50)
    ir_dir: str | None = None         # dir of room impulse responses
    p_noise: float = 0.8
    snr_db_range: tuple[float, float] = (0.0, 25.0)
    p_reverb: float = 0.4
    p_gain: float = 0.4
    p_eq: float = 0.3
    p_bandlimit: float = 0.3
    p_codec: float = 0.2
    seed: int | None = None
    _transforms: list = field(default_factory=list, repr=False)


def build_waveform_augment(cfg: AugmentConfig):
    """Build an ``audiomentations.Compose`` from whatever transforms are usable
    in this environment (degrades gracefully)."""
    import audiomentations as A

    tfs: list = []

    # --- additive background noise ---
    noise_added = False
    if cfg.noise_dir and Path(cfg.noise_dir).exists():
        try:
            tfs.append(
                A.AddBackgroundNoise(
                    sounds_path=cfg.noise_dir,
                    min_snr_db=cfg.snr_db_range[0],
                    max_snr_db=cfg.snr_db_range[1],
                    p=cfg.p_noise,
                )
            )
            noise_added = True
        except Exception:
            noise_added = False
    if not noise_added:
        # Synthetic colored noise covers white..pink..brown; no files needed.
        tfs.append(
            A.AddColorNoise(
                min_snr_db=cfg.snr_db_range[0],
                max_snr_db=cfg.snr_db_range[1],
                min_f_decay=-3.01,
                max_f_decay=3.01,
                p=cfg.p_noise,
            )
        )

    # --- reverberation ---
    if cfg.ir_dir and Path(cfg.ir_dir).exists():
        try:
            tfs.append(A.ApplyImpulseResponse(ir_path=cfg.ir_dir, p=cfg.p_reverb))
        except Exception:
            pass

    # --- gain / EQ / band-limit / codec ---
    if cfg.p_gain > 0:
        tfs.append(A.Gain(min_gain_db=-12.0, max_gain_db=6.0, p=cfg.p_gain))
    if cfg.p_eq > 0:
        try:
            tfs.append(A.SevenBandParametricEQ(min_gain_db=-8.0, max_gain_db=8.0, p=cfg.p_eq))
        except Exception:
            pass
    if cfg.p_bandlimit > 0:
        try:
            tfs.append(
                A.BandPassFilter(min_center_freq=200.0, max_center_freq=4000.0, p=cfg.p_bandlimit)
            )
        except Exception:
            pass
    if cfg.p_codec > 0:
        try:
            codec = A.Mp3Compression(min_bitrate=16, max_bitrate=64, p=1.0)
            # Self-test: the optional MP3 backend may be missing in some envs.
            codec(samples=np.zeros(C.SR, dtype=np.float32), sample_rate=C.SR)
            codec.p = cfg.p_codec
            tfs.append(codec)
        except Exception:
            pass  # MP3 backend not available -> skip codec augmentation

    compose = A.Compose(transforms=tfs)
    if cfg.seed is not None:
        try:
            compose.set_seed(cfg.seed)  # available in newer audiomentations
        except Exception:
            pass
    return compose


def apply_waveform_augment(compose, y: np.ndarray) -> np.ndarray:
    out = compose(samples=np.asarray(y, dtype=np.float32), sample_rate=C.SR)
    return out.astype(np.float32)


def build_background_augment(snr_db_range: tuple[float, float] = (3.0, 15.0),
                             noise_dir: str | None = None, seed: int | None = None):
    """A dedicated 'background noise' pipeline (one noise type, always applied).

    Uses a real noise corpus if ``noise_dir`` is given, else synthetic
    pink/brown-ish ambient noise at the given SNR. Pitch is unchanged, so labels
    stay valid.
    """
    import audiomentations as A

    if noise_dir and Path(noise_dir).exists():
        try:
            tf = A.AddBackgroundNoise(sounds_path=noise_dir,
                                      min_snr_db=snr_db_range[0],
                                      max_snr_db=snr_db_range[1], p=1.0)
        except Exception:
            tf = None
    else:
        tf = None
    if tf is None:
        # Pink/brown ambient (positive f_decay = energy concentrated low -> "rumble/room").
        tf = A.AddColorNoise(min_snr_db=snr_db_range[0], max_snr_db=snr_db_range[1],
                             min_f_decay=1.0, max_f_decay=3.01, p=1.0)
    compose = A.Compose(transforms=[tf])
    if seed is not None:
        try:
            compose.set_seed(seed)
        except Exception:
            pass
    return compose


# --------------------------------------------------------------------------
# Label-aware transforms
# --------------------------------------------------------------------------
def pitch_shift_with_labels(y: np.ndarray, f0_hz: np.ndarray, semitones: float):
    """Pitch-shift audio and scale the f0 labels by the same ratio.

    Returns ``(y_shifted, f0_shifted)``. Unvoiced frames (f0<=0) stay 0.
    """
    if librosa is None or abs(semitones) < 1e-6:
        return y, f0_hz
    y_shift = librosa.effects.pitch_shift(
        np.asarray(y, dtype=np.float32), sr=C.SR, n_steps=semitones
    )
    ratio = 2.0 ** (semitones / 12.0)
    f0_shift = np.where(np.asarray(f0_hz) > 0, np.asarray(f0_hz) * ratio, 0.0)
    return y_shift.astype(np.float32), f0_shift.astype(np.float32)


def formant_shift(y: np.ndarray, factor: float) -> np.ndarray:
    """Pitch-preserving formant/VTLP shift (labels unchanged).

    Trick: resample by ``factor`` (shifts pitch + formants), then pitch-shift
    back by ``-factor`` so f0 is restored but the spectral envelope (formants)
    stays shifted. ``factor`` ~ vocal-tract-length ratio (>1 = smaller tract /
    more child-like).
    """
    if librosa is None or abs(factor - 1.0) < 1e-3:
        return y
    y = np.asarray(y, dtype=np.float32)
    n = len(y)
    # Resample to change pitch+formants, then restore length and pitch.
    stretched = librosa.resample(y, orig_sr=C.SR, target_sr=int(C.SR * factor))
    semis = -12.0 * np.log2(factor)
    restored = librosa.effects.pitch_shift(stretched, sr=C.SR, n_steps=semis)
    if len(restored) >= n:
        return restored[:n].astype(np.float32)
    return np.pad(restored, (0, n - len(restored))).astype(np.float32)


# --------------------------------------------------------------------------
# Spectrogram-domain (SpecAugment) -- mild, for training time
# --------------------------------------------------------------------------
def spec_augment(
    log_mel: np.ndarray,
    n_time_masks: int = 1,
    n_freq_masks: int = 1,
    max_time: int = 8,
    max_freq: int = 12,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Apply mild time/frequency masking to a ``(T, n_mels)`` log-mel array.

    Kept mild on purpose: masking the band containing the fundamental can erase
    the very cue we need, so freq masks are small.
    """
    rng = rng or np.random.default_rng()
    out = np.array(log_mel, dtype=np.float32, copy=True)
    T, M = out.shape
    fill = float(out.mean())
    for _ in range(n_time_masks):
        w = int(rng.integers(0, max_time + 1))
        if w and T - w > 0:
            t0 = int(rng.integers(0, T - w))
            out[t0 : t0 + w, :] = fill
    for _ in range(n_freq_masks):
        w = int(rng.integers(0, max_freq + 1))
        if w and M - w > 0:
            f0 = int(rng.integers(0, M - w))
            out[:, f0 : f0 + w] = fill
    return out
