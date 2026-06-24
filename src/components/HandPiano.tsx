import { useId, useMemo, useRef, useState } from 'react'
import {
  formatPitch,
  midi,
  pitch as makePitch,
  pitchFromMidi,
  type Pitch,
} from '@/lib/theory/pitch'
import { ensureAudio, playPitch, playPitches } from '@/lib/audio'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface HandPianoProps {
  /** Lowest key. Defaults to middle C (C4). */
  startPitch?: Pitch
  /** Octaves to render (a closing key is added). Default 2. */
  octaves?: number
  /** Pitches to highlight as targets. */
  highlight?: Pitch[]
  /** Called when Play is pressed, with the pitches under the resting fingers. */
  onPlay?: (pitches: Pitch[]) => void
  className?: string
}

// Keyboard geometry (SVG user units). Keys sit at the top; the hand is below
// with the fingers pointing up toward them.
const WHITE_W = 40
const WHITE_H = 168
const BLACK_W = 26
const BLACK_H = 104
const KEYBOARD_TOP = 8
const VIEW_HEIGHT = 500

const WHITE_CLASSES = [0, 2, 4, 5, 7, 9, 11]

// --- Photoreal assets (background keyed out, cropped to content) ----------
// Knuckle points (kx, ky) were calibrated by clicking the images directly.
const PALM_SRC = '/hand/palm.png'
const PALM_IMG_W = 729
const PALM_IMG_H = 968
const PALM_W = 184
const PALM_H = (PALM_W * PALM_IMG_H) / PALM_IMG_W
const PALM_TOP_DY = 0

interface Asset {
  src: string
  w: number
  h: number
  kx: number
  ky: number
}
const FINGER_ASSET: Asset = { src: '/hand/finger.png', w: 228, h: 884, kx: 95, ky: 821 }
const THUMB_ASSET: Asset = { src: '/hand/thumb.png', w: 375, h: 770, kx: 181, ky: 760 }

// Hand knuckle positions in palm-image pixels (calibrated).
const HAND_KNUCKLES: Record<string, [number, number]> = {
  thumb: [708, 382],
  index: [602, 47],
  middle: [403, 23],
  ring: [218, 39],
  pinky: [67, 89],
}

function knuckleDX(imgX: number) {
  return (imgX / PALM_IMG_W) * PALM_W - PALM_W / 2
}
function knuckleDY(imgY: number) {
  return PALM_TOP_DY + (imgY / PALM_IMG_H) * PALM_H
}

const MIN_LEN = 44
const MAX_LEN = 190
// Widen the fingers/thumb a touch beyond their natural aspect (width only).
const WIDTH_GAIN = 1.3

type FingerState = 'above' | 'on' | 'pressing'
interface FingerSpec {
  name: string
  asset: Asset
  baseDX: number
  baseDY: number
  /** Natural knuckle-to-tip length in SVG units. */
  len: number
  /** Resting orientation in degrees (0 = straight up, + tips toward the right). */
  baseAngle: number
}

function spec(
  name: string,
  asset: Asset,
  len: number,
  baseAngle: number,
  nudge: [number, number] = [0, 0],
): FingerSpec {
  const [ix, iy] = HAND_KNUCKLES[name]
  return {
    name,
    asset,
    len,
    baseAngle,
    baseDX: knuckleDX(ix + nudge[0]),
    baseDY: knuckleDY(iy + nudge[1]),
  }
}

const FINGER_SPECS: FingerSpec[] = [
  // Thumb nudged a touch toward the hand (left + down) so its base sits in more.
  spec('thumb', THUMB_ASSET, 76, 30, [-26, 30]),
  spec('index', FINGER_ASSET, 104, 8),
  spec('middle', FINGER_ASSET, 116, 0),
  spec('ring', FINGER_ASSET, 104, -7),
  spec('pinky', FINGER_ASSET, 84, -16),
]

const ANGLE_LIMIT = 38 // degrees of rotation each way from the natural angle
const STATE_DELTA: Record<FingerState, number> = { above: -6, on: 0, pressing: 7 }
const DRAG_THRESHOLD = 4

