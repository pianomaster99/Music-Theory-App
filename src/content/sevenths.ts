import type { Module } from '@/lib/content/types'
import { pitch } from '@/lib/theory/pitch'

// The Seventh Chords module, one lesson per quality. A seventh chord is a triad
// with one more third stacked on top (a seventh above the root).

export const seventhsModule: Module = {
  id: 'sevenths',
  title: 'Seventh Chords',
  description:
    'A triad plus a seventh. Build and name major, minor, dominant, diminished, and half-diminished sevenths.',
  lessons: [
    {
      id: 'sevenths-major',
      title: 'Major 7th chords',
      summary: 'A major triad plus a major seventh — lush and dreamy.',
      steps: [
        {
          kind: 'concept',
          id: 'smaj-c1',
          title: 'One more third on top',
          body: 'A seventh chord adds another third above the triad — a note a seventh above the root, for four notes total. A major 7 is a major triad plus a major seventh. Example: Cmaj7 is C, E, G, B.',
          visualPitches: [pitch('C', 4), pitch('E', 4), pitch('G', 4), pitch('B', 4)],
        },
      ],
      generate: [
        { kind: 'buildChord', qualities: ['maj7'], count: 3 },
        { kind: 'identifyChord', qualities: ['maj7', 'dom7', 'min7'], count: 2 },
      ],
    },
    {
      id: 'sevenths-minor',
      title: 'Minor 7th chords',
      summary: 'A minor triad plus a minor seventh — smooth and mellow.',
      steps: [
        {
          kind: 'concept',
          id: 'smin-c1',
          title: 'Minor triad, minor seventh',
          body: 'A minor 7 is a minor triad with a minor seventh on top. It sounds smooth and mellow, very common in jazz and pop. Example: Dm7 is D, F, A, C.',
          visualPitches: [pitch('D', 4), pitch('F', 4), pitch('A', 4), pitch('C', 5)],
        },
      ],
      generate: [
        { kind: 'buildChord', qualities: ['min7'], count: 3 },
        { kind: 'identifyChord', qualities: ['maj7', 'dom7', 'min7'], count: 2 },
      ],
    },
    {
      id: 'sevenths-dominant',
      title: 'Dominant 7th chords',
      summary: 'A major triad plus a minor seventh — bluesy, wants to resolve.',
      steps: [
        {
          kind: 'concept',
          id: 'sdom-c1',
          title: 'Major triad, minor seventh',
          body: 'A dominant 7 is a major triad with a *minor* seventh on top. That flattened seventh gives it a bluesy edge and a strong pull toward resolution. Example: G7 is G, B, D, F.',
          visualPitches: [pitch('G', 4), pitch('B', 4), pitch('D', 5), pitch('F', 5)],
        },
      ],
      generate: [
        { kind: 'buildChord', qualities: ['dom7'], count: 3 },
        { kind: 'identifyChord', qualities: ['maj7', 'dom7', 'min7'], count: 2 },
      ],
    },
    {
      id: 'sevenths-diminished',
      title: 'Diminished 7th chords',
      summary: 'Three minor thirds stacked — maximally tense. (Bonus)',
      steps: [
        {
          kind: 'concept',
          id: 'sdim-c1',
          title: 'Three stacked minor thirds',
          body: 'A fully diminished 7 stacks three minor thirds, so even the seventh is diminished. Every interval is the same size, giving an eerie, maximally tense sound. Example: B°7 is B, D, F, A♭.',
          visualPitches: [pitch('B', 3), pitch('D', 4), pitch('F', 4), pitch('A', 4, -1)],
        },
      ],
      generate: [
        { kind: 'buildChord', qualities: ['dim7'], count: 2 },
        {
          kind: 'identifyChord',
          qualities: ['maj7', 'dom7', 'min7', 'halfdim7', 'dim7'],
          count: 3,
        },
      ],
    },
    {
      id: 'sevenths-halfdim',
      title: 'Half-diminished 7th chords',
      summary: 'A diminished triad plus a minor seventh — moody. (Bonus)',
      steps: [
        {
          kind: 'concept',
          id: 'shd-c1',
          title: 'Diminished triad, minor seventh',
          body: 'A half-diminished 7 is a diminished triad with a *minor* seventh (not diminished) on top. It is softer than a fully diminished chord — moody rather than eerie. Example: Bø7 is B, D, F, A.',
          visualPitches: [pitch('B', 3), pitch('D', 4), pitch('F', 4), pitch('A', 4)],
        },
      ],
      generate: [
        { kind: 'buildChord', qualities: ['halfdim7'], count: 2 },
        {
          kind: 'identifyChord',
          qualities: ['maj7', 'dom7', 'min7', 'halfdim7', 'dim7'],
          count: 3,
        },
      ],
    },
  ],
}
