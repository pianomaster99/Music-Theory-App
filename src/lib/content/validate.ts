import { classifyChord } from '@/lib/theory/chords'
import {
  intervalBetween,
  intervalsEqual,
  transpose,
} from '@/lib/theory/intervals'
import { midi, soundsEqual, spellingEqual, type Pitch } from '@/lib/theory/pitch'
import type {
  BuildChordStep,
  BuildIntervalStep,
  IdentifyChordStep,
  IdentifyIntervalStep,
  MistakeCategory,
  ProblemStep,
} from './types'

export interface ValidationResult {
  correct: boolean
  category: MistakeCategory
}

/** Validate a learner's answer against a problem step. Pure, no UI, no AI. */
export function validateAnswer(
  step: ProblemStep,
  input: AnswerInput,
): ValidationResult {
  switch (step.kind) {
    case 'buildInterval':
      return validateBuildInterval(step, input as Pitch)
    case 'identifyInterval':
      return validateIdentifyInterval(step, input as IdentifyIntervalInput)
    case 'buildChord':
      return validateBuildChord(step, input as Pitch[])
    case 'identifyChord':
      return validateIdentifyChord(step, input as IdentifyChordInput)
  }
}

export type AnswerInput =
  | Pitch
  | Pitch[]
  | IdentifyIntervalInput
  | IdentifyChordInput

export interface IdentifyIntervalInput {
  number: number
  quality: string
}

export interface IdentifyChordInput {
  rootLetter: string
  quality: string
}

function result(category: MistakeCategory): ValidationResult {
  return { correct: category === 'correct', category }
}

function validateBuildInterval(
  step: BuildIntervalStep,
  answer: Pitch,
): ValidationResult {
  const correctPitch = transpose(step.basePitch, step.target, step.direction)
  if (correctPitch && spellingEqual(answer, correctPitch)) {
    return result('correct')
  }
  if (correctPitch && soundsEqual(answer, correctPitch)) {
    return result('wrongEnharmonicSpelling')
  }

  // Did the learner place the note on the wrong side of the base note?
  const placedDirection =
    midi(answer) >= midi(step.basePitch) ? 'above' : 'below'
  if (placedDirection !== step.direction && correctPitch) {
    // Only call it "wrong direction" if they'd otherwise have the right interval.
    const flippedInterval = intervalBetween(step.basePitch, answer)
    if (flippedInterval && intervalsEqual(flippedInterval, step.target)) {
      return result('wrongDirection')
    }
  }

  const actual = intervalBetween(step.basePitch, answer)
  if (!actual) return result('wrong')

  // Same interval quality+number but a different octave away.
  if (
    actual.quality === step.target.quality &&
    ((actual.number - 1) % 7) + 1 === ((step.target.number - 1) % 7) + 1 &&
    actual.number !== step.target.number
  ) {
    return result('offByOctave')
  }
  if (actual.number === step.target.number) {
    return result('rightNumberWrongQuality')
  }
  if (actual.quality === step.target.quality) {
    return result('rightQualityWrongNumber')
  }
  return result('wrong')
}

function validateIdentifyInterval(
  step: IdentifyIntervalStep,
  answer: IdentifyIntervalInput,
): ValidationResult {
  const numberRight = answer.number === step.answer.number
  const qualityRight = answer.quality === step.answer.quality
  if (numberRight && qualityRight) return result('correct')
  if (numberRight) return result('rightNumberWrongQuality')
  if (qualityRight) return result('rightQualityWrongNumber')
  return result('wrong')
}

function validateBuildChord(
  step: BuildChordStep,
  answer: Pitch[],
): ValidationResult {
  const classified = classifyChord(answer)
  if (
    classified &&
    spellingEqual(classified.root, step.root) &&
    classified.quality === step.quality
  ) {
    return result('correct')
  }

  // Right notes by sound, wrong spelling somewhere.
  if (classified && classified.quality === step.quality) {
    return result('wrongEnharmonicSpelling')
  }
  if (classified && spellingEqual(classified.root, step.root)) {
    return result('rightNumberWrongQuality')
  }
  return result('wrong')
}

function validateIdentifyChord(
  step: IdentifyChordStep,
  answer: IdentifyChordInput,
): ValidationResult {
  const rootRight = answer.rootLetter === step.answerRoot.letter
  const qualityRight = answer.quality === step.answerQuality
  if (rootRight && qualityRight) return result('correct')
  if (qualityRight) return result('rightQualityWrongNumber')
  if (rootRight) return result('rightNumberWrongQuality')
  return result('wrong')
}
