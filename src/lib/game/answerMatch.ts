// Pitch-class answer matching for sung answers.
//
// Players sing the notes of an interval/chord one at a time, in any octave and
// any order. We compare by pitch class (mod 12) so the singer's register is
// irrelevant, and treat the answer as an unordered set.

const LETTER_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

/** Parse a note name like "C", "F#4", "Bb", "Ebb", "G#2" to a pitch class 0-11. */
export function noteNameToPc(name: string): number | null {
  if (!name) return null
  const m = name.trim().match(/^([A-Ga-g])(##|bb|#|b|x)?(-?\d+)?$/)
  if (!m) return null
  const letter = m[1].toUpperCase()
  let pc = LETTER_PC[letter]
  if (pc === undefined) return null
  const acc = m[2]
  if (acc === '#') pc += 1
  else if (acc === 'b') pc -= 1
  else if (acc === '##' || acc === 'x') pc += 2
  else if (acc === 'bb') pc -= 2
  return ((pc % 12) + 12) % 12
}

/** Deduped pitch classes for a list of note names (invalid names dropped). */
export function pitchesToPcs(names: string[]): number[] {
  const set = new Set<number>()
  for (const n of names) {
    const pc = noteNameToPc(n)
    if (pc !== null) set.add(pc)
  }
  return [...set]
}

/** The most recent `n` UNIQUE pitch classes from a buffer, preserving recency. */
function lastUniquePcs(buf: number[], n: number): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (let i = buf.length - 1; i >= 0 && out.length < n; i--) {
    if (!seen.has(buf[i])) {
      seen.add(buf[i])
      out.push(buf[i])
    }
  }
  return out
}

function setEquals(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sb = new Set(b)
  return a.every((x) => sb.has(x))
}

/** True if some transposition (0-11 semitones) of `a` equals set `b`. */
function matchesUnderTransposition(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const target = new Set(b)
  for (let t = 0; t < 12; t++) {
    const shifted = a.map((p) => (p + t) % 12)
    if (new Set(shifted).size === a.length && shifted.every((x) => target.has(x))) {
      return true
    }
  }
  return false
}

/**
 * Whether the recently sung notes satisfy the target.
 * The most recent `target.length` distinct pitch classes are compared to the
 * target set. With `relative`, the comparison is transposition-invariant (the
 * interval/chord SHAPE must match in any key); otherwise it's exact pitch class.
 */
export function matchesAnswer(
  recentPcs: number[],
  targetPcs: number[],
  relative = false,
): boolean {
  if (targetPcs.length === 0) return false
  const recent = lastUniquePcs(recentPcs, targetPcs.length)
  if (recent.length < targetPcs.length) return false
  return relative
    ? matchesUnderTransposition(recent, targetPcs)
    : setEquals(recent, targetPcs)
}
