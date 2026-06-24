import type { MistakeCategory, ProblemStep } from './types'

// Hand-written default feedback, spoken by Pianomaster99. Steps may override any
// of these with more specific wording via their `feedback` map. No AI.

export const DEFAULT_FEEDBACK: Record<MistakeCategory, string> = {
  correct: "That's it! Well done.",
  wrongEnharmonicSpelling:
    "Right pitch by sound, but the spelling is off. The letter name has to match the interval number.",
  rightNumberWrongQuality:
    'Good — the right number of letters apart, but the size (number of half steps) is off. Check the quality.',
  rightQualityWrongNumber:
    "The size sounds close, but it's written on the wrong letter, so the number is off.",
  wrongDirection:
    'You built the right interval, but in the wrong direction. Try the other side of the starting note.',
  offByOctave: "Right interval, wrong octave. Move it up or down an octave.",
  wrong: "Not quite. Re-read the prompt and give it another try.",
}

// Chords reuse the same outcome categories, but the wording needs to talk about
// roots and chord quality instead of interval numbers.
const CHORD_FEEDBACK: Record<MistakeCategory, string> = {
  correct: "That's it! Well done.",
  wrongEnharmonicSpelling:
    'Those pitches sound right, but one is spelled wrong. Each chord tone has to sit on the correct letter (stacked thirds).',
  rightNumberWrongQuality:
    'Right root, but the quality is off. Check the size of the thirds you stacked (major vs. minor).',
  rightQualityWrongNumber:
    'Right quality, but the root is wrong. Find the lowest note the chord is built on.',
  wrongDirection: 'Build the chord upward from the root.',
  offByOctave: "Right notes, wrong octave. That doesn't change the chord — nudge them back.",
  wrong: 'Not quite. Re-read the prompt and try stacking the chord again.',
}

function isChordStep(step: ProblemStep): boolean {
  return step.kind === 'buildChord' || step.kind === 'identifyChord'
}

export function feedbackFor(
  step: ProblemStep,
  category: MistakeCategory,
): string {
  if (step.feedback?.[category]) return step.feedback[category]!
  const defaults = isChordStep(step) ? CHORD_FEEDBACK : DEFAULT_FEEDBACK
  return defaults[category]
}
