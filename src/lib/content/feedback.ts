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

export function feedbackFor(
  step: ProblemStep,
  category: MistakeCategory,
): string {
  return step.feedback?.[category] ?? DEFAULT_FEEDBACK[category]
}
