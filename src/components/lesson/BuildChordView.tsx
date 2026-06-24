import { useEffect, useMemo, useState } from 'react'
import { Staff, type StaffNote } from '@/components/Staff'
import { Button } from '@/components/ui/button'
import { feedbackFor } from '@/lib/content/feedback'
import { validateAnswer } from '@/lib/content/validate'
import type { BuildChordStep } from '@/lib/content/types'
import { chordRecipe } from '@/lib/theory/chords'
import { diatonicStep, type Pitch } from '@/lib/theory/pitch'
import { pitchFromDiatonicStep } from '@/lib/theory/staff'
import { ensureAudio, playPitches } from '@/lib/audio'
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
}: ProblemViewProps<BuildChordStep>) {
  const [voices, setVoices] = useState<Pitch[]>(() => initialVoices(step))
  const [hintsShown, setHintsShown] = useState(0)

  useEffect(() => {
    setVoices(initialVoices(step))
    setHintsShown(0)
  }, [step])

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
  }

  const hearIt = async () => {
    await ensureAudio()
    playPitches([step.root, ...voices], 'chord')
  }

  return (
    <div className="space-y-4">
      <Staff
        notes={notes}
        onNoteChange={(id, p) => {
          const m = /^v(\d+)$/.exec(id)
          if (!m) return
          const idx = Number(m[1])
          setVoices((prev) => prev.map((v, i) => (i === idx ? p : v)))
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
