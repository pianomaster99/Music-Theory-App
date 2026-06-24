import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createChoirVoice, ensureAudio, type ChoirVoice } from '@/lib/audio'
import { formatPitch, midi, pitchFromMidi, type Pitch } from '@/lib/theory/pitch'
import { cn } from '@/lib/utils'

export type ChoirTheme = 'angels' | 'argentina' | 'orange'

/** Imperative controls so a tutor/mascot can conduct the choir in a demo. */
export interface ChoirHandle {
  /** Make singer `index` start holding their note. */
  sing(index: number): void
  /** Make singer `index` stop. */
  stop(index: number): void
  /** Stop every singer. */
  stopAll(): void
  /** Number of singers on stage. */
  count: number
}

export interface ChoirProps {
  theme: ChoirTheme
  /** Lowest singer's note. Defaults to middle C (C4). */
  startPitch?: Pitch
  /** Octaves of singers to render (one singer per chromatic note). Default 2. */
  octaves?: number
  /** Notes to mark as targets. */
  highlight?: Pitch[]
  /** Singers that should start out already singing (for pre-configured demos). */
  presetSinging?: Pitch[]
  /** Reports which singers are currently holding their note. */
  onChange?: (singing: Pitch[]) => void
  /** Show the built-in conductor baton (hide it when a mascot conducts). */
  showBaton?: boolean
  className?: string
}

const SLOT = 96
const LEFT = 72
const VIEW_H = 360
const FRONT_FOOT = 320
const BACK_FOOT = 232
const FRONT_SCALE = 0.85
const BACK_SCALE = 0.7
const HEAD_Y = -116 // local: top of a singer above their feet

// Argentina sky-blue and the shared skin tone, kept as constants for reuse.
const ARG_BLUE = '#74acdf'
const SKIN = '#f3c6a0'

interface Seat {
  cx: number
  footY: number
  scale: number
}

