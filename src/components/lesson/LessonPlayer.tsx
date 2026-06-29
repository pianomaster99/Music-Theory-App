import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Staff, type StaffNote } from '@/components/Staff'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ensureAudio, playPitches, playThwack } from '@/lib/audio'
import type { ValidationResult } from '@/lib/content/validate'
import type { Lesson, Step } from '@/lib/content/types'
import { isProblemStep } from '@/lib/content/types'
import { getLessonLocation, nextLesson } from '@/content/course'
import { useAuth } from '@/lib/auth/AuthProvider'
import { loadLessonProgress, saveLessonProgress } from '@/lib/progress/progress'
import { recordActivity } from '@/lib/progress/streak'
import { ReferenceTable } from '@/components/ReferenceTable'
import { LessonStage } from '@/components/LessonStage'
import {
  cancelSpeech,
  isSpeechEnabled,
  isSpeechSupported,
  setSpeechEnabled,
  speak,
} from '@/lib/speech'
import { Mascot, type MascotMood } from './Mascot'
import { ConceptDemo } from './ConceptDemo'
import { BuildIntervalView } from './BuildIntervalView'
import { IdentifyIntervalView } from './IdentifyIntervalView'
import { BuildChordView } from './BuildChordView'
import { IdentifyChordView } from './IdentifyChordView'

function defaultMascotMessage(step: Step): string {
  if (step.kind === 'concept') return 'Read this, then press Continue.'
  return step.prompt
}