interface FingerModel {
  angle: number
  length: number
  state: FingerState
}

function effLen(model: FingerModel): number {
  return clamp(model.length + STATE_DELTA[model.state], 28, MAX_LEN + 12)
}

interface WhiteKey {
  pitch: Pitch
  midi: number
  index: number
}
interface BlackKey {
  pitch: Pitch
  midi: number
  centerX: number
}

export function HandPiano({
  startPitch = makePitch('C', 4),
  octaves = 2,
  highlight = [],
  onPlay,
  className,
}: HandPianoProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const rid = useId().replace(/:/g, '')

  const { whiteKeys, blackKeys, width } = useMemo(() => {
    const start = midi(startPitch)
    const end = start + octaves * 12
    const whites: WhiteKey[] = []
    const whiteIndexByMidi: Record<number, number> = {}
    for (let m = start; m <= end; m++) {
      if (WHITE_CLASSES.includes(((m % 12) + 12) % 12)) {
        whiteIndexByMidi[m] = whites.length
        whites.push({ pitch: pitchFromMidi(m), midi: m, index: whites.length })
      }
    }
    const blacks: BlackKey[] = []
    for (let m = start + 1; m < end; m++) {
      if (!WHITE_CLASSES.includes(((m % 12) + 12) % 12)) {
        const lower = whiteIndexByMidi[m - 1]
        if (lower === undefined) continue
        blacks.push({ pitch: pitchFromMidi(m), midi: m, centerX: (lower + 1) * WHITE_W })
      }
    }
    return { whiteKeys: whites, blackKeys: blacks, width: whites.length * WHITE_W }
  }, [startPitch, octaves])

  const [hand, setHand] = useState(() => ({ x: width * 0.46, y: 250 }))
  const [fingers, setFingers] = useState<FingerModel[]>(() =>
    FINGER_SPECS.map((s) => ({ angle: 0, length: s.len, state: 'above' as FingerState })),
  )

  const drag = useRef<{
    kind: 'hand' | 'finger'
    index: number
    startX: number
    startY: number
    moved: boolean
    handX: number
    handY: number
    baseX: number
    baseY: number
  } | null>(null)

  const highlightMidis = useMemo(() => new Set(highlight.map((p) => midi(p))), [highlight])

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    }
  }

  const fingerGeom = (i: number, model = fingers[i], h = hand) => {
    const s = FINGER_SPECS[i]
    const baseX = h.x + s.baseDX
    const baseY = h.y + s.baseDY
    const eff = model.angle + s.baseAngle
    const L = effLen(model)
    const rad = (eff * Math.PI) / 180
    return {
      baseX,
      baseY,
      eff,
      L,
      tipX: baseX + Math.sin(rad) * L,
      tipY: baseY - Math.cos(rad) * L,
    }
  }

  // A finger only addresses a black key if its tip is actually on the black key
  // (inside its box). Otherwise it falls through to the white key below.
  const keyAt = (x: number, y: number): { pitch: Pitch; midi: number } | null => {
    if (y >= KEYBOARD_TOP && y <= KEYBOARD_TOP + BLACK_H) {
      for (const b of blackKeys) {
        if (x >= b.centerX - BLACK_W / 2 && x <= b.centerX + BLACK_W / 2) {
          return { pitch: b.pitch, midi: b.midi }
        }
      }
    }
    if (y >= KEYBOARD_TOP && y <= KEYBOARD_TOP + WHITE_H && x >= 0 && x <= width) {
      const idx = Math.max(0, Math.min(whiteKeys.length - 1, Math.floor(x / WHITE_W)))
      const w = whiteKeys[idx]
      return w ? { pitch: w.pitch, midi: w.midi } : null
    }
    return null
  }

  const fingerKeys = fingers.map((f, i) => {
    if (f.state === 'above') return null
    const g = fingerGeom(i, f)
    return keyAt(g.tipX, g.tipY)
  })
  const restingMidis = new Set(
    fingerKeys.filter((k): k is { pitch: Pitch; midi: number } => !!k).map((k) => k.midi),
  )
  const pressedMidis = new Set(
    fingers
      .map((f, i) => (f.state === 'pressing' ? fingerKeys[i]?.midi : undefined))
      .filter((m): m is number => m !== undefined),
  )

  // --- Pointer handling -----------------------------------------------------
  const onHandPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    void ensureAudio()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = {
      kind: 'hand',
      index: -1,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      handX: hand.x,
      handY: hand.y,
      baseX: 0,
      baseY: 0,
    }
  }

  const onFingerPointerDown = (e: React.PointerEvent, i: number) => {
    e.preventDefault()
    e.stopPropagation()
    void ensureAudio()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const g = fingerGeom(i)
    drag.current = {
      kind: 'finger',
      index: i,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      handX: hand.x,
      handY: hand.y,
      baseX: g.baseX,
      baseY: g.baseY,
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) d.moved = true
    if (!d.moved) return

    if (d.kind === 'hand') {
      const rect = svgRef.current?.getBoundingClientRect()
      const ratioX = width / (rect?.width ?? width)
      const ratioY = VIEW_HEIGHT / (rect?.height ?? VIEW_HEIGHT)
      setHand({
        x: clamp(d.handX + dx * ratioX, 10, width - 10),
        y: clamp(d.handY + dy * ratioY, 80, VIEW_HEIGHT - PALM_H * 0.5),
      })
    } else {
      // Dragging a fingertip both aims (rotation) and stretches (length only).
      const p = toSvg(e.clientX, e.clientY)
      const vx = p.x - d.baseX
      const vy = p.y - d.baseY
      const eff = (Math.atan2(vx, -vy) * 180) / Math.PI
      const user = clamp(eff - FINGER_SPECS[d.index].baseAngle, -ANGLE_LIMIT, ANGLE_LIMIT)
      const dist = Math.hypot(vx, vy)
      const length = clamp(dist - STATE_DELTA[fingers[d.index].state], MIN_LEN, MAX_LEN)
      setFingers((prev) =>
        prev.map((f, idx) => (idx === d.index ? { ...f, angle: user, length } : f)),
      )
    }
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved && d.kind === 'finger') {
      setFingers((prev) =>
        prev.map((f, idx) =>
          idx === d.index ? { ...f, state: f.state === 'above' ? 'on' : 'above' } : f,
        ),
      )
      const g = fingerGeom(d.index)
      const key = keyAt(g.tipX, g.tipY)
      if (key) playPitch(key.pitch)
    }
  }

  const handlePlay = () => {
    void ensureAudio()
    const pitches: Pitch[] = []
    fingers.forEach((f, i) => {
      if (f.state === 'on') {
        const key = fingerKeys[i]
        if (key) pitches.push(key.pitch)
      }
    })
    setFingers((prev) => prev.map((f) => (f.state === 'on' ? { ...f, state: 'pressing' } : f)))
    if (pitches.length > 0) playPitches(pitches, 'chord')
    onPlay?.(pitches)
    window.setTimeout(() => {
      setFingers((prev) => prev.map((f) => (f.state === 'pressing' ? { ...f, state: 'on' } : f)))
    }, 450)
  }

  const restingSummary = fingers
    .map((f, i) => (f.state !== 'above' ? fingerKeys[i]?.pitch : null))
    .filter((p): p is Pitch => !!p)
    .map((p) => formatPitch(p))

  return (
    <div className={cn('w-full text-ink', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${VIEW_HEIGHT}`}
        className="w-full touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <filter id={`rough-${rid}`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.03" numOctaves={2} seed={5} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={1.4} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        {/* White keys */}
        {whiteKeys.map((k) => {
          const pressed = pressedMidis.has(k.midi)
          const resting = restingMidis.has(k.midi)
          const target = highlightMidis.has(k.midi)
          return (
            <g
              key={`w-${k.midi}`}
              style={{ transform: pressed ? 'translateY(4px)' : 'translateY(0)', transition: 'transform 120ms ease-out' }}
            >
              <rect
                x={k.index * WHITE_W + 1}
                y={KEYBOARD_TOP}
                width={WHITE_W - 2}
                height={WHITE_H}
                rx={6}
                className={pressed ? 'fill-[#e7c79b]' : target ? 'fill-[#f0d9a8]' : resting ? 'fill-[#f7efe0]' : 'fill-[#fbf7ef]'}
                stroke="#2b2118"
                strokeWidth={2.4}
                filter={`url(#rough-${rid})`}
              />
            </g>
          )
        })}

        {/* Black keys */}
        {blackKeys.map((k) => {
          const pressed = pressedMidis.has(k.midi)
          const resting = restingMidis.has(k.midi)
          const target = highlightMidis.has(k.midi)
          return (
            <g
              key={`b-${k.midi}`}
              style={{ transform: pressed ? 'translateY(3px)' : 'translateY(0)', transition: 'transform 120ms ease-out' }}
            >
              <rect
                x={k.centerX - BLACK_W / 2}
                y={KEYBOARD_TOP}
                width={BLACK_W}
                height={BLACK_H}
                rx={5}
                className={pressed ? 'fill-[#5a4632]' : target ? 'fill-[#7a4a2f]' : resting ? 'fill-[#3a2c1e]' : 'fill-[#241a12]'}
                stroke="#0f0a06"
                strokeWidth={2}
                filter={`url(#rough-${rid})`}
              />
            </g>
          )
        })}

        {/* Soft contact shadow under the hand */}
        <ellipse cx={hand.x} cy={hand.y + PALM_TOP_DY + PALM_H - 6} rx={PALM_W * 0.5} ry={16} fill="#000" opacity={0.13} />

        {/* Back of the hand */}
        <image
          href={PALM_SRC}
          x={hand.x - PALM_W / 2}
          y={hand.y + PALM_TOP_DY}
          width={PALM_W}
          height={PALM_H}
          preserveAspectRatio="none"
          className="cursor-move"
          onPointerDown={onHandPointerDown}
          style={{ transition: 'all 120ms ease-out' }}
        />

        {/* Fingers, drawn on top so the knuckles stay visible. The finger's
            calibrated knuckle point is pinned to the hand knuckle (the pivot),
            so it rotates and stretches from there. */}
        {FINGER_SPECS.map((s, i) => {
          const f = fingers[i]
          const g = fingerGeom(i, f)
          const a = s.asset
          // Width fixed at the finger's natural width; only height scales with
          // length, so stretching lengthens without widening.
          const natScale = s.len / a.ky
          const displayW = a.w * natScale * WIDTH_GAIN
          const scaleV = g.L / a.ky
          const displayH = a.h * scaleV
          const handleR = displayW / 2 + 7
          return (
            <g
              key={s.name}
              transform={`translate(${g.baseX} ${g.baseY}) rotate(${g.eff})`}
              style={{ transition: 'transform 140ms ease-out' }}
            >
              <image
                href={a.src}
                x={-displayW * (a.kx / a.w)}
                y={-g.L}
                width={displayW}
                height={displayH}
                preserveAspectRatio="none"
                pointerEvents="none"
                style={{ transition: 'all 140ms ease-out' }}
              />
              {f.state === 'pressing' && (
                <ellipse cx={0} cy={-g.L + 6} rx={displayW * 0.42} ry={6} fill="#000" opacity={0.12} pointerEvents="none" />
              )}
              {/* Grab handle near the fingertip */}
              <circle
                cx={0}
                cy={-g.L + 8}
                r={handleR}
                fill="transparent"
                className="cursor-grab"
                onPointerDown={(e) => onFingerPointerDown(e, i)}
              />
            </g>
          )
        })}
      </svg>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Resting on:{' '}
          <span className="font-medium text-ink">
            {restingSummary.length ? restingSummary.join(' \u00B7 ') : '\u2014'}
          </span>
        </p>
        <Button onClick={handlePlay}>Play</Button>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        Drag the back of the hand to move it. Drag a fingertip to aim and stretch
        it. Click a fingertip to rest it on a key, then press Play. To play a
        black key, the fingertip must sit on the black key.
      </p>
    </div>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
