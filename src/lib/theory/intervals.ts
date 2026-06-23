import {
  LETTERS,
  diatonicStep,
  midi,
  type Letter,
  type Pitch,
} from './pitch'

export type IntervalQuality = 'P' | 'M' | 'm' | 'A' | 'd'

export interface Interval {
  /** Diatonic size: 1 = unison, 2 = second, ... 8 = octave, 9 = ninth, ... */
  number: number
  quality: IntervalQuality
}

/**
 * Whether a given simple interval number (1-7, where 1 = unison/octave class)
 * belongs to the "perfect" family (unison, fourth, fifth, octave) or the
 * "major/minor" family (second, third, sixth, seventh).
 */
function isPerfectFamily(simpleNumber: number): boolean {
  return simpleNumber === 1 || simpleNumber === 4 || simpleNumber === 5
}

/** Semitones spanned by the major/perfect version of a simple interval (number 1-7). */
const MAJOR_OR_PERFECT_SEMITONES: Record<number, number> = {
  1: 0, // perfect unison
  2: 2, // major second
  3: 4, // major third
  4: 5, // perfect fourth
  5: 7, // perfect fifth
  6: 9, // major sixth
  7: 11, // major seventh
}

/** Reduce an interval number to its simple form (1-7) and the octave count. */
function simplify(number: number): { simple: number; octaves: number } {
  // Interval numbers are 1-based; convert to 0-based steps for modulo math.
  const steps = number - 1
  const octaves = Math.floor(steps / 7)
  const simple = (steps % 7) + 1
  return { simple, octaves }
}

/**
 * Classify the interval between two pitches. `a` and `b` may be given in any
 * order; the interval is measured from the lower-sounding pitch upward.
 * Returns null if the spelling produces no valid standard quality.
 */
export function intervalBetween(a: Pitch, b: Pitch): Interval | null {
  const [low, high] = midi(a) <= midi(b) ? [a, b] : [b, a]

  const diatonicDistance = diatonicStep(high) - diatonicStep(low)
  const number = diatonicDistance + 1
  const semitones = midi(high) - midi(low)

  const { simple, octaves } = simplify(number)
  const referenceSemitones = MAJOR_OR_PERFECT_SEMITONES[simple] + 12 * octaves
  const diff = semitones - referenceSemitones

  const quality = qualityFromDiff(simple, diff)
  if (!quality) return null
  return { number, quality }
}

function qualityFromDiff(
  simpleNumber: number,
  diff: number,
): IntervalQuality | null {
  if (isPerfectFamily(simpleNumber)) {
    // Perfect family: diff 0 = P, +1 = A, -1 = d.
    if (diff === 0) return 'P'
    if (diff === 1) return 'A'
    if (diff === -1) return 'd'
    return null
  }
  // Major/minor family: diff 0 = M, -1 = m, +1 = A, -2 = d.
  if (diff === 0) return 'M'
  if (diff === -1) return 'm'
  if (diff === 1) return 'A'
  if (diff === -2) return 'd'
  return null
}

/** Semitone span of a fully-specified interval, or null if the quality is invalid for the number. */
export function intervalSemitones(interval: Interval): number | null {
  const { simple, octaves } = simplify(interval.number)
  const reference = MAJOR_OR_PERFECT_SEMITONES[simple] + 12 * octaves
  const offset = qualityOffset(simple, interval.quality)
  if (offset === null) return null
  return reference + offset
}

function qualityOffset(
  simpleNumber: number,
  quality: IntervalQuality,
): number | null {
  if (isPerfectFamily(simpleNumber)) {
    if (quality === 'P') return 0
    if (quality === 'A') return 1
    if (quality === 'd') return -1
    return null
  }
  if (quality === 'M') return 0
  if (quality === 'm') return -1
  if (quality === 'A') return 1
  if (quality === 'd') return -2
  return null
}

/**
 * Transpose a pitch by an interval in a direction, producing the correctly
 * spelled target pitch. The letter is derived from the interval number (so the
 * spelling is theoretically correct), and the accidental is derived from the
 * required semitone span.
 */
export function transpose(
  base: Pitch,
  interval: Interval,
  direction: 'above' | 'below',
): Pitch | null {
  const semitones = intervalSemitones(interval)
  if (semitones === null) return null

  const letterSteps = interval.number - 1
  const sign = direction === 'above' ? 1 : -1

  const baseLetterIndex = LETTERS.indexOf(base.letter)
  const targetLetterAbsolute = baseLetterIndex + sign * letterSteps
  const targetLetter = LETTERS[
    ((targetLetterAbsolute % 7) + 7) % 7
  ] as Letter
  const octaveShift = Math.floor(targetLetterAbsolute / 7)

  // Natural pitch on the target letter, before adjusting the accidental.
  const naturalTarget: Pitch = {
    letter: targetLetter,
    accidental: 0,
    octave: base.octave + octaveShift,
  }

  const naturalSemitones = midi(naturalTarget) - midi({ ...base, accidental: 0 })
  const desiredSemitones = sign * semitones
  const accidental =
    base.accidental + desiredSemitones - naturalSemitones

  return { ...naturalTarget, accidental }
}

const ORDINAL: Record<number, string> = {
  1: 'unison',
  2: 'second',
  3: 'third',
  4: 'fourth',
  5: 'fifth',
  6: 'sixth',
  7: 'seventh',
  8: 'octave',
}

const QUALITY_WORD: Record<IntervalQuality, string> = {
  P: 'perfect',
  M: 'major',
  m: 'minor',
  A: 'augmented',
  d: 'diminished',
}

/** Short label, e.g. { number: 3, quality: 'M' } -> "M3". */
export function formatInterval(interval: Interval): string {
  return `${interval.quality}${interval.number}`
}

/** Spoken label, e.g. "major third", "perfect fifth". */
export function describeInterval(interval: Interval): string {
  const ordinal = ORDINAL[interval.number] ?? `${interval.number}th`
  return `${QUALITY_WORD[interval.quality]} ${ordinal}`
}

export function intervalsEqual(a: Interval, b: Interval): boolean {
  return a.number === b.number && a.quality === b.quality
}
