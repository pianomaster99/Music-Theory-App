// Static, pre-generated question bank (see ml/gen_questions.py).
//
// 100 web-grounded questions per mode, generated offline by the OpenAI agent and
// bundled as JSON. Each round samples a shuffled subset, so rounds stay varied
// without any runtime API call.

import bankData from './questionBank.json'
import { pitchesToPcs } from './answerMatch'
import type { GameMode, Question } from './types'

interface BankItem {
  id: string
  kind: 'interval' | 'chord' | 'custom'
  prompt: string
  answerPitches: string[]
  reference?: string
  category?: string
  relative?: boolean
}

const BANK = bankData as Record<GameMode, BankItem[]>

function toQuestion(item: BankItem): Question | null {
  const answerPcs = pitchesToPcs(item.answerPitches)
  if (answerPcs.length < 2 || answerPcs.length > 3) return null
  return {
    id: item.id,
    kind: item.kind,
    prompt: item.prompt,
    answerPitches: item.answerPitches,
    answerPcs,
    label: item.reference,
    relative: !!item.relative,
  }
}

/** How many questions exist in the bank for a mode (0 if none). */
export function bankSize(mode: GameMode): number {
  return BANK[mode]?.length ?? 0
}

/** Sample `count` shuffled, valid questions from the bank for a mode. */
export function sampleBank(mode: GameMode, count: number): Question[] {
  const items = (BANK[mode] ?? []).slice()
  // Fisher-Yates shuffle.
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  const out: Question[] = []
  for (const it of items) {
    const q = toQuestion(it)
    if (q) out.push(q)
    if (out.length >= count) break
  }
  return out
}
