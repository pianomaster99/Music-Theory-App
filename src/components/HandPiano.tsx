import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
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

/** Imperative controls so a tutor/mascot can drive the hand in a demo. */
export interface HandPianoHandle {
  /** Glide the hand (in SVG units) toward a position. */
  moveHand(x: number, y: number): void
  /** Ease a finger toward a curl (0 straight..1 curled) and splay (deg). */
  moveFinger(index: number, curl: number, splay: number): void
  /** Rest a finger on / lift it off the keys. */
  restFinger(index: number, on: boolean): void
  /** Press the resting fingers (same as the Play button). */
  press(): void
  /** Current palm grab point (SVG units) — where you'd grab to drag the hand. */
  getHandPoint(): { x: number; y: number }
  /** Current fingertip position (SVG units) for a given finger. */
  getFingerTip(index: number): { x: number; y: number }
}

export interface HandPianoProps {
  /** Lowest key. Defaults to middle C (C4). */
  startPitch?: Pitch
  /** Octaves to render (a closing key is added). Default 2. */
  octaves?: number
  /** Pitches to highlight as targets. */
  highlight?: Pitch[]
  /** Called when Play is pressed, with the pitches under the resting fingers. */
  onPlay?: (pitches: Pitch[]) => void
  /** CSS filter applied to the hand artwork to tint its skin tone. */
  skinFilter?: string
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

// --- Cartoon hand (one cohesive mitten-like hand, procedurally jointed) ----
// Flat, bright fill + a single bold dark outline reads as a cartoon glove
// rather than a realistic (uncanny) hand. No fingernails, no skin creases.
const SKIN = '#ffce9e'
const SKIN_LIGHT = '#fff0dd'
const OUTLINE = '#2a1c12'
const OUTLINE_W = 5
// How far the palm silhouette is scaled out from the anchor (plumper hand).
const PALM_SCALE = 1.12

type FingerState = 'above' | 'on' | 'pressing'

interface FingerSpec {
  name: string
  /** Knuckle (MCP) offset from the hand anchor, in SVG units. */
  dx: number
  dy: number
  /** Resting splay angle (deg, 0 = straight up, + tips toward the right). */
  splay: number
  /** Phalanx lengths from knuckle to tip (3 for fingers, 2 for the thumb). */
  segs: number[]
  /** Finger width at the knuckle. */
  width: number
  splayLimit: number
  isThumb?: boolean
}

// Left-to-right: pinky, ring, middle, index, then the thumb on the right —
// matching the reference (back of a left hand, thumb to the side). Fingers are
// longer and plumper than life so the whole hand reads cartoonish and can
// comfortably reach every key in a two-octave span.
const FINGERS: FingerSpec[] = [
  { name: 'pinky', dx: -62, dy: 28, splay: -18, segs: [46, 34, 26], width: 26, splayLimit: 20 },
  { name: 'ring', dx: -32, dy: 9, splay: -7, segs: [58, 42, 32], width: 30, splayLimit: 18 },
  { name: 'middle', dx: 0, dy: 2, splay: 0, segs: [64, 46, 34], width: 31, splayLimit: 16 },
  { name: 'index', dx: 30, dy: 11, splay: 9, segs: [56, 40, 30], width: 30, splayLimit: 18 },
  { name: 'thumb', dx: 64, dy: 84, splay: 72, segs: [54, 44], width: 35, splayLimit: 34, isThumb: true },
]

// Joint flex (degrees) at full curl. Fingers bend at MCP/PIP/DIP; the thumb at
// MCP/IP. The sign curls the fingertip down-and-forward (away from the keys).
const FINGER_BEND = [16, 82, 56]
const THUMB_BEND = [24, 70]
const CURL_SIGN = 1

// State nudges the curl a touch: relaxed when above, extended when pressing.
const STATE_CURL: Record<FingerState, number> = { above: 0.05, on: 0, pressing: -0.08 }
const SPLAY_LIMIT_DEFAULT = 18
const DRAG_THRESHOLD = 4

interface FingerModel {
  /** 0 = fully extended/straight, 1 = fully curled. */
  curl: number
  /** User aim offset from the resting splay (deg). */
  splay: number
  state: FingerState
}

interface Pt {
  x: number
  y: number
}

/** Forward kinematics: joint points from knuckle to tip for the given model. */
function fingerPoints(
  originX: number,
  originY: number,
  spec: FingerSpec,
  model: FingerModel,
): Pt[] {
  const c = clamp(model.curl + STATE_CURL[model.state], 0, 1)
  const bends = spec.isThumb ? THUMB_BEND : FINGER_BEND
  let ang = spec.splay + model.splay
  let x = originX + spec.dx
  let y = originY + spec.dy
  const pts: Pt[] = [{ x, y }]
  for (let i = 0; i < spec.segs.length; i++) {
    ang += c * bends[i] * CURL_SIGN
    const r = (ang * Math.PI) / 180
    x += Math.sin(r) * spec.segs[i]
    y += -Math.cos(r) * spec.segs[i]
    pts.push({ x, y })
  }
  return pts
}

function straightReach(spec: FingerSpec): number {
  return spec.segs.reduce((a, b) => a + b, 0)
}

function curledReach(spec: FingerSpec): number {
  const pts = fingerPoints(0, 0, spec, { curl: 1, splay: 0, state: 'on' })
  const tip = pts[pts.length - 1]
  return Math.hypot(tip.x, tip.y)
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

// Back-of-hand silhouette anchors relative to the hand anchor (clockwise). The
// fingers' roots tuck under this blob so the whole thing reads as one hand.
const PALM_OUTLINE: [number, number][] = [
  [-58, 30], // left, under the pinky
  [-70, 76],
  [-60, 124],
  [-34, 160],
  [8, 166],
  [44, 152],
  [72, 120], // thumb mound
  [80, 92], // thumb web
  [52, 46], // up the right side under the index
  [34, 26],
  [-38, 24], // top edge under the fingers
]

/** A smooth closed path through anchor points (Catmull-Rom -> cubic bezier). */
function smoothClosedPath(pts: [number, number][]): string {
  const n = pts.length
  let d = `M ${pts[0][0]} ${pts[0][1]} `
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]} `
  }
  return d + 'Z'
}

/** Build a tapered, rounded outline along a finger's joint points. */
function fingerOutlinePath(pts: Pt[], baseHalf: number): string {
  const n = pts.length
  // Half-width per point. Plump, barely-tapered fingers with a rounded tip read
  // as cartoon "sausage" fingers rather than realistic ones.
  const half = pts.map((_, i) => baseHalf * (1 - 0.18 * (i / (n - 1))))
  // Plug the root a little "into" the hand so the join hides under the palm.
  const seg0 = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y }
  const s0len = Math.hypot(seg0.x, seg0.y) || 1
  const root: Pt = {
    x: pts[0].x - (seg0.x / s0len) * 16,
    y: pts[0].y - (seg0.y / s0len) * 16,
  }
  const chain = [root, ...pts]
  const halfChain = [baseHalf * 1.04, ...half]

  const normalAt = (i: number) => {
    const prev = chain[Math.max(i - 1, 0)]
    const next = chain[Math.min(i + 1, chain.length - 1)]
    const tx = next.x - prev.x
    const ty = next.y - prev.y
    const len = Math.hypot(tx, ty) || 1
    return { x: -ty / len, y: tx / len }
  }

  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i < chain.length; i++) {
    const nrm = normalAt(i)
    left.push({ x: chain[i].x + nrm.x * halfChain[i], y: chain[i].y + nrm.y * halfChain[i] })
    right.push({ x: chain[i].x - nrm.x * halfChain[i], y: chain[i].y - nrm.y * halfChain[i] })
  }

  const tip = chain[chain.length - 1]
  const tipDir = {
    x: tip.x - chain[chain.length - 2].x,
    y: tip.y - chain[chain.length - 2].y,
  }
  const tl = Math.hypot(tipDir.x, tipDir.y) || 1
  const tipExt: Pt = {
    x: tip.x + (tipDir.x / tl) * halfChain[halfChain.length - 1],
    y: tip.y + (tipDir.y / tl) * halfChain[halfChain.length - 1],
  }

  let d = `M ${left[0].x} ${left[0].y} `
  for (let i = 1; i < left.length; i++) d += `L ${left[i].x} ${left[i].y} `
  d += `Q ${tipExt.x} ${tipExt.y} ${right[right.length - 1].x} ${right[right.length - 1].y} `
  for (let i = right.length - 2; i >= 0; i--) d += `L ${right[i].x} ${right[i].y} `
  return d + 'Z'
}

export const HandPiano = forwardRef<HandPianoHandle, HandPianoProps>(function HandPiano(
  {
    startPitch = makePitch('C', 4),
    octaves = 2,
    highlight = [],
    onPlay,
    skinFilter = 'none',
    className,
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null)

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

  const [hand, setHand] = useState(() => ({ x: width * 0.46, y: 235 }))
  const [fingers, setFingers] = useState<FingerModel[]>(() =>
    FINGERS.map(() => ({ curl: 0.14, splay: 0, state: 'above' as FingerState })),
  )

  // --- Smooth motion --------------------------------------------------------
  // Drags update a *target*; a rAF loop eases the rendered hand + finger
  // geometry toward it so the whole hand glides as one fluid unit instead of
  // snapping (and we avoid the flaky SVG `d` transition for the finger paths).
  const targetRef = useRef<{
    hand: Pt
    fingers: { curl: number; splay: number }[]
  }>({
    hand: { x: width * 0.46, y: 235 },
    fingers: FINGERS.map(() => ({ curl: 0.14, splay: 0 })),
  })
  // Latest rendered values, kept fresh for the rAF loop's closure.
  const latest = useRef({ hand, fingers })
  useEffect(() => {
    latest.current = { hand, fingers }
  }, [hand, fingers])
  const rafRef = useRef<number | null>(null)

  const ensureAnim = () => {
    if (rafRef.current != null) return
    const EASE = 0.35
    const tick = () => {
      const cur = latest.current
      const tgt = targetRef.current
      let done = true

      const nh = {
        x: cur.hand.x + (tgt.hand.x - cur.hand.x) * EASE,
        y: cur.hand.y + (tgt.hand.y - cur.hand.y) * EASE,
      }
      if (Math.abs(tgt.hand.x - cur.hand.x) > 0.3 || Math.abs(tgt.hand.y - cur.hand.y) > 0.3) {
        done = false
      } else {
        nh.x = tgt.hand.x
        nh.y = tgt.hand.y
      }

      const nf = cur.fingers.map((f, i) => {
        const t = tgt.fingers[i]
        let curl = f.curl + (t.curl - f.curl) * EASE
        let splay = f.splay + (t.splay - f.splay) * EASE
        if (Math.abs(t.curl - f.curl) > 0.004 || Math.abs(t.splay - f.splay) > 0.08) {
          done = false
        } else {
          curl = t.curl
          splay = t.splay
        }
        return curl === f.curl && splay === f.splay ? f : { ...f, curl, splay }
      })

      latest.current = { hand: nh, fingers: nf }
      setHand(nh)
      setFingers(nf)

      rafRef.current = done ? null : requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const drag = useRef<{
    kind: 'hand' | 'finger'
    index: number
    startX: number
    startY: number
    moved: boolean
    handX: number
    handY: number
    knuckleX: number
    knuckleY: number
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

  const geomOf = (i: number, model = fingers[i], h = hand) => {
    const spec = FINGERS[i]
    const pts = fingerPoints(h.x, h.y, spec, model)
    const tip = pts[pts.length - 1]
    return { spec, pts, knuckle: pts[0], tipX: tip.x, tipY: tip.y }
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
    const g = geomOf(i, f)
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
      knuckleX: 0,
      knuckleY: 0,
    }
  }

  const onFingerPointerDown = (e: React.PointerEvent, i: number) => {
    e.preventDefault()
    e.stopPropagation()
    void ensureAudio()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const g = geomOf(i)
    drag.current = {
      kind: 'finger',
      index: i,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      handX: hand.x,
      handY: hand.y,
      knuckleX: g.knuckle.x,
      knuckleY: g.knuckle.y,
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
      targetRef.current.hand = {
        x: clamp(d.handX + dx * ratioX, 10, width - 10),
        y: clamp(d.handY + dy * ratioY, 70, VIEW_HEIGHT - 150),
      }
      ensureAnim()
    } else {
      // Dragging a fingertip aims it (splay) and curls/extends it: dragging the
      // tip away from the knuckle extends the finger, dragging it in curls it.
      const spec = FINGERS[d.index]
      const p = toSvg(e.clientX, e.clientY)
      const vx = p.x - d.knuckleX
      const vy = p.y - d.knuckleY
      const aim = (Math.atan2(vx, -vy) * 180) / Math.PI
      const limit = spec.splayLimit ?? SPLAY_LIMIT_DEFAULT
      const splay = clamp(aim - spec.splay, -limit, limit)
      const reach = Math.hypot(vx, vy)
      const maxR = straightReach(spec)
      const minR = curledReach(spec)
      const curl = clamp((maxR - reach) / Math.max(maxR - minR, 1), 0, 1)
      targetRef.current.fingers[d.index] = { curl, splay }
      ensureAnim()
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
      const g = geomOf(d.index)
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

  // Let a parent (e.g. the demo mascot) drive the hand. The existing rAF easing
  // makes all of these glide smoothly.
  useImperativeHandle(ref, () => ({
    moveHand: (x, y) => {
      targetRef.current.hand = {
        x: clamp(x, 10, width - 10),
        y: clamp(y, 70, VIEW_HEIGHT - 150),
      }
      ensureAnim()
    },
    moveFinger: (index, curl, splay) => {
      const t = targetRef.current.fingers[index]
      if (!t) return
      targetRef.current.fingers[index] = { curl: clamp(curl, 0, 1), splay }
      ensureAnim()
    },
    restFinger: (index, on) => {
      setFingers((prev) =>
        prev.map((f, idx) => (idx === index ? { ...f, state: on ? 'on' : 'above' } : f)),
      )
    },
    press: () => handlePlay(),
    getHandPoint: () => ({
      x: latest.current.hand.x,
      y: latest.current.hand.y + 88,
    }),
    getFingerTip: (index) => {
      const spec = FINGERS[index]
      const pts = fingerPoints(
        latest.current.hand.x,
        latest.current.hand.y,
        spec,
        latest.current.fingers[index],
      )
      const tip = pts[pts.length - 1]
      return { x: tip.x, y: tip.y }
    },
  }))

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
                rx={10}
                className={pressed ? 'fill-[#ffdf8a]' : target ? 'fill-[#fff0bf]' : resting ? 'fill-[#fff8e8]' : 'fill-[#fdf8ee]'}
                stroke="#1b140d"
                strokeWidth={3.4}
                strokeLinejoin="round"
              />
              {/* Cartoon gloss near the top of the key */}
              <rect
                x={k.index * WHITE_W + 5}
                y={KEYBOARD_TOP + 5}
                width={WHITE_W - 12}
                height={WHITE_H * 0.34}
                rx={7}
                fill="#ffffff"
                opacity={pressed ? 0.2 : 0.55}
                pointerEvents="none"
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
                rx={9}
                className={pressed ? 'fill-[#6b4a2a]' : target ? 'fill-[#8a4f2c]' : resting ? 'fill-[#34281b]' : 'fill-[#1c1510]'}
                stroke="#000000"
                strokeWidth={3}
                strokeLinejoin="round"
              />
              {/* Glossy sheen on the black key */}
              <rect
                x={k.centerX - BLACK_W / 2 + 3}
                y={KEYBOARD_TOP + 4}
                width={BLACK_W - 6}
                height={12}
                rx={5}
                fill="#ffffff"
                opacity={0.18}
                pointerEvents="none"
              />
            </g>
          )
        })}

        {/* The hand: one cohesive cartoon back-of-hand with jointed fingers. */}
        <g style={{ filter: skinFilter }}>
          {/* Soft contact shadow */}
          <ellipse
            cx={hand.x + 2}
            cy={hand.y + 150}
            rx={92}
            ry={20}
            fill="#000"
            opacity={0.12}
          />

          {/* Fingers (drawn first; their roots get tucked under the hand). */}
          {FINGERS.map((spec, i) => {
            const f = fingers[i]
            const pts = fingerPoints(hand.x, hand.y, spec, f)
            const nudge = f.state === 'above' ? 0 : f.state === 'on' ? 3 : 6
            return (
              <g
                key={spec.name}
                transform={`translate(0 ${-nudge})`}
                style={{ transition: 'transform 140ms ease-out' }}
              >
                <path
                  d={fingerOutlinePath(pts, spec.width / 2)}
                  fill={SKIN}
                  stroke={OUTLINE}
                  strokeWidth={OUTLINE_W}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            )
          })}

          {/* Hand body, painted over the finger roots to unify them. */}
          <path
            d={smoothClosedPath(
              PALM_OUTLINE.map(([x, y]) => [
                hand.x + x * PALM_SCALE,
                hand.y + y * PALM_SCALE,
              ]),
            )}
            fill={SKIN}
            stroke={OUTLINE}
            strokeWidth={OUTLINE_W}
            strokeLinejoin="round"
            className="cursor-move"
            onPointerDown={onHandPointerDown}
          />
          {/* Single soft cartoon highlight on the back of the hand */}
          <ellipse
            cx={hand.x - 8}
            cy={hand.y + 70}
            rx={42}
            ry={50}
            fill={SKIN_LIGHT}
            opacity={0.5}
            pointerEvents="none"
          />

          {/* Per-finger overlay: a little dot when resting, plus the (invisible)
              grab handle at the fingertip. No nails/creases — keeps it cartoon. */}
          {FINGERS.map((spec, i) => {
            const f = fingers[i]
            const nudge = f.state === 'above' ? 0 : f.state === 'on' ? 3 : 6
            const pts = fingerPoints(hand.x, hand.y, spec, f).map((p) => ({
              x: p.x,
              y: p.y - nudge,
            }))
            const tip = pts[pts.length - 1]
            const handleR = spec.width * 0.75
            const target = f.state !== 'above'
            return (
              <g key={`d-${spec.name}`}>
                {target && (
                  <circle
                    cx={tip.x}
                    cy={tip.y}
                    r={5}
                    fill="#6b8f3a"
                    stroke="#fff"
                    strokeWidth={1.5}
                    opacity={0.95}
                    pointerEvents="none"
                  />
                )}
                {/* Invisible grab handle at the fingertip */}
                <circle
                  cx={tip.x}
                  cy={tip.y}
                  r={handleR}
                  fill="transparent"
                  className="cursor-grab"
                  onPointerDown={(e) => onFingerPointerDown(e, i)}
                />
              </g>
            )
          })}
        </g>
      </svg>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-base text-ink-soft">
          Resting on:{' '}
          <span className="font-semibold text-ink">
            {restingSummary.length ? restingSummary.join(' \u00B7 ') : '\u2014'}
          </span>
        </p>
        <Button size="lg" onClick={handlePlay}>
          Play
        </Button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Drag the hand to move it; drag a fingertip to aim &amp; curl it; tap a
        fingertip to rest it on a key, then press Play.
      </p>
    </div>
  )
})

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
