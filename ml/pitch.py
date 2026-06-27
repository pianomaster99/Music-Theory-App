"""Pitch utilities for a DISCRETE piano-key label scheme.

Each frame is labeled with the nearest of the 88 piano keys (A0..C8, MIDI
21..108) or marked unvoiced. Class index ``c`` corresponds to MIDI note
``PIANO_MIDI_MIN + c``.
"""
from __future__ import annotations

import numpy as np

import config as C

_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def hz_to_midi(f0_hz: np.ndarray | float) -> np.ndarray:
    f0 = np.asarray(f0_hz, dtype=np.float64)
    with np.errstate(divide="ignore", invalid="ignore"):
        midi = 69.0 + 12.0 * np.log2(f0 / 440.0)
    return np.where(f0 > 0, midi, np.nan)


def midi_to_hz(midi: np.ndarray | float) -> np.ndarray:
    return 440.0 * (2.0 ** ((np.asarray(midi, dtype=np.float64) - 69.0) / 12.0))


def hz_to_class(f0_hz: np.ndarray | float) -> np.ndarray:
    """Nearest piano-key class index (0..87). Out-of-range/unvoiced -> -1."""
    midi = hz_to_midi(f0_hz)
    idx = np.round(midi) - C.PIANO_MIDI_MIN
    valid = np.isfinite(idx) & (idx >= 0) & (idx < C.N_PITCH_CLASSES)
    return np.where(valid, idx, -1).astype(np.int64)


def class_to_midi(cls: np.ndarray | int) -> np.ndarray:
    return np.asarray(cls) + C.PIANO_MIDI_MIN


def class_to_hz(cls: np.ndarray | int) -> np.ndarray:
    return midi_to_hz(class_to_midi(cls))


def class_centers_hz() -> np.ndarray:
    """Frequency (Hz) of each of the 88 piano keys."""
    return midi_to_hz(np.arange(C.N_PITCH_CLASSES) + C.PIANO_MIDI_MIN)


def f0_to_target(f0_hz: np.ndarray, voiced: np.ndarray | None = None) -> np.ndarray:
    """One-hot discrete target, shape ``(T, N_PITCH_CLASSES)``.

    Voiced frames put a 1 on the nearest piano key; unvoiced frames are all-zero.
    """
    f0_hz = np.asarray(f0_hz, dtype=np.float64)
    T = f0_hz.shape[0]
    if voiced is None:
        voiced = f0_hz > 0
    voiced = np.asarray(voiced, dtype=bool)

    cls = hz_to_class(f0_hz)
    target = np.zeros((T, C.N_PITCH_CLASSES), dtype=np.float32)
    ok = voiced & (cls >= 0)
    target[np.where(ok)[0], cls[ok]] = 1.0
    return target


def target_to_f0(target: np.ndarray, threshold: float = 0.5):
    """Decode a (T, N_PITCH_CLASSES) activation to f0 (Hz) at the argmax key.
    Returns ``(f0_hz, confidence)``."""
    target = np.asarray(target, dtype=np.float64)
    peak = np.argmax(target, axis=1)
    conf = target[np.arange(target.shape[0]), peak]
    f0 = class_to_hz(peak)
    f0 = np.where(conf >= threshold, f0, 0.0)
    return f0, conf


def midi_to_note_name(m: int) -> str:
    return f"{_NOTE_NAMES[int(m) % 12]}{int(m) // 12 - 1}"


_NAME_TO_PC = {"C": 0, "C#": 1, "DB": 1, "D": 2, "D#": 3, "EB": 3, "E": 4,
               "F": 5, "F#": 6, "GB": 6, "G": 7, "G#": 8, "AB": 8, "A": 9,
               "A#": 10, "BB": 10, "B": 11}


def note_name_to_class(name: str) -> int:
    """Parse e.g. 'A4'/'F#3'/'Bb2' to a piano-key class index, or -1 if invalid."""
    if not name or not isinstance(name, str):
        return -1
    s = name.strip().upper().replace("♯", "#").replace("♭", "B")
    i = 0
    while i < len(s) and not (s[i].isdigit() or s[i] in "+-"):
        i += 1
    letter, octave = s[:i], s[i:]
    if letter not in _NAME_TO_PC or not octave.lstrip("-").isdigit():
        return -1
    midi = (int(octave) + 1) * 12 + _NAME_TO_PC[letter]
    cls = midi - C.PIANO_MIDI_MIN
    return int(cls) if 0 <= cls < C.N_PITCH_CLASSES else -1


def hz_to_note_name(f0_hz: float) -> str:
    """Nearest piano note name with octave, e.g. 440 -> 'A4'. 0/invalid -> '-'."""
    if not np.isfinite(f0_hz) or f0_hz <= 0:
        return "-"
    m = int(round(69 + 12 * np.log2(f0_hz / 440.0)))
    m = int(np.clip(m, C.PIANO_MIDI_MIN, C.PIANO_MIDI_MAX))
    return midi_to_note_name(m)
