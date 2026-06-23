// Core pitch model for the music theory engine.
//
// A pitch is a letter (A-G), an accidental offset in semitones (-2..+2),
// and an octave in scientific pitch notation (middle C = C4).
//
// Two parallel coordinate systems matter:
//  - chromatic (semitones / MIDI): how a note *sounds*. Enharmonic spellings
//    (e.g. C# and Db) share the same chromatic value.
//  - diatonic (letter steps): how a note is *spelled* and where it sits on a
//    staff. C# and Db occupy different diatonic positions.
// Keeping both lets us tell "right note, wrong spelling" apart from a wrong note.

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

export interface Pitch {
  letter: Letter
  /** Accidental in semitones: -2 double flat, -1 flat, 0 natural, 1 sharp, 2 double sharp. */
  accidental: number
  /** Scientific pitch notation octave; middle C is C4. */
  octave: number
}

export const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** Semitone offset of each natural letter within an octave (C = 0). */
const LETTER_SEMITONES: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

/** Index of each letter in diatonic order (C = 0 .. B = 6). */
const LETTER_INDEX: Record<Letter, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
}

/** MIDI note number. Middle C (C4) = 60. */
export function midi(pitch: Pitch): number {
  return (
    12 * (pitch.octave + 1) + LETTER_SEMITONES[pitch.letter] + pitch.accidental
  )
}

/**
 * Absolute diatonic step index, counting only letter+octave (ignoring accidental).
 * C4 = 0, D4 = 1, ... B4 = 6, C5 = 7. Used for staff position and interval size.
 */
export function diatonicStep(pitch: Pitch): number {
  return 7 * pitch.octave + LETTER_INDEX[pitch.letter]
}

/** True if two pitches sound the same (enharmonically equal), regardless of spelling. */
export function soundsEqual(a: Pitch, b: Pitch): boolean {
  return midi(a) === midi(b)
}

/** True if two pitches are spelled identically. */
export function spellingEqual(a: Pitch, b: Pitch): boolean {
  return (
    a.letter === b.letter &&
    a.accidental === b.accidental &&
    a.octave === b.octave
  )
}

const ACCIDENTAL_GLYPH: Record<number, string> = {
  [-2]: '\u266D\u266D',
  [-1]: '\u266D',
  [0]: '',
  [1]: '\u266F',
  [2]: '\u00D7',
}

/** Human-readable name, e.g. { F, +1, 4 } -> "F#4". Uses ASCII # / b by default. */
export function formatPitch(pitch: Pitch, opts?: { unicode?: boolean }): string {
  const acc = opts?.unicode
    ? (ACCIDENTAL_GLYPH[pitch.accidental] ?? '')
    : accidentalAscii(pitch.accidental)
  return `${pitch.letter}${acc}${pitch.octave}`
}

function accidentalAscii(accidental: number): string {
  if (accidental === 0) return ''
  if (accidental > 0) return '#'.repeat(accidental)
  return 'b'.repeat(-accidental)
}

/** Build a pitch from a letter, octave, and accidental (default natural). */
export function pitch(letter: Letter, octave: number, accidental = 0): Pitch {
  return { letter, accidental, octave }
}
