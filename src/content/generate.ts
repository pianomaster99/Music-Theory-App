import type {
  BuildChordStep,
  BuildIntervalStep,
  Direction,
  GenSpec,
  IdentifyChordStep,
  IdentifyIntervalStep,
  Lesson,
  ProblemStep,
} from '@/lib/content/types'
import {
  describeInterval,
  transpose,
  type Interval,
} from '@/lib/theory/intervals'
import {
  chordLabel,
  chordPitches,
  type ChordQuality,
} from '@/lib/theory/chords'
import {
  diatonicStep,
  formatPitch,
  pitch,
  type Pitch,
} from '@/lib/theory/pitch'

// --- Deterministic RNG -----------------------------------------------------
// Generation is seeded by lesson id so the produced problems are stable across
// reloads and devices (so resume + progress still line up by step id), while
// still varying from lesson to lesson.
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

// Onboarding's expected daily time scales how many questions each lesson serves.
// Changing it invalidates the materialization cache so counts update.
let questionScale = 1
export function setQuestionScale(scale: number): void {
  if (scale !== questionScale) {
    questionScale = scale
    cache.clear()
  }
}
function scaled(count: number): number {
  return Math.max(1, Math.round(count * questionScale))
}

// Keep generated notes comfortably inside the staff's drawable range.
const STEP_MIN = diatonicStep(pitch('A', 3)) // 24
const STEP_MAX = diatonicStep(pitch('C', 6)) // 42

function inRange(p: Pitch): boolean {
  const s = diatonicStep(p)
  return s >= STEP_MIN && s <= STEP_MAX && Math.abs(p.accidental) <= 1
}

const DEFAULT_BASES: Pitch[] = [
  pitch('C', 4),
  pitch('D', 4),
  pitch('E', 4),
  pitch('F', 4),
  pitch('G', 4),
  pitch('A', 4),
  pitch('B', 4),
  pitch('C', 5),
]

const DEFAULT_DIRECTIONS: Direction[] = ['above', 'below']

const DEFAULT_TRIAD_ROOTS: Pitch[] = [
  pitch('C', 4),
  pitch('D', 4),
  pitch('E', 4),
  pitch('F', 4),
  pitch('G', 4),
  pitch('A', 4),
  pitch('B', 3),
]

const DEFAULT_SEVENTH_ROOTS: Pitch[] = [
  pitch('C', 4),
  pitch('D', 4),
  pitch('E', 4),
  pitch('F', 4),
  pitch('G', 4),
  pitch('A', 3),
  pitch('B', 3),
]

// --- "How does it feel" guidance (PRD feedback requirement) ----------------
export type ConsonanceFeel = 'perfect' | 'consonant' | 'dissonant'

export function intervalFeel(interval: Interval): ConsonanceFeel {
  const simple = ((interval.number - 1) % 7) + 1
  if (interval.quality === 'P') return 'perfect'
  // Tritones (augmented 4th / diminished 5th) are the sharp dissonances.
  if (
    (simple === 4 && interval.quality === 'A') ||
    (simple === 5 && interval.quality === 'd')
  ) {
    return 'dissonant'
  }
  if (simple === 3 || simple === 6) return 'consonant'
  if (simple === 2 || simple === 7) return 'dissonant'
  return 'consonant'
}

export const FEEL_HINT: Record<ConsonanceFeel, string> = {
  perfect:
    'Listen again — a perfect interval sounds open and satisfying, like it could end a piece.',
  consonant:
    'Listen again — a consonant third or sixth sounds smooth and sweet, easy on the ears.',
  dissonant:
    'Listen again — a dissonant interval sounds tense and clashing, almost like an OUCH!',
}

function intervalFeedback(interval: Interval) {
  const hint = FEEL_HINT[intervalFeel(interval)]
  return {
    rightNumberWrongQuality: `Right number of letters apart, but the quality is off. ${hint}`,
    wrong: `Not quite. ${hint}`,
  }
}

// --- Generators ------------------------------------------------------------
function genBuildInterval(
  rng: () => number,
  spec: Extract<GenSpec, { kind: 'buildInterval' }>,
  idAt: () => string,
): BuildIntervalStep[] {
  const bases = spec.bases ?? DEFAULT_BASES
  const directions = spec.directions ?? DEFAULT_DIRECTIONS
  const steps: BuildIntervalStep[] = []
  const want = scaled(spec.count)
  let guard = 0
  while (steps.length < want && guard < want * 40 + 40) {
    guard++
    const base = pick(rng, bases)
    const target = pick(rng, spec.intervals)
    const direction = pick(rng, directions)
    const result = transpose(base, target, direction)
    if (!result || !inRange(result) || !inRange(base)) continue
    steps.push({
      kind: 'buildInterval',
      id: idAt(),
      prompt: `Build a ${describeInterval(target)} ${direction} ${formatPitch(base)}.`,
      basePitch: base,
      target,
      direction,
      hints: [
        `Count letter names ${direction === 'above' ? 'up' : 'down'} from ${base.letter}, counting ${base.letter} as 1.`,
        `A ${describeInterval(target)} ${direction} ${formatPitch(base)} is ${formatPitch(result)}.`,
      ],
      feedback: intervalFeedback(target),
    })
  }
  return steps
}

