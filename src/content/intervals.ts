import type { Module } from '@/lib/content/types'
import { pitch } from '@/lib/theory/pitch'

// The Intervals module, framed by how intervals *sound*: perfect, consonant,
// and dissonant. Concepts are authored; the problems are generated so each
// lesson can offer a variable number of fresh examples.

export const intervalsModule: Module = {
  id: 'intervals',
  title: 'Intervals',
  description:
    'The distance between two notes. Learn to count, build, and name intervals by how they sound.',
  lessons: [
    {
      id: 'intervals-perfect',
      title: 'Perfect intervals',
      summary: 'Unisons, fourths, fifths, and octaves — the open, stable sounds.',
      steps: [
        {
          kind: 'concept',
          id: 'ip-c1',
          title: 'What is an interval?',
          body: 'An interval is the distance between two notes. To find its number, count letter names from the lower note to the higher one — counting the lower note as 1. From C up to G: C(1) D(2) E(3) F(4) G(5). That is a fifth.',
          visualPitches: [pitch('C', 4), pitch('G', 4)],
        },
        {
          kind: 'concept',
          id: 'ip-c2',
          title: 'The perfect family',
          body: 'Unisons, fourths, fifths, and octaves are called "perfect." They sound open and satisfying — stable enough to end a piece on. A perfect fourth (C–F) is 5 half steps; a perfect fifth (C–G) is 7 half steps; an octave is the same letter, 12 half steps up.',
          visualPitches: [pitch('C', 4), pitch('G', 4)],
        },
      ],
      generate: [
        {
          kind: 'buildInterval',
          intervals: [
            { number: 4, quality: 'P' },
            { number: 5, quality: 'P' },
            { number: 8, quality: 'P' },
          ],
          count: 3,
        },
        {
          kind: 'identifyInterval',
          intervals: [
            { number: 4, quality: 'P' },
            { number: 5, quality: 'P' },
            { number: 8, quality: 'P' },
          ],
          count: 2,
        },
      ],
    },
    {
      id: 'intervals-consonant',
      title: 'Consonant intervals',
      summary: 'Thirds and sixths — the smooth, sweet sounds.',
      steps: [
        {
          kind: 'concept',
          id: 'ic-c1',
          title: 'Major and minor',
          body: 'Thirds and sixths come in two sizes. A major third (C–E) is 4 half steps; a minor third (C–E♭) is 3. These intervals sound consonant — smooth and sweet, easy on the ears. They are the building blocks of chords.',
          visualPitches: [pitch('C', 4), pitch('E', 4)],
        },
        {
          kind: 'concept',
          id: 'ic-c2',
          title: 'Spelling matters',
          body: 'A third is always written on letters three apart (C–E), even when an accidental is involved. C–E♭ is a minor third; C–D♯ sounds the same but is the wrong spelling for a third, because D is only a second above C.',
          visualPitches: [pitch('C', 4), pitch('E', 4, -1)],
        },
      ],
      generate: [
        {
          kind: 'buildInterval',
          intervals: [
            { number: 3, quality: 'M' },
            { number: 3, quality: 'm' },
            { number: 6, quality: 'M' },
            { number: 6, quality: 'm' },
          ],
          count: 3,
        },
        {
          kind: 'identifyInterval',
          intervals: [
            { number: 3, quality: 'M' },
            { number: 3, quality: 'm' },
            { number: 6, quality: 'M' },
            { number: 6, quality: 'm' },
          ],
          count: 3,
        },
      ],
    },
    {
      id: 'intervals-dissonant',
      title: 'Dissonant intervals',
      summary: 'Seconds, sevenths, and the tritone — the tense, clashing sounds.',
      steps: [
        {
          kind: 'concept',
          id: 'id-c1',
          title: 'Tension and release',
          body: 'Seconds and sevenths sound dissonant — tense and clashing, almost an OUCH. So does the tritone (an augmented fourth or diminished fifth, like C–F♯). Dissonance is not "bad": it creates the tension that consonance resolves.',
          visualPitches: [pitch('C', 4), pitch('B', 4)],
        },
      ],
      generate: [
        {
          kind: 'buildInterval',
          intervals: [
            { number: 2, quality: 'M' },
            { number: 2, quality: 'm' },
            { number: 7, quality: 'M' },
            { number: 7, quality: 'm' },
            { number: 4, quality: 'A' },
            { number: 5, quality: 'd' },
          ],
          count: 3,
        },
        {
          kind: 'identifyInterval',
          intervals: [
            { number: 2, quality: 'M' },
            { number: 2, quality: 'm' },
            { number: 7, quality: 'M' },
            { number: 7, quality: 'm' },
            { number: 5, quality: 'd' },
          ],
          count: 3,
        },
      ],
    },
  ],
}
