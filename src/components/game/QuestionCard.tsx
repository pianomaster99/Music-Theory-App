import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatPitch, pitchFromMidi } from '@/lib/theory/pitch'
import { playReferenceA } from '@/lib/audio'
import { pcName } from '@/lib/game/notes'
import type { PitchReading } from '@/lib/pitch/detector'
import type { Question } from '@/lib/game/types'

interface Props {
  question: Question
  index: number
  total: number
  capturedPcs: number[]
  holdProgress: number
  reading: PitchReading | null
  level: number
  onSkip: () => void
  justCorrect: boolean
}

export default function QuestionCard({
  question,
  capturedPcs,
  holdProgress,
  reading,
  level,
  onSkip,
  justCorrect,
}: Props) {
  const need = question.answerPcs.length
  const liveNote =
    reading?.voiced && reading.noteMidi
      ? formatPitch(pitchFromMidi(reading.noteMidi), { unicode: true })
      : '—'

  return (
    <div
      className={cn(
        'rounded-2xl border-2 bg-parchment/70 p-6 transition-colors',
        justCorrect ? 'border-emerald-500' : 'border-ink/30',
      )}
    >
      {/* the question */}
      <p className="text-center font-display text-2xl leading-snug text-ink">
        {question.prompt}
      </p>

      {/* big centered answer boxes — the focal point */}
      <div className="mt-6 flex items-center justify-center gap-4">
        {Array.from({ length: need }).map((_, i) => {
          const pc = capturedPcs[i]
          const filled = pc !== undefined
          return (
            <div
              key={i}
              className={cn(
                'flex aspect-square w-24 items-center justify-center rounded-2xl border-4 font-display text-5xl transition-all sm:w-32 sm:text-6xl',
                filled
                  ? 'border-ink bg-parchment-dark text-ink shadow-[0_4px_0_rgba(74,53,38,0.25)]'
                  : 'border-dashed border-ink/25 text-ink/25',
              )}
            >
              {filled ? pcName(pc) : '?'}
            </div>
          )
        })}
      </div>

      {/* live note (subtle) */}
      <p className="mt-3 text-center text-sm text-ink-soft">
        hearing <span className="font-display text-ink">{liveNote}</span>
      </p>

      {/* two bars: mic volume (blue) + note hold (green) */}
      <div className="mt-5 space-y-2">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full bg-sky-500 transition-[width] duration-75"
            style={{ width: `${Math.min(100, Math.round(level * 350))}%` }}
          />
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full bg-emerald-500 transition-[width] duration-75"
            style={{ width: `${Math.round(holdProgress * 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex justify-between gap-2">
        <Button variant="outline" size="lg" onClick={() => void playReferenceA()}>
          🔊 Hear middle A
        </Button>
        <Button variant="outline" size="lg" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  )
}
