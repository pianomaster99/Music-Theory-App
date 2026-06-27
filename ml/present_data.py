"""Build the spec milestone-2 presentation of the generated data.

Reads data/manifest.jsonl and, per method, produces:
  * per-clip figures: log-mel spectrogram + overlaid f0 contour, and the
    Gaussian pitch-bin target the model will be trained against;
  * a pitch-distribution histogram and a voiced/confidence summary;
  * a cross-method pitch-coverage comparison;
  * data/report.md (embeds plots, links audio, stats tables) and
    data/index.html (gallery with inline audio players).

Usage:
    python present_data.py [--examples 3]
"""
from __future__ import annotations

import argparse
import csv
import html
from collections import defaultdict

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

import config as C
import dataset_common as dc
import features
import pitch

_METHOD_TITLE = {
    "synthetic": "Method 1 - Synthetic singing (exact labels)",
    "real_labeled": "Method 2 - Real labeled (vocadito) + noise",
    "distilled": "Method 3 - Real unlabeled + AI (CREPE) pseudo-labels",
}
_MEL_CENTERS = features.mel_center_freqs()


def _hz_to_mel_row(f0_hz: np.ndarray) -> np.ndarray:
    """Map f0 (Hz) to fractional mel-bin row for overlay (NaN where unvoiced)."""
    rows = np.interp(f0_hz, _MEL_CENTERS, np.arange(len(_MEL_CENTERS)),
                     left=np.nan, right=np.nan)
    return np.where(f0_hz > 0, rows, np.nan)


def note_timeline(f0: np.ndarray, voiced: np.ndarray, min_dur_s: float = 0.06):
    """Group frames into a readable note sequence: list of (start_s, end_s, note).

    Consecutive frames mapped to the same nearest semitone are merged; voiced
    gaps become rests (skipped). Very short blips below ``min_dur_s`` are dropped.
    """
    dt = 1.0 / C.FRAME_RATE
    midi = np.where(voiced & (f0 > 0),
                    np.round(69 + 12 * np.log2(np.where(f0 > 0, f0, 440) / 440.0)),
                    np.nan)
    events = []
    i, n = 0, len(midi)
    while i < n:
        if np.isnan(midi[i]):
            i += 1
            continue
        j = i
        while j < n and midi[j] == midi[i]:
            j += 1
        dur = (j - i) * dt
        if dur >= min_dur_s:
            m = int(midi[i])
            note = f"{pitch._NOTE_NAMES[m % 12]}{m // 12 - 1}"
            events.append((round(i * dt, 2), round(j * dt, 2), note))
        i = j
    return events


def export_label_csv(rec: dict) -> str:
    """Write per-frame labels (time, f0_hz, note, voiced, conf) to a CSV next to
    the clip. Returns the path relative to DATA_DIR for linking."""
    f0, voiced, conf = dc.load_labels(rec["label_path"])
    method = rec["method"]
    out_dir = C.DATA_DIR / method / "labels_csv"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{rec['clip_id']}.csv"
    dt = 1.0 / C.FRAME_RATE
    with open(out_path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["time_s", "f0_hz", "note", "voiced", "confidence"])
        for i in range(len(f0)):
            note = pitch.hz_to_note_name(float(f0[i])) if voiced[i] else ""
            w.writerow([f"{i * dt:.3f}", f"{float(f0[i]):.2f}", note,
                        int(bool(voiced[i])), f"{float(conf[i]):.3f}"])
    return f"{method}/labels_csv/{rec['clip_id']}.csv"


def _clip_figure(rec: dict, out_png) -> None:
    import soundfile as sf

    y, _ = sf.read(C.ML_DIR / rec["audio_path"])
    y = np.asarray(y, dtype=np.float32)
    f0, voiced, conf = dc.load_labels(rec["label_path"])
    log_mel = features.log_mel(y)
    T = min(len(f0), log_mel.shape[0])
    f0, voiced, conf, log_mel = f0[:T], voiced[:T], conf[:T], log_mel[:T]
    t = np.arange(T) / C.FRAME_RATE
    f0_plot = np.where(voiced, f0, np.nan)

    fig, axes = plt.subplots(2, 1, figsize=(9, 5.2), sharex=True)
    # --- log-mel + f0 overlay ---
    ax = axes[0]
    ax.imshow(log_mel.T, origin="lower", aspect="auto",
              extent=[0, t[-1] if T > 1 else 1, 0, log_mel.shape[1]], cmap="magma")
    ax.plot(t, _hz_to_mel_row(f0_plot), color="cyan", lw=1.6, label="f0 label")
    ax.set_ylabel("mel bin")
    ax.set_title(f"{rec['clip_id']}  |  {rec['source']}  |  "
                 f"{rec['duration_s']}s  |  voiced {100*rec['voiced_frac']:.0f}%"
                 + ("  [augmented]" if rec.get("augmented") else ""), fontsize=9)
    ax.legend(loc="upper right", fontsize=7)

    # --- pitch-bin Gaussian target (what the model predicts) ---
    ax = axes[1]
    target = pitch.f0_to_target(f0, voiced)
    ax.imshow(target.T, origin="lower", aspect="auto",
              extent=[0, t[-1] if T > 1 else 1, 0, C.N_PITCH_CLASSES], cmap="viridis")
    ax.set_ylabel("piano key (88: A0-C8)")
    ax.set_xlabel("time (s)")
    if rec["method"] == "distilled":
        ax2 = ax.twinx()
        ax2.plot(t, conf, color="orange", lw=0.9, alpha=0.8)
        ax2.set_ylim(0, 1)
        ax2.set_ylabel("teacher conf", color="orange", fontsize=8)
    fig.tight_layout()
    fig.savefig(out_png, dpi=90)
    plt.close(fig)


