import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  createRoom,
  findRoomByCode,
  joinRoom,
  MAX_PLAYERS,
  quickMatch,
  roomHasSpace,
} from '@/lib/game/room'
import { topTimes } from '@/lib/game/leaderboard'
import {
  MODE_BLURB,
  MODE_LABELS,
  type GameMode,
  type LeaderboardEntry,
} from '@/lib/game/types'

const MODES: GameMode[] = ['noobs', 'pros', 'hackers']

// What each mode tests + the module that teaches it (for the "learn first" nudge).
const MODE_LEARN: Record<GameMode, { content: string; module: string }> = {
  noobs: { content: 'intervals', module: 'Intervals' },
  pros: { content: 'triads and chords', module: 'Triads' },
  hackers: { content: 'chords and seventh chords', module: 'Seventh chords' },
}

function formatMs(ms: number): string {
  const s = ms / 1000
  return `${s.toFixed(1)}s`
}

export default function GameHome() {
  const { user, profile, ensureGuest } = useAuth()
  const navigate = useNavigate()

  const [nameInput, setNameInput] = useState<string | null>(null)
  const [mode, setMode] = useState<GameMode>('noobs')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [board, setBoard] = useState<LeaderboardEntry[]>([])

  // Default to the account name, but let the user override it (no effect needed).
  const defaultName = profile?.displayName || user?.displayName || ''
  const name = nameInput ?? defaultName

  useEffect(() => {
    let alive = true
    topTimes(mode, 10)
      .then((rows) => alive && setBoard(rows))
      .catch(() => alive && setBoard([]))
    return () => {
      alive = false
    }
  }, [mode])

  const trimmedName = name.trim()
  const isGuest = !!user?.isAnonymous || !profile

  const handleError = useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('operation-not-allowed') || msg.includes('admin-restricted')) {
      setError('Guest play needs Anonymous sign-in enabled in Firebase Auth.')
    } else {
      setError(msg)
    }
  }, [])

  const handleCreate = useCallback(async () => {
    if (!trimmedName) {
      setError('Enter a name first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const u = await ensureGuest(trimmedName)
      const room = await createRoom(
        { uid: u.uid, name: trimmedName, isGuest: !!u.isAnonymous },
        mode,
      )
      navigate(`/play/${room.id}`)
    } catch (e) {
      handleError(e)
      setBusy(false)
    }
  }, [trimmedName, ensureGuest, mode, navigate, handleError])

  const handleJoin = useCallback(async () => {
    if (!trimmedName) {
      setError('Enter a name first.')
      return
    }
    if (code.trim().length < 3) {
      setError('Enter a room code.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const roomId = await findRoomByCode(code)
      if (!roomId) {
        setError('No room found for that code.')
        setBusy(false)
        return
      }
      const u = await ensureGuest(trimmedName)
      if (!(await roomHasSpace(roomId, u.uid))) {
        setError(`That room is full (max ${MAX_PLAYERS} players).`)
        setBusy(false)
        return
      }
      await joinRoom(roomId, { uid: u.uid, name: trimmedName, isGuest: !!u.isAnonymous })
      navigate(`/play/${roomId}`)
    } catch (e) {
      handleError(e)
      setBusy(false)
    }
  }, [trimmedName, code, ensureGuest, navigate, handleError])

  const handleQuickMatch = useCallback(async () => {
    if (!trimmedName) {
      setError('Enter a name first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const u = await ensureGuest(trimmedName)
      const { roomId } = await quickMatch(
        { uid: u.uid, name: trimmedName, isGuest: !!u.isAnonymous },
        mode,
      )
      navigate(`/play/${roomId}`)
    } catch (e) {
      handleError(e)
      setBusy(false)
    }
  }, [trimmedName, ensureGuest, mode, navigate, handleError])

  const handleSolo = useCallback(() => {
    if (!trimmedName) {
      setError('Enter a name first.')
      return
    }
    navigate(`/play/solo?mode=${mode}`)
  }, [trimmedName, mode, navigate])

  const boardEmpty = useMemo(() => board.length === 0, [board])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="text-sm uppercase tracking-widest text-ink-soft">
          Multiplayer
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink">Pitch Rocket Race</h1>
        <p className="mx-auto mt-2 max-w-prose text-ink-soft">
          Sing the answer to each question. Every correct interval or chord
          boosts your rocket. First to the finish line wins.
        </p>
      </header>

      <div className="space-y-6 rounded-2xl border-2 border-ink/30 bg-parchment/60 p-6">
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Captain Pitchfinder"
            maxLength={40}
          />
          {isGuest && (
            <p className="text-xs text-ink-soft">Playing as a guest is fine.</p>
          )}
        </div>

        <div>
          <Label className="mb-2 block">Mode</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-xl border-2 p-3 text-left transition-all',
                  mode === m
                    ? 'border-ink bg-parchment-dark'
                    : 'border-ink/25 bg-parchment hover:border-ink/50',
                )}
              >
                <div className="font-display text-lg text-ink">{MODE_LABELS[m]}</div>
                <div className="mt-1 text-xs text-ink-soft">{MODE_BLURB[m]}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            New to {MODE_LEARN[mode].content}? Learn them first in the{' '}
            <Link to="/map" className="font-medium text-ink underline underline-offset-2">
              {MODE_LEARN[mode].module} module
            </Link>
            , then come back to get fluent.
          </p>
        </div>

        {error && <p className="text-sm font-medium text-[#9b3b2f]">{error}</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="sm:flex-1" size="lg" onClick={handleQuickMatch} disabled={busy}>
            {busy ? 'Please wait...' : '⚡ Quick match (random players)'}
          </Button>
          <Button
            className="sm:flex-1"
            size="lg"
            variant="outline"
            onClick={handleSolo}
            disabled={busy}
          >
            🚀 Solo time trial
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-ink-soft">
          <span className="h-px flex-1 bg-ink/20" />
          or play with friends
          <span className="h-px flex-1 bg-ink/20" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Button variant="outline" className="sm:flex-1" onClick={handleCreate} disabled={busy}>
            {busy ? 'Please wait...' : 'Create private room'}
          </Button>
          <div className="flex items-end gap-2 sm:flex-1">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="code">Room code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                maxLength={6}
                className="uppercase tracking-widest"
              />
            </div>
            <Button variant="outline" onClick={handleJoin} disabled={busy}>
              Join
            </Button>
          </div>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border-2 border-ink/20 bg-parchment/40 p-6">
        <h2 className="font-display text-2xl text-ink">
          Leaderboard — {MODE_LABELS[mode]}
        </h2>
        <p className="mb-3 text-xs text-ink-soft">Fastest race times.</p>
        {boardEmpty ? (
          <p className="text-ink-soft">No times yet. Be the first to finish!</p>
        ) : (
          <ol className="space-y-1">
            {board.map((e, i) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 odd:bg-parchment/60"
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 font-display text-ink-soft">{i + 1}</span>
                  <span className="text-ink">{e.name}</span>
                </span>
                <span className="font-mono text-ink">{formatMs(e.timeMs)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
