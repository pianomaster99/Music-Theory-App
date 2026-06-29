import { useMemo } from 'react'

const COLORS = ['#f59e0b', '#10b981', '#0ea5e9', '#ef4444', '#a855f7', '#fde047']

/** Deterministic pseudo-random in [0,1) — pure, so it's safe during render. */
function rand(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// A one-shot confetti burst overlay for celebratory screens. Pieces are
// generated deterministically so re-renders don't reshuffle them mid-fall.
export default function Celebration({ pieces = 40 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: rand(i * 1.1) * 100,
        delay: rand(i * 2.3) * 0.8,
        dur: 1.8 + rand(i * 3.7) * 1.6,
        color: COLORS[i % COLORS.length],
        rot: rand(i * 4.9) * 360,
        w: 6 + rand(i * 5.3) * 7,
      })),
    [pieces],
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <style>{`@keyframes confettifall{0%{transform:translateY(-12vh) rotate(0deg);opacity:1}100%{transform:translateY(112vh) rotate(720deg);opacity:0}}`}</style>
      {items.map((it, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${it.left}%`,
            top: '-12vh',
            width: it.w,
            height: it.w * 0.55,
            background: it.color,
            borderRadius: 2,
            transform: `rotate(${it.rot}deg)`,
            animation: `confettifall ${it.dur}s linear ${it.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}
