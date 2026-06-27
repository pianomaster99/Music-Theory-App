// Shared types for the multiplayer singing game.

export type GameMode = 'noobs' | 'pros' | 'hackers'

export type RoomStatus = 'lobby' | 'countdown' | 'racing' | 'finished'

export const MODE_LABELS: Record<GameMode, string> = {
  noobs: 'Noobs',
  pros: 'Pros',
  hackers: 'Hackers',
}

export const MODE_BLURB: Record<GameMode, string> = {
  noobs: 'Intervals only. Great for getting your ears warmed up.',
  pros: 'Intervals and chords, including questions that need chord knowledge.',
  hackers: 'Intervals, chords, and clever trivia that resolves to pitches.',
}

export interface Question {
  id: string
  kind: 'interval' | 'chord' | 'custom'
  prompt: string
  /** Canonical answer note names (octave optional, ignored for matching). */
  answerPitches: string[]
  /** Pitch classes (0-11) of the answer, deduped. Derived from answerPitches. */
  answerPcs: number[]
  label?: string
  /**
   * If true, match by interval/chord SHAPE (transposition-invariant) rather than
   * exact pitch classes — used for trivia questions that name a piece but not the
   * key, so the player may sing the interval/chord in any key.
   */
  relative?: boolean
}

export interface Room {
  id: string
  code: string
  hostUid: string
  mode: GameMode
  status: RoomStatus
  /** Effective points needed to finish the race. */
  target: number
  questions: Question[]
  startedAt: number | null
  /** True for public quick-match lobbies (random players auto-grouped). */
  queued?: boolean
  /** For queued lobbies: epoch ms at which the host auto-starts the race. */
  autoStartAt?: number | null
}

export interface Player {
  uid: string
  name: string
  isGuest: boolean
  /** Index into the shared question list this player is currently on. */
  currentIndex: number
  /** Raw number of correct answers. */
  correctCount: number
  /** Weighted score (every 3rd correct counts double); drives rocket position. */
  effectiveScore: number
  finished: boolean
  /** Race time in ms once finished, else null. */
  finishMs: number | null
}

export interface LeaderboardEntry {
  id: string
  uid: string
  name: string
  mode: GameMode
  timeMs: number
  target: number
}
