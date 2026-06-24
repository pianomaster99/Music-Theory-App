import { useMemo, useRef, useState } from 'react'
import { Staff, type StaffNote } from '@/components/Staff'
import { Button } from '@/components/ui/button'
import { feedbackFor } from '@/lib/content/feedback'
import {
  validateAnswer,
  validateBuildChordSound,
} from '@/lib/content/validate'
import type { BuildChordStep } from '@/lib/content/types'
import { chordRecipe } from '@/lib/theory/chords'
import { diatonicStep, formatPitch, type Pitch } from '@/lib/theory/pitch'
import { pitchFromDiatonicStep } from '@/lib/theory/staff'
import { ensureAudio, playPitches } from '@/lib/audio'
import { FeatureTip } from './FeatureTip'
import { STAFF_TIP } from './featureTips'
import { InstrumentBuild } from './InstrumentBuild'
import { useStagePointer } from './stagePointerContext'
import type { ProblemViewProps } from './types'

// One draggable note per non-root chord tone, started a diatonic third apart so
// the learner stacks them rather than starting from a pile.
function initialVoices(step: BuildChordStep): Pitch[] {
  const count = chordRecipe(step.quality).intervals.length
  const rootStep = diatonicStep(step.root)
  return Array.from({ length: count }, (_, i) =>
    pitchFromDiatonicStep(rootStep + 2 * (i + 1), 0),
  )
}

export function BuildChordView({
  step,
  solved,
  onResult,
  onHint,
}: ProblemViewProps<BuildChordStep>) {
  // Piano / choir: build by sounding pitches, validated by ear.
  if (step.feature === 'piano' || step.feature === 'choir') {
    return (
      <InstrumentBuild
        feature={step.feature}
        seed={step.id}
        anchors={[step.root]}
        solved={solved}
        instruction={`Sound every note of the chord, starting from the highlighted root ${formatPitch(step.root)}.`}
        onCheck={(pitches) => {
          const result = validateBuildChordSound(step, pitches)
          onResult(result, feedbackFor(step, result.category))
          return result
        }}
        hints={step.hints}
        onHint={onHint}
      />
    )
  }
  return (
    <StaffChordBuild
      step={step}
      solved={solved}
      onResult={onResult}
      onHint={onHint}
    />
  )
}

function StaffChordBuild({
  step,
  onResult,
  onHint,
}: ProblemViewProps<BuildChordStep>) {
  // Fresh per step: LessonPlayer remounts this via key={step.id}.
  const [voices, setVoices] = useState<Pitch[]>(() => initialVoices(step))
  const [hintsShown, setHintsShown] = useState(0)
  const staffRef = useRef<HTMLDivElement>(null)
  const pointer = useStagePointer()

  const notes: StaffNote[] = useMemo(
    () => [
      { id: 'root', pitch: step.root, tone: 'given' },
      ...voices.map((p, i) => ({
        id: `v${i}`,
        pitch: p,
        draggable: true,
        tone: 'answer' as const,
      })),
    ],
    [step.root, voices],
  )

  const check = () => {
    const result = validateAnswer(step, [step.root, ...voices])
    onResult(result, feedbackFor(step, result.category))
    if (!result.correct) {
      pointer?.point(staffRef.current, 'Check these notes')
    }
  }

  const hearIt = async () => {
    await ensureAudio()
    playPitches([step.root, ...voices], 'chord')
  }

  const revealHint = () => {
    if (!step.hints || step.hints.length === 0) return
    const next = Math.min(hintsShown + 1, step.hints.length)
    setHintsShown(next)
    onHint?.(step.hints[next - 1])
  }

  return (
    <div className="space-y-4">
      <FeatureTip {...STAFF_TIP} />
      <div ref={staffRef}>
        <Staff
          notes={notes}
          onNoteChange={(id, p) => {
            const m = /^v(\d+)$/.exec(id)
            if (!m) return
            const idx = Number(m[1])
            setVoices((prev) => prev.map((v, i) => (i === idx ? p : v)))
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