export const Choir = forwardRef<ChoirHandle, ChoirProps>(function Choir(
  {
    theme,
    startPitch,
    octaves = 2,
    highlight = [],
    presetSinging,
    onChange,
    showBaton = true,
    className,
  },
  ref,
) {
  // One singer per chromatic note across the requested octaves. Keyed by the
  // MIDI value (not the pitch object) so an inline startPitch prop is stable.
  const startMidi = startPitch ? midi(startPitch) : 60 // C4
  const notes = useMemo<Pitch[]>(
    () => Array.from({ length: octaves * 12 + 1 }, (_, k) => pitchFromMidi(startMidi + k)),
    [startMidi, octaves],
  )

  const [singing, setSinging] = useState<boolean[]>(() => {
    const preset = new Set((presetSinging ?? []).map(midi))
    return notes.map((n) => preset.has(midi(n)))
  })
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    onChange?.(notes.filter((_, i) => singing[i]))
  }, [singing, notes, onChange])

  // A dedicated, theme-specific voice (angels shimmer, men chant, orange honks).
  // Rebuilt when the theme changes; disposed (releasing all notes) on unmount.
  const voiceRef = useRef<ChoirVoice | null>(null)
  useEffect(() => {
    const voice = createChoirVoice(theme)
    voiceRef.current = voice
    return () => {
      voice.dispose()
      voiceRef.current = null
    }
  }, [theme])

  const highlightMidis = useMemo(
    () => new Set(highlight.map((p) => midi(p))),
    [highlight],
  )

  // Split the singers across two tiered rows (front row = lower notes).
  const N = notes.length
  const frontCount = Math.ceil(N / 2)
  const backCount = N - frontCount
  const maxCount = Math.max(frontCount, backCount)
  const width = LEFT * 2 + maxCount * SLOT

  const seatOf = (i: number): Seat => {
    if (i < frontCount) {
      const start = LEFT + ((maxCount - frontCount) * SLOT) / 2 + SLOT / 2
      return { cx: start + i * SLOT, footY: FRONT_FOOT, scale: FRONT_SCALE }
    }
    const col = i - frontCount
    const start = LEFT + ((maxCount - backCount) * SLOT) / 2 + SLOT / 2
    return { cx: start + col * SLOT, footY: BACK_FOOT, scale: BACK_SCALE }
  }

  const setSing = (i: number, on: boolean) => {
    setSelected(i)
    setSinging((prev) => prev.map((s, idx) => (idx === i ? on : s)))
    void (async () => {
      await ensureAudio()
      const voice = voiceRef.current
      if (!voice) return
      if (on) voice.start(notes[i])
      else voice.stop(notes[i])
    })()
  }
  const toggle = (i: number) => setSing(i, !singing[i])

  useImperativeHandle(ref, () => ({
    sing: (i: number) => setSing(i, true),
    stop: (i: number) => setSing(i, false),
    stopAll: () => {
      setSinging(notes.map(() => false))
      voiceRef.current?.stopAll()
    },
    count: notes.length,
  }))

  const anySinging = singing.some(Boolean)

  // The baton leans toward the selected singer (or rests upright).
  const batonPivot = { x: width / 2, y: VIEW_H - 56 }
  const batonLean = useMemo(() => {
    if (selected == null) return 0
    const seat = seatOf(selected)
    const dx = seat.cx - batonPivot.x
    const dy = batonPivot.y - (seat.footY + HEAD_Y * seat.scale)
    const deg = (Math.atan2(dx, dy) * 180) / Math.PI
    return Math.max(-46, Math.min(46, deg))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, width])

  const renderSinger = (i: number) => {
    const seat = seatOf(i)
    return (
      <Singer
        key={i}
        theme={theme}
        cx={seat.cx}
        footY={seat.footY}
        scale={seat.scale}
        singing={singing[i]}
        selected={selected === i}
        target={highlightMidis.has(midi(notes[i]))}
        variant={i}
        label={formatPitch(notes[i], { unicode: true })}
        onClick={() => toggle(i)}
      />
    )
  }

  const indices = notes.map((_, i) => i)
  const backIdx = indices.filter((i) => i >= frontCount)
  const frontIdx = indices.filter((i) => i < frontCount)

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${VIEW_H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`${theme} choir`}
      >
        <Riser width={width} top={BACK_FOOT - 2} bottom={BACK_FOOT + 24} />
        {backIdx.map(renderSinger)}
        <Riser width={width} top={FRONT_FOOT - 4} bottom={FRONT_FOOT + 28} />
        {frontIdx.map(renderSinger)}

        <MusicStand x={width / 2} bottom={VIEW_H} />
        {showBaton && <Baton pivot={batonPivot} lean={batonLean} active={anySinging} />}
      </svg>
    </div>
  )
})

// --- Stage pieces ----------------------------------------------------------

function Riser({
  width,
  top,
  bottom,
}: {
  width: number
  top: number
  bottom: number
}) {
  const inset = 26
  return (
    <g pointerEvents="none">
      {/* top face */}
      <path
        d={`M${inset + 14} ${top} L${width - inset - 14} ${top} L${width - inset} ${bottom} L${inset} ${bottom} Z`}
        fill="#d8b483"
        stroke="#3b2a20"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* front face */}
      <path
        d={`M${inset} ${bottom} L${width - inset} ${bottom} L${width - inset} ${bottom + 16} L${inset} ${bottom + 16} Z`}
        fill="#b98e5f"
        stroke="#3b2a20"
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </g>
  )
}

