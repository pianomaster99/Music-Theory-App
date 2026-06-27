/**
 * Cloud Functions for the multiplayer singing game.
 *
 * `generateQuestions` is an HTTPS callable that asks OpenAI for a batch of
 * non-formulaic music-theory questions whose answers are canonical pitch sets
 * (intervals = 2 pitches, chords = 3). The OpenAI key stays server-side (a
 * Functions secret). The whole call is capped at ~9s; on any failure it returns
 * `{ ok: false }` so the client falls back to its built-in generator and a round
 * can always start within the PRD's 10s budget.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import OpenAI from 'openai'

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY')

setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

type GameMode = 'noobs' | 'pros' | 'hackers'

interface GeneratedQuestion {
  id: string
  kind: 'interval' | 'chord' | 'custom'
  prompt: string
  /** Canonical answer as note names (octave optional), e.g. ["C", "E", "G"]. */
  answerPitches: string[]
  label?: string
}

const PITCH_RE = /^[A-Ga-g](##|bb|#|b|x)?(-?\d+)?$/

function modeGuidance(mode: GameMode): string {
  switch (mode) {
    case 'noobs':
      return (
        'Only INTERVALS (answer is exactly 2 pitches). Keep prompts approachable ' +
        'but varied in wording. Examples of angles: "sing a perfect fifth above D", ' +
        '"sing the two notes of a major third starting on F".'
      )
    case 'pros':
      return (
        'INTERVALS (2 pitches) and CHORDS (3 pitches: triads). Mix in questions ' +
        'that require chord knowledge, e.g. "sing the outer two notes of a C major ' +
        'triad" (interval answer) or "sing a D minor triad" (chord answer).'
      )
    case 'hackers':
      return (
        'INTERVALS (2 pitches), CHORDS (3 pitches), AND clever trivia that resolves ' +
        'to a pitch set. Example: "sing the first three distinct pitches of ' +
        "Beethoven's 5th\" -> {G, Eb}. Always include the canonical answer pitches. " +
        'Also include some questions of the easier two modes.'
      )
  }
}

const SYSTEM_PROMPT = (mode: GameMode, count: number) =>
  `You are pianomaster99, a witty quizmaster for a multiplayer singing race.
Generate exactly ${count} DISTINCT, non-formulaic music-theory questions whose
answer a player will SING as a set of pitches.

Mode "${mode}": ${modeGuidance(mode)}

Hard requirements:
- Every answer is a SET of 2 or 3 pitches (intervals = 2, chords/triads = 3).
- Order does not matter; the player sings the notes one at a time in any octave.
- "answerPitches" must be the exact note names (letter + optional accidental like
  # or b), e.g. ["C","E","G"]. Octave numbers are allowed but ignored.
- Vary phrasing, roots, qualities and directions so questions never feel repetitive.
- Keep prompts to one short sentence. Do not reveal the answer in the prompt.`

interface Payload {
  ok: boolean
  questions: GeneratedQuestion[]
}

function validate(qs: unknown, count: number): GeneratedQuestion[] {
  if (!Array.isArray(qs)) return []
  const out: GeneratedQuestion[] = []
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i] as Record<string, unknown>
    if (!q || typeof q !== 'object') continue
    const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : ''
    const kind = q.kind === 'chord' || q.kind === 'custom' ? q.kind : 'interval'
    const rawPitches = Array.isArray(q.answerPitches) ? q.answerPitches : []
    const answerPitches = rawPitches
      .filter((p): p is string => typeof p === 'string')
      .map((p) => p.trim())
      .filter((p) => PITCH_RE.test(p))
    if (!prompt) continue
    if (answerPitches.length < 2 || answerPitches.length > 3) continue
    out.push({
      id: `q${i}_${Date.now().toString(36)}`,
      kind,
      prompt,
      answerPitches,
      label: typeof q.label === 'string' ? q.label : undefined,
    })
    if (out.length >= count) break
  }
  return out
}

export const generateQuestions = onCall(
  { secrets: [OPENAI_API_KEY], timeoutSeconds: 30, cors: true },
  async (req): Promise<Payload> => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Sign in (or play as guest) first.')
    }
    const mode: GameMode =
      req.data?.mode === 'pros' || req.data?.mode === 'hackers'
        ? req.data.mode
        : 'noobs'
    const count = Math.min(Math.max(Number(req.data?.count) || 20, 1), 30)

    const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() })

    const work = (async (): Promise<Payload> => {
      const resp = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 1.0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT(mode, count) },
          {
            role: 'user',
            content: `Generate the ${count} questions now for mode "${mode}".`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'questions',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['questions'],
              properties: {
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['kind', 'prompt', 'answerPitches', 'label'],
                    properties: {
                      kind: { type: 'string', enum: ['interval', 'chord', 'custom'] },
                      prompt: { type: 'string' },
                      answerPitches: {
                        type: 'array',
                        items: { type: 'string' },
                        minItems: 2,
                        maxItems: 3,
                      },
                      label: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      })
      const content = resp.choices[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(content) as { questions?: unknown }
      const questions = validate(parsed.questions, count)
      return { ok: questions.length > 0, questions }
    })()

    const timeout = new Promise<Payload>((resolve) =>
      setTimeout(() => resolve({ ok: false, questions: [] }), 9000),
    )

    try {
      return await Promise.race([work, timeout])
    } catch (err) {
      console.error('generateQuestions failed', err)
      return { ok: false, questions: [] }
    }
  },
)
