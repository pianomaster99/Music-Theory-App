"""Presentation for the FINAL labeled data (Updated Data Generation Plan).

For each source clip it shows:
  * the three audio variants (original / general-aug / background-noise) as
    inline players - all share ONE label;
  * a figure comparing the FINE CREPE pitch-time labels (wavering, with slides)
    against the COARSE AI-cleaned note labels (stable, min-duration);
  * the clean note list and a link to the final per-frame label CSV.

Outputs data/final_report.md and data/final.html.

Usage:  python present_final.py [--examples 6]
"""
from __future__ import annotations

import argparse
import csv
import html
from collections import OrderedDict

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import soundfile as sf

import config as C
import dataset_common as dc
import features
import pitch

_MEL_CENTERS = features.mel_center_freqs()
_VARIANT_LABEL = {"orig": "original (clean)", "aug": "general aug (EQ/gain/codec/noise)",
                  "bg": "background noise"}


def _hz_to_mel_row(f0_hz: np.ndarray) -> np.ndarray:
    rows = np.interp(f0_hz, _MEL_CENTERS, np.arange(len(_MEL_CENTERS)),
                     left=np.nan, right=np.nan)
    return np.where(f0_hz > 0, rows, np.nan)


def _key_axis_ticks(ax):
    keys = [pitch.note_name_to_class(n) for n in ("C2", "C3", "C4", "C5", "C6")]
    ax.set_yticks([k for k in keys if k >= 0])
    ax.set_yticklabels([pitch.midi_to_note_name(pitch.class_to_midi(k))
                        for k in keys if k >= 0])


def _figure(base: str, orig_audio_rel: str, label_rel: str, out_png) -> list:
    d = np.load(C.ML_DIR / label_rel)
    coarse_f0, coarse_voiced = d["f0"], d["voiced"]
    fine_f0, fine_voiced = d["fine_f0"], d["fine_voiced"]
    notes = d["notes"]

    y, _ = sf.read(C.ML_DIR / orig_audio_rel)
    log_mel = features.log_mel(np.asarray(y, dtype=np.float32))
    T = min(len(coarse_f0), log_mel.shape[0])
    log_mel = log_mel[:T]
    t = np.arange(T) / C.FRAME_RATE
    fine_plot = np.where(fine_voiced[:T], fine_f0[:T], np.nan)
    coarse_plot = np.where(coarse_voiced[:T], coarse_f0[:T], np.nan)

    fine_key = np.where(fine_voiced[:T], pitch.hz_to_class(fine_f0[:T]), np.nan)
    coarse_key = np.where(coarse_voiced[:T], pitch.hz_to_class(coarse_f0[:T]), np.nan)

    fig, axes = plt.subplots(2, 1, figsize=(9.5, 5.6), sharex=True)
    ax = axes[0]
    ax.imshow(log_mel.T, origin="lower", aspect="auto",
              extent=[0, t[-1] if T > 1 else 1, 0, log_mel.shape[1]], cmap="magma")
    ax.plot(t, _hz_to_mel_row(fine_plot), color="cyan", lw=1.0, alpha=0.7,
            label="fine CREPE f0")
    ax.plot(t, _hz_to_mel_row(coarse_plot), color="#ff3b3b", lw=2.2,
            label="coarse AI note", solid_capstyle="butt")
    ax.set_ylabel("mel bin")
    ax.legend(loc="upper right", fontsize=7)
    ax.set_title(f"{base}  |  fine CREPE vs coarse AI labels", fontsize=9)

    ax = axes[1]
    ax.plot(t, fine_key, ".", color="#888", ms=2.2, label="fine CREPE key")
    ax.step(t, coarse_key, where="post", color="#ff3b3b", lw=2.0, label="coarse AI key")
    valid = coarse_key[~np.isnan(coarse_key)]
    fk = fine_key[~np.isnan(fine_key)]
    allk = np.concatenate([valid, fk]) if (valid.size or fk.size) else np.array([40.0])
    ax.set_ylim(max(0, allk.min() - 3), min(C.N_PITCH_CLASSES, allk.max() + 3))
    _key_axis_ticks(ax)
    ax.set_ylabel("piano key")
    ax.set_xlabel("time (s)")
    ax.legend(loc="upper right", fontsize=7)
    ax.grid(True, axis="y", alpha=0.2)
    fig.tight_layout()
    fig.savefig(out_png, dpi=90)
    plt.close(fig)

    note_list = [(int(s), int(e), int(k)) for s, e, k in notes] if notes.size else []
    return note_list


