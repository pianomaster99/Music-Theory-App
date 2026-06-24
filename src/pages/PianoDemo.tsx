import { useState } from 'react'
import { HandPiano } from '@/components/HandPiano'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatPitch, pitch, type Pitch } from '@/lib/theory/pitch'
import { HAND_SKINS, HAND_SKIN_FILTER, type HandSkin } from '@/lib/profile'

export default function PianoDemo() {
  const [played, setPlayed] = useState<Pitch[]>([])
  const [skin, setSkin] = useState<HandSkin>('light')

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-3xl">
            Cartoon hand — design preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-lg text-ink-soft">
            Drag the hand to move it, drag a fingertip to aim &amp; curl it, and
            tap a fingertip to rest it on a key. Targets{' '}
            <strong>C, E, G and the black key A&#9839;</strong> are highlighted —
            try to reach all four.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-ink-soft">Skin tone:</span>
            {HAND_SKINS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-label={s.label}
                onClick={() => setSkin(s.id)}
                className={cn(
                  'h-9 w-9 rounded-full border-2 transition-transform',
                  skin === s.id ? 'scale-110 border-ink' : 'border-ink/30',
                )}
                style={{ backgroundColor: s.swatch }}
              />
            ))}
          </div>

          <div className="rounded-2xl border-4 border-ink/20 bg-parchment/40 p-3">
            <HandPiano
              octaves={2}
              highlight={[
                pitch('C', 4),
                pitch('E', 4),
                pitch('G', 4),
                pitch('A', 4, 1),
              ]}
              onPlay={setPlayed}
              skinFilter={HAND_SKIN_FILTER[skin]}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-lg">
              Last played:{' '}
              <span className="font-semibold">
                {played.length
                  ? played.map((p) => formatPitch(p)).join(' · ')
                  : '—'}
              </span>
            </p>
            <Button variant="outline" onClick={() => setPlayed([])}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
