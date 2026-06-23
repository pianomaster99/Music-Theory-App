import { LETTERS, diatonicStep, type Letter, type Pitch } from './pitch'

// Geometry helpers that map between musical pitch and vertical staff position.
// Vertical position is driven by the *diatonic* step (letter + octave), so each
// line and space is a letter. Accidentals are glyphs, not vertical offsets.

/** Treble-clef staff line diatonic steps, bottom (E4) to top (F5). */
export const TREBLE_LINE_STEPS = [
  diatonicStep({ letter: 'E', accidental: 0, octave: 4 }),
  diatonicStep({ letter: 'G', accidental: 0, octave: 4 }),
  diatonicStep({ letter: 'B', accidental: 0, octave: 4 }),
  diatonicStep({ letter: 'D', accidental: 0, octave: 5 }),
  diatonicStep({ letter: 'F', accidental: 0, octave: 5 }),
]

export const BOTTOM_LINE_STEP = TREBLE_LINE_STEPS[0] // E4 = 30
export const TOP_LINE_STEP = TREBLE_LINE_STEPS[TREBLE_LINE_STEPS.length - 1] // F5 = 38

/** Convert a diatonic step back into a natural-letter pitch (accidental supplied). */
export function pitchFromDiatonicStep(step: number, accidental = 0): Pitch {
  const octave = Math.floor(step / 7)
  const letterIndex = step - 7 * octave
  return { letter: LETTERS[letterIndex] as Letter, accidental, octave }
}

/** Even diatonic steps land on lines; odd steps land on spaces. */
export function isLineStep(step: number): boolean {
  return step % 2 === 0
}

/**
 * Ledger line diatonic steps needed to reach a note above or below the staff.
 * Returns line-position steps between the staff and the note (inclusive of a
 * line the note itself sits on).
 */
export function ledgerLineSteps(step: number): number[] {
  const result: number[] = []
  if (step <= BOTTOM_LINE_STEP - 2) {
    for (let s = BOTTOM_LINE_STEP - 2; s >= step; s -= 2) result.push(s)
  }
  if (step >= TOP_LINE_STEP + 2) {
    for (let s = TOP_LINE_STEP + 2; s <= step; s += 2) result.push(s)
  }
  return result
}
