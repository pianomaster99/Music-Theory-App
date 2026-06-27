import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  joinRoom,
  leaveRoom,
  MAX_PLAYERS,
  resetMyProgress,
  roomHasSpace,
  startCountdown,
  startRacing,
  subscribePlayers,
  subscribeRoom,
  updatePlayer,
} from '@/lib/game/room'
import { generateRoundQuestions } from '@/lib/game/questions'
import { matchesAnswer } from '@/lib/game/answerMatch'
import { applyCorrect } from '@/lib/game/scoring'
import { submitTime } from '@/lib/game/leaderboard'
import { useStableNotes } from '@/lib/game/useStableNotes'
import type { Player, Room, RoomStatus } from '@/lib/game/types'
import RocketTrack from '@/components/game/RocketTrack'
import QuestionCard from '@/components/game/QuestionCard'
import Lobby from '@/components/game/Lobby'
import Results from '@/components/game/Results'

const COUNTDOWN_MS = 3000

interface LocalProgress {
  currentIndex: number
  correctCount: number
  effectiveScore: number
  finished: boolean
  finishMs: number | null
}

const ZERO: LocalProgress = {
  currentIndex: 0,
  correctCount: 0,
  effectiveScore: 0,
  finished: false,
  finishMs: null,
}

function distinctRecent(buf: number[], n: number): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (let i = buf.length - 1; i >= 0 && out.length < n; i--) {
    if (!seen.has(buf[i])) {
      seen.add(buf[i])
      out.push(buf[i])
    }
  }
  return out.reverse()
}

