import type { Module } from '@/lib/content/types'
import { pitch } from '@/lib/theory/pitch'

// The Intervals module. Lessons are pure data: a sequence of concept and
// interactive problem steps with hand-written hints and feedback.

export const intervalsModule: Module = {
  id: 'intervals',
  title: 'Intervals',
  description:
    'An interval is the distance between two notes. Learn to count it, build it, and name it.',
  lessons: [
    {
      id: 'intervals-1',
      title: 'Counting the distance',
      summary: 'What an interval is and how to count its number.',
      steps: [
        {
          kind: 'concept',
          id: 'i1-c1',
          title: 'What is an interval?',
          body: 'An interval is simply the distance between two notes. Every chord, melody, and scale is built from intervals. Here are two notes a distance apart — C and the G above it.',
          visualPitches: [pitch('C', 4), pitch('G', 4)],
        },
        {
          kind: 'concept',
          id: 'i1-c2',
          title: 'Counting the number',
          body: 'To find the number of an interval, count letter names from the bottom note to the top — and count the bottom note as 1. From C up to G: C(1) D(2) E(3) F(4) G(5). That is a fifth.',
          visualPitches: [pitch('C', 4), pitch('G', 4)],
        },
        {
          kind: 'buildInterval',
          id: 'i1-p1',
          prompt: 'Drag the red note to build a 5th above C.',
          basePitch: pitch('C', 4),
          target: { number: 5, quality: 'P' },
          direction: 'above',
          hints: [
            'Count letter names from C as 1: C(1) D(2) E(3) F(4) G(5).',
            'The fifth letter above C is G. Place the note on G with no sharp or flat.',
          ],
        },
        {
          kind: 'buildInterval',
          id: 'i1-p2',
          prompt: 'Now build a 3rd above C.',
          basePitch: pitch('C', 4),
          target: { number: 3, quality: 'M' },
          direction: 'above',
          hints: [
            'Count: C(1) D(2) E(3). The third letter above C is E.',
            'Place the note on E, no accidental.',
          ],
        },
        {
          kind: 'buildInterval',
          id: 'i1-p3',
          prompt: 'Build an octave (8th) above C.',
          basePitch: pitch('C', 4),
          target: { number: 8, quality: 'P' },
          direction: 'above',
          hints: [
            'An octave is the same letter, eight steps up: C to the next C.',
            'Place the note on the C above the starting note.',
          ],
        },
        {
          kind: 'identifyInterval',
          id: 'i1-p4',
          prompt: 'What number is this interval?',
          pitches: [pitch('C', 4), pitch('A', 4)],
          answer: { number: 6, quality: 'M' },
          numberOnly: true,
          hints: ['Count letter names: C(1) D(2) E(3) F(4) G(5) A(6).'],
        },
      ],
    },
    {
      id: 'intervals-2',
      title: 'Major and minor',
      summary: 'The quality of an interval: how many half steps it spans.',
      steps: [
        {
          kind: 'concept',
          id: 'i2-c1',
          title: 'Two intervals can share a number',
          body: 'The number alone is not enough. A third can be major (4 half steps, like C to E) or minor (3 half steps, like C to E-flat). The "quality" tells you the exact size.',
          visualPitches: [pitch('C', 4), pitch('E', 4)],
        },
        {
          kind: 'buildInterval',
          id: 'i2-p1',
          prompt: 'Build a minor 3rd (m3) above C.',
          basePitch: pitch('C', 4),
          target: { number: 3, quality: 'm' },
          direction: 'above',
          hints: [
            'Start with the third letter above C — that is E.',
            'A minor third is one half step smaller than a major third. Lower the E with a flat to get E-flat.',
          ],
          feedback: {
            wrongEnharmonicSpelling:
              'That note sounds right, but a third above C must be spelled on E. D-sharp is the wrong spelling here — use E-flat.',
          },
        },
        {
          kind: 'buildInterval',
          id: 'i2-p2',
          prompt: 'Build a perfect 5th (P5) above D.',
          basePitch: pitch('D', 4),
          target: { number: 5, quality: 'P' },
          direction: 'above',
          hints: [
            'Count five letters from D: D(1) E(2) F(3) G(4) A(5).',
            'A perfect fifth above D is A, with no accidental.',
          ],
        },
        {
          kind: 'identifyInterval',
          id: 'i2-p3',
          prompt: 'Name this interval (number and quality).',
          pitches: [pitch('C', 4), pitch('E', 4, -1)],
          answer: { number: 3, quality: 'm' },
          hints: [
            'C to E is a third. Now count half steps: C to E-flat is 3 half steps.',
            '3 half steps over a third is a minor third.',
          ],
        },
        {
          kind: 'identifyInterval',
          id: 'i2-p4',
          prompt: 'Name this interval (number and quality).',
          pitches: [pitch('C', 4), pitch('E', 4)],
          answer: { number: 3, quality: 'M' },
          hints: ['C to E natural is 4 half steps over a third — a major third.'],
        },
      ],
    },
  ],
}