function MusicStand({ x, bottom }: { x: number; bottom: number }) {
  const poleTop = bottom - 96
  return (
    <g stroke="#2b2622" strokeWidth={4} strokeLinecap="round" pointerEvents="none">
      {/* tripod legs */}
      <line x1={x} y1={bottom - 30} x2={x - 26} y2={bottom - 2} />
      <line x1={x} y1={bottom - 30} x2={x + 26} y2={bottom - 2} />
      <line x1={x} y1={bottom - 30} x2={x} y2={bottom - 4} />
      {/* pole */}
      <line x1={x} y1={poleTop} x2={x} y2={bottom - 28} />
      {/* slanted board with sheet music */}
      <g transform={`rotate(-10 ${x} ${poleTop})`}>
        <rect
          x={x - 42}
          y={poleTop - 30}
          width={84}
          height={48}
          rx={6}
          fill="#2b2622"
          stroke="#0c0a08"
          strokeWidth={3}
        />
        <rect
          x={x - 35}
          y={poleTop - 24}
          width={70}
          height={36}
          rx={3}
          fill="#fdf8ee"
          stroke="none"
        />
        {[0, 1, 2, 3, 4].map((n) => (
          <line
            key={n}
            x1={x - 30}
            y1={poleTop - 18 + n * 6}
            x2={x + 30}
            y2={poleTop - 18 + n * 6}
            stroke="#7a6a55"
            strokeWidth={1.2}
          />
        ))}
        {/* a couple of jaunty notes */}
        <circle cx={x - 16} cy={poleTop - 2} r={3} fill="#2b2622" stroke="none" />
        <circle cx={x + 6} cy={poleTop - 8} r={3} fill="#2b2622" stroke="none" />
      </g>
    </g>
  )
}

function Baton({
  pivot,
  lean,
  active,
}: {
  pivot: { x: number; y: number }
  lean: number
  active: boolean
}) {
  return (
    <g
      transform={`translate(${pivot.x} ${pivot.y}) rotate(${lean})`}
      style={{ transition: 'transform 260ms ease-out' }}
      pointerEvents="none"
    >
      <g
        className={active ? 'choir-baton-wave' : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}
      >
        {/* stick */}
        <line x1={0} y1={6} x2={0} y2={-128} stroke="#5b4636" strokeWidth={5} strokeLinecap="round" />
        <line x1={0} y1={6} x2={0} y2={-128} stroke="#caa46e" strokeWidth={2} strokeLinecap="round" />
        {/* glowing magical tip */}
        <circle cx={0} cy={-130} r={9} fill="#fff3b0" opacity={0.5} className={active ? 'choir-twinkle' : undefined} />
        <circle cx={0} cy={-130} r={4.5} fill="#fff6c8" stroke="#e6b800" strokeWidth={1.5} />
        {/* sparkles */}
        <g className={active ? 'choir-twinkle' : undefined} fill="#ffe680">
          <path d="M14 -140 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
          <path d="M-16 -120 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 z" />
        </g>
      </g>
    </g>
  )
}

// --- Singers ---------------------------------------------------------------

function Singer({
  theme,
  cx,
  footY,
  scale,
  singing,
  selected,
  target,
  variant,
  label,
  onClick,
}: {
  theme: ChoirTheme
  cx: number
  footY: number
  scale: number
  singing: boolean
  selected: boolean
  target: boolean
  variant: number
  label: string
  onClick: () => void
}) {
  const noteY =
    theme === 'orange' ? -44 : theme === 'argentina' ? -58 : -52

  return (
    <g
      transform={`translate(${cx} ${footY}) scale(${scale})`}
      className="cursor-pointer"
      onClick={onClick}
    >
      {/* selection / spotlight glow */}
      <ellipse
        cx={0}
        cy={6}
        rx={52}
        ry={13}
        fill={selected ? '#ffe27a' : '#000'}
        opacity={selected ? 0.55 : 0.12}
      />
      {target && (
        <text x={0} y={HEAD_Y - 8} textAnchor="middle" fontSize={20} aria-hidden>
          ⭐
        </text>
      )}
      <g
        className={singing ? 'choir-singing' : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}
      >
        {theme === 'angels' && <AngelBody singing={singing} />}
        {theme === 'argentina' && <ArgentinaBody singing={singing} variant={variant} />}
        {theme === 'orange' && <OrangeBody singing={singing} />}

        {/* Note label badge on the body */}
        <g transform={`translate(0 ${noteY})`}>
          <rect x={-19} y={-14} width={38} height={28} rx={9} fill="#fdf8ee" stroke="#3b2a20" strokeWidth={2.4} />
          <text
            x={0}
            y={5}
            textAnchor="middle"
            fontFamily="'Baloo 2 Variable','Baloo 2',sans-serif"
            fontSize={16}
            fontWeight={700}
            fill="#3b2a20"
          >
            {label}
          </text>
        </g>

        {singing && (
          <g className="choir-note" fill="#3b2a20" aria-hidden>
            <text x={26} y={HEAD_Y + 4} fontSize={18}>
              ♪
            </text>
          </g>
        )}
      </g>
    </g>
  )
}