export default function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user, profile, ensureGuest } = useAuth()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loaded, setLoaded] = useState(false)
  const [starting, setStarting] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [lobbyCountdown, setLobbyCountdown] = useState<number | null>(null)
  const [guestName, setGuestName] = useState('')
  const [roomFull, setRoomFull] = useState(false)

  // Local race state (authoritative for my own rocket; avoids double-counting
  // before the Firestore snapshot round-trips).
  const [myIndex, setMyIndex] = useState(0)
  const [capturedPcs, setCapturedPcs] = useState<number[]>([])
  const [justCorrect, setJustCorrect] = useState(false)

  const progressRef = useRef<LocalProgress>({ ...ZERO })
  const recentPcsRef = useRef<number[]>([])
  const roomRef = useRef<Room | null>(null)
  const submittedRef = useRef(false)
  const prevStatusRef = useRef<RoomStatus | null>(null)
  const countdownTimerRef = useRef<number | null>(null)
  const myUidRef = useRef<string | null>(null)
  const seatedRef = useRef(false)
  const isHostRef = useRef(false)
  const startedOnceRef = useRef(false)

  const myUid = user?.uid ?? null
  const me = useMemo(
    () => players.find((p) => p.uid === myUid) ?? null,
    [players, myUid],
  )
  const isHost = !!room && room.hostUid === myUid
  const seated = !!me
  const raceOver = !!room && (room.status === 'finished' || players.some((p) => p.finished))

  useEffect(() => {
    roomRef.current = room
  }, [room])
  useEffect(() => {
    myUidRef.current = myUid
  }, [myUid])
  useEffect(() => {
    seatedRef.current = seated
  }, [seated])
  useEffect(() => {
    isHostRef.current = isHost
  }, [isHost])

  // Subscriptions. New-round reset + the pre-race countdown are handled here (in
  // the subscription callback, an external-event handler) rather than in effect
  // bodies, so state updates stay reactive to the shared room status.
  useEffect(() => {
    if (!roomId) return
    const unsubR = subscribeRoom(roomId, (r) => {
      setRoom(r)
      setLoaded(true)

      const prev = prevStatusRef.current
      const status = r?.status ?? null

      if (r && status === 'countdown' && prev !== 'countdown') {
        // New round starting: reset my progress and run the local countdown.
        progressRef.current = { ...ZERO }
        recentPcsRef.current = []
        submittedRef.current = false
        setMyIndex(0)
        setCapturedPcs([])
        if (myUidRef.current && seatedRef.current) {
          void resetMyProgress(roomId, myUidRef.current)
        }
        let n = Math.ceil(COUNTDOWN_MS / 1000)
        setCountdown(n)
        if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = window.setInterval(() => {
          n -= 1
          setCountdown(n > 0 ? n : null)
          if (n <= 0 && countdownTimerRef.current) {
            window.clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
          }
        }, 1000)
      }

      if (status !== 'countdown' && prev === 'countdown') {
        if (countdownTimerRef.current) {
          window.clearInterval(countdownTimerRef.current)
          countdownTimerRef.current = null
        }
        setCountdown(null)
      }

      prevStatusRef.current = status
    })
    const unsubP = subscribePlayers(roomId, setPlayers)
    return () => {
      unsubR()
      unsubP()
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current)
    }
  }, [roomId])

  // Auto-join if I'm authed but not seated and the room is still in the lobby
  // (only if there's space — caps the race at MAX_PLAYERS).
  useEffect(() => {
    if (!roomId || !room || seated) return
    if (room.status !== 'lobby') return
    if (!user) return
    const name = profile?.displayName || user.displayName || 'Player'
    void (async () => {
      if (await roomHasSpace(roomId, user.uid)) {
        await joinRoom(roomId, { uid: user.uid, name, isGuest: !!user.isAnonymous })
      } else {
        setRoomFull(true)
      }
    })()
  }, [roomId, room, seated, user, profile])

  // ----- stable-note answer handling -----
  const onStableNote = useCallback(
    ({ pc }: { pc: number; midi: number }) => {
      const r = roomRef.current
      if (!r || r.status !== 'racing') return
      if (progressRef.current.finished) return
      const len = r.questions.length
      if (!len) return
      const q = r.questions[progressRef.current.currentIndex % len]
      if (!q) return

      recentPcsRef.current.push(pc)
      if (recentPcsRef.current.length > 8) recentPcsRef.current.shift()

      if (matchesAnswer(recentPcsRef.current, q.answerPcs, q.relative)) {
        // Correct! advance.
        const next = applyCorrect(progressRef.current, r.target)
        const currentIndex = progressRef.current.currentIndex + 1
        const finishMs = next.finished ? Date.now() - (r.startedAt ?? Date.now()) : null
        progressRef.current = { ...next, currentIndex, finishMs }
        recentPcsRef.current = []
        setCapturedPcs([])
        setMyIndex(currentIndex)
        setJustCorrect(true)
        window.setTimeout(() => setJustCorrect(false), 600)
        if (roomId && myUid) {
          void updatePlayer(roomId, myUid, {
            correctCount: next.correctCount,
            effectiveScore: next.effectiveScore,
            finished: next.finished,
            finishMs,
            currentIndex,
          })
        }
      } else {
        setCapturedPcs(distinctRecent(recentPcsRef.current, q.answerPcs.length))
      }
    },
    [roomId, myUid],
  )

  const mic = useStableNotes({ holdMs: 500, onStableNote })

  // Stop the mic when the race ends. (Starting it must be a user gesture — see
  // handleEnableMic — otherwise the browser keeps the AudioContext suspended and
  // no audio is captured. We intentionally keep it running through the lobby so a
  // player can pre-enable it before the race begins.)
  useEffect(() => {
    if (raceOver && mic.status === 'listening') {
      void mic.stop()
    }
  }, [raceOver, mic])

  const handleEnableMic = useCallback(() => {
    if (mic.status === 'idle') void mic.start()
  }, [mic])

  // Submit my finish time to the global leaderboard once.
  useEffect(() => {
    if (!room || !me || !me.finished || me.finishMs == null) return
    if (submittedRef.current) return
    submittedRef.current = true
    void submitTime({
      uid: me.uid,
      name: me.name,
      mode: room.mode,
      timeMs: me.finishMs,
      target: room.target,
    }).catch(() => {})
  }, [room, me])

  const handleStart = useCallback(async () => {
    if (!roomId || !room) return
    setStarting(true)
    try {
      const { questions } = await generateRoundQuestions(room.mode, 20)
      await startCountdown(roomId, questions, room.target)
      window.setTimeout(() => {
        void startRacing(roomId)
      }, COUNTDOWN_MS)
    } finally {
      setStarting(false)
    }
  }, [roomId, room])

  // Keep a stable ref to handleStart for the auto-start timer.
  const handleStartRef = useRef(handleStart)
  useEffect(() => {
    handleStartRef.current = handleStart
  })

  // Quick-match lobbies auto-start: tick a countdown to autoStartAt; the host
  // launches the round once it elapses. (setState happens in the interval
  // callback, not the effect body.)
  useEffect(() => {
    if (!room?.queued || room.status !== 'lobby' || !room.autoStartAt) return
    const at = room.autoStartAt
    const id = window.setInterval(() => {
      const remain = Math.max(0, Math.ceil((at - Date.now()) / 1000))
      setLobbyCountdown(remain)
      if (remain <= 0) {
        window.clearInterval(id)
        if (isHostRef.current && !startedOnceRef.current) {
          startedOnceRef.current = true
          void handleStartRef.current()
        }
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [room?.queued, room?.status, room?.autoStartAt])

  const handleSkip = useCallback(() => {
    const r = roomRef.current
    if (!r || !roomId || !myUid) return
    const currentIndex = progressRef.current.currentIndex + 1
    progressRef.current = { ...progressRef.current, currentIndex }
    recentPcsRef.current = []
    setCapturedPcs([])
    setMyIndex(currentIndex)
    void updatePlayer(roomId, myUid, { currentIndex })
  }, [roomId, myUid])

  const handleLeave = useCallback(async () => {
    if (roomId && myUid) await leaveRoom(roomId, myUid)
    await mic.stop()
    navigate('/play')
  }, [roomId, myUid, mic, navigate])

  const handleGuestJoin = useCallback(async () => {
    if (!roomId || !guestName.trim()) return
    const u = await ensureGuest(guestName.trim())
    if (!(await roomHasSpace(roomId, u.uid))) {
      setRoomFull(true)
      return
    }
    await joinRoom(roomId, {
      uid: u.uid,
      name: guestName.trim(),
      isGuest: !!u.isAnonymous,
    })
  }, [roomId, guestName, ensureGuest])

  // ----- render -----
  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center font-display text-2xl text-ink-soft">
        Loading room…
      </div>
    )
  }
  if (!room) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Room not found</h1>
        <p className="mt-2 text-ink-soft">It may have been closed.</p>
        <Button className="mt-6" onClick={() => navigate('/play')}>
          Back to lobby
        </Button>
      </div>
    )
  }

  if (roomFull && !seated) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Room is full</h1>
        <p className="mt-2 text-ink-soft">
          This race already has {MAX_PLAYERS} players.
        </p>
        <Button className="mt-6" onClick={() => navigate('/play')}>
          Back to lobby
        </Button>
      </div>
    )
  }

  // Not seated (e.g. opened a share link without an account) -> name gate.
  if (!seated && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <h1 className="text-center font-display text-3xl text-ink">Join the race</h1>
        <p className="mt-2 text-center text-ink-soft">Room {room.code}</p>
        <div className="mt-6 space-y-3 rounded-2xl border-2 border-ink/30 bg-parchment/60 p-6">
          <Label htmlFor="gname">Your name</Label>
          <Input
            id="gname"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Captain Pitchfinder"
            maxLength={40}
          />
          <Button className="w-full" onClick={handleGuestJoin}>
            Join as guest
          </Button>
        </div>
      </div>
    )
  }

  if (raceOver) {
    return (
      <Results
        room={room}
        players={players}
        myUid={myUid}
        isHost={isHost}
        onRematch={handleStart}
        onLeave={handleLeave}
        starting={starting}
      />
    )
  }

  if (room.status === 'lobby') {
    return (
      <Lobby
        room={room}
        players={players}
        isHost={isHost}
        starting={starting}
        onStart={handleStart}
        onLeave={handleLeave}
        lobbyCountdown={lobbyCountdown}
        micReady={mic.status === 'listening'}
        onEnableMic={handleEnableMic}
      />
    )
  }

  // countdown or racing
  const len = room.questions.length
  const question = len ? room.questions[myIndex % len] : null

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <RocketTrack players={players} target={room.target} myUid={myUid} />

      {mic.status !== 'listening' && (
        <div className="rounded-xl border-2 border-amber-500/60 bg-amber-50/60 p-3 text-center">
          <p className="mb-2 text-sm text-ink">
            Your microphone isn't on — you won't be able to answer.
          </p>
          <Button variant="outline" onClick={handleEnableMic} disabled={mic.status === 'loading'}>
            {mic.status === 'loading' ? 'Enabling…' : '🎤 Enable microphone'}
          </Button>
        </div>
      )}

      {countdown !== null && (
        <div className="rounded-2xl border-2 border-ink/30 bg-parchment/60 p-10 text-center">
          <div className="font-display text-7xl text-ink">{countdown}</div>
          <p className="mt-2 text-ink-soft">Get ready to sing…</p>
        </div>
      )}

      {room.status === 'racing' && question && (
        <>
          {mic.status === 'loading' && (
            <p className="text-center text-ink-soft">Warming up the mic…</p>
          )}
          {mic.error && (
            <p className="text-center text-sm text-[#9b3b2f]">{mic.error}</p>
          )}
          <QuestionCard
            question={question}
            index={myIndex}
            total={len}
            capturedPcs={capturedPcs}
            holdProgress={mic.holdProgress}
            reading={mic.reading}
            level={mic.level}
            onSkip={handleSkip}
            justCorrect={justCorrect}
          />
        </>
      )}
    </div>
  )
}
