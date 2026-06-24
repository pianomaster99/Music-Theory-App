import type { ChordQuality } from '@/lib/theory/chords'
import type { Interval } from '@/lib/theory/intervals'
import type { Pitch } from '@/lib/theory/pitch'

// A lesson is data: an ordered sequence of steps. Each step is either a concept
// (an idea to read, optionally with a visual) or an interactive problem the
// learner manipulates directly. This is what lets us add lessons without
// touching component code, and later lets AI generate them.

export type Direction = 'above' | 'below'

/**
 * Which hands-on tool the learner uses to build an answer. The topic of a
 * problem comes from the course path; the tool is randomized per problem.
 */
export type InteractiveFeature = 'staff' | 'piano' | 'choir'

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
  /** Optional pitches to render as an illustration. */
  visualPitches?: Pitch[]
  /**
   * How to illustrate `visualPitches`. 'staff' (default) draws them on the
   * staff; 'piano' shows the hand-piano with those keys lit; 'choir' shows the
   * matching singers already singing — so intros preview every tool.
   */
  demoFeature?: InteractiveFeature
}

export interface BuildIntervalStep extends BaseStep {
  kind: 'buildInterval'
  basePitch: Pitch
  target: Interval
  direction: Direction
  /** Tool used to build the answer (defaults to the staff). */
  feature?: InteractiveFeature
}

export interface IdentifyIntervalStep extends BaseStep {
  kind: 'identifyInterval'
  pitches: [Pitch, Pitch]
  answer: Interval
  /** When true, only the interval number is asked for (quality is ignored). */
  numberOnly?: boolean
}

export interface BuildChordStep extends BaseStep {
  kind: 'buildChord'
  root: Pitch
  quality: ChordQuality
  /** Tool used to build the answer (defaults to the staff). */
  feature?: InteractiveFeature
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

// Generators let a lesson produce randomized-but-deterministic problems instead
// of (or in addition to) hand-authored ones, so each lesson can offer however
// many questions onboarding asks for. They are materialized into concrete Steps.
export interface BuildIntervalGen {
  kind: 'buildInterval'
  intervals: Interval[]
  directions?: Direction[]
  bases?: Pitch[]
  count: number
  /** Limit which tools may be chosen (defaults to all that fit the notes). */
  features?: InteractiveFeature[]
}
export interface IdentifyIntervalGen {
  kind: 'identifyInterval'
  intervals: Interval[]
  directions?: Direction[]
  bases?: Pitch[]
  numberOnly?: boolean
  count: number
}
export interface BuildChordGen {
  kind: 'buildChord'
  qualities: ChordQuality[]
  roots?: Pitch[]
  count: number
  /** Limit which tools may be chosen (defaults to all that fit the notes). */
  features?: InteractiveFeature[]
}
export interface IdentifyChordGen {
  kind: 'identifyChord'
  qualities: ChordQuality[]
  roots?: Pitch[]
  count: number
}
export type GenSpec =
  | BuildIntervalGen
  | IdentifyIntervalGen
  | BuildChordGen
  | IdentifyChordGen

export interface Lesson {
  id: string
  title: string
  /** One-line summary shown on the course path. */
  summary: string
  steps: Step[]
  /** Optional generators, materialized into extra problem steps after `steps`. */
  generate?: GenSpec[]
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
