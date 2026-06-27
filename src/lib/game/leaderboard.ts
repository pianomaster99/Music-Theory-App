// Global leaderboard: fastest race completion times per mode.

import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { GameMode, LeaderboardEntry } from './types'

const LEADERBOARD = 'leaderboard'

export async function submitTime(entry: {
  uid: string
  name: string
  mode: GameMode
  timeMs: number
  target: number
}): Promise<void> {
  await addDoc(collection(db, LEADERBOARD), {
    ...entry,
    name: entry.name.slice(0, 40),
    createdAt: serverTimestamp(),
  })
}

/** Top fastest times for a mode (ascending by time). */
export async function topTimes(
  mode: GameMode,
  count = 10,
): Promise<LeaderboardEntry[]> {
  const snap = await getDocs(
    query(
      collection(db, LEADERBOARD),
      where('mode', '==', mode),
      orderBy('timeMs', 'asc'),
      limit(count),
    ),
  )
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      uid: data.uid,
      name: data.name,
      mode: data.mode,
      timeMs: data.timeMs,
      target: data.target,
    } satisfies LeaderboardEntry
  })
}
