import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/firebase'

export interface StreakState {
  currentStreak: number
  longestStreak: number
  /** Local calendar date of last practice, YYYY-MM-DD. */
  lastActiveDate: string
}

export interface RecordActivityResult {
  state: StreakState
  /** True when this activity extended or (re)started the streak today. */
  advanced: boolean
}

function localDateStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Whole-day difference between two YYYY-MM-DD strings (b - a). */
function dayDiff(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime()
  const db_ = new Date(`${b}T00:00:00`).getTime()
  return Math.round((db_ - da) / 86_400_000)
}

function streakRef(uid: string) {
  return doc(db, 'users', uid, 'stats', 'streak')
}

export async function loadStreak(uid: string): Promise<StreakState | null> {
  const snap = await getDoc(streakRef(uid))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    currentStreak: typeof d.currentStreak === 'number' ? d.currentStreak : 0,
    longestStreak: typeof d.longestStreak === 'number' ? d.longestStreak : 0,
    lastActiveDate:
      typeof d.lastActiveDate === 'string' ? d.lastActiveDate : '',
  }
}

/**
 * Record that the learner practiced today, updating their daily streak.
 * Same-day repeat calls are a no-op (no extra write).
 */
export async function recordActivity(
  uid: string,
): Promise<RecordActivityResult> {
  const today = localDateStr()
  const prev = await loadStreak(uid)

  if (prev && prev.lastActiveDate === today) {
    return { state: prev, advanced: false }
  }

  let current = 1
  if (prev && prev.lastActiveDate) {
    const diff = dayDiff(prev.lastActiveDate, today)
    current = diff === 1 ? prev.currentStreak + 1 : 1
  }
  const longest = Math.max(prev?.longestStreak ?? 0, current)
  const state: StreakState = {
    currentStreak: current,
    longestStreak: longest,
    lastActiveDate: today,
  }
  await setDoc(
    streakRef(uid),
    { ...state, updatedAt: serverTimestamp() },
    { merge: true },
  )
  return { state, advanced: true }
}
