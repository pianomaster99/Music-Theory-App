import { useState } from 'react'
import { HandPiano } from '@/components/HandPiano'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPitch, pitch, type Pitch } from '@/lib/theory/pitch'
import { useAuth } from '@/lib/auth/AuthProvider'
import { HAND_SKIN_FILTER } from '@/lib/profile'

export default function PianoDemo() {
  const [played, setPlayed] = useState<Pitch[]>([])
  const { profile } = useAuth()
  const skinFilter = HAND_SKIN_FILTER[profile?.handSkin ?? 'light']

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Hand & piano demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-soft">
            Drag the hand by its palm, fan each finger by dragging its tip
            (limited rotation), and click a fingertip to rest it on a key. Press
            Play to press the resting fingers. Target keys C–E–G are
            highlighted.
          </p>
          <HandPiano
            octaves={2}
            highlight={[pitch('C', 4), pitch('E', 4), pitch('G', 4)]}
            onPlay={setPlayed}
            skinFilter={skinFilter}
          />
          <p className="text-center text-sm">
            Last played:{' '}
            <span className="font-medium">
              {played.length ? played.map((p) => formatPitch(p)).join(' ') : '—'}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
