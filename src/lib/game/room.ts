// Firestore-backed room service: create/join, realtime subscriptions, and
// per-player progress updates. Rocket positions are derived on the client from
// each player's effectiveScore, so we only write to Firestore on discrete events
// (join, answer, finish, status change), keeping it well within free-tier limits.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { DEFAULT_TARGET } from './scoring'
import type { GameMode, Player, Question, Room, RoomStatus } from './types'

const ROOMS = 'rooms'
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no ambiguous O/0/I/1/L

/** How long a quick-match lobby waits for random players before auto-starting. */
export const QUEUE_WAIT_MS = 12000

/** Maximum players allowed in a single race. */
export const MAX_PLAYERS = 5

/** Whether a room has room for `uid` (already-seated players always "fit"). */
export async function roomHasSpace(roomId: string, uid: string): Promise<boolean> {
  const snap = await getDocs(collection(db, ROOMS, roomId, 'players'))
  if (snap.docs.some((d) => d.id === uid)) return true
  return snap.size < MAX_PLAYERS
}

function randomCode(len = 4): string {
  let s = ''
  for (let i = 0; i < len; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return s
}

export interface HostInfo {
  uid: string
  name: string
  isGuest: boolean
}

function freshPlayer(info: HostInfo): Player {
  return {
    uid: info.uid,
    name: info.name,
    isGuest: info.isGuest,
    currentIndex: 0,
    correctCount: 0,
    effectiveScore: 0,
    finished: false,
    finishMs: null,
  }
}

async function codeInUse(code: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, ROOMS), where('code', '==', code), limit(1)),
  )
  return !snap.empty
}

/** Create a new room in the lobby state and seat the host as the first player. */
export async function createRoom(
  host: HostInfo,
  mode: GameMode,
  target = DEFAULT_TARGET,
): Promise<Room> {
  let code = randomCode()
  for (let i = 0; i < 5 && (await codeInUse(code)); i++) code = randomCode()

  const ref = await addDoc(collection(db, ROOMS), {
    code,
    hostUid: host.uid,
    mode,
    status: 'lobby' as RoomStatus,
    target,
    questions: [],
    startedAt: null,
    createdAt: serverTimestamp(),
  })

  await setDoc(doc(db, ROOMS, ref.id, 'players', host.uid), {
    ...freshPlayer(host),
    joinedAt: serverTimestamp(),
  })

  return {
    id: ref.id,
    code,
    hostUid: host.uid,
    mode,
    status: 'lobby',
    target,
    questions: [],
    startedAt: null,
  }
}

/**
 * Quick match: join an open public lobby for this mode, or create one and host
 * it. Uses a single-field `queueKey` query (auto-indexed, no extra rules) so a
 * room is discoverable only while it is an open, joinable lobby. There is a small
 * race window where two players may create separate lobbies; that just yields two
 * smaller matches, which is acceptable.
 */
