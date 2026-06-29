import { useEffect, useState } from 'react'
import { PianoMascot } from './PianoMascot'

export type MascotMood = 'neutral' | 'happy' | 'thinking'

export function Mascot({
  message,
  mood = 'neutral',
  slapToken = 0,
}: {
  message: string
  mood?: MascotMood
  /** Incremented on each wrong answer to trigger the ruler-slap reaction. */
  slapToken?: number
}) {
  const [slapping, setSlapping] = useState(false)
  const [estTalking, setEstTalking] = useState(false)

  useEffect(() => {
    if (slapToken <= 0) return
    // Defer the "on" flip out of the effect body (avoids cascading renders).
    const raf = requestAnimationFrame(() => setSlapping(true))
    const t = setTimeout(() => setSlapping(false), 1300)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [slapToken])

  // Animate the mouth for an estimated duration whenever a new line appears, so
  // the keyboard "talks" as Pianomaster99's message comes in.
  useEffect(() => {
    if (!message) return
    const words = message.trim().split(/\s+/).length
    const ms = Math.min(5000, Math.max(900, words * 280))
    const raf = requestAnimationFrame(() => setEstTalking(true))
    const t = setTimeout(() => setEstTalking(false), ms)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [message])

  const talking = estTalking && !slapping

  const motion = slapping
    ? 'animate-mascot-wrong-dance'
    : talking
      ? 'animate-mascot-fly'
      : 'animate-mascot-hover'

  return (
    <div className="flex items-start gap-3">
      <div className="relative shrink-0">
        <PianoMascot
          mood={mood}
          talking={talking}
          slapping={slapping}
          className={`h-24 w-20 ${motion}`}
        />
        {slapping && (
          <span
            className="animate-ruler-swing pointer-events-none absolute -right-2 top-0 text-2xl"
            aria-hidden
          >
            📏
          </span>
        )}
      </div>
      <div className="relative flex-1 rounded-2xl border-2 border-ink/40 bg-parchment/80 px-4 py-3 text-ink shadow-[0_3px_0_rgba(74,53,38,0.25)]">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          Pianomaster99
        </p>
        <p className="mt-0.5 text-xl leading-snug">{message}</p>
      </div>
    </div>
  )
}
