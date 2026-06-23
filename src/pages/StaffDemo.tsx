import { useState } from 'react'
import { Staff, type StaffNote } from '@/components/Staff'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { intervalBetween, describeInterval } from '@/lib/theory/intervals'
import { pitch, type Pitch } from '@/lib/theory/pitch'

export default function StaffDemo() {
  const base: Pitch = pitch('C', 4)
  const [moved, setMoved] = useState<Pitch>(pitch('E', 4))

  const notes: StaffNote[] = [
    { id: 'base', pitch: base, tone: 'given' },
    { id: 'moved', pitch: moved, draggable: true, tone: 'answer' },
  ]

  const interval = intervalBetween(base, moved)

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Staff drag demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Drag the purple note up and down. Tap it (or use the buttons) to
            change its accidental.
          </p>
          <Staff
            notes={notes}
            onNoteChange={(id, p) => id === 'moved' && setMoved(p)}
          />
          <p className="text-center text-sm">
            Interval from the gray C4:{' '}
            <span className="font-medium">
              {interval ? describeInterval(interval) : 'unrecognized spelling'}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