export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const { user } = useAuth()
  const [stepIndex, setStepIndex] = useState(0)
  const [solved, setSolved] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const completedStepIds = useRef<string[]>([])
  const activityRecorded = useRef(false)
  const [mascot, setMascot] = useState<{ message: string; mood: MascotMood }>({
    message: defaultMascotMessage(lesson.steps[0]),
    mood: 'neutral',
  })

  const [speechOn, setSpeechOn] = useState(isSpeechEnabled())
  const [slapToken, setSlapToken] = useState(0)

  const step = lesson.steps[stepIndex]
  const total = lesson.steps.length
  const follow = useMemo(() => nextLesson(lesson.id), [lesson.id])
  // Whether finishing this lesson also completes its module (boundary or course
  // end) — if so, we nudge the learner toward the game to build fluency.
  const moduleDone = useMemo(() => {
    const here = getLessonLocation(lesson.id)
    if (!here) return false
    return !follow || follow.module.id !== here.module.id
  }, [lesson.id, follow])

  // Whenever Pianomaster99 puts text in his bubble, he says it out loud. We
  // set the bubble and speak together (rather than reacting to message changes)
  // so identical lines — e.g. the same feedback twice — still get spoken.
  const say = (message: string, mood: MascotMood) => {
    setMascot({ message, mood })
    speak(message)
  }

  useEffect(() => () => cancelSpeech(), [])

  const toggleSpeech = () => {
    const next = !speechOn
    setSpeechEnabled(next)
    setSpeechOn(next)
    if (next) speak(mascot.message)
  }

  // Persist the learner's place in this lesson.
  const persist = (currentStepIndex: number, isCompleted: boolean) => {
    if (!user) return
    void saveLessonProgress(user.uid, lesson.id, {
      currentStepIndex,
      completedStepIds: completedStepIds.current,
      completed: isCompleted,
    }).catch(() => {
      toast.error('Could not save your progress.')
    })
  }

  // Load saved progress and resume where the learner left off.
  useEffect(() => {
    if (!user) {
      setHydrated(true)
      return
    }
    let cancelled = false
    loadLessonProgress(user.uid, lesson.id)
      .then((p) => {
        if (cancelled) return
        if (p) {
          completedStepIds.current = p.completedStepIds
          const resumeIndex = p.completed
            ? 0
            : Math.min(Math.max(p.currentStepIndex, 0), lesson.steps.length - 1)
          setStepIndex(resumeIndex)
          const resumeStep = lesson.steps[resumeIndex]
          setSolved(
            resumeStep.kind !== 'concept' &&
              p.completedStepIds.includes(resumeStep.id),
          )
          if (!p.completed && resumeIndex > 0) {
            toast('Resumed where you left off.')
          }
        }
        setHydrated(true)
      })
      .catch(() => setHydrated(true))
    return () => {
      cancelled = true
    }
  }, [user, lesson.id, lesson.steps])

  useEffect(() => {
    setSolved(
      step.kind !== 'concept' && completedStepIds.current.includes(step.id),
    )
    const msg = defaultMascotMessage(step)
    setMascot({ message: msg, mood: 'neutral' })
    // On concept steps, read the actual teaching text aloud (not just the short
    // "read this" bubble), so Pianomaster99 narrates everything he shows.
    speak(step.kind === 'concept' ? `${step.title}. ${step.body}` : msg)
  }, [step])

  const handleResult = (result: ValidationResult, message: string) => {
    say(message, result.correct ? 'happy' : 'thinking')
    if (result.correct) {
      setSolved(true)
      if (!completedStepIds.current.includes(step.id)) {
        completedStepIds.current = [...completedStepIds.current, step.id]
      }
      persist(stepIndex, false)
      recordPractice()
    } else {
      // Pianomaster99 raps the hand with a ruler on a wrong answer.
      setSlapToken((t) => t + 1)
      void playThwack()
    }
  }

  // Pianomaster99 reads the hint aloud and shows it in his speech bubble.
  const handleHint = (text: string) => {
    say(text, 'thinking')
  }

  // Update the daily streak once per lesson session, on first solve.
  const recordPractice = () => {
    if (!user || activityRecorded.current) return
    activityRecorded.current = true
    void recordActivity(user.uid)
      .then(({ state, advanced }) => {
        if (advanced && state.currentStreak > 1) {
          toast(`\u{1F525} ${state.currentStreak}-day streak!`)
        }
      })
      .catch(() => {
        activityRecorded.current = false
      })
  }

  const canAdvance = step.kind === 'concept' || solved

  const advance = () => {
    const nextIndex = stepIndex + 1
    if (nextIndex >= total) {
      setCompleted(true)
      persist(stepIndex, true)
    } else {
      setStepIndex(nextIndex)
      persist(nextIndex, false)
    }
  }

  if (user && !hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center font-display text-2xl text-ink-soft">
        Finding your place...
      </div>
    )
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
            <div className="flex flex-wrap justify-center gap-3">
              {follow ? (
                <Button asChild>
                  <Link to={`/lesson/${follow.lesson.id}`}>
                    Next: {follow.lesson.title}
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/map">Back to map</Link>
              </Button>
            </div>

            {moduleDone && (
              <div className="mt-2 rounded-xl border-2 border-ink/20 bg-parchment-dark/40 p-4">
                <p className="font-display text-lg text-ink">
                  🚀 Make it fluent
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  You just finished a whole module. Race your ears in the Pitch
                  Rocket Race to lock it in.
                </p>
                <Button asChild className="mt-3">
                  <Link to="/play">Play the game</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
          <Link to="/map" className="hover:underline">
            &larr; Map
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {isSpeechSupported() && (
              <button
                type="button"
                onClick={toggleSpeech}
                className="hover:underline"
                aria-label={speechOn ? 'Mute tutor voice' : 'Unmute tutor voice'}
              >
                {speechOn ? '🔊 Voice' : '🔇 Voice'}
              </button>
            )}
            <ReferenceTable />
            <span>
              Step {stepIndex + 1} of {total}
            </span>
          </div>
        </div>
        <Progress value={((stepIndex + (canAdvance ? 1 : 0)) / total) * 100} />
        <h1 className="pt-2 font-display text-3xl">{lesson.title}</h1>
      </div>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-6">
          <Mascot
            message={mascot.message}
            mood={mascot.mood}
            slapToken={slapToken}
          />
        </aside>

        <main className="space-y-5">
          <LessonStage resetKey={step.id}>
            <StepBody
              key={step.id}
              step={step}
              solved={solved}
              onResult={handleResult}
              onHint={handleHint}
            />
          </LessonStage>

          {canAdvance && (
            <div className="flex justify-end">
              <Button onClick={advance}>
                {stepIndex + 1 >= total ? 'Finish' : 'Continue'}
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function StepBody({
  step,
  solved,
  onResult,
  onHint,
}: {
  step: Step
  solved: boolean
  onResult: (result: ValidationResult, message: string) => void
  onHint: (text: string) => void
}) {
  if (step.kind === 'concept') {
    const visual: StaffNote[] | null = step.visualPitches
      ? step.visualPitches.map((p, i) => ({
          id: `v${i}`,
          pitch: p,
          tone: 'given' as const,
        }))
      : null
    const demoFeature =
      step.demoFeature === 'piano' || step.demoFeature === 'choir'
        ? step.demoFeature
        : null
    return (
      <div className="space-y-4">
        <h2 className="font-display text-2xl">{step.title}</h2>
        <p className="text-lg leading-relaxed text-ink">{step.body}</p>
        {step.visualPitches && demoFeature ? (
          <ConceptDemo
            feature={demoFeature}
            pitches={step.visualPitches}
            seed={step.id}
          />
        ) : (
          visual && <Staff notes={visual} />
        )}
        {step.visualPitches && step.visualPitches.length > 0 && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={async () => {
                await ensureAudio()
                playPitches(step.visualPitches!, 'melodic')
              }}
            >
              Hear it
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (!isProblemStep(step)) return null

  return (
    <div className="space-y-4">
      <p className="text-center text-xl text-ink">{step.prompt}</p>
      {step.kind === 'buildInterval' && (
        <BuildIntervalView
          step={step}
          solved={solved}
          onResult={onResult}
          onHint={onHint}
        />
      )}
      {step.kind === 'identifyInterval' && (
        <IdentifyIntervalView
          step={step}
          solved={solved}
          onResult={onResult}
          onHint={onHint}
        />
      )}
      {step.kind === 'buildChord' && (
        <BuildChordView
          step={step}
          solved={solved}
          onResult={onResult}
          onHint={onHint}
        />
      )}
      {step.kind === 'identifyChord' && (
        <IdentifyChordView
          step={step}
          solved={solved}
          onResult={onResult}
          onHint={onHint}
        />
      )}
    </div>
  )
}
