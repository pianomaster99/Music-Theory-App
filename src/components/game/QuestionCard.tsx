import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatPitch, pitchFromMidi, type Pitch } from '@/lib/theory/pitch'
import { playReferenceA } from '@/lib/audio'
import GameStaff from './GameStaff'
import type { PitchReading } from '@/lib/pitch/detector'
import type { Question } from '@/lib/game/types'

interface Props {
  question: Question
  index: number
  total: number
  /** Registered (correct-so-far) notes, shown on the staff. */
  capturedNotes: Pitch[]
  /** Brief flag set when a wrong note was sung (shakes + red-tints the staff). */
  wrong: boolean
  /** Brief flag set when the last correct answer counted as a double (2x) boost. */
  bonus: boolean
  holdProgress: number
  reading: PitchReading | null
  level: number
  onSkip: () => void
  justCorrect: boolean
}

export default function QuestionCard({
  question,
  capturedNotes,
  wrong,
  bonus,
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
        'relative overflow-hidden rounded-2xl border-2 bg-parchment/70 p-6 transition-colors',
        bonus
          ? 'border-orange-500'
          : justCorrect
            ? 'border-emerald-500'
            : 'border-ink/30',
      )}
    >
      {bonus && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl">
          <style>{`
            @keyframes bonusglow{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
            @keyframes bonuspop{0%{transform:scale(0.4);opacity:0}30%{transform:scale(1.15);opacity:1}80%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
            @keyframes flamerise{0%{transform:translateY(20px) scale(0.8);opacity:0}30%{opacity:1}100%{transform:translateY(-44px) scale(1.25);opacity:0}}
          `}</style>
          <div className="absolute inset-0 bg-gradient-to-t from-orange-500/40 via-amber-400/15 to-transparent animate-[bonusglow_1.1s_ease-out]" />
          <div className="absolute inset-x-0 bottom-0 flex justify-around">
            {Array.from({ length: 11 }).map((_, i) => (
              <span
                key={i}
                className="text-3xl animate-[flamerise_1.1s_ease-out]"
                style={{ animationDelay: `${i * 55}ms` }}
              >
                🔥
              </span>
            ))}
          </div>
          <div className="absolute inset-x-0 top-6 flex justify-center">
            <span className="rounded-full bg-gradient-to-b from-amber-400 to-orange-600 px-5 py-1.5 font-display text-2xl text-white shadow-[0_3px_0_rgba(120,50,0,0.4)] animate-[bonuspop_1.1s_ease-out]">
              🔥 2× BOOST! 🔥
            </span>
          </div>
        </div>
      )}

      {/* the question */}
      <p className="text-center font-display text-2xl leading-snug text-ink">
        {question.prompt}
      </p>

      {/* registered notes on a grand staff — the focal point */}
      <div className="mt-5">
        <GameStaff notes={capturedNotes} need={need} wrong={wrong} />
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
