import { useEffect, useMemo, useState } from 'react'
import { Staff, type StaffNote } from '@/components/Staff'
import { Button } from '@/components/ui/button'
import { feedbackFor } from '@/lib/content/feedback'
import { validateAnswer } from '@/lib/content/validate'
import type { IdentifyChordStep } from '@/lib/content/types'
import { isSeventh, type ChordQuality } from '@/lib/theory/chords'
import { LETTERS } from '@/lib/theory/pitch'
import { ensureAudio, playPitches } from '@/lib/audio'
import { DragTokens, type DragToken, type DropSlot } from './DragTokens'
import type { ProblemViewProps } from './types'

const TRIAD_QUALITIES: ChordQuality[] = ['major', 'minor', 'diminished', 'augmented']
const SEVENTH_QUALITIES: ChordQuality[] = ['maj7', 'min7', 'dom7', 'halfdim7', 'dim7']

const QUALITY_LABEL: Record<ChordQuality, string> = {
  major: 'major',
  minor: 'minor',
  diminished: 'dim',
  augmented: 'aug',
  maj7: 'maj7',
  min7: 'min7',
  dom7: 'dom7',
  dim7: 'dim7',
  halfdim7: 'half-dim7',
}

const slots: DropSlot[] = [
  { id: 'root', placeholder: 'root' },
  { id: 'quality', placeholder: 'quality' },
]

export function IdentifyChordView({
  step,
  solved,
  onResult,
}: ProblemViewProps<IdentifyChordStep>) {
  const [values, setValues] = useState<Record<string, string | null>>({
    root: null,
    quality: null,
  })
  const [hintsShown, setHintsShown] = useState(0)

  useEffect(() => {
    setValues({ root: null, quality: null })
    setHintsShown(0)
  }, [step])

  const notes: StaffNote[] = step.pitches.map((p, i) => ({
    id: `c${i}`,
    pitch: p,
    tone: 'given',
  }))

  const tokens: DragToken[] = useMemo(() => {
    const qualityOptions = isSeventh(step.answerQuality)
      ? SEVENTH_QUALITIES
      : TRIAD_QUALITIES
    const rootTokens: DragToken[] = LETTERS.map((l) => ({
      id: `r${l}`,
      label: l,
      slot: 'root',
      value: l,
    }))
    const qualityTokens: DragToken[] = qualityOptions.map((q) => ({
      id: `q${q}`,
      label: QUALITY_LABEL[q],
      slot: 'quality',
      value: q,
    }))
    return [...rootTokens, ...qualityTokens]
  }, [step.answerQuality])

  const canCheck = values.root !== null && values.quality !== null

  const check = () => {
    if (values.root === null || values.quality === null) return
    const result = validateAnswer(step, {
      rootLetter: values.root,
      quality: values.quality,
    })
    onResult(result, feedbackFor(step, result.category))
  }

  const hearIt = async () => {
    await ensureAudio()
    playPitches(step.pitches, 'chord')
  }

  return (
    <div className="space-y-4">
      <Staff notes={notes} />

      <p className="text-center text-sm text-ink-soft">
        Drag a root letter and a quality into the slots.
      </p>

      <DragTokens
        slots={slots}
        tokens={tokens}
        values={values}
        disabled={solved}
        labelFor={(slotId, value) =>
          slotId === 'quality' ? QUALITY_LABEL[value as ChordQuality] : value
        }
        onAssign={(slotId, value) =>
          setValues((prev) => ({ ...prev, [slotId]: value }))
        }
      />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={check} disabled={!canCheck || solved}>
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
