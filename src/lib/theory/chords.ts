import {
  formatInterval,
  intervalBetween,
  transpose,
  type Interval,
} from './intervals'
import { formatPitch, midi, type Pitch } from './pitch'

export type ChordQuality =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'augmented'
  | 'maj7'
  | 'min7'
  | 'dom7'
  | 'dim7'
  | 'halfdim7'

export type ChordCategory = 'triad' | 'seventh'

interface ChordRecipe {
  quality: ChordQuality
  category: ChordCategory
  label: string
  /** Intervals above the root, in order. */
  intervals: Interval[]
}

const RECIPES: ChordRecipe[] = [
  {
    quality: 'major',
    category: 'triad',
    label: 'major triad',
    intervals: [
      { number: 3, quality: 'M' },
      { number: 5, quality: 'P' },
    ],
  },
  {
    quality: 'minor',
    category: 'triad',
    label: 'minor triad',
    intervals: [
      { number: 3, quality: 'm' },
      { number: 5, quality: 'P' },
    ],
  },
  {
    quality: 'diminished',
    category: 'triad',
    label: 'diminished triad',
    intervals: [
      { number: 3, quality: 'm' },
      { number: 5, quality: 'd' },
    ],
  },
  {
    quality: 'augmented',
    category: 'triad',
    label: 'augmented triad',
    intervals: [
      { number: 3, quality: 'M' },
      { number: 5, quality: 'A' },
    ],
  },
  {
    quality: 'maj7',
    category: 'seventh',
    label: 'major seventh chord',
    intervals: [
      { number: 3, quality: 'M' },
      { number: 5, quality: 'P' },
      { number: 7, quality: 'M' },
    ],
  },
  {
    quality: 'min7',
    category: 'seventh',
    label: 'minor seventh chord',
    intervals: [
      { number: 3, quality: 'm' },
      { number: 5, quality: 'P' },
      { number: 7, quality: 'm' },
    ],
  },
  {
    quality: 'dom7',
    category: 'seventh',
    label: 'dominant seventh chord',
    intervals: [
      { number: 3, quality: 'M' },
      { number: 5, quality: 'P' },
      { number: 7, quality: 'm' },
    ],
  },
  {
    quality: 'dim7',
    category: 'seventh',
    label: 'diminished seventh chord',
    intervals: [
      { number: 3, quality: 'm' },
      { number: 5, quality: 'd' },
      { number: 7, quality: 'd' },
    ],
  },
  {
    quality: 'halfdim7',
    category: 'seventh',
    label: 'half-diminished seventh chord',
    intervals: [
      { number: 3, quality: 'm' },
      { number: 5, quality: 'd' },
      { number: 7, quality: 'm' },
    ],
  },
]

const RECIPE_BY_QUALITY = new Map(RECIPES.map((r) => [r.quality, r]))

export function chordRecipe(quality: ChordQuality): ChordRecipe {
  const recipe = RECIPE_BY_QUALITY.get(quality)
  if (!recipe) throw new Error(`Unknown chord quality: ${quality}`)
  return recipe
}

export function chordLabel(quality: ChordQuality): string {
  return chordRecipe(quality).label
}

/** Build the correctly spelled pitches of a chord in root position. */
export function chordPitches(root: Pitch, quality: ChordQuality): Pitch[] {
  const recipe = chordRecipe(quality)
  const pitches: Pitch[] = [root]
  for (const interval of recipe.intervals) {
    const next = transpose(root, interval, 'above')
    if (!next) throw new Error(`Cannot build ${quality} on ${formatPitch(root)}`)
    pitches.push(next)
  }
  return pitches
}

/**
 * Classify a set of pitches as a root-position chord. Returns the root and
 * quality, or null if the pitches do not spell a known triad or seventh chord.
 */
export function classifyChord(
  pitches: Pitch[],
): { root: Pitch; quality: ChordQuality } | null {
  if (pitches.length < 3) return null
  const sorted = [...pitches].sort((a, b) => midi(a) - midi(b))
  const root = sorted[0]

  const intervalLabels = sorted
    .slice(1)
    .map((p) => {
      const interval = intervalBetween(root, p)
      return interval ? formatInterval(interval) : null
    })

  if (intervalLabels.some((l) => l === null)) return null

  const key = intervalLabels.join(',')
  for (const recipe of RECIPES) {
    if (recipe.intervals.length !== intervalLabels.length) continue
    const recipeKey = recipe.intervals.map(formatInterval).join(',')
    if (recipeKey === key) return { root, quality: recipe.quality }
  }
  return null
}

export function isSeventh(quality: ChordQuality): boolean {
  return chordRecipe(quality).category === 'seventh'
}
