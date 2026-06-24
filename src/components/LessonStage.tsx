import type { ReactNode } from 'react'
import { useBackground } from '@/lib/backgrounds'

/** Wraps the interactive area in a themed frame so the backdrop engages with
 * the lesson (e.g. "locked in an eerie dungeon", "floating over candyland"). */
export function LessonStage({ children }: { children: ReactNode }) {
  const { theme } = useBackground()
  return (
    <div
      className="relative rounded-2xl border-4 p-4 pt-6 shadow-lg"
      style={{ borderColor: theme.ring, background: 'rgba(253, 248, 238, 0.94)' }}
    >
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-medium text-white shadow"
        style={{ backgroundColor: theme.ring }}
      >
        {theme.emoji} {theme.stage}
      </div>
      {children}
    </div>
  )
}
