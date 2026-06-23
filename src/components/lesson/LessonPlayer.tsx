import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Staff, type StaffNote } from '@/components/Staff'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { ValidationResult } from '@/lib/content/validate'
import type { Lesson, Step } from '@/lib/content/types'
import { isProblemStep } from '@/lib/content/types'
import { nextLesson } from '@/content/course'
import { Mascot, type MascotMood } from './Mascot'
import { BuildIntervalView } from './BuildIntervalView'
import { IdentifyIntervalView } from './IdentifyIntervalView'

function defaultMascotMessage(step: Step): string {
  if (step.kind === 'concept') return 'Read this, then press Continue.'
  return step.prompt
}

export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [solved, setSolved] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [mascot, setMascot] = useState<{ message: string; mood: MascotMood }>({
    message: defaultMascotMessage(lesson.steps[0]),
    mood: 'neutral',
  })

  const step = lesson.steps[stepIndex]
  const total = lesson.steps.length
  const follow = useMemo(() => nextLesson(lesson.id), [lesson.id])

  useEffect(() => {
    setSolved(false)
    setMascot({ message: defaultMascotMessage(step), mood: 'neutral' })
  }, [step])

  const handleResult = (result: ValidationResult, message: string) => {
    setMascot({ message, mood: result.correct ? 'happy' : 'thinking' })
    if (result.correct) setSolved(true)
  }

  const canAdvance = step.kind === 'concept' || solved

  const advance = () => {
    if (stepIndex + 1 >= total) {
      setCompleted(true)
    } else {
      setStepIndex((i) => i + 1)
    }
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardContent className="space-y-5 py-8 text-center">
            <p className="text-5xl">{'\u2693'}</p>
            <h2 className="font-display text-3xl">Lesson complete!</h2>
            <p className="text-ink-soft">
              You finished &ldquo;{lesson.title}&rdquo;.
            </p>
            <div className="flex justify-center gap-3">
              {follow ? (
                <Button asChild>
                  <Link to={`/lesson/${follow.lesson.id}`}>
                    Next: {follow.lesson.title}
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/">Back to map</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <Link to="/" className="hover:underline">
            &larr; Map
          </Link>
          <span>
            Step {stepIndex + 1} of {total}
          </span>
        </div>
        <Progress value={((stepIndex + (canAdvance ? 1 : 0)) / total) * 100} />
        <h1 className="pt-2 font-display text-2xl">{lesson.title}</h1>
      </div>

      <Mascot message={mascot.message} mood={mascot.mood} />

      <Card>
        <CardContent className="py-6">
          <StepBody
            key={step.id}
            step={step}
            solved={solved}
            onResult={handleResult}
          />
        </CardContent>
      </Card>

      {canAdvance && (
        <div className="flex justify-end">
          <Button onClick={advance}>
            {stepIndex + 1 >= total ? 'Finish' : 'Continue'}
          </Button>
        </div>
      )}
    </div>
  )
}

function StepBody({
  step,
  solved,
  onResult,
}: {
  step: Step
  solved: boolean
  onResult: (result: ValidationResult, message: string) => void
}) {
  if (step.kind === 'concept') {
    const visual: StaffNote[] | null = step.visualPitches
      ? step.visualPitches.map((p, i) => ({
          id: `v${i}`,
          pitch: p,
          tone: 'given' as const,
        }))
      : null
    return (
      <div className="space-y-4">
        <h2 className="font-display text-xl">{step.title}</h2>
        <p className="leading-relaxed text-ink">{step.body}</p>
        {visual && <Staff notes={visual} />}
      </div>
    )
  }

  if (!isProblemStep(step)) return null

  return (
    <div className="space-y-4">
      <p className="text-center text-lg text-ink">{step.prompt}</p>
      {step.kind === 'buildInterval' && (
        <BuildIntervalView step={step} solved={solved} onResult={onResult} />
      )}
      {step.kind === 'identifyInterval' && (
        <IdentifyIntervalView step={step} solved={solved} onResult={onResult} />
      )}
      {(step.kind === 'buildChord' || step.kind === 'identifyChord') && (
        <p className="text-center text-sm text-ink-soft">
          This problem type is coming soon.
        </p>
      )}
    </div>
  )
}