export async function quickMatch(
  info: HostInfo,
  mode: GameMode,
): Promise<{ roomId: string; isHost: boolean }> {
  const now = Date.now()
  const snap = await getDocs(
    query(collection(db, ROOMS), where('queueKey', '==', mode), limit(10)),
  )
  // Join the first open lobby that still has space (< MAX_PLAYERS).
  for (const d of snap.docs) {
    const r = d.data()
    if (r.status !== 'lobby' || (r.autoStartAt ?? 0) <= now) continue
    if (await roomHasSpace(d.id, info.uid)) {
      await joinRoom(d.id, info)
      return { roomId: d.id, isHost: false }
    }
  }

  let code = randomCode()
  for (let i = 0; i < 5 && (await codeInUse(code)); i++) code = randomCode()
  const ref = await addDoc(collection(db, ROOMS), {
    code,
    hostUid: info.uid,
    mode,
    status: 'lobby' as RoomStatus,
    target: DEFAULT_TARGET,
    questions: [],
    startedAt: null,
    queued: true,
    queueKey: mode,
    autoStartAt: now + QUEUE_WAIT_MS,
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(db, ROOMS, ref.id, 'players', info.uid), {
    ...freshPlayer(info),
    joinedAt: serverTimestamp(),
  })
  return { roomId: ref.id, isHost: true }
}

/** Find a lobby room by its join code. Returns the room id, or null. */
export async function findRoomByCode(code: string): Promise<string | null> {
  const snap = await getDocs(
    query(collection(db, ROOMS), where('code', '==', code.toUpperCase().trim()), limit(1)),
  )
  if (snap.empty) return null
  return snap.docs[0].id
}

/** Seat a player into an existing room (creates/overwrites their own entry). */
export async function joinRoom(roomId: string, info: HostInfo): Promise<void> {
  await setDoc(
    doc(db, ROOMS, roomId, 'players', info.uid),
    { ...freshPlayer(info), joinedAt: serverTimestamp() },
    { merge: true },
  )
}

export function subscribeRoom(
  roomId: string,
  cb: (room: Room | null) => void,
): () => void {
  return onSnapshot(doc(db, ROOMS, roomId), (snap) => {
    if (!snap.exists()) {
      cb(null)
      return
    }
    const d = snap.data()
    cb({
      id: snap.id,
      code: d.code,
      hostUid: d.hostUid,
      mode: d.mode,
      status: d.status,
      target: d.target ?? DEFAULT_TARGET,
      questions: (d.questions ?? []) as Question[],
      startedAt: d.startedAt ?? null,
      queued: !!d.queued,
      autoStartAt: d.autoStartAt ?? null,
    })
  })
}

export function subscribePlayers(
  roomId: string,
  cb: (players: Player[]) => void,
): () => void {
  return onSnapshot(collection(db, ROOMS, roomId, 'players'), (snap) => {
    const players = snap.docs.map((p) => {
      const d = p.data()
      return {
        uid: p.id,
        name: d.name ?? 'Player',
        isGuest: !!d.isGuest,
        currentIndex: d.currentIndex ?? 0,
        correctCount: d.correctCount ?? 0,
        effectiveScore: d.effectiveScore ?? 0,
        finished: !!d.finished,
        finishMs: d.finishMs ?? null,
      } satisfies Player
    })
    cb(players)
  })
}

/** Host-only: write the round's questions and flip the room into countdown. */
export async function startCountdown(
  roomId: string,
  questions: Question[],
  target: number,
): Promise<void> {
  await updateDoc(doc(db, ROOMS, roomId), {
    questions,
    target,
    status: 'countdown' as RoomStatus,
    // Close matchmaking for this room so no new random players join mid-race.
    queueKey: null,
  })
}

/** Host-only: begin the race; startedAt is shared so all clients time equally. */
export async function startRacing(roomId: string): Promise<void> {
  await updateDoc(doc(db, ROOMS, roomId), {
    status: 'racing' as RoomStatus,
    startedAt: Date.now(),
  })
}

/** Host-only: set an arbitrary room status (e.g. back to lobby for a rematch). */
export async function setRoomStatus(
  roomId: string,
  status: RoomStatus,
): Promise<void> {
  await updateDoc(doc(db, ROOMS, roomId), { status })
}

export async function updatePlayer(
  roomId: string,
  uid: string,
  patch: Partial<Player>,
): Promise<void> {
  await updateDoc(doc(db, ROOMS, roomId, 'players', uid), patch)
}

/** Reset every player's progress for a rematch (each writes their own doc). */
export async function resetMyProgress(roomId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, ROOMS, roomId, 'players', uid), {
    currentIndex: 0,
    correctCount: 0,
    effectiveScore: 0,
    finished: false,
    finishMs: null,
  })
}

export async function leaveRoom(roomId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, ROOMS, roomId, 'players', uid)).catch(() => {})
}