def _method_pitch_hist(rows: list[dict], method: str, out_png) -> dict:
    notes_hz = []
    voiced_fracs = []
    durs = []
    for r in rows:
        f0, voiced, _ = dc.load_labels(r["label_path"])
        notes_hz.append(f0[voiced & (f0 > 0)])
        voiced_fracs.append(r["voiced_frac"])
        durs.append(r["duration_s"])
    allf = np.concatenate(notes_hz) if notes_hz else np.array([])

    fig, ax = plt.subplots(figsize=(7, 2.6))
    if allf.size:
        midi = 69 + 12 * np.log2(allf / 440.0)
        ax.hist(midi, bins=np.arange(24, 96, 1), color="#4C72B0")
        ax.set_xlabel("pitch (MIDI note number)")
        ax.set_ylabel("frames")
    ax.set_title(f"{_METHOD_TITLE[method]} - pitch coverage", fontsize=9)
    fig.tight_layout()
    fig.savefig(out_png, dpi=90)
    plt.close(fig)

    return {
        "clips": len(rows),
        "clean": sum(1 for r in rows if not r.get("augmented")),
        "augmented": sum(1 for r in rows if r.get("augmented")),
        "minutes": round(sum(durs) / 60, 1),
        "voiced_pct": round(100 * float(np.mean(voiced_fracs)) if voiced_fracs else 0, 1),
        "f0_lo": round(float(allf.min()), 1) if allf.size else 0.0,
        "f0_hi": round(float(allf.max()), 1) if allf.size else 0.0,
        "note_lo": pitch.hz_to_note_name(float(allf.min())) if allf.size else "-",
        "note_hi": pitch.hz_to_note_name(float(allf.max())) if allf.size else "-",
        "licenses": sorted({r["license"] for r in rows}),
        "sources": sorted({r["source"].split("+")[0] for r in rows}),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--examples", type=int, default=3)
    args = ap.parse_args()

    C.ensure_dirs()
    plots = C.DATA_DIR / "plots"
    plots.mkdir(parents=True, exist_ok=True)

    manifest = dc.read_manifest()
    if not manifest:
        print("No manifest found. Run the datagen_*.py scripts first.")
        return

    by_method: dict[str, list[dict]] = defaultdict(list)
    for r in manifest:
        by_method[r["method"]].append(r)

    rng = np.random.default_rng(0)
    stats: dict[str, dict] = {}
    examples: dict[str, list[tuple[dict, str]]] = {}

    for method in C.METHODS:
        rows = by_method.get(method, [])
        if not rows:
            continue
        stats[method] = _method_pitch_hist(rows, method, plots / f"{method}_hist.png")
        # Prefer clean clips for the example figures.
        clean = [r for r in rows if not r.get("augmented")] or rows
        idx = rng.choice(len(clean), size=min(args.examples, len(clean)), replace=False)
        def _entry(rec, png_name):
            f0, voiced, _ = dc.load_labels(rec["label_path"])
            tl = note_timeline(f0, voiced)
            return (rec, png_name, tl, export_label_csv(rec))

        ex = []
        for k, i in enumerate(sorted(idx)):
            rec = clean[int(i)]
            png = plots / f"{method}_ex{k}.png"
            _clip_figure(rec, png)
            ex.append(_entry(rec, png.name))
        # one augmented example to show robustness, if any
        aug = [r for r in rows if r.get("augmented")]
        if aug:
            rec = aug[int(rng.integers(len(aug)))]
            png = plots / f"{method}_aug.png"
            _clip_figure(rec, png)
            ex.append(_entry(rec, png.name))
        examples[method] = ex
        print(f"  rendered {method}: {len(ex)} figures, stats={stats[method]['clips']} clips")

    # Export per-frame label CSVs for EVERY clip so any clip is inspectable.
    n_csv = 0
    for r in manifest:
        export_label_csv(r)
        n_csv += 1
    print(f"  exported {n_csv} per-clip label CSVs")

    _write_report(stats, examples)
    _write_html(stats, examples)
    print(f"\nReport:  {C.DATA_DIR / 'report.md'}")
    print(f"Gallery: {C.DATA_DIR / 'index.html'}")


def _write_report(stats: dict, examples: dict) -> None:
    L = ["# Singing-Voice Pitch Data - Generation Report (spec milestone 2)\n",
         "Three data-generation methods from `spec.md`. Labels are on a 10 ms grid "
         "(100 Hz), 16 kHz audio; the pitch target is a DISCRETE one-hot over the "
         "88 piano keys (A0-C8, MIDI 21-108) plus a voicing flag.\n",
         "## Summary\n",
         "| Method | Clips (clean/aug) | Audio | Voiced | Pitch range | Sources | License |",
         "|---|---|---|---|---|---|---|"]
    for m in C.METHODS:
        s = stats.get(m)
        if not s:
            continue
        L.append(f"| {_METHOD_TITLE[m]} | {s['clips']} ({s['clean']}/{s['augmented']}) | "
                 f"{s['minutes']} min | {s['voiced_pct']}% | "
                 f"{s['f0_lo']}-{s['f0_hi']} Hz ({s['note_lo']}-{s['note_hi']}) | "
                 f"{', '.join(s['sources'])} | {', '.join(s['licenses'])} |")
    L.append("")
    for m in C.METHODS:
        if m not in stats:
            continue
        L.append(f"## {_METHOD_TITLE[m]}\n")
        L.append(f"![hist](plots/{m}_hist.png)\n")
        for rec, png, tl, csvrel in examples.get(m, []):
            L.append(f"**{rec['clip_id']}** - `{rec['source']}` "
                     f"({rec['duration_s']}s){'  [augmented]' if rec.get('augmented') else ''}  ")
            L.append(f"[audio]({rec['audio_path'].replace('data/', '')}) | "
                     f"[labels CSV]({csvrel})\n")
            notes = " ".join(f"{n}({a:.1f}-{b:.1f}s)" for a, b, n in tl[:12])
            if notes:
                L.append(f"Notes (label): {notes}{' ...' if len(tl) > 12 else ''}\n")
            L.append(f"![{rec['clip_id']}](plots/{png})\n")
    (C.DATA_DIR / "report.md").write_text("\n".join(L))


def _write_html(stats: dict, examples: dict) -> None:
    P = ["<!doctype html><meta charset='utf-8'><title>Singing pitch data</title>",
         "<style>body{font-family:system-ui,Arial;margin:2rem;max-width:1000px}"
         "img{max-width:100%;border:1px solid #ddd;border-radius:6px}"
         "table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}"
         ".clip{margin:1rem 0;padding:1rem;background:#fafafa;border-radius:8px}"
         "h2{margin-top:2rem}</style>",
         "<h1>Singing-Voice Pitch Data - milestone 2</h1>",
         "<p>16 kHz, 10 ms frame grid; target = 88 discrete piano keys (A0-C8) + voicing.</p>",
         "<table><tr><th>Method</th><th>Clips</th><th>Audio</th><th>Voiced</th>"
         "<th>Pitch range</th><th>License</th></tr>"]
    for m in C.METHODS:
        s = stats.get(m)
        if not s:
            continue
        P.append(f"<tr><td>{html.escape(_METHOD_TITLE[m])}</td>"
                 f"<td>{s['clips']} ({s['clean']}/{s['augmented']})</td><td>{s['minutes']} min</td>"
                 f"<td>{s['voiced_pct']}%</td>"
                 f"<td>{s['f0_lo']}-{s['f0_hi']} Hz ({s['note_lo']}-{s['note_hi']})</td>"
                 f"<td>{html.escape(', '.join(s['licenses']))}</td></tr>")
    P.append("</table>")
    for m in C.METHODS:
        if m not in stats:
            continue
        P.append(f"<h2>{html.escape(_METHOD_TITLE[m])}</h2>")
        P.append(f"<img src='plots/{m}_hist.png'>")
        for rec, png, tl, csvrel in examples.get(m, []):
            audio_rel = rec["audio_path"].replace("data/", "")
            notes = " ".join(f"{html.escape(n)} <span style='color:#888'>"
                             f"({a:.1f}-{b:.1f}s)</span>" for a, b, n in tl[:16])
            P.append("<div class='clip'>")
            P.append(f"<b>{rec['clip_id']}</b> - {html.escape(rec['source'])} "
                     f"({rec['duration_s']}s){' [augmented]' if rec.get('augmented') else ''}<br>")
            P.append(f"<audio controls src='{audio_rel}'></audio> "
                     f"&nbsp; <a href='{csvrel}'>labels CSV &darr;</a><br>")
            if notes:
                P.append(f"<div style='font-size:13px;margin:.4rem 0'>"
                         f"<b>Note labels:</b> {notes}{' ...' if len(tl) > 16 else ''}</div>")
            P.append(f"<img src='plots/{png}'>")
            P.append("</div>")
    (C.DATA_DIR / "index.html").write_text("\n".join(P))


if __name__ == "__main__":
    main()
