import { useCallback, useEffect, useRef, useState } from 'react'
import { HandPiano, type HandPianoHandle } from '@/components/HandPiano'
import { PianoMascot, type ArmPose } from '@/components/lesson/PianoMascot'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { pitch } from '@/lib/theory/pitch'

// The HandPiano renders at its native viewBox size, so we pin the stage width to
// it (1 SVG unit == 1px) and read its hand/finger positions straight back.
const STAGE_W = 600 // octaves=2 -> 15 white keys * 40
const MASCOT_W = 120
const SCALE = MASCOT_W / 120
const HAND_VB_X = 123 // right glove hand in the mascot viewBox
const HAND_VB_Y = 71
const HAND_START_X = STAGE_W * 0.46 // matches HandPiano's default hand position
const HAND_START_Y = 235
const OFFSCREEN = { x: -220, y: 240 }

// Which fingers Pianomaster99 drags, in left-to-right order, and how far he
// curls/aims each one. (0 pinky, 1 ring, 2 middle, 3 index, 4 thumb.)
const FINGER_SEQ = [
  { idx: 0, curl: 0.42, splay: -8 },
  { idx: 2, curl: 0.55, splay: 0 },
  { idx: 4, curl: 0.32, splay: 12 },
]

type Phase = 'idle' | 'enter' | 'dragHand' | 'finger' | 'press' | 'done'
type Active = { kind: 'hand' } | { kind: 'finger'; index: number }

const CAPTION: Record<Phase, string> = {
  idle: '',
  enter: 'Here comes Pianomaster99...',
  dragHand: 'First he drags the whole hand into place.',
  finger: 'Then he places each finger, one at a time.',
  press: 'And presses to play!',
  done: 'Ta-da!',
}

export default function MascotPianoDemo() {
  const piano = useRef<HandPianoHandle>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const phaseRef = useRef<Phase>('idle')
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])
  const active = useRef<Active>({ kind: 'hand' })

  // The mascot's glove position eases toward whatever it is grabbing each frame.
  const glove = useRef({ ...OFFSCREEN })
  const [glovePos, setGlovePos] = useState({ ...OFFSCREEN })
  const raf = useRef<number | null>(null)

  const timers = useRef<number[]>([])
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  const after = (ms: number, fn: () => void) =>
    timers.current.push(window.setTimeout(fn, ms))

  // Follow loop: glue the mascot's hand to the piano part it's manipulating.
  useEffect(() => {
    const tick = () => {
      const p = piano.current
      let tgt = OFFSCREEN
      if (p && phaseRef.current !== 'idle') {
        tgt =
          active.current.kind === 'hand'
            ? p.getHandPoint()
            : p.getFingerTip(active.current.index)
      }
      const g = glove.current
      g.x += (tgt.x - g.x) * 0.18
      g.y += (tgt.y - g.y) * 0.18
      setGlovePos({ x: g.x, y: g.y })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
    }
  }, [])

  const run = useCallback(() => {
    clearTimers()
    const p = piano.current
    p?.moveHand(HAND_START_X, HAND_START_Y)
    ;[0, 1, 2, 3, 4].forEach((i) => {
      p?.restFinger(i, false)
      p?.moveFinger(i, 0.14, 0)
    })
    active.current = { kind: 'hand' }
    glove.current = { ...OFFSCREEN }
    setPhase('enter')

    // Walk over, grab the back of the hand, drag it into place.
    after(1100, () => {
      setPhase('dragHand')
      piano.current?.moveHand(HAND_START_X - 70, 250)
    })

    // Then move to each fingertip and drag the finger down like a user.
    let t = 2200
    FINGER_SEQ.forEach((f) => {
      after(t, () => {
        setPhase('finger')
        active.current = { kind: 'finger', index: f.idx }
      })
      after(t + 750, () => {
        piano.current?.moveFinger(f.idx, f.curl, f.splay)
        piano.current?.restFinger(f.idx, true)
      })
      t += 1500
    })

    after(t, () => {
      setPhase('press')
      active.current = { kind: 'hand' }
      piano.current?.press()
    })
    after(t + 900, () => setPhase('done'))
  }, [])

  useEffect(() => {
    const id = window.setTimeout(run, 60)
    return () => {
      window.clearTimeout(id)
      clearTimers()
    }
  }, [run])

  const rightArm: ArmPose =
    phase === 'done' ? 'wave' : phase === 'enter' || phase === 'idle' ? 'reach' : 'hold'

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Pianomaster99 plays the hand-piano</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-soft">
            Pianomaster99 walks over, drags the whole hand into place, then moves
            to each finger and drags it down onto a key — just like you would.
          </p>

          <div className="overflow-x-auto">
            <div className="relative mx-auto" style={{ width: STAGE_W }}>
              <HandPiano
                ref={piano}
                octaves={2}
                highlight={[pitch('C', 4), pitch('E', 4), pitch('G', 4)]}
              />
              <div
                className="pointer-events-none absolute z-20"
                style={{
                  left: glovePos.x - HAND_VB_X * SCALE,
                  top: glovePos.y - HAND_VB_Y * SCALE,
                  width: MASCOT_W,
                  overflow: 'visible',
                }}
              >
                <PianoMascot
                  mood={phase === 'done' ? 'happy' : 'thinking'}
                  talking={phase === 'done'}
                  armRight={rightArm}
                  armLeft="idle"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button onClick={run}>Replay</Button>
            <span className="min-h-[1.25rem] text-sm text-ink-soft">
              {CAPTION[phase]}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
