"""Generate a creative, web-grounded question bank for the singing game.

Runs the OpenAI agent OFFLINE (key from ../.env) with the hosted web-search tool
so it can research famous music for inspiration/accuracy, then validates every
question down to a singable 2-3 note pitch set and writes a static JSON the app
bundles (src/lib/game/questionBank.json).

Per-mode mix (100 each):
  * noobs   : 100 intervals (varied roots/qualities/directions)
  * pros    : ~80 chords (triads) + ~20 intervals
  * hackers : ~80 web-researched creative trivia + ~10 intervals + ~10 chords

Usage:  python gen_questions.py [--per-call 12] [--no-web]
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re

from dotenv import load_dotenv
from openai import OpenAI

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT, ".env"))
OUT_PATH = os.path.join(ROOT, "src", "lib", "game", "questionBank.json")

MODEL = "gpt-4o"

# --------------------------------------------------------------------------
# pitch-class parsing (octave optional) — mirrors src/lib/game/answerMatch.ts
# --------------------------------------------------------------------------
_LETTER_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def note_to_pc(name: str):
    if not isinstance(name, str):
        return None
    m = re.match(r"^([A-Ga-g])(##|bb|#|b|x)?(-?\d+)?$", name.strip())
    if not m:
        return None
    pc = _LETTER_PC[m.group(1).upper()]
    acc = m.group(2)
    if acc == "#":
        pc += 1
    elif acc == "b":
        pc -= 1
    elif acc in ("##", "x"):
        pc += 2
    elif acc == "bb":
        pc -= 2
    return pc % 12


def pcs_of(names) -> list[int]:
    out = []
    for n in names or []:
        pc = note_to_pc(n)
        if pc is not None and pc not in out:
            out.append(pc)
    return out


def validate(item) -> dict | None:
    if not isinstance(item, dict):
        return None
    prompt = str(item.get("prompt", "")).strip()
    kind = item.get("kind")
    kind = kind if kind in ("interval", "chord", "custom") else "custom"
    names = item.get("answerPitches")
    if not prompt or not isinstance(names, list):
        return None
    names = [str(p).strip() for p in names if str(p).strip()]
    pcs = pcs_of(names)
    if len(pcs) < 2 or len(pcs) > 3:  # need 2-3 DISTINCT pitch classes
        return None
    return {
        "kind": kind,
        "prompt": prompt,
        "answerPitches": names,
        "reference": str(item.get("reference", "")).strip(),
    }


# --------------------------------------------------------------------------
# procedural top-up (guarantees we always reach 100/mode)
# --------------------------------------------------------------------------
_ROOTS = ["C", "D", "E", "F", "G", "A", "B", "C#", "F#", "Bb", "Eb", "Ab"]
_INTERVALS = [
    ("minor second", 1), ("major second", 2), ("minor third", 3),
    ("major third", 4), ("perfect fourth", 5), ("perfect fifth", 7),
    ("minor sixth", 8), ("major sixth", 9), ("minor seventh", 10),
    ("major seventh", 11),
]
_TRIADS = {
    "major": [0, 4, 7], "minor": [0, 3, 7],
    "diminished": [0, 3, 6], "augmented": [0, 4, 8],
}


def _proc_interval() -> dict:
    root = random.choice(_ROOTS)
    name, semis = random.choice(_INTERVALS)
    direction = random.choice(["above", "below"])
    rpc = note_to_pc(root)
    other = _SHARP[(rpc + (semis if direction == "above" else -semis)) % 12]
    return {
        "kind": "interval",
        "prompt": f"Sing a {name} {direction} {root}.",
        "answerPitches": [root, other],
        "reference": "procedural",
    }


def _proc_chord() -> dict:
    root = random.choice(_ROOTS)
    quality, offsets = random.choice(list(_TRIADS.items()))
    rpc = note_to_pc(root)
    names = [_SHARP[(rpc + o) % 12] for o in offsets]
    return {
        "kind": "chord",
        "prompt": f"Sing a {root} {quality} triad.",
        "answerPitches": names,
        "reference": "procedural",
    }


# --------------------------------------------------------------------------
# OpenAI agent (web-grounded)
# --------------------------------------------------------------------------
SYSTEM = (
    "You are pianomaster99, a witty music quizmaster building a singing ear-training "
    "game. The player SINGS the answer as a SET of 2 or 3 distinct pitch classes "
    "(interval = 2 notes, chord/triad = 3 notes), in any order/octave.\n"
    "- 'prompt' is ONE short sentence beginning with 'Sing'. Keep it concise.\n"
    "- 'answerPitches' are the exact notes (letter + optional accidental like C, F#, Bb) "
    "and MUST have 2-3 DISTINCT pitch classes (never an octave/unison).\n"
    "Return ONLY JSON: "
    '{"questions":[{"kind":"interval|chord|custom","prompt":"Sing ...","answerPitches":["C","E","G"],"reference":"piece/source"}]}'
)

CATEGORY_INSTRUCTIONS = {
    "interval": (
        "Generate {n} INTERVAL questions (answer = exactly 2 notes). Name the interval "
        "and root in the prompt, e.g. 'Sing a perfect fifth above D'. Vary root, "
        "quality (m2..M7), and direction."
    ),
    "chord": (
        "Generate {n} CHORD questions (answer = exactly 3 notes of a triad: major, "
        "minor, diminished, or augmented). Name the chord and root, e.g. 'Sing a D "
        "minor triad'. Vary root and quality."
    ),
    "trivia": (
        "Use WEB SEARCH to research FAMOUS music (classical AND popular/film), then "
        "generate {n} questions that NAME a famous piece and ask the player to sing its "
        "signature interval or chord (opening interval, iconic two-note motif, opening "
        "chord, famous triad, etc.).\n"
        "CRITICAL — DO NOT GIVE THE ANSWER AWAY. The prompt must NOT mention:\n"
        "  * the interval/chord name or quality (no 'perfect fifth', 'major third', "
        "'minor triad', 'octave', etc.),\n"
        "  * any note name or the starting/root note,\n"
        "  * the number of semitones.\n"
        "Just reference the piece/section. Good examples: 'Sing the two notes that open "
        "the Jaws theme.', 'Sing the opening chord of Pachelbel's Canon.', 'Sing the "
        "leap that begins the Star Wars main theme.' Provide the ACTUAL notes (in the "
        "piece's real key) in answerPitches (we accept any key when matching). Vary "
        "between 2-note (interval) and 3-note (chord) answers. Use well-known, "
        "verifiable pieces; put the piece in 'reference'; never reuse a piece; never "
        "use octave/unison answers."
    ),
}


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    # Grab the outermost JSON object if there's surrounding prose.
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start:end + 1]
    return json.loads(text)


def call_agent(client: OpenAI, mode: str, category: str, n: int,
               avoid: list[str], web: bool) -> list[dict]:
    instr = CATEGORY_INSTRUCTIONS[category].format(n=n)
    avoid_note = ""
    if avoid:
        avoid_note = ("\nDo NOT repeat these already-used prompts/pieces:\n- "
                      + "\n- ".join(avoid[-40:]))
    user = (f"Game mode: {mode}.\n{instr}{avoid_note}\n"
            "Return ONLY the JSON object described by the system message.")

    tool_attempts = ([{"type": "web_search"}], [{"type": "web_search_preview"}], None) \
        if (web and category == "trivia") else (None,)
    last_err = None
    for tools in tool_attempts:
        try:
            kwargs = dict(model=MODEL, instructions=SYSTEM, input=user)
            if tools:
                kwargs["tools"] = tools
            resp = client.responses.create(**kwargs)
            data = _extract_json(resp.output_text)
            items = data.get("questions", data if isinstance(data, list) else [])
            return [v for v in (validate(it) for it in items) if v]
        except Exception as e:  # noqa: BLE001
            last_err = e
            continue
    print(f"    ! agent call failed ({type(last_err).__name__}: {str(last_err)[:120]})")
    return []


def build_mode(client: OpenAI, mode: str, quotas: dict[str, int], *,
               per_call: int, web: bool) -> list[dict]:
    """quotas: category -> target count. categories: interval, chord, trivia.

    `category` (what kind of question we asked for) is tracked separately from
    `kind` (the answer's shape), since a creative trivia question may still have
    an interval or chord answer.
    """
    collected: list[dict] = []
    seen_prompts: set[str] = set()
    seen_keys: set[str] = set()
    avoid: list[str] = []

    def add(item: dict, category: str) -> bool:
        p = item["prompt"].lower()
        key = ",".join(map(str, sorted(pcs_of(item["answerPitches"])))) + "|" + (
            item.get("reference", "").lower())
        if p in seen_prompts or key in seen_keys:
            return False
        seen_prompts.add(p)
        seen_keys.add(key)
        item["category"] = category
        # Trivia hides the key, so it is matched by interval/chord shape (any key).
        item["relative"] = (category == "trivia")
        collected.append(item)
        avoid.append(item.get("reference") or item["prompt"])
        return True

    def count(category: str) -> int:
        return sum(1 for c in collected if c["category"] == category)

    for category, target in quotas.items():
        got = count(category)
        attempts = 0
        while got < target and attempts < 20:
            attempts += 1
            need = min(per_call, target - got)
            batch = call_agent(client, mode, category, need, avoid, web)
            new = sum(1 for it in batch if add(it, category))
            got = count(category)
            print(f"  [{mode}/{category}] +{new} -> {got}/{target} (attempt {attempts})")
        # procedural top-up to guarantee the quota
        guard = 0
        while got < target and guard < target * 40:
            guard += 1
            if category == "chord":
                it = _proc_chord()
            elif category == "interval":
                it = _proc_interval()
            else:  # trivia shortfall: fill with a mix of intervals/chords
                it = _proc_interval() if random.random() < 0.5 else _proc_chord()
            if add(it, category):
                got = count(category)
        print(f"  [{mode}/{category}] final {got}/{target}")
    return collected


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-call", type=int, default=12)
    ap.add_argument("--no-web", action="store_true")
    ap.add_argument("--modes", nargs="+", default=["noobs", "pros", "hackers"])
    args = ap.parse_args()
    web = not args.no_web

    client = OpenAI()
    full_plan = {
        "noobs": {"interval": 100},
        "pros": {"chord": 80, "interval": 20},
        "hackers": {"trivia": 100},  # all creative trivia, no giveaways
    }
    plan = {m: full_plan[m] for m in args.modes if m in full_plan}

    bank: dict[str, list[dict]] = {}
    for mode, quotas in plan.items():
        print(f"\n=== {mode} ===", flush=True)
        items = build_mode(client, mode, quotas, per_call=args.per_call, web=web)
        random.shuffle(items)
        for i, it in enumerate(items):
            it["id"] = f"{mode[0]}{i:03d}"
        bank[mode] = items[:100]
        print(f"  {mode}: {len(bank[mode])} questions", flush=True)

    # Merge with any existing bank so we can regenerate a subset of modes.
    out: dict[str, list[dict]] = {}
    if os.path.exists(OUT_PATH):
        with open(OUT_PATH) as fh:
            out = json.load(fh)
    out.update(bank)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)
    print(f"\nwrote {OUT_PATH}")
    for mode in out:
        cats: dict[str, int] = {}
        for it in out[mode]:
            c = it.get("category", "?")
            cats[c] = cats.get(c, 0) + 1
        print(f"  {mode}: {len(out[mode])} | {cats}")


if __name__ == "__main__":
    main()