def _export_csv(base: str, label_rel: str) -> str:
    d = np.load(C.ML_DIR / label_rel)
    f0, voiced, conf = d["f0"], d["voiced"], d["conf"]
    out_dir = C.DATA_DIR / "final" / "labels_csv"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{base}.csv"
    dt = 1.0 / C.FRAME_RATE
    with open(out, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["time_s", "f0_hz", "note", "voiced", "teacher_conf"])
        for i in range(len(f0)):
            note = pitch.hz_to_note_name(float(f0[i])) if voiced[i] else ""
            w.writerow([f"{i*dt:.3f}", f"{float(f0[i]):.2f}", note,
                        int(bool(voiced[i])), f"{float(conf[i]):.3f}"])
    return f"final/labels_csv/{base}.csv"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--examples", type=int, default=6)
    args = ap.parse_args()

    plots = C.DATA_DIR / "plots"
    plots.mkdir(parents=True, exist_ok=True)

    rows = [r for r in dc.read_manifest() if r["method"] == "final"]
    if not rows:
        print("No 'final' data. Run datagen_pipeline.py first.")
        return

    # group variants by source clip
    groups: "OrderedDict[str, dict]" = OrderedDict()
    for r in rows:
        base = r["clip_id"].rsplit("__", 1)[0]
        g = groups.setdefault(base, {"label": r["label_path"], "variants": {}, "extra": r.get("extra", {})})
        g["variants"][r["extra"].get("variant", r["clip_id"].rsplit("__", 1)[-1])] = r["audio_path"]

    items = list(groups.items())[: args.examples]
    cards = []
    for k, (base, g) in enumerate(items):
        png = plots / f"final_ex{k}.png"
        orig_rel = g["variants"].get("orig") or next(iter(g["variants"].values()))
        notes = _figure(base, orig_rel, g["label"], png)
        csv_rel = _export_csv(base, g["label"])
        cards.append((base, g, png.name, notes, csv_rel))
        print(f"  rendered {base}: {len(notes)} notes")

    n_src = len(groups)
    tot_notes = 0
    for _, g in groups.items():
        d = np.load(C.ML_DIR / g["label"])
        tot_notes += int(d["notes"].shape[0])

    _write_html(cards, n_src, len(rows), tot_notes)
    _write_md(cards)
    print(f"\nGallery: {C.DATA_DIR / 'final.html'}")
    print(f"Report:  {C.DATA_DIR / 'final_report.md'}")


def _notes_str(notes) -> str:
    parts = []
    for s, e, kk in notes[:18]:
        parts.append(f"{pitch.midi_to_note_name(pitch.class_to_midi(kk))} "
                     f"({s/C.FRAME_RATE:.1f}-{e/C.FRAME_RATE:.1f}s)")
    return ", ".join(parts) + (" ..." if len(notes) > 18 else "")


def _write_html(cards, n_src, n_clips, tot_notes) -> None:
    P = ["<!doctype html><meta charset='utf-8'><title>Final labeled data</title>",
         "<style>body{font-family:system-ui,Arial;margin:2rem;max-width:1050px}"
         "img{max-width:100%;border:1px solid #ddd;border-radius:6px}"
         ".clip{margin:1.2rem 0;padding:1rem;background:#fafafa;border-radius:8px}"
         ".v{display:inline-block;margin:.3rem 1rem .3rem 0;font-size:13px}"
         "audio{height:32px;vertical-align:middle}h2{margin-top:1.6rem}</style>",
         "<h1>Final labeled data &mdash; CREPE &rarr; AI coarsening</h1>",
         f"<p>{n_src} source clips &times; 3 noise variations = {n_clips} audio files; "
         f"{tot_notes} clean note events. Each source has <b>original + general-aug + "
         "background-noise</b> audio, all sharing one label. The label is CREPE's fine "
         "pitch-time output cleaned by an AI agent into stable notes "
         "(min ~100&nbsp;ms hold; wavers &amp; slides dropped). "
         "Red = final AI note label, grey/cyan = raw CREPE.</p>"]
    for base, g, png, notes, csv_rel in cards:
        ex = g["extra"]
        P.append("<div class='clip'>")
        P.append(f"<b>{html.escape(base)}</b> &nbsp; "
                 f"<span style='color:#666'>fine voiced {int(100*ex.get('fine_voiced_frac',0))}% "
                 f"&rarr; coarse {int(100*ex.get('coarse_voiced_frac',0))}% &nbsp;|&nbsp; "
                 f"{ex.get('n_notes','?')} notes &nbsp;|&nbsp; coarsen={ex.get('coarsen','?')}</span><br>")
        for v in ("orig", "aug", "bg"):
            if v in g["variants"]:
                rel = g["variants"][v].replace("data/", "")
                P.append(f"<span class='v'>{_VARIANT_LABEL[v]}<br>"
                         f"<audio controls src='{rel}'></audio></span>")
        P.append(f"<br><a href='{csv_rel}'>final label CSV &darr;</a>")
        P.append(f"<div style='font-size:12.5px;margin:.4rem 0'><b>Notes:</b> "
                 f"{html.escape(_notes_str(notes))}</div>")
        P.append(f"<img src='plots/{png}'>")
        P.append("</div>")
    (C.DATA_DIR / "final.html").write_text("\n".join(P))


def _write_md(cards) -> None:
    L = ["# Final labeled data - CREPE -> AI coarsening\n",
         "Each source clip has original + general-aug + background-noise audio "
         "(one shared label). Label = CREPE fine f0 cleaned by an AI agent into "
         "stable notes (min ~100 ms; wavers/slides removed).\n"]
    for base, g, png, notes, csv_rel in cards:
        ex = g["extra"]
        L.append(f"## {base}\n")
        L.append(f"- coarsen: {ex.get('coarsen')} | notes: {ex.get('n_notes')} | "
                 f"fine voiced {int(100*ex.get('fine_voiced_frac',0))}% -> "
                 f"coarse {int(100*ex.get('coarse_voiced_frac',0))}%")
        for v in ("orig", "aug", "bg"):
            if v in g["variants"]:
                L.append(f"- {_VARIANT_LABEL[v]}: [audio]({g['variants'][v].replace('data/','')})")
        L.append(f"- [final label CSV]({csv_rel})")
        L.append(f"\nNotes: {_notes_str(notes)}\n")
        L.append(f"![{base}](plots/{png})\n")
    (C.DATA_DIR / "final_report.md").write_text("\n".join(L))


if __name__ == "__main__":
    main()
