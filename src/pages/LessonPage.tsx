import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { LessonPlayer } from '@/components/lesson/LessonPlayer'
import { getLessonLocation } from '@/content/course'

export default function LessonPage() {
  const { lessonId } = useParams()
  const location = lessonId ? getLessonLocation(lessonId) : undefined

  if (!location) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl">Lesson not found</h1>
        <p className="mt-2 text-ink-soft">
          We couldn&rsquo;t find a lesson called &ldquo;{lessonId}&rdquo;.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Back to map</Link>
        </Button>
      </div>
    )
  }

  return <LessonPlayer lesson={location.lesson} />
}
