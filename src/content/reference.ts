import {
  describeInterval,
  formatInterval,
  intervalSemitones,
  transpose,
  type Interval,
} from '@/lib/theory/intervals'
import {
  chordLabel,
  chordPitches,
  chordRecipe,
  type ChordQuality,
} from '@/lib/theory/chords'
import { pitch, type Pitch } from '@/lib/theory/pitch'
import { intervalFeel, type ConsonanceFeel } from './generate'

export interface IntervalRef {
  interval: Interval
  short: string
  name: string
  halfSteps: number
  feel: ConsonanceFeel
  /** Example built upward from C4. */
  example: Pitch[]
}

const REFERENCE_INTERVALS: Interval[] = [
  { number: 1, quality: 'P' },
  { number: 2, quality: 'm' },
  { number: 2, quality: 'M' },
  { number: 3, quality: 'm' },
  { number: 3, quality: 'M' },
  { number: 4, quality: 'P' },
  { number: 4, quality: 'A' },
  { number: 5, quality: 'P' },
  { number: 6, quality: 'm' },
  { number: 6, quality: 'M' },
  { number: 7, quality: 'm' },
  { number: 7, quality: 'M' },
  { number: 8, quality: 'P' },
]

const C4 = pitch('C', 4)

export const INTERVAL_TABLE: IntervalRef[] = REFERENCE_INTERVALS.map((interval) => {
  const top = transpose(C4, interval, 'above')
  return {
    interval,
    short: formatInterval(interval),
    name: describeInterval(interval),
    halfSteps: intervalSemitones(interval) ?? 0,
    feel: intervalFeel(interval),
    example: top ? [C4, top] : [C4],
  }
})

export interface ChordRef {
  quality: ChordQuality
  label: string
  category: 'triad' | 'seventh'
  /** Stacked intervals above the root, e.g. ["M3", "P5"]. */
  formula: string[]
  example: Pitch[]
}

const CHORD_ORDER: ChordQuality[] = [
  'major',
  'minor',
  'diminished',
  'augmented',
  'maj7',
  'min7',
  'dom7',
  'halfdim7',
  'dim7',
]

// dim7 on C needs a double flat; show it on B for a clean spelling.
function exampleRoot(quality: ChordQuality): Pitch {
  return quality === 'dim7' ? pitch('B', 3) : C4
}

export const CHORD_TABLE: ChordRef[] = CHORD_ORDER.map((quality) => {
  const recipe = chordRecipe(quality)
  const root = exampleRoot(quality)
  return {
    quality,
    label: chordLabel(quality),
    category: recipe.category,
    formula: recipe.intervals.map(formatInterval),
    example: chordPitches(root, quality),
  }
})

export const FEEL_LABEL: Record<ConsonanceFeel, string> = {
  perfect: 'perfect',
  consonant: 'consonant',
  dissonant: 'dissonant',
}
