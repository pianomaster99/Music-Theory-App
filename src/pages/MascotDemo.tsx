import { useCallback, useEffect, useRef, useState } from 'react'
import { Staff, type StaffNote } from '@/components/Staff'
import { PianoMascot, type ArmPose } from '@/components/lesson/PianoMascot'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { pitch } from '@/lib/theory/pitch'
import { pitchFromDiatonicStep } from '@/lib/theory/staff'
import { ensureAudio, playPitches } from '@/lib/audio'

// Staff geometry (mirrors src/components/Staff.tsx) so the mascot overlay lines
// up with the note in this fixed-width 360px stage (1 SVG unit == 1px there).
const STAGE_W = 360
const STEP_PX = 9
const PADDING_TOP = 34
const MAX_STEP = 43
const ANSWER_X = 164 // second note column

// Mascot render size + where its left glove hand sits in the 120x150 viewBox,
// so we can place the mascot (to the RIGHT of the staff, clear of the notes)
// with its left hand landing right on the answer note.
const MASCOT_W = 100
const MASCOT_SCALE = MASCOT_W / 120
const HAND_VB_X = -4 // left arm hand, just left of the body
const HAND_VB_Y = 71

// Diatonic steps: the answer note drags from D4(29) up to G4(32); C4 stays put.
const START_STEP = 29
const TARGET_STEP = 32

const yForStep = (step: number) => PADDING_TOP + (MAX_STEP - step) * STEP_PX

type Phase = 'idle' | 'enter' | 'grab' | 'drag' | 'cheer'

export default function MascotDemo() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [step, setStep] = useState(START_STEP)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  const after = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const run = useCallback(() => {
    clearTimers()
    setStep(START_STEP)
    setPhase('enter')
    after(950, () => setPhase('grab'))
    after(1350, () => {
      setPhase('drag')
      setStep(30)
    })
    after(1750, () => setStep(31))
    after(2150, () => setStep(TARGET_STEP))
    after(2650, () => {
      setPhase('cheer')
      void ensureAudio().then(() =>
        playPitches([pitch('C', 4), pitchFromDiatonicStep(TARGET_STEP, 0)], 'chord'),
      )
    })
  }, [])

  useEffect(() => {
    // Defer so the first state change isn't synchronous within the effect.
    const id = window.setTimeout(run, 50)
    return () => {
      window.clearTimeout(id)
      clearTimers()
    }
  }, [run])

  const notes: StaffNote[] = [
    { id: 'root', pitch: pitch('C', 4), tone: 'given' },
    { id: 'answer', pitch: pitchFromDiatonicStep(step, 0), tone: 'answer' },
  ]

  const noteY = yForStep(step)
  // Place the mascot to the RIGHT of the staff so its body never covers a note;
  // its left hand reaches back to land on the answer note.
  const mascotLeft =
    phase === 'idle' ? STAGE_W + 40 : ANSWER_X - HAND_VB_X * MASCOT_SCALE
  const mascotTop = noteY - HAND_VB_Y * MASCOT_SCALE

  // The left arm does the work; the right arm just swings along idly.
  const leftArm: ArmPose =
    phase === 'cheer'
      ? 'wave'
      : phase === 'grab' || phase === 'drag'
        ? 'hold'
        : 'reach'

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Pianomaster99 drags a note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-soft">
            Pianomaster99 glides into the example, grabs the answer note, and
            drags it up to the right pitch (G4), then celebrates.
          </p>

          <div className="relative mx-auto" style={{ width: STAGE_W }}>
            <Staff notes={notes} minStep={25} maxStep={MAX_STEP} />

            {/* The mascot overlay glides in and tracks the note vertically; its
                drawn arm reaches out and grips the note (no emoji). */}
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: mascotLeft,
                top: mascotTop,
                width: MASCOT_W,
                overflow: 'visible',
                transition: 'left 900ms cubic-bezier(.22,.61,.36,1), top 350ms ease',
              }}
            >
              <PianoMascot
                mood={phase === 'cheer' ? 'happy' : leftArm === 'hold' ? 'thinking' : 'neutral'}
                talking={phase === 'cheer'}
                armLeft={leftArm}
                armRight={phase === 'cheer' ? 'wave' : 'idle'}
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button onClick={run}>Replay</Button>
            <span className="text-sm text-ink-soft">
              {phase === 'cheer' ? 'Nailed it!' : 'Watch him work...'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
