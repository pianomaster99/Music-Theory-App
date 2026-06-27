"""Method 1 - procedural source-filter singing-voice synthesizer.

Pure NumPy/SciPy. Because we *generate* the f0 contour, the frame-level labels
are exact by construction (not estimated). Pipeline per clip:

  random melody (notes + portamento + rests)
    -> per-sample f0 contour + vibrato + jitter + amplitude envelope
    -> additive band-limited glottal source (harmonics, 1/h^tilt spectral tilt)
    -> parallel formant resonators (vowel timbre, vocal-tract-length scaled)
    -> breath noise + normalization
    -> downsample f0/voiced to the 10 ms frame grid

Voice "archetypes" sweep the full range (bass..soprano..child) by varying the
pitch range and the formant/vocal-tract scaling, which is what gives the trained
model robustness across singers.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.signal import lfilter

import config as C
import features

# Neutral adult formant tables (Hz): F1..F5 per vowel.
_VOWELS = {
    "a": [(700, 130), (1220, 110), (2600, 170), (3500, 250), (4500, 300)],
    "e": [(400, 90), (2000, 110), (2550, 170), (3500, 250), (4500, 300)],
    "i": [(300, 80), (2300, 110), (3000, 170), (3700, 250), (4600, 300)],
    "o": [(500, 90), (900, 110), (2600, 170), (3300, 250), (4400, 300)],
    "u": [(350, 80), (700, 100), (2550, 170), (3400, 250), (4500, 300)],
}
_VOWEL_KEYS = list(_VOWELS)

# Voice archetypes: (midi_low, midi_high, vocal-tract length factor range).
# tract>1 => shorter tract => formants shift up (female/child).
_VOICES = {
    "bass": (36, 60, (0.85, 0.95)),
    "tenor": (43, 67, (0.92, 1.0)),
    "alto": (53, 77, (1.0, 1.1)),
    "soprano": (60, 84, (1.05, 1.18)),
    "child": (64, 88, (1.18, 1.4)),
}
_VOICE_KEYS = list(_VOICES)


@dataclass
class SynthParams:
    duration_s: float = 4.0
    voice: str = "alto"
    vowel: str = "a"
    tempo_bpm: float = 100.0
    vibrato_rate_hz: float = 5.5
    vibrato_depth_semitones: float = 0.35
    portamento_frac: float = 0.15   # fraction of a note spent sliding in
    rest_prob: float = 0.15         # chance a slot is an unvoiced rest
    breath_level: float = 0.004
    jitter_cents: float = 8.0
    spectral_tilt: float = 1.0      # harmonic amplitude ~ 1/h**tilt


def _midi_to_hz(m: np.ndarray | float) -> np.ndarray:
    return 440.0 * (2.0 ** ((np.asarray(m, dtype=np.float64) - 69.0) / 12.0))


def _resonator(x: np.ndarray, f_hz: float, bw_hz: float, gain: float) -> np.ndarray:
    """Two-pole resonator normalised to ~unit peak gain, scaled by ``gain``."""
    r = np.exp(-np.pi * bw_hz / C.SR)
    theta = 2.0 * np.pi * f_hz / C.SR
    a = [1.0, -2.0 * r * np.cos(theta), r * r]
    b = [(1.0 - r) * gain]
    return lfilter(b, a, x)


def _build_contour(p: SynthParams, rng: np.random.Generator):
    """Per-sample f0 (Hz, 0 in rests), amplitude envelope, voiced mask."""
    n = int(p.duration_s * C.SR)
    lo, hi, _ = _VOICES[p.voice]
    beat_s = 60.0 / p.tempo_bpm
    # Note durations: 1, 1.5 or 2 beats.
    f0 = np.zeros(n, dtype=np.float64)
    amp = np.zeros(n, dtype=np.float64)
    voiced = np.zeros(n, dtype=bool)

    pos = 0
    prev_midi = float(rng.integers(lo, hi + 1))
    while pos < n:
        dur_beats = rng.choice([1.0, 1.0, 1.5, 2.0])
        seg = max(1, int(dur_beats * beat_s * C.SR))
        end = min(n, pos + seg)
        L = end - pos
        if rng.random() < p.rest_prob:
            pos = end
            continue

        # Random-walk melody within the voice range.
        step = int(rng.integers(-5, 6))
        midi = float(np.clip(prev_midi + step, lo, hi))

        # Portamento: slide from prev to target over the first portion.
        slide = max(1, int(p.portamento_frac * L))
        midi_curve = np.full(L, midi)
        s = min(slide, L)
        midi_curve[:s] = np.linspace(prev_midi, midi, s)
        seg_f0 = _midi_to_hz(midi_curve)

        # ADSR-ish amplitude envelope.
        env = np.ones(L)
        atk = max(1, int(0.02 * C.SR))
        rel = max(1, int(0.05 * C.SR))
        env[:min(atk, L)] = np.linspace(0, 1, min(atk, L))
        if L > rel:
            env[-rel:] = np.linspace(1, 0, rel)

        f0[pos:end] = seg_f0
        amp[pos:end] = env * rng.uniform(0.7, 1.0)
        voiced[pos:end] = True
        prev_midi = midi
        pos = end

    # Vibrato (delayed onset) + jitter on the voiced f0.
    t = np.arange(n) / C.SR
    vib = p.vibrato_depth_semitones * np.sin(2 * np.pi * p.vibrato_rate_hz * t)
    vib_env = np.clip((t % 0.6) / 0.3, 0, 1)  # ramps in within each held note-ish
    jitter = rng.normal(0, p.jitter_cents, n)
    jitter = np.convolve(jitter, np.ones(64) / 64, mode="same")
    cents_mod = vib * vib_env * 100.0 + jitter
    f0 = np.where(voiced, f0 * (2.0 ** (cents_mod / 1200.0)), 0.0)
    return f0, amp, voiced


def _synthesize(f0: np.ndarray, amp: np.ndarray, voiced: np.ndarray, p: SynthParams,
                rng: np.random.Generator) -> np.ndarray:
    n = len(f0)
    # Instantaneous phase from the f0 contour.
    phase = 2 * np.pi * np.cumsum(np.where(voiced, f0, 0.0)) / C.SR
    nyq = 0.45 * C.SR
    f0_safe = np.where(f0 > 0, f0, 1e9)
    h_max = int(np.ceil(nyq / max(1.0, f0[voiced].min() if voiced.any() else 100.0)))
    h_max = max(1, min(h_max, 120))

    source = np.zeros(n, dtype=np.float64)
    for h in range(1, h_max + 1):
        mask = (h * f0_safe) < nyq
        if not mask.any():
            break
        source += (1.0 / (h ** p.spectral_tilt)) * np.sin(h * phase) * mask
    source *= voiced  # silence in rests

    # Vowel formant filtering (parallel resonators), tract-length scaled.
    tract = rng.uniform(*_VOICES[p.voice][2])
    formants = _VOWELS[p.vowel]
    out = np.zeros(n, dtype=np.float64)
    for i, (fc, bw) in enumerate(formants):
        gain = 1.0 / (i + 1) ** 0.5
        out += _resonator(source, min(fc * tract, 0.49 * C.SR), bw, gain)

    out *= amp
    out += p.breath_level * rng.normal(0, 1, n) * (amp > 0)  # breath only while singing
    peak = np.max(np.abs(out)) or 1.0
    return (0.9 * out / peak).astype(np.float32)


def synthesize_clip(rng: np.random.Generator, params: SynthParams | None = None):
    """Generate one singing clip. Returns ``(audio, f0_grid, voiced_grid, meta)``."""
    if params is None:
        params = SynthParams(
            duration_s=float(rng.uniform(2.5, 5.0)),
            voice=rng.choice(_VOICE_KEYS),
            vowel=rng.choice(_VOWEL_KEYS),
            tempo_bpm=float(rng.uniform(70, 140)),
            vibrato_rate_hz=float(rng.uniform(4.5, 7.0)),
            vibrato_depth_semitones=float(rng.uniform(0.1, 0.5)),
            rest_prob=float(rng.uniform(0.05, 0.25)),
        )
    f0_audio, amp, voiced_audio = _build_contour(params, rng)
    audio = _synthesize(f0_audio, amp, voiced_audio, params, rng)

    # Sample f0/voiced onto the 10 ms frame grid (frame i ~ original sample i*HOP).
    n_frames = features.n_frames_for(len(audio))
    idx = np.clip(np.arange(n_frames) * C.HOP_LENGTH, 0, len(audio) - 1)
    f0_grid = f0_audio[idx].astype(np.float32)
    voiced_grid = voiced_audio[idx] & (f0_grid > 0)
    f0_grid = np.where(voiced_grid, f0_grid, 0.0).astype(np.float32)

    meta = {"voice": params.voice, "vowel": params.vowel,
            "tempo_bpm": round(params.tempo_bpm, 1)}
    return audio, f0_grid, voiced_grid, meta


# --- Optional realism layer: WORLD resynthesis (used only if pyworld present) ---
def world_available() -> bool:
    try:
        import pyworld  # noqa: F401
        return True
    except Exception:
        return False
