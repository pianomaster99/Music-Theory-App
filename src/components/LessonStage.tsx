import type { ReactNode } from 'react'
import { STAGE } from '@/lib/backgrounds'
import { StagePointerProvider } from './lesson/StagePointer'

/** Wraps the interactive area in a treasure-map frame so it reads as part of
 * the scene. `resetKey` (the step id) remounts the pointer overlay between
 * problems. */
export function LessonStage({
  children,
  resetKey,
}: {
  children: ReactNode
  resetKey?: string
}) {
  return (
    <div
      className="relative rounded-2xl border-4 p-4 pt-6 shadow-lg"
      style={{ borderColor: STAGE.ring, background: 'rgba(253, 248, 238, 0.94)' }}
    >
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-medium text-white shadow"
        style={{ backgroundColor: STAGE.ring }}
      >
        {STAGE.emoji} {STAGE.caption}
      </div>
      <StagePointerProvider key={resetKey}>{children}</StagePointerProvider>
    </div>
  )
}
