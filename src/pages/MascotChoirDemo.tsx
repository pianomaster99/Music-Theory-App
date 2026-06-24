import { useCallback, useEffect, useRef, useState } from 'react'
import { Choir, type ChoirHandle } from '@/components/Choir'
import { PianoMascot } from '@/components/lesson/PianoMascot'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Front-row seat geometry mirrored from Choir (octaves = 1 -> front row is the
// widest), so we can aim the baton beam at a specific singer.
const OCTAVES = 1
const SLOT = 96
const LEFT = 72
const STAGE_H = 360
const FRONT_FOOT = 320
const FRONT_SCALE = 0.85
const HEAD_Y = -116

const SINGERS = OCTAVES * 12 + 1
const FRONT_COUNT = Math.ceil(SINGERS / 2)
const STAGE_W = LEFT * 2 + FRONT_COUNT * SLOT
const seatX = (i: number) => LEFT + SLOT / 2 + i * SLOT
const HEAD_SCREEN_Y = FRONT_FOOT + HEAD_Y * FRONT_SCALE

const MASCOT_W = 120
const MASCOT_LEFT = 6
const MASCOT_TOP = 150
// Baton tip in the mascot viewBox (right hand) -> approximate screen origin.
const BEAM_ORIGIN = { x: MASCOT_LEFT + 158 * (MASCOT_W / 120), y: MASCOT_TOP + 44 * (MASCOT_W / 120) }
const MASCOT_CENTER_X = MASCOT_LEFT + (60 * MASCOT_W) / 120

// Front-row singers to conduct, left -> right.
const TARGETS = [1, 3, 5]

type Phase = 'idle' | 'enter' | 'point' | 'done'

export default function MascotChoirDemo() {
  const choir = useRef<ChoirHandle>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [target, setTarget] = useState<number | null>(null)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  const after = (ms: number, fn: () => void) =>
    timers.current.push(window.setTimeout(fn, ms))

  const run = useCallback(() => {
    clearTimers()
    choir.current?.stopAll()
    setTarget(null)
    setPhase('enter')

    let t = 700
    TARGETS.forEach((idx, k) => {
      after(t, () => {
        setPhase('point')
        if (k > 0) choir.current?.stop(TARGETS[k - 1])
        setTarget(idx)
        choir.current?.sing(idx)
      })
      t += 1500
    })
    after(t, () => {
      choir.current?.stop(TARGETS[TARGETS.length - 1])
      setTarget(null)
      setPhase('done')
    })
  }, [])

  useEffect(() => {
    const id = window.setTimeout(run, 60)
    return () => {
      window.clearTimeout(id)
      clearTimers()
    }
  }, [run])

  const tip = target != null ? { x: seatX(target), y: HEAD_SCREEN_Y } : null
  // Lean the whole mascot toward the singer it's conducting.
  const tilt =
    target != null
      ? Math.max(0, Math.min(28, ((seatX(target) - MASCOT_CENTER_X) / STAGE_W) * 64))
      : 0

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Pianomaster99 conducts the choir</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-soft">
            Pianomaster99 raises his baton and waves it at each singer in turn —
            whoever he points at starts to sing.
          </p>

          <div className="overflow-x-auto">
            <div className="relative mx-auto" style={{ width: STAGE_W }}>
              <Choir
                ref={choir}
                theme="angels"
                octaves={OCTAVES}
                showBaton={false}
              />

              {/* Magic beam from the baton tip to the singer being conducted */}
              {tip && (
                <svg
                  className="pointer-events-none absolute inset-0"
                  style={{ width: STAGE_W, height: STAGE_H, overflow: 'visible' }}
                  viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
                >
                  <line
                    x1={BEAM_ORIGIN.x}
                    y1={BEAM_ORIGIN.y}
                    x2={tip.x}
                    y2={tip.y}
                    stroke="#ffe27a"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray="2 8"
                    opacity={0.85}
                    className="choir-twinkle"
                  />
                  <circle cx={tip.x} cy={tip.y} r={10} fill="#fff3b0" opacity={0.5} className="choir-twinkle" />
                </svg>
              )}

              {/* Conductor mascot at front-left, leaning toward the singer */}
              <div
                className="pointer-events-none absolute z-20"
                style={{
                  left: MASCOT_LEFT,
                  top: phase === 'idle' ? STAGE_H + 60 : MASCOT_TOP,
                  width: MASCOT_W,
                  overflow: 'visible',
                  transform: `rotate(${tilt}deg)`,
                  transformOrigin: '50% 92%',
                  transition: 'transform 360ms ease, top 600ms ease',
                }}
              >
                <PianoMascot
                  mood={phase === 'done' ? 'happy' : 'neutral'}
                  talking={phase === 'point' || phase === 'done'}
                  armRight={phase === 'point' ? 'wave' : phase === 'done' ? 'wave' : 'reach'}
                  armLeft="idle"
                  baton
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button onClick={run}>Replay</Button>
            <span className="text-sm text-ink-soft">
              {phase === 'done' ? 'Bravo!' : phase === 'point' ? 'Sing!' : 'Raising the baton...'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
