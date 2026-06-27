"""Coarsen fine CREPE pitch-time labels into clean, stable note labels.

CREPE gives per-frame f0 that wavers at note onsets, vibrates on holds, and slides
between notes. For training we want only *settled* pitches with high confidence:

  * CONTEXT  - look at past AND future windows; a frame is labelable only when
    local pitch variance is low on both sides (no shaky beginnings/ends).
  * ATTACK   - volatile frames at a note's start stay UNLABELED until pitch settles.
  * HYSTERESIS - once on a note, a *noticeable* sustained shift (>= SHIFT_SEM) is
    required before switching; wavers/transitions between notes are unlabeled.
  * VOLUME   - gate low-energy frames; trim each note at its taper.
  * FINE IN  - rules + LLM work on continuous Hz / float-MIDI (not 88 buckets).
  * FINE OUT - LLM reads fine pitch; both paths output discrete piano-key labels.

``coarsen_rules`` is the fast default. ``coarsen_llm`` sends fine-resolution frames
to an OpenAI agent and falls back to rules on error.
"""
from __future__ import annotations

import json
import os

import numpy as np

import config as C
import pitch

# ~100 fps (16 kHz, hop 160). TOLERANT settling: we WAIT for the pitch to settle
# before a note begins (no scoops/attacks), then keep labeling through vibrato and
# waver, and only END the note when the volume decays (or the pitch clearly moves
# to a new note). This keeps a healthy fraction of frames voiced so the model's
# voicing head learns properly.
MIN_FRAMES = 9           # >= ~90 ms sustained before a note counts
MIN_SHORT = 5            # a quick passing note must still be a real ~50 ms hold
SMOOTH_W = 7
TOL = 1
MERGE_GAP = 9
CONF_THRESH = 0.5        # accept moderately-confident teacher frames
ENERGY_FLOOR = 0.05
PASS_ENERGY = 0.2

# Settlement (ATTACK only): a note may START once local pitch is steady. Lenient
# std so normal vibrato counts as "settled".
SETTLE_FRAMES = 9        # ~90 ms context each side
SETTLE_STD = 0.5         # semitones; vibrato/waver up to ~a half step still settles

# Hysteresis: once on a note, a clear, sustained shift is needed to change note.
SHIFT_SEM = 2.0          # semitones away from current note centre
SHIFT_HOLD = 12          # ~120 ms of the new pitch before we commit

