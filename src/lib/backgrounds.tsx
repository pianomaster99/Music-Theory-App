import type { CSSProperties, ReactNode } from 'react'

// The app uses a single fixed backdrop: the treasure-map parchment. The lesson
// stage frame borrows these colours so it reads as part of the same scene.
export const STAGE = {
  emoji: '🗺️',
  caption: 'on the old map',
  ring: '#7a5a36',
}

const LAYER_STYLE: CSSProperties = {
  background:
    'radial-gradient(120% 120% at 50% 0%, #efe0bd 0%, #e3cd9f 55%, #d3b87f 100%)',
}

/** Paints the fixed parchment backdrop behind the whole app. */
export function AppBackground({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10" style={LAYER_STYLE} />
      {children}
    </>
  )
}
