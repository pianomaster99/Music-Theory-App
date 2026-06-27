"""Shared constants for the singing-voice pitch-detection project.

Everything downstream (synthesis, real-data alignment, distillation, features,
labels) is pinned to these numbers so the three data-generation methods produce
interchangeable clips on a common time/frequency grid.
"""
from __future__ import annotations

import os
from pathlib import Path

# --- Audio -----------------------------------------------------------------
SR = 16_000  # sample rate (Hz). Matches CREPE; covers vocal f0 + harmonics.

# --- Frame grid (10 ms hop, 64 ms analysis window) -------------------------
WIN_LENGTH = 1024          # analysis window in samples (64 ms @ 16 kHz)
HOP_LENGTH = 160           # hop in samples (10 ms @ 16 kHz) -> 100 frames/s
N_FFT = 1024
FRAME_RATE = SR / HOP_LENGTH  # 100.0 frames per second

# --- Log-mel front-end -----------------------------------------------------
N_MELS = 128
FMIN = 30.0                # Hz; below the lowest vocal fundamental we care about
FMAX = SR / 2              # Nyquist (8000 Hz)

# --- Pitch classes: discrete piano keys (A0..C8) ---------------------------
# Each frame is labeled with the nearest of the 88 piano keys (or unvoiced).
# MIDI 21 (A0, 27.5 Hz) .. MIDI 108 (C8, 4186 Hz).
PIANO_MIDI_MIN = 21          # A0
PIANO_MIDI_MAX = 108         # C8
N_PITCH_CLASSES = PIANO_MIDI_MAX - PIANO_MIDI_MIN + 1   # 88

# A frame is considered "voiced" only above this confidence/energy gate. Used
# when deriving voicing from teacher confidence or synthetic envelopes.
VOICING_THRESHOLD = 0.5

# Plausible sung-pitch range used to sanity-filter f0 values (Hz).
F0_FLOOR_HZ = 55.0    # ~A1
F0_CEIL_HZ = 1500.0   # above soprano / child whistle-register singing

# --- Paths -----------------------------------------------------------------
ML_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("PITCH_DATA_DIR", ML_DIR / "data"))
CORPORA_DIR = Path(os.environ.get("PITCH_CORPORA_DIR", ML_DIR / "corpora"))
MANIFEST_PATH = DATA_DIR / "manifest.jsonl"

# Per-method output subdirectories under DATA_DIR.
METHODS = ("synthetic", "real_labeled", "distilled")


def ensure_dirs() -> None:
    """Create the data/corpora directory tree."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CORPORA_DIR.mkdir(parents=True, exist_ok=True)
    for method in METHODS:
        (DATA_DIR / method / "audio").mkdir(parents=True, exist_ok=True)
        (DATA_DIR / method / "labels").mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "plots").mkdir(parents=True, exist_ok=True)
