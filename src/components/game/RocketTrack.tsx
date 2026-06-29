import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import RocketShip from './RocketShip'
import type { Player } from '@/lib/game/types'

interface Props {
  players: Player[]
  target: number
  myUid: string | null
}

// Rockets move relative to each other along the track; fast parallax starfields
// behind them sell the "everyone blasting forward" feel. Each rocket jitters
// constantly and fires a big flame burst whenever it advances.
export default function RocketTrack({ players, target, myUid }: Props) {
  const ordered = [...players].sort((a, b) => b.effectiveScore - a.effectiveScore)

  // Detect score increases to fire a brief boost burst on the moving rocket.
  const prevScores = useRef<Record<string, number>>({})
  const [boostUids, setBoostUids] = useState<Set<string>>(new Set())
  useEffect(() => {
    const newly: string[] = []
    for (const p of players) {
      const prev = prevScores.current[p.uid] ?? 0
      if (p.effectiveScore > prev) newly.push(p.uid)
      prevScores.current[p.uid] = p.effectiveScore
    }
    if (newly.length === 0) return
    // setState happens inside timers (not synchronously in the effect body).
    const onId = window.setTimeout(() => {
      setBoostUids((prev) => new Set([...prev, ...newly]))
    }, 0)
    const offId = window.setTimeout(() => {
      setBoostUids((prev) => {
        const next = new Set(prev)
        newly.forEach((u) => next.delete(u))
        return next
      })
    }, 850)
    return () => {
      window.clearTimeout(onId)
      window.clearTimeout(offId)
    }
  }, [players])

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-ink/30 bg-gradient-to-b from-[#0b1026] to-[#1a2348] p-4">
      {/* two parallax starfields scrolling backward quickly */}
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(2px_2px_at_20px_30px,#fff,transparent),radial-gradient(2px_2px_at_120px_80px,#fff,transparent),radial-gradient(1px_1px_at_200px_50px,#fff,transparent),radial-gradient(2px_2px_at_300px_120px,#fff,transparent)] [background-size:320px_160px] motion-safe:animate-[starscroll_2.2s_linear_infinite]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(1px_1px_at_60px_50px,#cfe3ff,transparent),radial-gradient(1px_1px_at_180px_110px,#cfe3ff,transparent),radial-gradient(1px_1px_at_260px_20px,#cfe3ff,transparent)] [background-size:220px_140px] motion-safe:animate-[starscroll2_1.1s_linear_infinite]" />
      <style>{`
        @keyframes starscroll{from{background-position:0 0,0 0,0 0,0 0}to{background-position:-320px 0,-320px 0,-320px 0,-320px 0}}
        @keyframes starscroll2{from{background-position:0 0,0 0,0 0}to{background-position:-220px 0,-220px 0,-220px 0}}
        @keyframes rkshake{0%,100%{transform:translateY(0) rotate(0deg)}25%{transform:translateY(-1px) rotate(-1.5deg)}50%{transform:translateY(1px) rotate(1deg)}75%{transform:translateY(-0.5px) rotate(1.5deg)}}
        @keyframes rkboost{0%{transform:scale(1)}30%{transform:scale(1.28) translateX(4px)}100%{transform:scale(1)}}
      `}</style>

      <div className="relative space-y-3">
        {ordered.map((p) => {
          const frac = Math.max(0, Math.min(1, p.effectiveScore / target))
          const leftPct = 4 + frac * 84
          const isMe = p.uid === myUid
          const boosting = boostUids.has(p.uid)
          return (
            <div key={p.uid} className="relative h-12">
              {/* finish line */}
              <div className="absolute right-1 top-0 bottom-0 w-1 bg-[repeating-linear-gradient(45deg,#fff_0_6px,#000_6px_12px)] opacity-70" />
              <div
                className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-500 ease-out"
                style={{ left: `${leftPct}%` }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="motion-safe:animate-[rkshake_0.22s_ease-in-out_infinite]"
                    style={
                      boosting
                        ? { animation: 'rkboost 0.85s ease-out' }
                        : undefined
                    }
                  >
                    <RocketShip
                      hue={p.finished ? 'finished' : isMe ? 'me' : 'other'}
                      boosting
                      boost={boosting}
                      className="h-10 w-20 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                    />
                  </div>
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
