"""Lazy-loading training loop (spec 'Updated Data Generation Plan').

Train on the current data; if it isn't good enough yet, pull MORE unlabeled
audio (next vocadito tracks), label+coarsen it via the pipeline, and retrain -
repeating until the target is met or the unlabeled pool / iteration budget is
exhausted.

Stop criterion uses VALIDATION loss by default (train loss alone goes to ~0 by
memorising a few clips, so it's a poor signal); pass --use-train-loss to follow
the spec's literal wording instead.

Usage:
    python lazy_train.py --target-val-loss 0.5 --max-iters 5 --add-clips 8
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys

import config as C
import dataset_common as dc

PY = sys.executable


def _count_sources() -> int:
    recs = [r for r in dc.read_manifest() if r["method"] == "final"]
    return len({r["clip_id"].rsplit("__", 1)[0] for r in recs})


def _last_losses():
    hist_p = C.DATA_DIR / "model" / "history.json"
    if not hist_p.exists():
        return None
    hist = json.loads(hist_p.read_text())
    train_loss = hist[-1]["train"]["loss"]
    val_loss = min(h["val"]["loss"] for h in hist)
    return train_loss, val_loss


def _run(cmd):
    print(f"\n$ {' '.join(cmd)}", flush=True)
    subprocess.run(cmd, check=True, cwd=str(C.ML_DIR))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target-val-loss", type=float, default=0.5)
    ap.add_argument("--use-train-loss", action="store_true")
    ap.add_argument("--target-train-loss", type=float, default=0.2)
    ap.add_argument("--max-iters", type=int, default=5)
    ap.add_argument("--add-clips", type=int, default=8)
    ap.add_argument("--coarsen", choices=["llm", "rules"], default="rules")
    ap.add_argument("--epochs", type=int, default=80)
    args = ap.parse_args()

    for it in range(1, args.max_iters + 1):
        n_src = _count_sources()
        print(f"\n===== lazy iteration {it} | {n_src} source clips in pool =====")
        _run([PY, "train.py", "--epochs", str(args.epochs)])
        tl, vl = _last_losses()
        print(f"-> train loss {tl:.3f} | best val loss {vl:.3f}")

        met = (tl <= args.target_train_loss) if args.use_train_loss \
            else (vl <= args.target_val_loss)
        if met:
            print(f"target met after iteration {it}. done.")
            return
        if it == args.max_iters:
            break

        # not good enough -> fetch more unlabeled data (next tracks) and retry
        print(f"not good enough -> adding {args.add_clips} more clips")
        _run([PY, "datagen_pipeline.py", "--clips", str(args.add_clips),
              "--coarsen", args.coarsen, "--track-start", str(n_src)])

    print("\nreached iteration/pool budget without hitting target.")


if __name__ == "__main__":
    main()
