// Race scoring rules (game-prd.md).
//
// Each correct answer is a boost (+1). Every 3rd correct answer is a bigger
// boost that counts as 2. Players finish when their effective score reaches the
// room target.

export const DEFAULT_TARGET = 10

/** Points a correct answer is worth given the new running correct count. */
export function pointsForCorrect(newCorrectCount: number): number {
  return newCorrectCount % 3 === 0 ? 2 : 1
}

export interface ProgressUpdate {
  correctCount: number
  effectiveScore: number
  finished: boolean
}

/** Apply one correct answer to a player's running totals. */
export function applyCorrect(
  prev: { correctCount: number; effectiveScore: number },
  target: number,
): ProgressUpdate {
  const correctCount = prev.correctCount + 1
  const effectiveScore = prev.effectiveScore + pointsForCorrect(correctCount)
  return {
    correctCount,
    effectiveScore,
    finished: effectiveScore >= target,
  }
}