function Face({
  cy,
  singing,
  eyeColor = '#2b2622',
}: {
  cy: number
  singing: boolean
  eyeColor?: string
}) {
  return (
    <g>
      {singing ? (
        <>
          {/* serene closed eyes */}
          <path d={`M-10 ${cy - 2} q4 4 8 0`} fill="none" stroke={eyeColor} strokeWidth={2} strokeLinecap="round" />
          <path d={`M2 ${cy - 2} q4 4 8 0`} fill="none" stroke={eyeColor} strokeWidth={2} strokeLinecap="round" />
          {/* open singing mouth */}
          <ellipse cx={0} cy={cy + 10} rx={5} ry={7} fill="#7a2f2f" />
        </>
      ) : (
        <>
          <circle cx={-6} cy={cy} r={2.4} fill={eyeColor} />
          <circle cx={6} cy={cy} r={2.4} fill={eyeColor} />
          <path d={`M-5 ${cy + 9} q5 4 10 0`} fill="none" stroke={eyeColor} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
    </g>
  )
}

function AngelBody({ singing }: { singing: boolean }) {
  return (
    <g stroke="#3b2a20" strokeWidth={2.6} strokeLinejoin="round">
      {/* wings */}
      <path d="M-18 -78 C-54 -98 -58 -54 -20 -56 Z" fill="#ffffff" />
      <path d="M18 -78 C54 -98 58 -54 20 -56 Z" fill="#ffffff" />
      {/* robe */}
      <path d="M-30 4 Q-34 -56 -15 -74 L15 -74 Q34 -56 30 4 Z" fill="#f7f4ea" />
      {/* clasped hands */}
      <ellipse cx={0} cy={-44} rx={11} ry={8} fill={SKIN} />
      {/* head */}
      <circle cx={0} cy={-90} r={19} fill={SKIN} />
      {/* hair fringe */}
      <path d="M-19 -94 Q0 -116 19 -94 Q10 -104 0 -102 Q-10 -104 -19 -94 Z" fill="#caa24a" />
      {/* halo */}
      <ellipse
        cx={0}
        cy={-114}
        rx={17}
        ry={5}
        fill="none"
        stroke="#f0c63a"
        strokeWidth={4}
        className={singing ? 'choir-twinkle' : undefined}
      />
      {/* cheeks */}
      <circle cx={-11} cy={-86} r={3.2} fill="#f3a08a" stroke="none" opacity={0.7} />
      <circle cx={11} cy={-86} r={3.2} fill="#f3a08a" stroke="none" opacity={0.7} />
      <g stroke="none">
        <Face cy={-92} singing={singing} />
      </g>
    </g>
  )
}

function ArgentinaBody({ singing, variant }: { singing: boolean; variant: number }) {
  const hair = ['#2b2018', '#5a3a1e', '#3a2a1a'][variant % 3] || '#2b2018'
  return (
    <g stroke="#3b2a20" strokeWidth={2.6} strokeLinejoin="round">
      {/* shoes */}
      <ellipse cx={-11} cy={2} rx={11} ry={5} fill="#1a1410" />
      <ellipse cx={12} cy={2} rx={11} ry={5} fill="#1a1410" />
      {/* legs */}
      <rect x={-15} y={-30} width={9} height={32} rx={3} fill={SKIN} />
      <rect x={6} y={-30} width={9} height={32} rx={3} fill={SKIN} />
      {/* shorts */}
      <rect x={-18} y={-44} width={36} height={18} rx={4} fill="#ffffff" />
      <rect x={-2} y={-44} width={4} height={18} fill={ARG_BLUE} stroke="none" />
      {/* arms */}
      <rect x={-30} y={-82} width={9} height={34} rx={4.5} fill={SKIN} />
      <rect x={21} y={-82} width={9} height={34} rx={4.5} fill={SKIN} />
      {/* jersey */}
      <rect x={-24} y={-86} width={48} height={44} rx={8} fill="#ffffff" />
      {/* sky-blue vertical stripes */}
      <g stroke="none" fill={ARG_BLUE}>
        <rect x={-19} y={-86} width={7} height={44} />
        <rect x={-3.5} y={-86} width={7} height={44} />
        <rect x={12} y={-86} width={7} height={44} />
      </g>
      {/* sleeves */}
      <rect x={-31} y={-86} width={11} height={14} rx={4} fill={ARG_BLUE} />
      <rect x={20} y={-86} width={11} height={14} rx={4} fill={ARG_BLUE} />
      {/* head */}
      <circle cx={0} cy={-104} r={18} fill={SKIN} />
      {/* hair */}
      <path d={`M-18 -108 Q0 -128 18 -108 Q12 -120 0 -120 Q-12 -120 -18 -108 Z`} fill={hair} />
      <g stroke="none">
        <Face cy={-106} singing={singing} />
      </g>
    </g>
  )
}

function OrangeBody({ singing }: { singing: boolean }) {
  return (
    <g stroke="#b5651d" strokeWidth={2.6} strokeLinejoin="round">
      {/* shoes + stick legs */}
      <line x1={-12} y1={-30} x2={-12} y2={0} stroke="#5b4636" strokeWidth={4} strokeLinecap="round" />
      <line x1={12} y1={-30} x2={12} y2={0} stroke="#5b4636" strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={-13} cy={2} rx={9} ry={4.5} fill="#3b2a20" stroke="none" />
      <ellipse cx={13} cy={2} rx={9} ry={4.5} fill="#3b2a20" stroke="none" />
      {/* arms */}
      <line x1={-40} y1={-58} x2={-12} y2={-46} stroke="#5b4636" strokeWidth={4} strokeLinecap="round" />
      <line x1={40} y1={-58} x2={12} y2={-46} stroke="#5b4636" strokeWidth={4} strokeLinecap="round" />
      {/* body (the orange) */}
      <circle cx={0} cy={-58} r={46} fill="#f4922b" />
      {/* dimple texture */}
      <g stroke="none" fill="#e07f1c" opacity={0.6}>
        <circle cx={-22} cy={-72} r={2} />
        <circle cx={-10} cy={-40} r={2} />
        <circle cx={20} cy={-66} r={2} />
        <circle cx={26} cy={-44} r={2} />
        <circle cx={4} cy={-86} r={2} />
      </g>
      {/* stem + leaf */}
      <line x1={0} y1={-104} x2={0} y2={-116} stroke="#5b4636" strokeWidth={4} strokeLinecap="round" />
      <path d="M2 -114 q18 -8 22 4 q-16 6 -22 -4 z" fill="#5aa02c" stroke="#3f7320" />
      {/* eyes */}
      <g stroke="#3b2a20" strokeWidth={2}>
        <ellipse cx={-13} cy={-70} rx={8} ry={10} fill="#fff" />
        <ellipse cx={13} cy={-70} rx={8} ry={10} fill="#fff" />
      </g>
      <circle cx={-12} cy={-68} r={3.4} fill="#2b2622" stroke="none" />
      <circle cx={14} cy={-68} r={3.4} fill="#2b2622" stroke="none" />
      {/* mouth */}
      {singing ? (
        <g stroke="#7a1f14" strokeWidth={2}>
          <path d="M-16 -44 Q0 -22 16 -44 Q0 -36 -16 -44 Z" fill="#6b1d12" />
          <ellipse cx={0} cy={-34} rx={6} ry={3.5} fill="#e8607a" stroke="none" />
        </g>
      ) : (
        <path d="M-13 -46 Q0 -36 13 -46" fill="none" stroke="#7a1f14" strokeWidth={2.4} strokeLinecap="round" />
      )}
    </g>
  )
}
