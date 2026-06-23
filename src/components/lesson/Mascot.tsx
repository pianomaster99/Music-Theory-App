import { cn } from '@/lib/utils'

export type MascotMood = 'neutral' | 'happy' | 'thinking'

const FACE: Record<MascotMood, string> = {
  neutral: '\u266A', // ♪
  happy: '\u266B', // ♫
  thinking: '\u266A',
}

export function Mascot({
  message,
  mood = 'neutral',
}: {
  message: string
  mood?: MascotMood
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-ink/50 text-2xl text-parchment',
          mood === 'happy' ? 'bg-[#6b8f3a]' : 'bg-ink',
        )}
        aria-hidden
      >
        {FACE[mood]}
      </div>
      <div className="relative flex-1 rounded-md border-2 border-ink/40 bg-parchment/70 px-4 py-3 text-ink">
        <p className="text-xs uppercase tracking-widest text-ink-soft">
          Pianomaster99
        </p>
        <p className="mt-0.5 leading-snug">{message}</p>
      </div>
    </div>
  )
}