function genIdentifyInterval(
  rng: () => number,
  spec: Extract<GenSpec, { kind: 'identifyInterval' }>,
  idAt: () => string,
): IdentifyIntervalStep[] {
  const bases = spec.bases ?? DEFAULT_BASES
  const directions = spec.directions ?? DEFAULT_DIRECTIONS
  const steps: IdentifyIntervalStep[] = []
  const want = scaled(spec.count)
  let guard = 0
  while (steps.length < want && guard < want * 40 + 40) {
    guard++
    const base = pick(rng, bases)
    const target = pick(rng, spec.intervals)
    const direction = pick(rng, directions)
    const other = transpose(base, target, direction)
    if (!other || !inRange(other) || !inRange(base)) continue
    const pair: [Pitch, Pitch] =
      direction === 'above' ? [base, other] : [other, base]
    steps.push({
      kind: 'identifyInterval',
      id: idAt(),
      prompt: spec.numberOnly
        ? 'What number is this interval?'
        : 'Name this interval (number and quality).',
      pitches: pair,
      answer: target,
      numberOnly: spec.numberOnly,
      hints: [
        'Count letter names from the lower note up to the higher note, counting the lower note as 1.',
        spec.numberOnly
          ? `That gives the number.`
          : `Then check the size in half steps to get the quality.`,
      ],
      feedback: intervalFeedback(target),
    })
  }
  return steps
}

function genBuildChord(
  rng: () => number,
  spec: Extract<GenSpec, { kind: 'buildChord' }>,
  idAt: () => string,
): BuildChordStep[] {
  const roots = spec.roots ?? defaultRootsFor(spec.qualities)
  const steps: BuildChordStep[] = []
  const want = scaled(spec.count)
  let guard = 0
  while (steps.length < want && guard < want * 40 + 40) {
    guard++
    const root = pick(rng, roots)
    const quality = pick(rng, spec.qualities)
    let ps: Pitch[]
    try {
      ps = chordPitches(root, quality)
    } catch {
      continue
    }
    if (!ps.every(inRange)) continue
    steps.push({
      kind: 'buildChord',
      id: idAt(),
      prompt: `Build a ${chordLabel(quality)} on ${formatPitch(root)}.`,
      root,
      quality,
      hints: [
        `Stack thirds up from ${formatPitch(root)}.`,
        `The notes are ${ps.map((p) => formatPitch(p)).join(', ')}.`,
      ],
    })
  }
  return steps
}

function genIdentifyChord(
  rng: () => number,
  spec: Extract<GenSpec, { kind: 'identifyChord' }>,
  idAt: () => string,
): IdentifyChordStep[] {
  const roots = spec.roots ?? defaultRootsFor(spec.qualities)
  const steps: IdentifyChordStep[] = []
  const want = scaled(spec.count)
  let guard = 0
  while (steps.length < want && guard < want * 40 + 40) {
    guard++
    const root = pick(rng, roots)
    const quality = pick(rng, spec.qualities)
    let ps: Pitch[]
    try {
      ps = chordPitches(root, quality)
    } catch {
      continue
    }
    if (!ps.every(inRange)) continue
    steps.push({
      kind: 'identifyChord',
      id: idAt(),
      prompt: 'Name this chord (root and quality).',
      pitches: ps,
      answerRoot: root,
      answerQuality: quality,
      hints: [
        'The lowest note is the root.',
        'Work out the thirds stacked above it to get the quality.',
      ],
    })
  }
  return steps
}

function defaultRootsFor(qualities: ChordQuality[]): Pitch[] {
  const seventh = qualities.some((q) => q.includes('7'))
  return seventh ? DEFAULT_SEVENTH_ROOTS : DEFAULT_TRIAD_ROOTS
}

function generateSteps(lesson: Lesson): ProblemStep[] {
  if (!lesson.generate || lesson.generate.length === 0) return []
  const rng = mulberry32(hashString(lesson.id))
  let n = 0
  const idAt = () => `${lesson.id}-g${n++}`
  const out: ProblemStep[] = []
  for (const spec of lesson.generate) {
    switch (spec.kind) {
      case 'buildInterval':
        out.push(...genBuildInterval(rng, spec, idAt))
        break
      case 'identifyInterval':
        out.push(...genIdentifyInterval(rng, spec, idAt))
        break
      case 'buildChord':
        out.push(...genBuildChord(rng, spec, idAt))
        break
      case 'identifyChord':
        out.push(...genIdentifyChord(rng, spec, idAt))
        break
    }
  }
  return out
}

const cache = new Map<string, Lesson>()

/**
 * Expand a lesson's generators into concrete steps (appended after the authored
 * steps). Deterministic and cached, so progress/step ids stay stable.
 */
export function materializeLesson(lesson: Lesson): Lesson {
  if (!lesson.generate || lesson.generate.length === 0) return lesson
  const cached = cache.get(lesson.id)
  if (cached) return cached
  const materialized: Lesson = {
    ...lesson,
    steps: [...lesson.steps, ...generateSteps(lesson)],
  }
  cache.set(lesson.id, materialized)
  return materialized
}
