import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CHORD_TABLE, FEEL_LABEL, INTERVAL_TABLE } from '@/content/reference'
import { ensureAudio, playPitches } from '@/lib/audio'
import { formatPitch, type Pitch } from '@/lib/theory/pitch'
import type { ConsonanceFeel } from '@/content/generate'

const FEEL_STYLES: Record<ConsonanceFeel, string> = {
  perfect: 'bg-[#dfeae0] text-[#2f5d3a] border-[#2f5d3a]/40',
  consonant: 'bg-[#e6ecf6] text-[#2f4a6d] border-[#2f4a6d]/40',
  dissonant: 'bg-[#f6e3e0] text-[#7a2f2f] border-[#7a2f2f]/40',
}

function HearButton({ pitches, kind }: { pitches: Pitch[]; kind: 'chord' | 'melodic' }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await ensureAudio()
        playPitches(pitches, kind)
      }}
      className="rounded-md border-2 border-ink/30 px-2 py-1 text-xs text-ink transition-colors hover:bg-ink/10"
      aria-label="Hear example"
    >
      ▶ Hear
    </button>
  )
}

export function ReferenceTable() {
  const [tab, setTab] = useState<'intervals' | 'chords'>('intervals')

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Reference
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Reference table</DialogTitle>
          <DialogDescription>
            Intervals and chords with their make-up — and a playable example of each.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3 flex gap-2">
          {(['intervals', 'chords'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md border-2 border-ink/40 px-3 py-1.5 text-sm capitalize text-ink transition-colors hover:bg-ink/10',
                tab === t && 'bg-ink text-parchment hover:bg-ink',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'intervals' ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ink/30 text-left text-ink-soft">
                <th className="py-2 pr-2">Interval</th>
                <th className="px-2">Half steps</th>
                <th className="px-2">Feel</th>
                <th className="px-2">Example (from C)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {INTERVAL_TABLE.map((row) => (
                <tr key={row.short} className="border-b border-ink/15">
                  <td className="py-2 pr-2">
                    <span className="font-medium text-ink">{row.name}</span>{' '}
                    <span className="text-ink-soft">({row.short})</span>
                  </td>
                  <td className="px-2 text-ink">{row.halfSteps}</td>
                  <td className="px-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs',
                        FEEL_STYLES[row.feel],
                      )}
                    >
                      {FEEL_LABEL[row.feel]}
                    </span>
                  </td>
                  <td className="px-2 text-ink">
                    {row.example.map((p) => formatPitch(p)).join('–')}
                  </td>
                  <td className="px-2">
                    <HearButton pitches={row.example} kind="melodic" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ink/30 text-left text-ink-soft">
                <th className="py-2 pr-2">Chord</th>
                <th className="px-2">Stacked intervals</th>
                <th className="px-2">Example</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {CHORD_TABLE.map((row) => (
                <tr key={row.quality} className="border-b border-ink/15">
                  <td className="py-2 pr-2 font-medium capitalize text-ink">
                    {row.label}
                  </td>
                  <td className="px-2 text-ink">{row.formula.join(' + ')}</td>
                  <td className="px-2 text-ink">
                    {row.example.map((p) => formatPitch(p)).join(' ')}
                  </td>
                  <td className="px-2">
                    <HearButton pitches={row.example} kind="chord" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  )
}
