import { useEffect, useState } from 'react'
import { Staff, type StaffNote } from '@/components/Staff'
import { Button } from '@/components/ui/button'
import { feedbackFor } from '@/lib/content/feedback'
import { validateAnswer } from '@/lib/content/validate'
import type { IdentifyIntervalStep } from '@/lib/content/types'
import type { IntervalQuality } from '@/lib/theory/intervals'
import { cn } from '@/lib/utils'
import type { ProblemViewProps } from './types'

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8]

function qualityOptions(number: number): IntervalQuality[] {
  const simple = ((number - 1) % 7) + 1
  const isPerfect = simple === 1 || simple === 4 || simple === 5
  return isPerfect ? ['d', 'P', 'A'] : ['d', 'm', 'M', 'A']
}

const QUALITY_LABEL: Record<IntervalQuality, string> = {
  d: 'dim',
  m: 'minor',
  P: 'perfect',
  M: 'major',
  A: 'aug',
}

export function IdentifyIntervalView({
  step,
  solved,
  onResult,
}: ProblemViewProps<IdentifyIntervalStep>) {
  const [number, setNumber] = useState<number | null>(null)
  const [quality, setQuality] = useState<IntervalQuality | null>(null)
  const [hintsShown, setHintsShown] = useState(0)

  useEffect(() => {
    setNumber(null)
    setQuality(null)
    setHintsShown(0)
  }, [step])

  const notes: StaffNote[] = [
    { id: 'a', pitch: step.pitches[0], tone: 'given' },
    { id: 'b', pitch: step.pitches[1], tone: 'answer' },
  ]

  const canCheck =
    number !== null && (step.numberOnly || quality !== null)

  const check = () => {
    if (number === null) return
    const result = validateAnswer(step, {
      number,
      quality: quality ?? '',
    })
    onResult(result, feedbackFor(step, result.category))
  }

  return (
    <div className="space-y-4">
      <Staff notes={notes} />

      <div className="space-y-3">
        <div>
          <p className="mb-1 text-sm text-ink-soft">Number</p>
          <div className="flex flex-wrap gap-1.5">
            {NUMBERS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumber(n)}
                className={cn(
                  'size-9 rounded-md border-2 border-ink/40 text-ink transition-colors hover:bg-ink/10',
                  number === n && 'bg-ink text-parchment hover:bg-ink',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {!step.numberOnly && number !== null && (
          <div>
            <p className="mb-1 text-sm text-ink-soft">Quality</p>
            <div className="flex flex-wrap gap-1.5">
              {qualityOptions(number).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={cn(
                    'rounded-md border-2 border-ink/40 px-3 py-1.5 text-sm text-ink transition-colors hover:bg-ink/10',
                    quality === q && 'bg-ink text-parchment hover:bg-ink',
                  )}
                >
                  {QUALITY_LABEL[q]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={check} disabled={!canCheck || solved}>
          Check
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
