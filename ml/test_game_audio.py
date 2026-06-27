"""Emulate the in-browser game audio path on real singing clips.

Runs the EXACT exported ONNX model + log-mel front-end with the same sliding
window (200 frames), per-window normalisation, last-frame decode, and the game's
"singing" gate (level >= LEVEL_THRESH and pitch-confidence >= MIN_CONFIDENCE).
Reports, per clip, what fraction of frames would register as "hearing" and the
notes detected — so we can confirm singing registers before a human demo.
"""
from __future__ import annotations

import glob
import json
import sys

import numpy as np
import onnxruntime as ort
import soundfile as sf

import config as C
import features
import pitch as pitchmod

WINDOW = 200
STEP = 5
# Mirror src/lib/game/useStableNotes.ts: gate on the model's voicing head + level.
LEVEL_THRESH = 0.02
SENSITIVITY = 0.5

MODEL = C.ML_DIR.parent / "public" / "models" / "pitch_crnn.onnx"


def softmax_peak_conf(logits_row: np.ndarray) -> tuple[int, float]:
    peak = int(np.argmax(logits_row))
    lo, hi = max(0, peak - 2), min(len(logits_row) - 1, peak + 2)
    seg = logits_row[lo:hi + 1]
    seg = np.exp(seg - seg.max())
    probs = seg / seg.sum()
    return peak, float(probs[peak - lo])


def run_clip(sess: ort.InferenceSession, path: str) -> dict:
    y, sr = sf.read(path)
    y = np.asarray(y, dtype=np.float32)
    if y.ndim > 1:
        y = y.mean(axis=1)
    lm = features.log_mel(y)  # (T, n_mels)
    T = len(lm)
    if T < WINDOW:
        return {"frames": 0}

    # Per-frame RMS aligned to the label grid (the same loudness the game meters).
    import coarsen
    rms = coarsen.frame_rms(y, T)

    singing_frames = 0
    total = 0
    notes = []
    for end in range(WINDOW, T + 1, STEP):
        win = lm[end - WINDOW:end]
        norm = (win - win.mean()) / (win.std() + 1e-5)
        inp = norm[None, :, :].astype(np.float32)
        p_log, v_log = sess.run(None, {"lm": inp})
        last_pitch = p_log[0, -1]
        last_voice = float(v_log[0, -1])
        peak, _conf = softmax_peak_conf(last_pitch)
        voice_prob = 1.0 / (1.0 + np.exp(-last_voice))
        level = float(rms[end - 1])
        singing = level >= LEVEL_THRESH and voice_prob >= SENSITIVITY
        total += 1
        if singing:
            singing_frames += 1
            notes.append(peak + C.PIANO_MIDI_MIN)
    note_names = []
    if notes:
        vals, counts = np.unique(np.array(notes), return_counts=True)
        order = np.argsort(-counts)[:5]
        note_names = [f"{pitchmod.midi_to_note_name(int(vals[i]))}×{int(counts[i])}" for i in order]
    return {
        "frames": total,
        "singing": singing_frames,
        "pct": round(100 * singing_frames / max(1, total), 1),
        "top_notes": note_names,
        "mean_rms": round(float(rms.mean()), 4),
    }


def main() -> None:
    sess = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    clips = sorted(glob.glob(str(C.ML_DIR / "data/final/audio/*orig.wav")))
    # A spread across datasets.
    picks = []
    seen = set()
    for c in clips:
        ds = c.split("final_")[1].split("_")[0]
        if ds not in seen:
            seen.add(ds)
            picks.append(c)
    picks = picks[:8] if len(picks) >= 8 else clips[:8]
    if len(sys.argv) > 1:
        picks = sys.argv[1:]

    print(f"model: {MODEL.name}  gate: level>={LEVEL_THRESH}, voiceProb>={SENSITIVITY}\n")
    agg = []
    for c in picks:
        r = run_clip(sess, c)
        agg.append(r.get("pct", 0))
        name = c.split("/")[-1].replace("__orig.wav", "")
        print(f"  {name:42s} singing {r.get('pct',0):5.1f}% of frames "
              f"| rms {r.get('mean_rms','?')} | notes {r.get('top_notes', [])}")
    if agg:
        print(f"\nMEAN singing-registered frames: {np.mean(agg):.1f}%")
        print("PASS" if np.mean(agg) >= 40 else "LOW — gate may be too strict")


if __name__ == "__main__":
    main()
