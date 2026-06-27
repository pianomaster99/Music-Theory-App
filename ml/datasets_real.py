"""Method 2 helpers: load real datasets that ship frame-level f0 labels and slice
them into fixed-length clips aligned to our 10 ms grid.

Primary source: **vocadito** (40 solo monophonic singing excerpts, 7 languages,
human-corrected frame-level f0, CC BY 4.0) via ``mirdata``. The loader is written
so other f0-labeled mirdata datasets can be added the same way.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

import config as C
import dataset_common as dc

try:
    import librosa
except Exception:  # pragma: no cover
    librosa = None


@dataclass
class RealClip:
    clip_id: str
    audio: np.ndarray       # 16 kHz mono float32
    f0: np.ndarray          # Hz, on the 10 ms grid (0 = unvoiced)
    voiced: np.ndarray      # bool, 10 ms grid
    source: str
    license: str
    meta: dict


def _segment_track(
    audio16: np.ndarray,
    times: np.ndarray,
    freqs: np.ndarray,
    voicing: np.ndarray,
    *,
    track_id: str,
    source: str,
    license: str,
    meta: dict,
    segment_s: float,
    stride_s: float,
):
    seg = int(segment_s * C.SR)
    stride = int(stride_s * C.SR)
    n = len(audio16)
    voiced_all = (voicing > 0) & np.isfinite(freqs) & (freqs > 0)
    freqs = np.where(voiced_all, freqs, 0.0)

    k = 0
    for s in range(0, max(1, n - seg + 1), stride):
        a = audio16[s : s + seg]
        if len(a) < int(0.75 * seg):
            continue
        t0 = s / C.SR
        rel = times - t0
        m = (rel >= -0.02) & (rel <= segment_s + 0.02)
        if m.sum() < 5:
            continue
        f0_grid, voiced_grid = dc.resample_f0_to_grid(
            rel[m], freqs[m], len(a), voiced=voiced_all[m]
        )
        # Clamp to plausible sung range.
        bad = (f0_grid < C.F0_FLOOR_HZ) | (f0_grid > C.F0_CEIL_HZ)
        f0_grid = np.where(bad, 0.0, f0_grid)
        voiced_grid = voiced_grid & (f0_grid > 0)
        if voiced_grid.mean() < 0.05:
            continue
        yield RealClip(
            clip_id=f"{track_id}_seg{k:03d}",
            audio=a.astype(np.float32),
            f0=f0_grid.astype(np.float32),
            voiced=voiced_grid,
            source=source,
            license=license,
            meta=meta,
        )
        k += 1


def vocadito_clips(segment_s: float = 4.0, stride_s: float = 3.0, max_tracks: int | None = None):
    """Yield fixed-length labeled clips from vocadito (downloads on first use)."""
    import mirdata

    ds = mirdata.initialize("vocadito", data_home=str(C.CORPORA_DIR / "vocadito"))
    try:
        ds.validate()
    except Exception:
        ds.download()

    track_ids = ds.track_ids
    if max_tracks:
        track_ids = track_ids[:max_tracks]

    for tid in track_ids:
        t = ds.track(tid)
        y, sr = t.audio
        if librosa is not None and sr != C.SR:
            y = librosa.resample(np.asarray(y, dtype=np.float32), orig_sr=sr, target_sr=C.SR)
        f0 = t.f0
        meta = {
            "dataset": "vocadito",
            "language": t.language,
            "singer_id": t.singer_id,
        }
        yield from _segment_track(
            np.asarray(y, dtype=np.float32),
            np.asarray(f0.times, dtype=np.float64),
            np.asarray(f0.frequencies, dtype=np.float64),
            np.asarray(f0.voicing, dtype=np.float64),
            track_id=f"vocadito_{tid}",
            source="vocadito",
            license="CC BY 4.0",
            meta=meta,
            segment_s=segment_s,
            stride_s=stride_s,
        )


def vocadito_audio_segments(
    segment_s: float = 4.0,
    stride_s: float = 3.0,
    track_start: int = 0,
    track_end: int | None = None,
):
    """Yield raw (unlabeled) audio segments from vocadito tracks ``[start:end]``.

    Used by Method 3, which deliberately *ignores* the ground-truth labels and
    re-labels with a teacher model. A disjoint track range from Method 2 avoids
    leakage between the two methods.
    """
    import mirdata

    ds = mirdata.initialize("vocadito", data_home=str(C.CORPORA_DIR / "vocadito"))
    try:
        ds.validate()
    except Exception:
        ds.download()

    track_ids = ds.track_ids[track_start:track_end]
    seg = int(segment_s * C.SR)
    stride = int(stride_s * C.SR)
    for tid in track_ids:
        t = ds.track(tid)
        y, sr = t.audio
        y = np.asarray(y, dtype=np.float32)
        if librosa is not None and sr != C.SR:
            y = librosa.resample(y, orig_sr=sr, target_sr=C.SR)
        meta = {"dataset": "vocadito", "language": t.language, "singer_id": t.singer_id}
        for k, s in enumerate(range(0, max(1, len(y) - seg + 1), stride)):
            a = y[s : s + seg]
            if len(a) >= int(0.75 * seg):
                yield f"vocadito_{tid}_seg{k:03d}", a.astype(np.float32), meta


def vocalset_audio_segments(
    segment_s: float = 4.0,
    stride_s: float = 4.0,
    track_start: int = 0,
    track_end: int | None = None,
    root: str | None = None,
):
    """Yield raw (unlabeled) audio segments from the VocalSet corpus.

    VocalSet is ~10 h of solo singing from 20 singers (vowels, scales, arpeggios,
    many techniques) - a large, diverse UNLABELED supply for distillation. Files
    are walked in sorted order; ``track_start``/``track_end`` slice the file list
    so successive lazy iterations pull disjoint, never-before-seen audio.
    """
    import glob
    import os
    from collections import OrderedDict

    base = root or str(C.CORPORA_DIR / "vocalset")
    wavs = sorted(glob.glob(os.path.join(base, "**", "*.wav"), recursive=True))
    # Prefer the canonical FULL/ tree if present (skips any stray duplicates).
    full = [w for w in wavs if f"{os.sep}FULL{os.sep}" in w]
    wavs = full or wavs

    def _singer(p):
        parts = os.path.relpath(p, base).split(os.sep)
        return parts[1] if len(parts) > 2 else (parts[0] if parts else "x")

    # Round-robin across singers so any prefix of the list spans MANY voices
    # (diversity matters more than hours for robustness).
    by_singer: "OrderedDict[str, list]" = OrderedDict()
    for w in wavs:
        by_singer.setdefault(_singer(w), []).append(w)
    queues = list(by_singer.values())
    wavs = []
    while any(queues):
        for q in queues:
            if q:
                wavs.append(q.pop(0))
    wavs = wavs[track_start:track_end]

    seg = int(segment_s * C.SR)
    stride = int(stride_s * C.SR)
    for path in wavs:
        try:
            y, sr = (librosa.load(path, sr=C.SR, mono=True) if librosa is not None
                     else (None, None))
        except Exception:
            continue
        if y is None or len(y) < int(0.75 * seg):
            continue
        y = np.asarray(y, dtype=np.float32)
        rel = os.path.relpath(path, base)
        parts = rel.replace(".wav", "").split(os.sep)
        singer = parts[1] if len(parts) > 2 else (parts[0] if parts else "unknown")
        technique = parts[-2] if len(parts) >= 2 else ""
        tag = "_".join(parts).replace(" ", "")
        meta = {"dataset": "vocalset", "singer_id": singer, "technique": technique}
        for k, s in enumerate(range(0, max(1, len(y) - seg + 1), stride)):
            a = y[s : s + seg]
            if len(a) >= int(0.75 * seg):
                yield f"vocalset_{tag}_seg{k:03d}", a.astype(np.float32), meta


def _emit_round_robin(file_iters):
    """Interleave per-file segment generators so the first N items span as many
    distinct files/singers as possible (one segment from each in turn).

    ``file_iters`` is an iterable of *generators* (lazy: a file's audio is only
    loaded on the first ``next`` of its generator), so consuming only the first
    K items loads at most K files.
    """
    active = list(file_iters)
    while active:
        nxt = []
        for it in active:
            try:
                item = next(it)
            except StopIteration:
                continue
            yield item
            nxt.append(it)
        active = nxt


def opensinger_audio_segments(
    segment_s: float = 4.0,
    stride_s: float = 4.0,
    track_start: int = 0,
    track_end: int | None = None,
    root: str | None = None,
):
    """Yield raw (unlabeled) audio segments from OpenSinger (HF mirror).

    OpenSinger ships as parquet shards (``original`` config) holding short solo
    singing segments with an ``id`` like ``25_<song>_<seg>`` and a ``gender``.
    The distinct-singer key is ``<gender><leading-number>`` (e.g. ``M25``), giving
    ~74 voices. Rows are ordered round-robin by singer so any prefix of the list
    spans as many voices as possible; ``track_start``/``track_end`` slice that
    round-robin list so lazy iterations pull disjoint, fresh singers/clips.
    """
    import glob
    import io
    import os
    from collections import OrderedDict

    import pyarrow.parquet as pq
    import soundfile as sf

    base = root or str(C.CORPORA_DIR / "opensinger_hf")
    parquets = sorted(glob.glob(os.path.join(base, "**", "*.parquet"), recursive=True))
    if not parquets:
        return

    # Cheap pass over (id, gender) only to build a per-row singer index.
    index = []  # (singer, file_idx, row_idx)
    for fi, p in enumerate(parquets):
        tbl = pq.read_table(p, columns=["id", "gender"])
        ids = tbl.column("id").to_pylist()
        genders = tbl.column("gender").to_pylist()
        for ri, (idv, g) in enumerate(zip(ids, genders)):
            num = str(idv).split("_", 1)[0]
            index.append((f"{g or 'x'}{num}", fi, ri))

    by_singer: "OrderedDict[str, list]" = OrderedDict()
    for item in index:
        by_singer.setdefault(item[0], []).append(item)
    queues = list(by_singer.values())
    order = []
    while any(queues):
        for q in queues:
            if q:
                order.append(q.pop(0))
    order = order[track_start:track_end]

    seg = int(segment_s * C.SR)
    stride = int(stride_s * C.SR)
    file_cache: dict = {}

    def _rows(fi):
        if fi not in file_cache:
            tbl = pq.read_table(parquets[fi], columns=["audio", "id"])
            file_cache[fi] = (tbl.column("audio").to_pylist(), tbl.column("id").to_pylist())
        return file_cache[fi]

    def _one_row(singer, fi, ri):
        audio_rows, ids = _rows(fi)
        try:
            y, sr = sf.read(io.BytesIO(audio_rows[ri]["bytes"]), dtype="float32")
        except Exception:
            return
        y = np.asarray(y, dtype=np.float32)
        if y.ndim > 1:
            y = y.mean(axis=1)
        if librosa is not None and sr != C.SR:
            y = librosa.resample(y, orig_sr=sr, target_sr=C.SR)
        if len(y) < int(0.75 * seg):
            return
        tag = str(ids[ri]).replace(" ", "").replace("/", "_")
        meta = {"dataset": "opensinger", "singer_id": singer}
        for k, s in enumerate(range(0, max(1, len(y) - seg + 1), stride)):
            a = y[s : s + seg]
            if len(a) >= int(0.75 * seg):
                yield f"opensinger_{tag}_seg{k:03d}", a.astype(np.float32), meta

    yield from _emit_round_robin(_one_row(*o) for o in order)


def jvs_music_audio_segments(
    segment_s: float = 4.0,
    stride_s: float = 4.0,
    track_start: int = 0,
    track_end: int | None = None,
    root: str | None = None,
):
    """Yield raw (unlabeled) audio segments from JVS-MuSiC.

    JVS-MuSiC = 100 Japanese speakers each singing a common song plus a unique
    one (``jvs001``..``jvs100``/``song_*``/``wav``/``*.wav``). The singer dir is
    the diversity key; files are walked round-robin by singer so any prefix spans
    all 100 voices.
    """
    import glob
    import os
    from collections import OrderedDict

    base = root or str(C.CORPORA_DIR / "jvs_music")
    wavs = sorted(glob.glob(os.path.join(base, "**", "*.wav"), recursive=True))
    # Keep only the natural recordings ("raw.wav"); skip tempo/pitch-corrected
    # "modified*.wav" so we don't train on shifted near-duplicates.
    wavs = [w for w in wavs if os.path.basename(w) == "raw.wav"]
    if not wavs:
        return

    def _singer(p):
        import re

        m = re.search(r"(jvs\d{3})", p)
        return m.group(1) if m else os.path.basename(os.path.dirname(p))

    by_singer: "OrderedDict[str, list]" = OrderedDict()
    for w in wavs:
        by_singer.setdefault(_singer(w), []).append(w)
    queues = list(by_singer.values())
    wavs = []
    while any(queues):
        for q in queues:
            if q:
                wavs.append(q.pop(0))
    wavs = wavs[track_start:track_end]

    seg = int(segment_s * C.SR)
    stride = int(stride_s * C.SR)

    def _one_file(path):
        try:
            y, sr = (librosa.load(path, sr=C.SR, mono=True) if librosa is not None
                     else (None, None))
        except Exception:
            return
        if y is None or len(y) < int(0.75 * seg):
            return
        y = np.asarray(y, dtype=np.float32)
        singer = _singer(path)
        # Distinguish the singer's two songs (song_common vs song_unique).
        song = "common" if "song_common" in path else ("unique" if "song_unique" in path else "song")
        meta = {"dataset": "jvs_music", "singer_id": singer}
        for k, s in enumerate(range(0, max(1, len(y) - seg + 1), stride)):
            a = y[s : s + seg]
            if len(a) >= int(0.75 * seg):
                yield f"jvsmusic_{singer}_{song}_seg{k:03d}", a.astype(np.float32), meta

    yield from _emit_round_robin(_one_file(p) for p in wavs)


def gtsinger_audio_segments(
    segment_s: float = 4.0,
    stride_s: float = 4.0,
    track_start: int = 0,
    track_end: int | None = None,
    root: str | None = None,
):
    """Yield raw (unlabeled) audio segments from GTSinger.

    Layout: ``<Language>/<Singer>/<Technique>/<Song>/.../NNNN.wav`` (e.g.
    ``Chinese/ZH-Alto-1/Breathy/...``). The diversity key is ``Language/Singer``
    (~20 singers across 9 languages). Files are emitted segment-round-robin by
    singer so any prefix spans as many distinct voices/languages as available.
    """
    import glob
    import os

    base = root or str(C.CORPORA_DIR / "gtsinger")
    wavs = sorted(glob.glob(os.path.join(base, "**", "*.wav"), recursive=True))
    if not wavs:
        return

    def _singer(p):
        parts = os.path.relpath(p, base).split(os.sep)
        return "/".join(parts[:2]) if len(parts) >= 2 else parts[0]

    by_singer: "OrderedDict[str, list]" = __import__("collections").OrderedDict()
    for w in wavs:
        by_singer.setdefault(_singer(w), []).append(w)
    queues = list(by_singer.values())
    wavs = []
    while any(queues):
        for q in queues:
            if q:
                wavs.append(q.pop(0))
    wavs = wavs[track_start:track_end]

    seg = int(segment_s * C.SR)
    stride = int(stride_s * C.SR)

    def _one_file(path):
        try:
            y, sr = (librosa.load(path, sr=C.SR, mono=True) if librosa is not None
                     else (None, None))
        except Exception:
            return
        if y is None or len(y) < int(0.75 * seg):
            return
        y = np.asarray(y, dtype=np.float32)
        singer = _singer(path)
        tag = singer.replace("/", "_").replace(" ", "")
        meta = {"dataset": "gtsinger", "singer_id": singer}
        for k, s in enumerate(range(0, max(1, len(y) - seg + 1), stride)):
            a = y[s : s + seg]
            if len(a) >= int(0.75 * seg):
                yield f"gtsinger_{tag}_seg{k:03d}", a.astype(np.float32), meta

    yield from _emit_round_robin(_one_file(p) for p in wavs)


def ravdess_audio_segments(
    segment_s: float = 4.0,
    stride_s: float = 4.0,
    track_start: int = 0,
    track_end: int | None = None,
    root: str | None = None,
):
    """Yield raw (unlabeled) sung audio segments from RAVDESS (singing subset).

    Loaded from the HF parquet shards (``audio.bytes`` + a label/actor field).
    RAVDESS has 24 actors; the actor id is parsed from the filename
    (``03-..-..-..-..-..-NN.wav`` -> actor ``NN``) and used as the singer key,
    emitted round-robin so any prefix spans many actors.
    """
    import glob
    import io
    import os
    import re

    import pyarrow.parquet as pq
    import soundfile as sf

    base = root or str(C.CORPORA_DIR / "ravdess" / "data")
    parquets = sorted(p for p in glob.glob(os.path.join(base, "*.parquet"))
                      if os.path.getsize(p) > 0)
    if not parquets:
        return

    # Build a (actor, file_idx, row_idx) index by reading only light columns.
    index = []
    file_cols: dict = {}
    for fi, p in enumerate(parquets):
        tbl = pq.read_table(p)
        names = tbl.column_names
        audio_col = next((c for c in names if "audio" in c.lower()), names[0])
        path_col = next((c for c in names if c.lower() in ("path", "file", "filename", "audio_path")), None)
        rows = tbl.to_pylist()
        file_cols[fi] = (rows, audio_col, path_col)
        for ri, r in enumerate(rows):
            actor = "x"
            src = ""
            a = r.get(audio_col)
            if isinstance(a, dict) and a.get("path"):
                src = str(a["path"])
            elif path_col and r.get(path_col):
                src = str(r[path_col])
            # RAVDESS filename: modality-channel-emotion-intensity-statement-
            # repetition-ACTOR.wav -> the actor id is the final two digits.
            m = re.search(r"(\d\d)\.wav", src)
            if m:
                actor = f"actor{m.group(1)}"
            index.append((actor, fi, ri))

    by_singer: "OrderedDict[str, list]" = __import__("collections").OrderedDict()
    for item in index:
        by_singer.setdefault(item[0], []).append(item)
    queues = list(by_singer.values())
    order = []
    while any(queues):
        for q in queues:
            if q:
                order.append(q.pop(0))
    order = order[track_start:track_end]

    seg = int(segment_s * C.SR)
    stride = int(stride_s * C.SR)

    def _one_row(actor, fi, ri):
        rows, audio_col, _ = file_cols[fi]
        a = rows[ri].get(audio_col)
        try:
            if isinstance(a, dict) and a.get("bytes"):
                y, sr = sf.read(io.BytesIO(a["bytes"]), dtype="float32")
            elif isinstance(a, dict) and a.get("array") is not None:
                y, sr = np.asarray(a["array"], dtype=np.float32), int(a.get("sampling_rate", C.SR))
            else:
                return
        except Exception:
            return
        y = np.asarray(y, dtype=np.float32)
        if y.ndim > 1:
            y = y.mean(axis=1)
        if librosa is not None and sr != C.SR:
            y = librosa.resample(y, orig_sr=sr, target_sr=C.SR)
        if len(y) < int(0.75 * seg):
            return
        meta = {"dataset": "ravdess", "singer_id": actor}
        for k, s in enumerate(range(0, max(1, len(y) - seg + 1), stride)):
            seg_a = y[s : s + seg]
            if len(seg_a) >= int(0.75 * seg):
                yield f"ravdess_{actor}_{fi}_{ri}_seg{k:03d}", seg_a.astype(np.float32), meta

    yield from _emit_round_robin(_one_row(*o) for o in order)


# Registry of UNLABELED audio sources for the distillation pipeline.
UNLABELED_SOURCES = {
    "vocadito": vocadito_audio_segments,
    "vocalset": vocalset_audio_segments,
    "opensinger": opensinger_audio_segments,
    "jvs_music": jvs_music_audio_segments,
    "gtsinger": gtsinger_audio_segments,
    "ravdess": ravdess_audio_segments,
}

# Registry so the driver can iterate available real (labeled) datasets.
REAL_SOURCES = {
    "vocadito": vocadito_clips,
}
