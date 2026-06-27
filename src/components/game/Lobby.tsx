import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MODE_LABELS, type Player, type Room } from '@/lib/game/types'

interface Props {
  room: Room
  players: Player[]
  isHost: boolean
  starting: boolean
  onStart: () => void
  onLeave: () => void
  /** For quick-match lobbies: seconds until auto-start (null = still arriving). */
  lobbyCountdown?: number | null
  micReady: boolean
  onEnableMic: () => void
}

export default function Lobby({
  room,
  players,
  isHost,
  starting,
  onStart,
  onLeave,
  lobbyCountdown,
  micReady,
  onEnableMic,
}: Props) {
  const [copied, setCopied] = useState(false)
  const queued = !!room.queued

  const share = async () => {
    const url = `${window.location.origin}/play/${room.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be blocked; ignore
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border-2 border-ink/30 bg-parchment/60 p-6 text-center">
        <p className="text-sm uppercase tracking-widest text-ink-soft">
          {MODE_LABELS[room.mode]} race · lobby
        </p>
        {queued ? (
          <>
            <h1 className="mt-1 font-display text-3xl text-ink">Finding players…</h1>
            <div className="my-3 font-display text-6xl text-ink">
              {lobbyCountdown == null ? '…' : `${lobbyCountdown}s`}
            </div>
            <p className="text-ink-soft">
              Auto-starting soon. Anyone else queueing for {MODE_LABELS[room.mode]}{' '}
              joins this race.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-1 font-display text-3xl text-ink">Room code</h1>
            <div className="my-3 font-display text-6xl tracking-[0.3em] text-ink">
              {room.code}
            </div>
            <Button variant="outline" onClick={share}>
              {copied ? 'Link copied!' : 'Copy invite link'}
            </Button>
          </>
        )}
      </div>

      <div className="mt-6 rounded-2xl border-2 border-ink/20 bg-parchment/40 p-6">
        <h2 className="mb-3 font-display text-xl text-ink">
          Players ({players.length})
        </h2>
        <ul className="space-y-2">
          {players.map((p) => (
            <li
              key={p.uid}
              className="flex items-center justify-between rounded-lg bg-parchment/70 px-3 py-2"
            >
              <span className="text-ink">{p.name}</span>
              {p.uid === room.hostUid && (
                <span className="text-xs uppercase tracking-widest text-ink-soft">
                  host
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-xl border-2 border-ink/20 bg-parchment/50 p-3 text-center">
          {micReady ? (
            <p className="text-sm font-medium text-emerald-700">
              🎤 Microphone ready
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm text-ink-soft">
                Enable your mic before the race starts so you can sing answers.
              </p>
              <Button variant="outline" onClick={onEnableMic}>
                🎤 Enable microphone
              </Button>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onLeave}>
            Leave
          </Button>
          {isHost ? (
            <Button size="lg" onClick={onStart} disabled={starting}>
              {starting
                ? 'Building questions…'
                : queued
                  ? 'Start now'
                  : 'Start race'}
            </Button>
          ) : (
            <span className="text-ink-soft">
              {queued ? 'Match starts automatically…' : 'Waiting for the host to start…'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
