"""Self-contained NumPy log-mel spectrogram front-end.

Deliberately dependency-light (NumPy only) and written so the exact same math
can later be reimplemented in TypeScript for in-browser inference. Frame timing
matches ``config`` (1024-sample window, 160-sample hop -> 100 frames/s).
"""
from __future__ import annotations

import numpy as np

import config as C

_MEL_FB_CACHE: dict[tuple, np.ndarray] = {}
_WINDOW_CACHE: dict[int, np.ndarray] = {}


def _hz_to_mel(hz: np.ndarray) -> np.ndarray:
    return 2595.0 * np.log10(1.0 + hz / 700.0)


def _mel_to_hz(mel: np.ndarray) -> np.ndarray:
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


def mel_filterbank(
    sr: int = C.SR,
    n_fft: int = C.N_FFT,
    n_mels: int = C.N_MELS,
    fmin: float = C.FMIN,
    fmax: float = C.FMAX,
) -> np.ndarray:
    """Slaney-style triangular mel filterbank, shape ``(n_mels, n_fft//2+1)``."""
    key = (sr, n_fft, n_mels, fmin, fmax)
    if key in _MEL_FB_CACHE:
        return _MEL_FB_CACHE[key]

    n_bins = n_fft // 2 + 1
    fft_freqs = np.linspace(0, sr / 2, n_bins)
    mel_pts = np.linspace(_hz_to_mel(np.array(fmin)), _hz_to_mel(np.array(fmax)), n_mels + 2)
    hz_pts = _mel_to_hz(mel_pts)

    fb = np.zeros((n_mels, n_bins), dtype=np.float32)
    for m in range(n_mels):
        lo, ctr, hi = hz_pts[m], hz_pts[m + 1], hz_pts[m + 2]
        left = (fft_freqs - lo) / max(ctr - lo, 1e-9)
        right = (hi - fft_freqs) / max(hi - ctr, 1e-9)
        tri = np.maximum(0.0, np.minimum(left, right))
        # Slaney normalization (equal area).
        enorm = 2.0 / max(hi - lo, 1e-9)
        fb[m] = (tri * enorm).astype(np.float32)
    _MEL_FB_CACHE[key] = fb
    return fb


def mel_center_freqs(
    sr: int = C.SR, n_mels: int = C.N_MELS, fmin: float = C.FMIN, fmax: float = C.FMAX
) -> np.ndarray:
    """Centre frequency (Hz) of each mel band -- handy for plotting f0 overlays."""
    mel_pts = np.linspace(_hz_to_mel(np.array(fmin)), _hz_to_mel(np.array(fmax)), n_mels + 2)
    return _mel_to_hz(mel_pts)[1:-1]


def _hann(win_length: int) -> np.ndarray:
    if win_length not in _WINDOW_CACHE:
        _WINDOW_CACHE[win_length] = np.hanning(win_length).astype(np.float32)
    return _WINDOW_CACHE[win_length]


def frame_signal(y: np.ndarray, n_fft: int = C.N_FFT, hop: int = C.HOP_LENGTH) -> np.ndarray:
    """Center-padded framing -> ``(n_frames, n_fft)``. n_frames = 1 + len(y)//hop."""
    y = np.asarray(y, dtype=np.float32)
    pad = n_fft // 2
    y = np.pad(y, (pad, pad), mode="reflect")
    n_frames = 1 + (len(y) - n_fft) // hop
    if n_frames <= 0:
        return np.zeros((0, n_fft), dtype=np.float32)
    idx = np.arange(n_fft)[None, :] + hop * np.arange(n_frames)[:, None]
    return y[idx]


def log_mel(y: np.ndarray, sr: int = C.SR) -> np.ndarray:
    """Compute a log-mel spectrogram, shape ``(n_frames, n_mels)`` (float32).

    Power spectrum -> mel filterbank -> log compression. This is the model input.
    """
    frames = frame_signal(y, C.N_FFT, C.HOP_LENGTH)
    if frames.shape[0] == 0:
        return np.zeros((0, C.N_MELS), dtype=np.float32)
    frames = frames * _hann(C.N_FFT)[None, :]
    spec = np.fft.rfft(frames, n=C.N_FFT, axis=1)
    power = (spec.real ** 2 + spec.imag ** 2).astype(np.float32)  # (T, n_fft//2+1)
    mel = power @ mel_filterbank(sr).T                            # (T, n_mels)
    log = np.log(mel + 1e-6).astype(np.float32)
    return log


def n_frames_for(num_samples: int, hop: int = C.HOP_LENGTH) -> int:
    """Number of log-mel frames produced for a signal of ``num_samples`` (matches
    the center-padded framing in :func:`frame_signal`)."""
    pad = C.N_FFT // 2
    total = num_samples + 2 * pad
    return max(0, 1 + (total - C.N_FFT) // hop)
