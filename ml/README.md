# Singing-Voice Pitch Detection — Data Generation

Implements the three data-generation methods from [spec.md](spec.md) for a
lightweight, browser-deployable singing-voice **pitch detector**. This stage
covers spec **milestone 2** ("generate the data and present it") — no model is
trained yet.

The model target is a **discrete classification over the 88 piano keys**
(A0-C8, MIDI 21-108): each frame is the nearest piano key (one-hot) plus a
separate voicing flag, at 16 kHz on a 10 ms frame grid.

## Setup

```bash
cd ml
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
# torch CPU wheel (smaller):
# pip install torch --index-url https://download.pytorch.org/whl/cpu
```

## The three data-generation methods

| Method | File(s) | Labels | Network needed |
|--------|---------|--------|----------------|
| 1. Synthetic singing | `synth.py`, `datagen_synthetic.py` | exact (generated from the f0 contour) | no |
| 2. Real, labeled + noise | `datasets_real.py`, `datagen_real.py` | dataset frame-level f0 | yes (mirdata downloads) |
| 3. Real, unlabeled + AI-labeled | `distill.py`, `datagen_distill.py` | teacher pseudo-labels (torchcrepe) | yes |

Generate everything and build the review report:

```bash
python datagen_synthetic.py --clips 200
python datagen_real.py --max-clips 100      # downloads vocadito etc.
python datagen_distill.py --max-clips 100
python present_data.py                       # writes data/report.md + data/index.html
```

Each method writes `data/<method>/audio/*.wav` + `data/<method>/labels/*.npz`
and appends to `data/manifest.jsonl` (see `dataset_common.py`).

## Shared modules

- `config.py` — sample rate, frame grid, pitch-bin scheme, paths.
- `pitch.py` — f0(Hz) ↔ cents ↔ bin, Gaussian targets, voicing, note names.
- `features.py` — NumPy log-mel front-end (mirrors the future browser front-end).
- `augment.py` — noise / reverb / EQ / codec / formant / SpecAugment pipeline.
- `dataset_common.py` — manifest + clip IO + f0-grid alignment.
