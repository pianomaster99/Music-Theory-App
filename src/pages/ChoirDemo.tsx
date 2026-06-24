import { useState } from 'react'
import { Choir, type ChoirTheme } from '@/components/Choir'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPitch, pitch, type Pitch } from '@/lib/theory/pitch'

const THEMES: { id: ChoirTheme; label: string; emoji: string; blurb: string }[] = [
  { id: 'angels', label: 'Angels', emoji: '😇', blurb: 'Haloed cherubs in flowing robes.' },
  { id: 'argentina', label: 'Argentina XI', emoji: '⚽', blurb: 'The sky-blue-and-white chanting squad.' },
  { id: 'orange', label: 'Talking oranges', emoji: '🍊', blurb: 'Cheeky citrus with a big mouth.' },
]

const TARGET: Pitch[] = [pitch('C', 4), pitch('E', 4), pitch('G', 4)]

export default function ChoirDemo() {
  const [theme, setTheme] = useState<ChoirTheme>('angels')
  const [holding, setHolding] = useState<Pitch[]>([])

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Choir preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-ink-soft">
            You are the conductor at the stand. There are two octaves of singers —
            one per note. Click a singer and they hold (sustain) their note; click
            them again to stop. The magical baton waves toward whoever you picked.
            The ⭐ singers are the C–E–G target for this demo.
          </p>

          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <Button
                key={t.id}
                variant={theme === t.id ? 'default' : 'outline'}
                onClick={() => setTheme(t.id)}
              >
                <span className="mr-1">{t.emoji}</span>
                {t.label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-ink-soft">
            {THEMES.find((t) => t.id === theme)?.blurb}
          </p>

          <div className="rounded-2xl border-2 border-ink/25 bg-parchment/40 p-2">
            <Choir
              key={theme}
              theme={theme}
              startPitch={pitch('C', 4)}
              octaves={2}
              highlight={TARGET}
              onChange={setHolding}
            />
          </div>

          <p className="text-center">
            Holding:{' '}
            <span className="font-bold">
              {holding.length
                ? holding.map((p) => formatPitch(p, { unicode: true })).join(' · ')
                : '—'}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
