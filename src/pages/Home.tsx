import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function Home() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Learn by doing
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Music Theory, one interaction at a time
        </h1>
        <p className="text-lg text-muted-foreground">
          Drag notes onto a staff, build intervals and chords, and get instant
          feedback. No memorizing &mdash; you figure it out.
        </p>
      </div>

      <Card className="w-full text-left">
        <CardHeader>
          <CardTitle>Intervals</CardTitle>
          <CardDescription>
            Start here. Learn how distances between notes work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/lesson/demo">Start the first lesson</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
