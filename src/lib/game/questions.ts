// Round question generation.
//
// Primary path: a bundled, web-grounded question bank (100/mode, generated
// offline by the OpenAI agent — see ml/gen_questions.py). If the bank is missing
// or short, we top up / fall back to a procedural generator built on the app's
// theory libs so a round always starts instantly.

import {
  describeInterval,
  transpose,
  type Interval,
} from '@/lib/theory/intervals'
import { chordLabel, chordPitches, type ChordQuality } from '@/lib/theory/chords'
import { formatPitch, pitch, type Letter, type Pitch } from '@/lib/theory/pitch'
import { pitchesToPcs } from './answerMatch'
import { bankSize, sampleBank } from './bank'
import type { GameMode, Question } from './types'

interface RawItem {
  id?: string
  kind?: 'interval' | 'chord' | 'custom'
  prompt?: string
  answerPitches?: string[]
  label?: string
}

let qid = 0
function nextId(): string {
  qid += 1
  return `q${Date.now().toString(36)}_${qid}`
}

/** Validate + normalize a raw item into a Question (or null if unusable). */
function toQuestion(item: RawItem): Question | null {
  const prompt = item.prompt?.trim()
  const answerPitches = (item.answerPitches ?? []).map((p) => p.trim()).filter(Boolean)
  if (!prompt || answerPitches.length < 2) return null
  const answerPcs = pitchesToPcs(answerPitches)
  // Need at least two DISTINCT pitch classes to be singable/matchable.
  if (answerPcs.length < 2 || answerPcs.length > 3) return null
  return {
    id: item.id || nextId(),
    kind: item.kind === 'chord' || item.kind === 'custom' ? item.kind : 'interval',
    prompt,
    answerPitches,
    answerPcs,
    label: item.label,
  }
}

// --------------------------------------------------------------------------
// Local fallback generator
// --------------------------------------------------------------------------
const ROOT_LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

const NOOB_INTERVALS: Interval[] = [
  { number: 2, quality: 'm' },
  { number: 2, quality: 'M' },
  { number: 3, quality: 'm' },
  { number: 3, quality: 'M' },
  { number: 4, quality: 'P' },
  { number: 5, quality: 'P' },
  { number: 6, quality: 'M' },
]

const PRO_INTERVALS: Interval[] = [
  ...NOOB_INTERVALS,
  { number: 6, quality: 'm' },
  { number: 7, quality: 'm' },
  { number: 7, quality: 'M' },
]

const TRIADS: ChordQuality[] = ['major', 'minor', 'diminished', 'augmented']

const CUSTOM_BANK: { prompt: string; answerPitches: string[] }[] = [
  { prompt: 'Sing the two distinct pitches that open "Twinkle Twinkle Little Star".', answerPitches: ['C', 'G'] },
  { prompt: 'Sing the first three pitches of the NBC chime.', answerPitches: ['G', 'E', 'C'] },
  { prompt: 'Sing the two notes of the iconic "Jaws" motif.', answerPitches: ['E', 'F'] },
  { prompt: "Sing the distinct pitches of Beethoven's 5th opening motif.", answerPitches: ['G', 'Eb'] },
  { prompt: 'Sing the tritone that starts "The Simpsons" theme, above C.', answerPitches: ['C', 'F#'] },
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomRoot(): Pitch {
  return pitch(pick(ROOT_LETTERS), 4)
}

function makeInterval(intervals: Interval[]): Question | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const root = randomRoot()
    const iv = pick(intervals)
    const direction = Math.random() < 0.75 ? 'above' : 'below'
    const target = transpose(root, iv, direction)
    if (!target) continue
    const q = toQuestion({
      kind: 'interval',
      prompt: `Sing a ${describeInterval(iv)} ${direction} ${formatPitch(root)}.`,
      answerPitches: [formatPitch(root), formatPitch(target)],
      label: `${describeInterval(iv)} ${direction} ${formatPitch(root)}`,
    })
    if (q) return q
  }
  return null
}

function makeChord(): Question | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const root = randomRoot()
    const quality = pick(TRIADS)
    try {
      const pitches = chordPitches(root, quality)
      const q = toQuestion({
        kind: 'chord',
        prompt: `Sing a ${formatPitch(root)} ${chordLabel(quality)}.`,
        answerPitches: pitches.map((p) => formatPitch(p)),
        label: `${formatPitch(root)} ${chordLabel(quality)}`,
      })
      if (q) return q
    } catch {
      // Some root/quality combos produce invalid spellings; just retry.
    }
  }
  return null
}

function makeCustom(): Question | null {
  return toQuestion({ kind: 'custom', ...pick(CUSTOM_BANK) })
}

function makeOne(mode: GameMode): Question | null {
  if (mode === 'noobs') return makeInterval(NOOB_INTERVALS)
  if (mode === 'pros') {
    return Math.random() < 0.5 ? makeInterval(PRO_INTERVALS) : makeChord()
  }
  // hackers
  const r = Math.random()
  if (r < 0.4) return makeInterval(PRO_INTERVALS)
  if (r < 0.75) return makeChord()
  return makeCustom()
}

export function localFallback(mode: GameMode, count: number): Question[] {
  const out: Question[] = []
  const seen = new Set<string>()
  let guard = 0
  while (out.length < count && guard < count * 20) {
    guard++
    const q = makeOne(mode)
    if (!q) continue
    if (seen.has(q.prompt)) continue
    seen.add(q.prompt)
    out.push(q)
  }
  return out
}

/** Generate the round's questions, preferring the bundled bank. */
export async function generateRoundQuestions(
  mode: GameMode,
  count = 20,
): Promise<{ questions: Question[]; source: 'bank' | 'fallback' | 'mixed' }> {
  const banked = bankSize(mode) > 0 ? sampleBank(mode, count) : []
  if (banked.length >= count) {
    return { questions: banked.slice(0, count), source: 'bank' }
  }
  if (banked.length === 0) {
    return { questions: localFallback(mode, count), source: 'fallback' }
  }
  // Bank too small: top up with procedural questions.
  const seen = new Set(banked.map((q) => q.prompt))
  const extra = localFallback(mode, count * 2).filter((q) => !seen.has(q.prompt))
  return {
    questions: [...banked, ...extra].slice(0, count),
    source: 'mixed',
  }
}
