import { useRef, useState } from 'react'
import { Staff, type StaffNote } from '@/components/Staff'
import { Button } from '@/components/ui/button'
import { feedbackFor } from '@/lib/content/feedback'
import {
  validateAnswer,
  validateBuildIntervalSound,
} from '@/lib/content/validate'
import type { BuildIntervalStep } from '@/lib/content/types'
import { diatonicStep, formatPitch, type Pitch } from '@/lib/theory/pitch'
import { pitchFromDiatonicStep } from '@/lib/theory/staff'
import { ensureAudio, playPitches } from '@/lib/audio'
import { FeatureTip } from './FeatureTip'
import { STAFF_TIP } from './featureTips'
import { InstrumentBuild } from './InstrumentBuild'
import { useStagePointer } from './stagePointerContext'
import type { ProblemViewProps } from './types'

function initialAnswer(step: BuildIntervalStep): Pitch {
  const offset = step.direction === 'above' ? 2 : -2
  return pitchFromDiatonicStep(diatonicStep(step.basePitch) + offset, 0)
}

export function BuildIntervalView({
  step,
  solved,
  onResult,
  onHint,
}: ProblemViewProps<BuildIntervalStep>) {
  // Piano / choir: build by sounding pitches, validated by ear.
  if (step.feature === 'piano' || step.feature === 'choir') {
    return (
      <InstrumentBuild
        feature={step.feature}
        seed={step.id}
        anchors={[step.basePitch]}
        solved={solved}
        instruction={`Sound ${formatPitch(step.basePitch)} (highlighted) and the note a ${step.direction === 'above' ? 'higher' : 'lower'} interval away to complete it.`}
        onCheck={(pitches) => {
          const result = validateBuildIntervalSound(step, pitches)
          onResult(result, feedbackFor(step, result.category))
          return result
        }}
        hints={step.hints}
        onHint={onHint}
      />
    )
  }
  return (
    <StaffIntervalBuild
      step={step}
      solved={solved}
      onResult={onResult}
      onHint={onHint}
    />
  )
}

function StaffIntervalBuild({
  step,
  onResult,
  onHint,
}: ProblemViewProps<BuildIntervalStep>) {
  // Fresh per step: LessonPlayer remounts this via key={step.id}.
  const [answer, setAnswer] = useState<Pitch>(() => initialAnswer(step))
  const [hintsShown, setHintsShown] = useState(0)
  const staffRef = useRef<HTMLDivElement>(null)
  const pointer = useStagePointer()

  const check = () => {
    const result = validateAnswer(step, answer)
    onResult(result, feedbackFor(step, result.category))
    if (!result.correct) {
      const note = staffRef.current?.querySelector('[data-note-id="answer"]')
      pointer?.point(note ?? staffRef.current, 'This note')
    }
  }

  const hearIt = async () => {
    await ensureAudio()
    const pair =
      step.direction === 'above' ? [step.basePitch, answer] : [answer, step.basePitch]
    playPitches(pair, 'melodic')
  }

  const revealHint = () => {
    if (!step.hints || step.hints.length === 0) return
    const next = Math.min(hintsShown + 1, step.hints.length)
    setHintsShown(next)
    onHint?.(step.hints[next - 1])
  }

  const notes: StaffNote[] = [
    { id: 'base', pitch: step.basePitch, tone: 'given' },
    { id: 'answer', pitch: answer, draggable: true, tone: 'answer' },
  ]

  return (
    <div className="space-y-4">
      <FeatureTip {...STAFF_TIP} />
      <div ref={staffRef}>
        <Staff
          notes={notes}
          onNoteChange={(id, p) => {
            if (id === 'answer') setAnswer(p)
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={check}>Check</Button>
        <Button variant="outline" onClick={hearIt}>
          Hear it
        </Button>
        {step.hints && step.hints.length > 0 && (
          <Button
            variant="outline"
            onClick={revealHint}
            disabled={hintsShown >= (step.hints?.length ?? 0)}
          >
            Hint
          </Button>
        )}
      </div>
    </div>
  )
}
