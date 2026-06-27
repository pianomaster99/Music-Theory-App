"""Export the trained PitchCRNN to ONNX + dump the exact front-end tables.

Produces two artefacts the web app loads:
  * ``public/models/pitch_crnn.onnx``      - the model (dynamic time axis).
  * ``public/models/pitch_frontend.json``  - the EXACT Hann window + Slaney mel
    filterbank + config used at training time, so the in-browser log-mel matches
    ``features.py`` bit-for-bit (any drift wrecks accuracy).

Usage:  python export_onnx.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch

import config as C
import features
from model import PitchCRNN

CKPT = C.DATA_DIR / "model" / "pitch_crnn.pt"
WEB_DIR = C.ML_DIR.parent / "public" / "models"


def main() -> None:
    WEB_DIR.mkdir(parents=True, exist_ok=True)
    ckpt = torch.load(CKPT, map_location="cpu")
    dropout = float(ckpt.get("config", {}).get("dropout", 0.3))
    model = PitchCRNN(dropout=dropout)
    model.load_state_dict(ckpt["model"])
    model.eval()

    # Wrap so ONNX outputs are just (pitch_logits, voice_logits) without the GRU
    # hidden state (the web runner re-feeds a rolling window each tick).
    class Wrap(torch.nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, lm):  # lm: (1, T, n_mels)
            p, v, _ = self.m(lm)
            return p, v

    wrap = Wrap(model).eval()
    T = 200
    dummy = torch.randn(1, T, C.N_MELS)
    onnx_path = WEB_DIR / "pitch_crnn.onnx"
    torch.onnx.export(
        wrap, dummy, str(onnx_path),
        input_names=["lm"], output_names=["pitch_logits", "voice_logits"],
        dynamic_axes={"lm": {1: "T"}, "pitch_logits": {1: "T"}, "voice_logits": {1: "T"}},
        opset_version=17,
        dynamo=False,  # legacy tracer handles the dynamic time axis cleanly
    )

    # Sanity: parity with PyTorch on the dummy input.
    import onnxruntime as ort  # noqa: WPS433 (optional dependency)
    try:
        sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        out = sess.run(None, {"lm": dummy.numpy()})
        with torch.no_grad():
            p_ref, v_ref = wrap(dummy)
        dp = float(np.abs(out[0] - p_ref.numpy()).max())
        dv = float(np.abs(out[1] - v_ref.numpy()).max())
        print(f"ONNX parity: max|dpitch|={dp:.2e}  max|dvoice|={dv:.2e}")
    except Exception as e:  # pragma: no cover
        print(f"(skipped ORT parity check: {type(e).__name__}: {e})")

    # Front-end tables, straight from the training code so they match exactly.
    hann = np.hanning(C.N_FFT).astype(np.float32)
    mel_fb = features.mel_filterbank().astype(np.float32)  # (n_mels, n_fft//2+1)
    frontend = {
        "sr": C.SR, "n_fft": C.N_FFT, "hop": C.HOP_LENGTH, "win": C.WIN_LENGTH,
        "n_mels": C.N_MELS, "fmin": C.FMIN, "fmax": float(C.FMAX),
        "n_classes": C.N_PITCH_CLASSES, "piano_midi_min": C.PIANO_MIDI_MIN,
        "frame_rate": C.FRAME_RATE,
        "hann": hann.tolist(),
        "mel_fb_shape": list(mel_fb.shape),
        "mel_fb": mel_fb.reshape(-1).tolist(),
    }
    fe_path = WEB_DIR / "pitch_frontend.json"
    fe_path.write_text(json.dumps(frontend))

    print(f"saved: {onnx_path} ({onnx_path.stat().st_size/1024:.0f} KB)")
    print(f"saved: {fe_path} ({fe_path.stat().st_size/1024:.0f} KB; "
          f"mel_fb {mel_fb.shape}, hann {hann.shape})")


if __name__ == "__main__":
    main()