# Decay: once a note is held, end its label when the (smoothed) RMS falls below
# this fraction of the note's running peak -> we cut the decaying tail.
DECAY_FRAC = 0.5
ENERGY_SMOOTH = 5        # frames of moving-average on RMS for decay (ignore vibrato dips)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def frame_rms(audio: np.ndarray, n_frames: int,
              hop: int = C.HOP_LENGTH, win: int = C.WIN_LENGTH) -> np.ndarray:
    """Per-frame RMS energy aligned to the label grid."""
    a = np.pad(np.asarray(audio, dtype=np.float32), (win // 2, win // 2))
    out = np.zeros(n_frames, dtype=np.float32)
    for i in range(n_frames):
        seg = a[i * hop: i * hop + win]
        if seg.size:
            out[i] = float(np.sqrt(np.mean(seg * seg) + 1e-12))
    return out


def _mode_filter(keys: np.ndarray, w: int) -> np.ndarray:
    if w <= 1:
        return keys.copy()
    n = len(keys)
    h = w // 2
    out = keys.copy()
    for i in range(n):
        seg = keys[max(0, i - h): min(n, i + h + 1)]
        vals, counts = np.unique(seg, return_counts=True)
        out[i] = int(vals[np.argmax(counts)])
    return out


def _rle(keys: np.ndarray):
    segs, n, i = [], len(keys), 0
    while i < n:
        k = int(keys[i])
        j = i
        while j < n and int(keys[j]) == k:
            j += 1
        segs.append((k, i, j - i))
        i = j
    return segs


def _to_per_frame(notes, n):
    coarse = np.full(n, -1, dtype=int)
    for s, e, k in notes:
        if k >= 0:
            coarse[max(0, s): min(n, e)] = k
    return coarse


def _gate(f0, voiced, conf, energy, conf_thresh, energy_floor):
    """High-confidence, audible frames only."""
    n = len(f0)
    gate = np.asarray(voiced, dtype=bool) & (np.asarray(conf) >= conf_thresh)
    peak = 1.0
    if energy is not None:
        e = np.asarray(energy)[:n]
        peak = float(max(e.max(), 1e-9))
        gate &= e >= energy_floor * peak
    hz = np.asarray(f0, dtype=np.float64)
    gate &= np.isfinite(hz) & (hz > 0)
    return gate, peak


def _fine_midi(f0: np.ndarray) -> np.ndarray:
    midi = pitch.hz_to_midi(f0)
    return np.where(np.isfinite(midi), midi, np.nan)


def _stable_mask(midi: np.ndarray, gate: np.ndarray, w: int = SETTLE_FRAMES,
                 settle_std: float = SETTLE_STD) -> np.ndarray:
    """Bidirectional settlement: label only when pitch is steady in context.

    At clip edges the missing side is relaxed so we can still label near boundaries
  once the available side is stable.
    """
    n = len(midi)
    stable = np.zeros(n, dtype=bool)
    min_pts = max(3, w // 2)
    for i in range(n):
        if not gate[i]:
            continue
        ps, pe = max(0, i - w), i + 1
        fs, fe = i, min(n, i + w + 1)
        past = midi[ps:pe][gate[ps:pe]]
        future = midi[fs:fe][gate[fs:fe]]
        past_ok = len(past) >= min_pts and float(np.nanstd(past)) <= settle_std
        future_ok = len(future) >= min_pts and float(np.nanstd(future)) <= settle_std
        at_start = i < w
        at_end = i >= n - w
        if at_start and not at_end:
            stable[i] = future_ok
        elif at_end and not at_start:
            stable[i] = past_ok
        else:
            stable[i] = past_ok and future_ok
    return stable


def _smooth_energy(energy: np.ndarray, w: int = ENERGY_SMOOTH) -> np.ndarray:
    if energy is None or w <= 1:
        return energy
    e = np.asarray(energy, dtype=np.float64)
    k = np.ones(w) / w
    return np.convolve(e, k, mode="same")


def _label_notes(midi: np.ndarray, stable: np.ndarray, gate: np.ndarray,
                 energy: np.ndarray | None, *, shift_sem: float = SHIFT_SEM,
                 shift_hold: int = SHIFT_HOLD, tol: float = TOL,
                 decay_frac: float = DECAY_FRAC) -> np.ndarray:
    """Tolerant note labeling.

    * START a note only once the pitch has SETTLED (``stable``) -> no scoops/attacks.
    * Once started, keep labeling through vibrato/waver (we do NOT drop frames just
      because they wobble), tracking the note's running peak loudness.
    * END the note (cut the tail) when the smoothed RMS decays below
      ``decay_frac`` of that peak, when the pitch clearly moves to a new note
      (a >= ``shift_sem`` change sustained ``shift_hold`` frames), or on silence.
    """
    n = len(midi)
    labels = np.full(n, -1, dtype=int)
    se = _smooth_energy(energy) if energy is not None else None
    cur = -1
    centre = np.nan
    peak = 0.0
    pending = -1
    pcount = 0

    for i in range(n):
        if not gate[i]:
            cur, pending, pcount = -1, -1, 0
            continue
        m = float(midi[i])
        e = float(se[i]) if se is not None else 1.0

        if cur < 0:
            # Wait for the note to settle before starting it.
            if stable[i]:
                c = int(round(m)) - C.PIANO_MIDI_MIN
                if 0 <= c < C.N_PITCH_CLASSES:
                    cur, centre, peak = c, m, e
                    labels[i] = cur
            continue

        # Decay: cut the tail once loudness falls well below the note's peak.
        if e > peak:
            peak = e
        if se is not None and e < decay_frac * peak:
            cur, pending, pcount = -1, -1, 0
            continue

        diff = abs(m - centre)
        if diff < shift_sem:
            # Within vibrato/waver range: keep the note (tolerant).
            labels[i] = cur
            pending, pcount = -1, 0
        else:
            # A clear move; only switch after it is sustained.
            c = int(round(m)) - C.PIANO_MIDI_MIN
            if pending == c:
                pcount += 1
            else:
                pending, pcount = c, 1
            if pcount >= shift_hold and 0 <= c < C.N_PITCH_CLASSES:
                cur, centre, peak = c, m, e
                labels[i] = cur
                pending, pcount = -1, 0
            else:
                labels[i] = cur  # brief transition still belongs to the held note

    return labels


def _labels_to_notes(labels: np.ndarray) -> list:
    notes = []
    for k, s, l in _rle(labels):
        if k >= 0:
            notes.append([s, s + l, k])
    return notes


def _postprocess(notes, energy, peak, *, min_frames, min_short, pass_energy):
    """Length/energy filtering. (Onset is handled by settlement and the tail by
    the decay cut in _label_notes, so no extra taper trimming here.)"""
    out = []
    for s, e, k in notes:
        if k < 0:
            continue
        length = e - s
        if length >= min_frames:
            out.append((s, e, k))
        elif length >= min_short and energy is not None and \
                float(np.asarray(energy)[s:e].mean()) >= pass_energy * peak:
            out.append((s, e, k))  # short but energetic passing note
    return out


def _merge_near(notes, tol=TOL, merge_gap=MERGE_GAP):
    merged = []
    for nt in sorted(notes):
        s, e, k = nt[0], nt[1], nt[2]
        if merged and abs(k - merged[-1][2]) <= tol and s - merged[-1][1] <= merge_gap:
            merged[-1][1] = e
        else:
            merged.append([s, e, k])
    return merged


def _octave_fix(labels, tol=TOL, max_blip=MIN_FRAMES):
    out = labels.copy()
    runs = _rle(out)
    for idx in range(1, len(runs) - 1):
        k, s, l = runs[idx]
        if k < 0 or l > max_blip:
            continue
        kp, kn = runs[idx - 1][0], runs[idx + 1][0]
        if kp < 0 or kn < 0 or abs(kp - kn) > tol:
            continue
        if abs(abs(k - kp) - 12) <= 1:
            shift = 12 if k > kp else -12
            out[s:s + l] = k - shift
    return out


def coarsen_rules(f0, voiced, conf, energy=None, *, min_frames=MIN_FRAMES,
                  min_short=MIN_SHORT, smooth=SMOOTH_W, tol=TOL, merge_gap=MERGE_GAP,
                  conf_thresh=CONF_THRESH, energy_floor=ENERGY_FLOOR,
                  pass_energy=PASS_ENERGY, settle_frames=SETTLE_FRAMES,
                  settle_std=SETTLE_STD, shift_sem=SHIFT_SEM, shift_hold=SHIFT_HOLD,
                  decay_frac=DECAY_FRAC):
    n = len(f0)
    gate, peak = _gate(f0, voiced, conf, energy, conf_thresh, energy_floor)
    midi = _fine_midi(f0)
    stable = _stable_mask(midi, gate, w=settle_frames, settle_std=settle_std)
    labels = _label_notes(midi, stable, gate, energy, shift_sem=shift_sem,
                          shift_hold=shift_hold, tol=tol, decay_frac=decay_frac)
    # Light mode smooth on assigned frames only (keeps -1 gaps).
    sm = labels.copy()
    voiced_idx = sm >= 0
    if smooth > 1 and voiced_idx.any():
        tmp = sm.copy()
        tmp[~voiced_idx] = -1
        sm = _mode_filter(tmp, smooth)
        sm[~voiced_idx] = -1
    sm = _octave_fix(sm, tol=tol)
    notes = _merge_near(_labels_to_notes(sm), tol=tol, merge_gap=merge_gap)
    notes = _postprocess(notes, energy, peak, min_frames=min_frames,
                         min_short=min_short, pass_energy=pass_energy)
    return _to_per_frame(notes, n), notes


# --------------------------------------------------------------------------
# OpenAI agent coarsener — FINE resolution input, discrete output
# --------------------------------------------------------------------------
_RULES = (
    "You clean an automatic monophonic pitch transcription of one singing voice. "
    "Input: FINE-RESOLUTION frames with continuous pitch (hz + float midi), "
    "confidence (0-1), and rel_vol (0-1 vs clip peak). These are NOT bucketed "
    "into piano keys yet — use the float midi/hz to judge stability.\n"
    "Output DISCRETE piano-key notes (scientific pitch e.g. 'A4') a musician would write.\n"
    "Rules (high confidence, context-aware, NOT a tuner):\n"
    "- Do NOT label shaky ATTACK frames: wait until pitch has settled (low local "
    "variance in past+future context) before starting a note.\n"
    "- Once a note has settled, require a NOTICEABLE sustained shift (>= ~2 semitones "
    "for ~120 ms) before changing to a new note; leave transitions UNLABELED.\n"
    "- Merge vibrato/wobble within +/-1 semitone of a hold into ONE note.\n"
    "- DROP monotonic slides/scoops with no flat plateau.\n"
    "- END each note where rel_vol tapers; never extend into near-silence.\n"
    "- Only output notes you are confident about; never invent unsupported pitches.\n"
    f"- Normal notes >= {MIN_FRAMES} frames (~100 ms); short passing notes >= {MIN_SHORT} "
    "frames only if flat and rel_vol >= 0.20.\n"
    "Return ONLY JSON: {\"notes\":[{\"note\":\"A4\",\"start_s\":0.0,\"end_s\":0.5}, ...]}."
)


def _fine_frames_payload(f0, voiced, conf, energy, peak, conf_thresh=CONF_THRESH,
                        step: int = 2):
    """Fine-resolution frames for the LLM (Hz + float MIDI, not 88 buckets)."""
    frames = []
    n = len(f0)
    for i in range(0, n, step):
        if not voiced[i] or float(conf[i]) < conf_thresh:
            continue
        hz = float(f0[i])
        if hz <= 0:
            continue
        rel = 0.0
        if energy is not None:
            rel = round(float(energy[i]) / peak, 2)
        m = pitch.hz_to_midi(hz)
        frames.append({
            "t_s": round(i / C.FRAME_RATE, 3),
            "hz": round(hz, 1),
            "midi": round(float(m), 2),
            "conf": round(float(conf[i]), 2),
            "rel_vol": rel,
        })
    return frames


def coarsen_llm(f0, voiced, conf, energy=None, *, model="gpt-4o-mini", conf_thresh=CONF_THRESH,
                energy_floor=ENERGY_FLOOR, min_frames=MIN_FRAMES,
                min_short=MIN_SHORT, pass_energy=PASS_ENERGY):
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    from openai import OpenAI

    n = len(f0)
    gate, peak = _gate(f0, voiced, conf, energy, conf_thresh, energy_floor)
    frames = _fine_frames_payload(f0, gate, conf, energy, peak, conf_thresh=conf_thresh)
    if not frames:
        return np.full(n, -1, dtype=int), []

    client = OpenAI()
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": _RULES},
                  {"role": "user", "content": json.dumps({
                      "fine_frames": frames,
                      "frame_rate_hz": C.FRAME_RATE,
                      "note": "pitch is continuous; output discrete piano keys only",
                  })}],
        response_format={"type": "json_object"},
    )
    data = json.loads(resp.choices[0].message.content)
    notes = []
    for ev in data.get("notes", []):
        k = pitch.note_name_to_class(ev.get("note", ""))
        s = int(round(float(ev.get("start_s", 0)) * C.FRAME_RATE))
        e = int(round(float(ev.get("end_s", 0)) * C.FRAME_RATE))
        if k >= 0 and e > s:
            notes.append([max(0, s), min(n, e), k])
    notes.sort()
    notes = _postprocess(notes, energy, peak, min_frames=min_frames,
                         min_short=min_short, pass_energy=pass_energy)
    return _to_per_frame(notes, n), notes


def coarsen(f0, voiced, conf, energy=None, *, method="rules", model="gpt-4o-mini",
            conf_thresh=CONF_THRESH):
    if method == "llm":
        try:
            return coarsen_llm(f0, voiced, conf, energy, model=model, conf_thresh=conf_thresh)
        except Exception as e:
            print(f"    ! LLM coarsen failed ({type(e).__name__}: {str(e)[:120]}); using rules")
    return coarsen_rules(f0, voiced, conf, energy, conf_thresh=conf_thresh)
