import type { Module } from '@/lib/content/types'
import { pitch } from '@/lib/theory/pitch'

// The Triads module, one lesson per quality. Concepts are authored; problems
// are generated so each lesson offers fresh, varied examples.

export const triadsModule: Module = {
  id: 'triads',
  title: 'Triads',
  description:
    'Three notes stacked in thirds. Build and name major, minor, diminished, and augmented triads.',
  lessons: [
    {
      id: 'triads-major',
      title: 'Major triads',
      summary: 'A major third with a minor third on top — bright and stable.',
      steps: [
        {
          kind: 'concept',
          id: 'tmaj-c1',
          title: 'A triad is a stack of thirds',
          body: 'A triad is three notes built by stacking two thirds: a root, a third, and a fifth. A major triad puts a major third on the bottom and a minor third on top, giving a bright, stable sound. Example: C major is C, E, G.',
          visualPitches: [pitch('C', 4), pitch('E', 4), pitch('G', 4)],
        },
      ],
      generate: [
        { kind: 'buildChord', qualities: ['major'], count: 3 },
        { kind: 'identifyChord', qualities: ['major', 'minor'], count: 2 },
      ],
    },
    {
      id: 'triads-minor',
      title: 'Minor triads',
      summary: 'A minor third with a major third on top — darker, but stable.',
      steps: [
        {
          kind: 'concept',
          id: 'tmin-c1',
          title: 'Flip the thirds',
          body: 'A minor triad flips the stack: a minor third on the bottom, a major third on top. The fifth is still perfect, so it is stable — just darker than major. Example: A minor is A, C, E.',
          visualPitches: [pitch('A', 4), pitch('C', 5), pitch('E', 5)],
        },
      ],
      generate: [
        { kind: 'buildChord', qualities: ['minor'], count: 3 },
        { kind: 'identifyChord', qualities: ['major', 'minor'], count: 2 },
      ],
    },
    {
      id: 'triads-diminished',
      title: 'Diminished triads',
      summary: 'Two minor thirds stacked — tense, wants to resolve. (Bonus)',
      steps: [
        {
          kind: 'concept',
          id: 'tdim-c1',
          title: 'Shrink the fifth',
          body: 'Stack two minor thirds and the fifth becomes diminished — a half step smaller than perfect. The result sounds tense and unstable, eager to resolve. Example: B diminished is B, D, F.',
          visualPitches: [pitch('B', 3), pitch('D', 4), pitch('F', 4)],
        },
      ],
      generate: [
        { kind: 'buildChord', qualities: ['diminished'], count: 2 },
        {
          kind: 'identifyChord',
          qualities: ['major', 'minor', 'diminished'],
          count: 3,
        },
      ],
    },
    {
      id: 'triads-augmented',
      title: 'Augmented triads',
      summary: 'Two major thirds stacked — bright and restless. (Bonus)',
      steps: [
        {
          kind: 'concept',
          id: 'taug-c1',
          title: 'Stretch the fifth',
          body: 'Stack two major thirds and the fifth becomes augmented — a half step larger than perfect. The chord sounds bright but restless, with no clear home. Example: C augmented is C, E, G♯.',
          visualPitches: [pitch('C', 4), pitch('E', 4), pitch('G', 4, 1)],
        },
      ],
      generate: [
        { kind: 'buildChord', qualities: ['augmented'], count: 2 },
        {
          kind: 'identifyChord',
          qualities: ['major', 'minor', 'augmented'],
          count: 3,
        },
      ],
    },
  ],
}
