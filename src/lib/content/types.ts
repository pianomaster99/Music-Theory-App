import type { ChordQuality } from '@/lib/theory/chords'
import type { Interval } from '@/lib/theory/intervals'
import type { Pitch } from '@/lib/theory/pitch'

// A lesson is data: an ordered sequence of steps. Each step is either a concept
// (an idea to read, optionally with a visual) or an interactive problem the
// learner manipulates directly. This is what lets us add lessons without
// touching component code, and later lets AI generate them.

export type Direction = 'above' | 'below'

/** Categories of outcome the feedback layer can react to. */
export type MistakeCategory =
  | 'correct'
  | 'wrongEnharmonicSpelling'
  | 'rightNumberWrongQuality'
  | 'rightQualityWrongNumber'
  | 'wrongDirection'
  | 'offByOctave'
  | 'wrong'

/** Authored, hand-written feedback for a problem. No AI in the MVP. */
export type FeedbackMap = Partial<Record<MistakeCategory, string>>

interface BaseStep {
  id: string
  /** Short prompt shown to the learner. */
  prompt: string
  /** Ordered hints, revealed one at a time on request. */
  hints?: string[]
  /** Hand-written feedback keyed by outcome category. */
  feedback?: FeedbackMap
}

export interface ConceptStep {
  kind: 'concept'
  id: string
  title: string
  /** Markdown-ish body text. */
  body: string
  /** Optional pitches to render on a staff as an illustration. */
  visualPitches?: Pitch[]
}

export interface BuildIntervalStep extends BaseStep {
  kind: 'buildInterval'
  basePitch: Pitch
  target: Interval
  direction: Direction
}

export interface IdentifyIntervalStep extends BaseStep {
  kind: 'identifyInterval'
  pitches: [Pitch, Pitch]
  answer: Interval
}

export interface BuildChordStep extends BaseStep {
  kind: 'buildChord'
  root: Pitch
  quality: ChordQuality
}

export interface IdentifyChordStep extends BaseStep {
  kind: 'identifyChord'
  pitches: Pitch[]
  answerRoot: Pitch
  answerQuality: ChordQuality
}

export type ProblemStep =
  | BuildIntervalStep
  | IdentifyIntervalStep
  | BuildChordStep
  | IdentifyChordStep

export type Step = ConceptStep | ProblemStep

export function isProblemStep(step: Step): step is ProblemStep {
  return step.kind !== 'concept'
}

export interface Lesson {
  id: string
  title: string
  /** One-line summary shown on the course path. */
  summary: string
  steps: Step[]
}

export interface Module {
  id: string
  title: string
  description: string
  lessons: Lesson[]
}

export interface Course {
  id: string
  subject: string
  modules: Module[]
}
