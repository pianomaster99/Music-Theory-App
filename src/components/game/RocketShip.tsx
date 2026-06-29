import { useId } from 'react'

export type RocketHue = 'me' | 'other' | 'finished'

interface Props {
  hue?: RocketHue
  /** Animate the exhaust flame (e.g. while racing / on a boost). */
  boosting?: boolean
  /** Extra-big flame burst (e.g. right after the rocket moves forward). */
  boost?: boolean
  className?: string
}

const PALETTE: Record<
  RocketHue,
  { hullTop: string; hullBot: string; trim: string; window: string }
> = {
  me: { hullTop: '#6ee7b7', hullBot: '#059669', trim: '#065f46', window: '#a7f3d0' },
  other: { hullTop: '#bae6fd', hullBot: '#0284c7', trim: '#075985', window: '#e0f2fe' },
  finished: { hullTop: '#fde68a', hullBot: '#d97706', trim: '#92400e', window: '#fef3c7' },
}

// A sleek custom rocket pointing right (the direction of travel on the track).
export default function RocketShip({
  hue = 'other',
  boosting = false,
  boost = false,
  className,
}: Props) {
  const uid = useId().replace(/:/g, '')
  const hull = `hull-${uid}`
  const flame = `flame-${uid}`
  const glow = `glow-${uid}`
  const c = PALETTE[hue]

  return (
    <svg
      viewBox="-18 0 90 40"
      className={className}
      role="img"
      aria-label="rocket"
    >
      <defs>
        <linearGradient id={hull} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.hullTop} />
          <stop offset="1" stopColor={c.hullBot} />
        </linearGradient>
        <linearGradient id={flame} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#fffbeb" />
          <stop offset="0.35" stopColor="#fde047" />
          <stop offset="0.7" stopColor="#fb923c" />
          <stop offset="1" stopColor="#ef4444" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={c.window} />
          <stop offset="1" stopColor={c.trim} />
        </radialGradient>
        <style>{`
          @keyframes rkflame {
            0%,100% { transform: scaleX(1); opacity: .95 }
            50% { transform: scaleX(.55); opacity: .6 }
          }
          .rk-flame-${uid} {
            transform-origin: 18px 20px;
            ${boosting ? `animation: rkflame .12s ease-in-out infinite;` : ''}
          }
        `}</style>
      </defs>

      {/* exhaust flame (longer + brighter while boosting) */}
      <g className={`rk-flame-${uid}`}>
        {boost && (
          <path d="M18 12 L-16 20 L18 28 Z" fill={`url(#${flame})`} opacity="0.9" />
        )}
        <path
          d={boost ? 'M18 13 L-8 20 L18 27 Z' : 'M18 14 L0 20 L18 26 Z'}
          fill={`url(#${flame})`}
        />
        <path
          d={boost ? 'M18 16 L-2 20 L18 24 Z' : 'M18 16.5 L8 20 L18 23.5 Z'}
          fill="#fffbeb"
          opacity="0.9"
        />
      </g>

      {/* lower + upper fins */}
      <path d="M24 22 L18 34 L34 26 Z" fill={c.trim} />
      <path d="M24 18 L18 6 L34 14 Z" fill={c.trim} />

      {/* hull */}
      <path
        d="M22 20
           C22 14 32 11 44 11
           C56 11 66 15 70 20
           C66 25 56 29 44 29
           C32 29 22 26 22 20 Z"
        fill={`url(#${hull})`}
        stroke={c.trim}
        strokeWidth="1.5"
      />

      {/* nose accent */}
      <path
        d="M58 12.5 C64 14 68 17 70 20 C68 23 64 26 58 27.5 C61 24 62 22 62 20 C62 18 61 16 58 12.5 Z"
        fill={c.trim}
        opacity="0.65"
      />

      {/* porthole */}
      <circle cx="40" cy="20" r="5.5" fill={c.trim} />
      <circle cx="40" cy="20" r="4" fill={`url(#${glow})`} />
      <circle cx="38.4" cy="18.4" r="1.2" fill="#ffffff" opacity="0.9" />
    </svg>
  )
}
