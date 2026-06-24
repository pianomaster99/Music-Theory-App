import { useCallback, useRef, useState, type ReactNode } from 'react'
import { PianoMascot } from './PianoMascot'
import { StagePointerContext } from './stagePointerContext'

interface PointState {
  /** Target marker, relative to the stage box. */
  tx: number
  ty: number
  /** Top-left of the flying mascot, relative to the stage box. */
  mx: number
  my: number
  /** Pointing-hand origin and rotation toward the target. */
  hx: number
  hy: number
  angle: number
  message?: string
}

const MASCOT_W = 66
const MASCOT_H = 84

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Wraps the interactive area and lends children a `point()` helper. When a
 * learner slips up, Pianomaster99 zooms into the example and points his hand at
 * the spot. The overlay never intercepts pointer events.
 */
export function StagePointerProvider({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | null>(null)
  const [state, setState] = useState<PointState | null>(null)

  const clear = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = null
    setState(null)
  }, [])

  const point = useCallback((el: Element | null, message?: string) => {
    const stage = stageRef.current
    if (!stage || !el) return
    const c = stage.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const tx = r.left - c.left + r.width / 2
    const ty = r.top - c.top + r.height / 2

    // Park the mascot up-and-to-the-side of the target, kept inside the stage.
    const preferLeft = tx > c.width / 2
    const centerX = clamp(
      tx + (preferLeft ? -96 : 96),
      MASCOT_W / 2 + 4,
      c.width - MASCOT_W / 2 - 4,
    )
    const centerY = clamp(ty - 86, MASCOT_H / 2 + 4, c.height - MASCOT_H / 2 - 4)
    const angle = (Math.atan2(ty - centerY, tx - centerX) * 180) / Math.PI

    setState({
      tx,
      ty,
      mx: centerX - MASCOT_W / 2,
      my: centerY - MASCOT_H / 2,
      hx: centerX,
      hy: centerY,
      angle,
      message,
    })
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setState(null), 4600)
  }, [])

  return (
    <StagePointerContext.Provider value={{ point, clear }}>
      <div ref={stageRef} className="relative">
        {children}
        {state && (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
            {/* Pulsing ring marking the spot */}
            <span
              className="animate-pointer-ping absolute rounded-full"
              style={{
                left: state.tx - 18,
                top: state.ty - 18,
                width: 36,
                height: 36,
                border: '3px solid #c2410c',
              }}
            />
            {/* The pointing hand, rotated toward the target */}
            <span
              className="absolute select-none text-3xl drop-shadow"
              style={{
                left: state.hx - 16,
                top: state.hy - 16,
                transform: `rotate(${state.angle}deg)`,
                transformOrigin: 'center',
              }}
              aria-hidden
            >
              👉
            </span>
            {/* Pianomaster99 flying in to help */}
            <div
              className="animate-mascot-fly absolute"
              style={{ left: state.mx, top: state.my, width: MASCOT_W, height: MASCOT_H }}
            >
              <PianoMascot mood="thinking" talking className="h-full w-full" />
            </div>
            {state.message && (
              <div
                className="absolute max-w-[150px] -translate-x-1/2 rounded-lg border-2 border-ink/40 bg-parchment/95 px-2 py-1 text-center text-xs font-bold text-ink shadow"
                style={{ left: state.mx + MASCOT_W / 2, top: state.my - 26 }}
              >
                {state.message}
              </div>
            )}
          </div>
        )}
      </div>
    </StagePointerContext.Provider>
  )
}
