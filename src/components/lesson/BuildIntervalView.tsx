import { useEffect, useState } from 'react'
import { Staff, type StaffNote } from '@/components/Staff'
import { Button } from '@/components/ui/button'
import { feedbackFor } from '@/lib/content/feedback'
import { validateAnswer } from '@/lib/content/validate'
import type { BuildIntervalStep } from '@/lib/content/types'
import { diatonicStep, type Pitch } from '@/lib/theory/pitch'
import { pitchFromDiatonicStep } from '@/lib/theory/staff'
import { ensureAudio, playPitches } from '@/lib/audio'
import type { ProblemViewProps } from './types'

function initialAnswer(step: BuildIntervalStep): Pitch {
  const offset = step.direction === 'above' ? 2 : -2
  return pitchFromDiatonicStep(diatonicStep(step.basePitch) + offset, 0)
}

export function BuildIntervalView({
  step,
  solved,
  onResult,
}: ProblemViewProps<BuildIntervalStep>) {
  const [answer, setAnswer] = useState<Pitch>(() => initialAnswer(step))
  const [hintsShown, setHintsShown] = useState(0)

  useEffect(() => {
    setAnswer(initialAnswer(step))
    setHintsShown(0)
  }, [step])

  const check = () => {
    const result = validateAnswer(step, answer)
    onResult(result, feedbackFor(step, result.category))
  }

  const hearIt = async () => {
    await ensureAudio()
    const pair =
      step.direction === 'above' ? [step.basePitch, answer] : [answer, step.basePitch]
    playPitches(pair, 'melodic')
  }

  const notes: StaffNote[] = [
    { id: 'base', pitch: step.basePitch, tone: 'given' },
    { id: 'answer', pitch: answer, draggable: true, tone: 'answer' },
  ]

  return (
    <div className="space-y-4">
      <Staff
        notes={notes}
        onNoteChange={(id, p) => {
          if (id === 'answer') setAnswer(p)
        }}
      />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={check} disabled={solved}>
          Check
        </Button>
        <Button variant="outline" onClick={hearIt}>
          Hear it
        </Button>
        {step.hints && step.hints.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setHintsShown((n) => Math.min(n + 1, step.hints!.length))}
            disabled={hintsShown >= (step.hints?.length ?? 0)}
          >
            Hint
          </Button>
        )}
      </div>

      {hintsShown > 0 && step.hints && (
        <ul className="space-y-1 rounded-md border-2 border-ink/30 bg-parchment/50 p-3 text-sm text-ink">
          {step.hints.slice(0, hintsShown).map((h, i) => (
            <li key={i}>• {h}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
