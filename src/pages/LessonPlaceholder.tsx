import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function LessonPlaceholder() {
  const { lessonId } = useParams()
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Lesson: {lessonId}</h1>
      <p className="text-muted-foreground">
        The interactive lesson player will live here.
      </p>
      <Button asChild variant="outline">
        <Link to="/">Back home</Link>
      </Button>
    </div>
  )
}
