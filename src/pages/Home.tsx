import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { course } from '@/content/course'
import { useAuth } from '@/lib/auth/AuthProvider'

export default function Home() {
  const { user, signOutUser } = useAuth()
  const firstName = user?.displayName?.split(' ')[0]

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between text-ink-soft">
        <span className="font-display text-lg text-ink">
          {firstName ? `Ahoy, ${firstName}` : 'Ahoy'}
        </span>
        <Button variant="ghost" size="sm" onClick={() => void signOutUser()}>
          Sign out
        </Button>
      </div>
      <header className="mb-10 text-center">
        <p className="text-sm uppercase tracking-widest text-ink-soft">
          A learn-by-doing chart
        </p>
        <h1 className="mt-2 font-display text-5xl text-ink">
          The Music Theory Map
        </h1>
        <p className="mx-auto mt-3 max-w-prose text-lg text-ink-soft">
          Chart a course through music theory by doing, not memorizing. Drag
          notes, build intervals, and let Pianomaster99 guide you.
        </p>
      </header>

      <div className="space-y-8">
        {course.modules.map((module) => (
          <section key={module.id}>
            <h2 className="font-display text-2xl text-ink">{module.title}</h2>
            <p className="mb-4 text-ink-soft">{module.description}</p>
            <div className="space-y-3">
              {module.lessons.map((lesson, i) => (
                <Card key={lesson.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {i + 1}. {lesson.title}
                    </CardTitle>
                    <CardDescription>{lesson.summary}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild>
                      <Link to={`/lesson/${lesson.id}`}>Start lesson</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
