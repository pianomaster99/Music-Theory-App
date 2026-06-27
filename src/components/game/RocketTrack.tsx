import { cn } from '@/lib/utils'
import RocketShip from './RocketShip'
import type { Player } from '@/lib/game/types'

interface Props {
  players: Player[]
  target: number
  myUid: string | null
}

// Rockets move relative to each other along the track; a scrolling starfield
// behind them sells the "everyone moving forward" feel. Position maps a player's
// effectiveScore/target to a horizontal lane position.
export default function RocketTrack({ players, target, myUid }: Props) {
  const ordered = [...players].sort((a, b) => b.effectiveScore - a.effectiveScore)

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-ink/30 bg-gradient-to-b from-[#0b1026] to-[#1a2348] p-4">
      {/* scrolling starfield */}
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(2px_2px_at_20px_30px,#fff,transparent),radial-gradient(2px_2px_at_120px_80px,#fff,transparent),radial-gradient(1px_1px_at_200px_50px,#fff,transparent),radial-gradient(2px_2px_at_300px_120px,#fff,transparent)] [background-size:320px_160px] motion-safe:animate-[starscroll_6s_linear_infinite]" />
      <style>{`@keyframes starscroll{from{background-position:0 0,0 0,0 0,0 0}to{background-position:-320px 0,-320px 0,-320px 0,-320px 0}}`}</style>

      <div className="relative space-y-3">
        {ordered.map((p) => {
          const frac = Math.max(0, Math.min(1, p.effectiveScore / target))
          const leftPct = 4 + frac * 84
          const isMe = p.uid === myUid
          return (
            <div key={p.uid} className="relative h-12">
              {/* finish line */}
              <div className="absolute right-1 top-0 bottom-0 w-1 bg-[repeating-linear-gradient(45deg,#fff_0_6px,#000_6px_12px)] opacity-70" />
              <div
                className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-500 ease-out"
                style={{ left: `${leftPct}%` }}
              >
                <div className="flex items-center gap-2">
                  <RocketShip
                    hue={p.finished ? 'finished' : isMe ? 'me' : 'other'}
                    boosting
                    className="h-9 w-16 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
                  />
                  <span
                    className={cn(
                      'whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
                      isMe ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/10 text-white/90',
                    )}
                  >
                    {p.name}
                    {isMe ? ' (you)' : ''}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
