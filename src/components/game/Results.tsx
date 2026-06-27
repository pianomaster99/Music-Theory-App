import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MODE_LABELS, type Player, type Room } from '@/lib/game/types'

interface Props {
  room: Room
  players: Player[]
  myUid: string | null
  isHost: boolean
  onRematch: () => void
  onLeave: () => void
  starting: boolean
}

function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1
    if (a.finished && b.finished) return (a.finishMs ?? 0) - (b.finishMs ?? 0)
    return b.effectiveScore - a.effectiveScore
  })
}

export default function Results({
  room,
  players,
  myUid,
  isHost,
  onRematch,
  onLeave,
  starting,
}: Props) {
  const ranked = rankPlayers(players)
  const winner = ranked[0]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border-2 border-ink/30 bg-parchment/60 p-6 text-center">
        <p className="text-sm uppercase tracking-widest text-ink-soft">
          {MODE_LABELS[room.mode]} race · results
        </p>
        <h1 className="mt-1 font-display text-4xl text-ink">
          {winner ? `${winner.name} wins!` : 'Race over'}
        </h1>
      </div>

      <ol className="mt-6 space-y-2">
        {ranked.map((p, i) => (
          <li
            key={p.uid}
            className={cn(
              'flex items-center justify-between rounded-xl border-2 px-4 py-3',
              p.uid === myUid ? 'border-emerald-500 bg-parchment-dark' : 'border-ink/20 bg-parchment/50',
            )}
          >
            <span className="flex items-center gap-3">
              <span className="w-6 font-display text-2xl text-ink-soft">{i + 1}</span>
              <span className="font-display text-lg text-ink">{p.name}</span>
            </span>
            <span className="text-right text-ink">
              {p.finished && p.finishMs != null ? (
                <span className="font-mono">{(p.finishMs / 1000).toFixed(1)}s</span>
              ) : (
                <span className="text-ink-soft">{p.effectiveScore}/{room.target}</span>
              )}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onLeave}>
          Leave
        </Button>
        {isHost && (
          <Button size="lg" onClick={onRematch} disabled={starting}>
            {starting ? 'Building questions…' : 'Rematch'}
          </Button>
        )}
      </div>
    </div>
  )
}
