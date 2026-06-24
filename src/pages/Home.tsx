import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { course } from '@/content/course'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useCourseProgress } from '@/lib/progress/useCourseProgress'
import type { LessonState, LessonStatus } from '@/lib/progress/courseProgress'
import type { Achievement } from '@/lib/progress/achievements'
import type { StreakState } from '@/lib/progress/streak'

const STATUS_LABEL: Record<LessonStatus, string> = {
  complete: 'Charted',
  'in-progress': 'In progress',
  available: 'Ready',
  locked: 'Locked',
}

function actionLabel(status: LessonStatus): string {
  switch (status) {
    case 'complete':
      return 'Review'
    case 'in-progress':
      return 'Continue'
    case 'available':
      return 'Start lesson'
    case 'locked':
      return 'Locked'
  }
}

export default function Home() {
  const { user, signOutUser } = useAuth()
  const { states, recommended, totals, streak, achievements, loading } =
    useCourseProgress()
  const firstName = user?.displayName?.split(' ')[0]

  const stateById = new Map<string, LessonState>(
    states.map((s) => [s.location.lesson.id, s]),
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-ink-soft">
        <span className="font-display text-lg text-ink">
          {firstName ? `Ahoy, ${firstName}` : 'Ahoy'}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {!loading && <StreakChip streak={streak} />}
          <Button variant="ghost" size="sm" onClick={() => void signOutUser()}>
            Sign out
          </Button>
        </div>
      </div>

      <header className="mb-8 text-center">
        <p className="text-sm uppercase tracking-widest text-ink-soft">
          A learn-by-doing chart
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">
          The Music Theory Map
        </h1>
        <p className="mx-auto mt-3 max-w-prose text-base text-ink-soft sm:text-lg">
          Chart a course through music theory by doing, not memorizing. Drag
          notes, build intervals, and let Pianomaster99 guide you.
        </p>
      </header>

      {!loading && (
        <div className="mb-8">
          <NextStep recommended={recommended} />
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-sm text-ink-soft">
              <span>Voyage progress</span>
              <span>
                {totals.completed} / {totals.total} lessons charted
              </span>
            </div>
            <Progress
              value={
                totals.total > 0
                  ? (totals.completed / totals.total) * 100
                  : 0
              }
            />
          </div>
        </div>
      )}

      <div className="space-y-8">
        {course.modules.map((module) => (
          <section key={module.id}>
            <h2 className="font-display text-3xl text-ink">{module.title}</h2>
            <p className="mb-4 text-ink-soft">{module.description}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {module.lessons.map((lesson, i) => {
                const state = stateById.get(lesson.id)
                const status = state?.status ?? 'available'
                const locked = status === 'locked'
                return (
                  <Card
                    key={lesson.id}
                    className={
                      'h-full ' + (locked ? 'opacity-60' : '')
                    }
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-lg">
                          {i + 1}. {lesson.title}
                        </CardTitle>
                        <Badge
                          variant={
                            status === 'complete' ? 'default' : 'secondary'
                          }
                        >
                          {STATUS_LABEL[status]}
                        </Badge>
                      </div>
                      <CardDescription>{lesson.summary}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {state && state.problemCount > 0 && status !== 'locked' && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-ink-soft">
                            <span>Mastery</span>
                            <span>
                              {state.solvedCount} / {state.problemCount} problems
                            </span>
                          </div>
                          <Progress value={state.mastery * 100} />
                        </div>
                      )}
                      {locked ? (
                        <Button disabled variant="outline">
                          Locked
                        </Button>
                      ) : (
                        <Button asChild>
                          <Link to={`/lesson/${lesson.id}`}>
                            {actionLabel(status)}
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {!loading && (
        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Trophies</h2>
          <p className="mb-4 text-ink-soft">
            Earn these as you explore the map.
          </p>
          <Achievements achievements={achievements} />
        </section>
      )}
    </div>
  )
}

function StreakChip({ streak }: { streak: StreakState | null }) {
  const count = streak?.currentStreak ?? 0
  const active = count > 0
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-sm font-medium ' +
        (active
          ? 'border-ink/40 text-ink'
          : 'border-ink/20 text-ink-soft')
      }
      title="Daily practice streak"
    >
      <span aria-hidden>{'\u{1F525}'}</span>
      {active ? `${count}-day streak` : 'No streak yet'}
    </span>
  )
}

function Achievements({ achievements }: { achievements: Achievement[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {achievements.map((a) => (
        <div
          key={a.id}
          className={
            'flex items-start gap-3 rounded-lg border-2 p-3 ' +
            (a.earned
              ? 'border-ink/40 bg-parchment/60'
              : 'border-ink/15 opacity-50')
          }
          title={a.earned ? 'Earned' : 'Locked'}
        >
          <span className="text-2xl" aria-hidden>
            {a.earned ? a.icon : '\u{1F512}'}
          </span>
          <div>
            <p className="font-display text-base leading-tight text-ink">
              {a.title}
            </p>
            <p className="text-xs text-ink-soft">{a.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function NextStep({ recommended }: { recommended: LessonState | undefined }) {
  if (!recommended) {
    return (
      <Card className="border-2 border-ink/40 bg-parchment/60">
        <CardContent className="flex items-center gap-4 py-6">
          <span className="text-4xl">{'\u2693'}</span>
          <div>
            <p className="font-display text-xl text-ink">
              You&rsquo;ve charted the whole map!
            </p>
            <p className="text-ink-soft">
              Every lesson is complete. Revisit any island to keep your skills
              sharp.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { lesson } = recommended.location
  const verb = recommended.status === 'in-progress' ? 'Continue' : 'Start'
  return (
    <Card className="border-2 border-ink/40 bg-parchment/60">
      <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-ink-soft">
            {recommended.status === 'in-progress'
              ? 'Pick up where you left off'
              : 'Your next heading'}
          </p>
          <p className="mt-1 font-display text-2xl text-ink">{lesson.title}</p>
          <p className="text-ink-soft">{lesson.summary}</p>
        </div>
        <Button asChild size="lg">
          <Link to={`/lesson/${lesson.id}`}>{verb}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
