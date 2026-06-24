import { useMemo, useState } from 'react'
import { Staff, type StaffNote } from '@/components/Staff'
import { Button } from '@/components/ui/button'
import { feedbackFor } from '@/lib/content/feedback'
import { validateAnswer } from '@/lib/content/validate'
import type { IdentifyIntervalStep } from '@/lib/content/types'
import type { IntervalQuality } from '@/lib/theory/intervals'
import { ensureAudio, playPitches } from '@/lib/audio'
import { DragTokens, type DragToken, type DropSlot } from './DragTokens'
import { FeatureTip } from './FeatureTip'
import { TOKENS_TIP } from './featureTips'
import type { ProblemViewProps } from './types'

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8]
const QUALITIES: IntervalQuality[] = ['d', 'm', 'P', 'M', 'A']

const QUALITY_LABEL: Record<IntervalQuality, string> = {
  d: 'dim',
  m: 'minor',
  P: 'perfect',
  M: 'major',
  A: 'aug',
}

export function IdentifyIntervalView({
  step,
  onResult,
  onHint,
}: ProblemViewProps<IdentifyIntervalStep>) {
  const [values, setValues] = useState<Record<string, string | null>>({
    quality: null,
    number: null,
  })
  const [hintsShown, setHintsShown] = useState(0)

  const notes: StaffNote[] = [
    { id: 'a', pitch: step.pitches[0], tone: 'given' },
    { id: 'b', pitch: step.pitches[1], tone: 'answer' },
  ]

  const slots: DropSlot[] = useMemo(
    () =>
      step.numberOnly
        ? [{ id: 'number', placeholder: '?' }]
        : [
            { id: 'quality', placeholder: 'quality' },
            { id: 'number', placeholder: '#' },
          ],
    [step.numberOnly],
  )

  const tokens: DragToken[] = useMemo(() => {
    const numberTokens: DragToken[] = NUMBERS.map((n) => ({
      id: `n${n}`,
      label: String(n),
      slot: 'number',
      value: String(n),
    }))
    if (step.numberOnly) return numberTokens
    const qualityTokens: DragToken[] = QUALITIES.map((q) => ({
      id: `q${q}`,
      label: QUALITY_LABEL[q],
      slot: 'quality',
      value: q,
    }))
    return [...qualityTokens, ...numberTokens]
  }, [step.numberOnly])

  const canCheck =
    values.number !== null && (step.numberOnly || values.quality !== null)

  const check = () => {
    if (values.number === null) return
    const result = validateAnswer(step, {
      number: Number(values.number),
      quality: values.quality ?? '',
    })
    onResult(result, feedbackFor(step, result.category))
  }

  const hearIt = async () => {
    await ensureAudio()
    playPitches([step.pitches[0], step.pitches[1]], 'melodic')
  }

  const revealHint = () => {
    if (!step.hints || step.hints.length === 0) return
    const next = Math.min(hintsShown + 1, step.hints.length)
    setHintsShown(next)
    onHint?.(step.hints[next - 1])
  }

  return (
    <div className="space-y-4">
      <FeatureTip {...TOKENS_TIP} />
      <Staff notes={notes} />

      <p className="text-center text-sm text-ink-soft">
        Drag {step.numberOnly ? 'the number' : 'a quality and a number'} into the
        slot{step.numberOnly ? '' : 's'}.
      </p>

      <DragTokens
        slots={slots}
        tokens={tokens}
        values={values}
        labelFor={(slotId, value) =>
          slotId === 'quality' ? QUALITY_LABEL[value as IntervalQuality] : value
        }
        onAssign={(slotId, value) =>
          setValues((prev) => ({ ...prev, [slotId]: value }))
        }
      />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={check} disabled={!canCheck}>
          Check
        </Button>
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
