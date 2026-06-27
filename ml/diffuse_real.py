"""Generate diffusion-model variations of real (vocadito) singing clips.

This is audio-to-audio diffusion (SDEdit-style): take a real clip, noise it part
way, then run the reverse diffusion of a pretrained mel-spectrogram DDPM
(teticio/audio-diffusion-256) to synthesize a variation. Useful to *hear* what a
diffusion augmentation sounds like.

NOTE: the diffusion regenerates audio, so the original f0 labels no longer hold;
these clips would need re-labeling (e.g. with the CREPE teacher) before training.
This script is for listening / exploration.

Usage:
    python diffuse_real.py [--clips 3] [--steps 50] [--strengths 0.4 0.7]
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import soundfile as sf

import config as C

MODEL = "teticio/audio-diffusion-256"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clips", type=int, default=3)
    ap.add_argument("--steps", type=int, default=50)
    ap.add_argument("--strengths", type=float, nargs="*", default=[0.4, 0.7],
                    help="noise strength in (0,1]; higher = more diffused/changed")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    import torch
    from diffusers import DiffusionPipeline, DDIMScheduler
    import librosa

    out_dir = C.DATA_DIR / "diffused"
    (out_dir / "audio").mkdir(parents=True, exist_ok=True)
    (out_dir / "plots").mkdir(parents=True, exist_ok=True)

    print(f"loading {MODEL} ...", flush=True)
    pipe = DiffusionPipeline.from_pretrained(MODEL)
    pipe.scheduler = DDIMScheduler()
    pipe = pipe.to("cpu")
    sr = pipe.mel.get_sample_rate()
    clip_samples = pipe.mel.x_res * pipe.mel.hop_length  # ~5 s window
    print(f"pipeline sr={sr}, window={clip_samples/sr:.1f}s", flush=True)

    # Pick clean real clips from the Method-2 output.
    src = sorted((C.DATA_DIR / "real_labeled" / "audio").glob("*.wav"))
    src = [p for p in src if "_aug" not in p.name][: args.clips]

    rows = []
    t0 = time.time()
    for p in src:
        y, file_sr = sf.read(p)
        y = np.asarray(y, dtype=np.float32)
        if file_sr != sr:
            y = librosa.resample(y, orig_sr=file_sr, target_sr=sr)
        # take the loudest ~window to maximize singing content
        if len(y) < clip_samples:
            y = np.pad(y, (0, clip_samples - len(y)))
        y = y[:clip_samples]

        variants = [("original", y)]
        for strength in args.strengths:
            start_step = int((1.0 - strength) * args.steps)
            gen = torch.Generator(device="cpu").manual_seed(args.seed)
            out = pipe(raw_audio=y, start_step=start_step, steps=args.steps, generator=gen)
            audio = np.asarray(out.audios[0, 0], dtype=np.float32)
            variants.append((f"diff{strength:.2f}", audio))
            print(f"  {p.stem} strength={strength} -> {time.time()-t0:.0f}s", flush=True)

        # save wavs + a comparison spectrogram figure
        fig, axes = plt.subplots(1, len(variants), figsize=(4 * len(variants), 3))
        if len(variants) == 1:
            axes = [axes]
        for ax, (label, a) in zip(axes, variants):
            wav_name = f"{p.stem}__{label}.wav"
            sf.write(out_dir / "audio" / wav_name, a, sr, subtype="PCM_16")
            S = librosa.amplitude_to_db(np.abs(librosa.stft(a, n_fft=1024, hop_length=256)),
                                        ref=np.max)
            ax.imshow(S, origin="lower", aspect="auto", cmap="magma")
            ax.set_title(f"{p.stem}\n{label}", fontsize=8)
            ax.set_xticks([]); ax.set_yticks([])
        fig.tight_layout()
        fig_name = f"{p.stem}_diffusion.png"
        fig.savefig(out_dir / "plots" / fig_name, dpi=90)
        plt.close(fig)
        rows.append((p.stem, [v[0] for v in variants], fig_name))

    _write_html(rows, args.strengths)
    print(f"\nDiffused {len(src)} clips in {time.time()-t0:.0f}s")
    print(f"Gallery: {out_dir / 'index.html'}")


def _write_html(rows, strengths) -> None:
    out_dir = C.DATA_DIR / "diffused"
    P = ["<!doctype html><meta charset='utf-8'><title>Diffused real samples</title>",
         "<style>body{font-family:system-ui,Arial;margin:2rem;max-width:1100px}"
         "img{max-width:100%;border:1px solid #ddd;border-radius:6px}"
         ".clip{margin:1rem 0;padding:1rem;background:#fafafa;border-radius:8px}"
         "audio{width:220px}</style>",
         "<h1>Diffusion variations of real (vocadito) clips</h1>",
         "<p>Audio-to-audio diffusion (SDEdit) with teticio/audio-diffusion-256. "
         "Higher strength = more noise added before denoising = more changed. "
         "Labels are NOT preserved (regenerated audio).</p>"]
    for stem, labels, fig in rows:
        P.append("<div class='clip'>")
        P.append(f"<b>{stem}</b><br>")
        for label in labels:
            wav = f"audio/{stem}__{label}.wav"
            P.append(f"<span>{label}</span><br><audio controls src='{wav}'></audio> ")
        P.append(f"<br><img src='plots/{fig}'>")
        P.append("</div>")
    (out_dir / "index.html").write_text("\n".join(P))


if __name__ == "__main__":
    main()
