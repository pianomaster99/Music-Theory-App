import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface DropSlot {
  id: string
  placeholder: string
}

export interface DragToken {
  id: string
  label: string
  /** Which slot this token may drop into. */
  slot: string
  /** Value reported to onAssign when dropped. */
  value: string
}

interface DragState {
  token: DragToken
  x: number
  y: number
  moved: boolean
}

const MOVE_THRESHOLD = 5

/**
 * Build an answer by dragging tokens into slots (e.g. drag "M" then "3" to make
 * a major third). Tapping a token also drops it into its slot for convenience;
 * tapping a filled slot clears it.
 */
export function DragTokens({
  slots,
  tokens,
  values,
  labelFor,
  onAssign,
  disabled,
}: {
  slots: DropSlot[]
  tokens: DragToken[]
  values: Record<string, string | null>
  /** Display label for a slot's current value. */
  labelFor: (slotId: string, value: string) => string
  onAssign: (slotId: string, value: string | null) => void
  disabled?: boolean
}) {
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const start = useRef<{ x: number; y: number } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  const onPointerDown = (e: React.PointerEvent, token: DragToken) => {
    if (disabled) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    setDrag({ token, x: e.clientX, y: e.clientY, moved: false })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !start.current) return
    const moved =
      drag.moved ||
      Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) >
        MOVE_THRESHOLD
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return
    const token = drag.token
    if (!drag.moved) {
      // Treat as a tap: drop into the token's own slot.
      onAssign(token.slot, token.value)
      setDrag(null)
      return
    }
    for (const s of slots) {
      const el = slotRefs.current[s.id]
      if (!el || token.slot !== s.id) continue
      const r = el.getBoundingClientRect()
      if (
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom
      ) {
        onAssign(s.id, token.value)
        break
      }
    }
    setDrag(null)
  }

  return (
    <div className="space-y-4">
      {/* Answer slots */}
      <div className="flex items-center justify-center gap-2">
        {slots.map((s) => {
          const v = values[s.id]
          return (
            <div
              key={s.id}
              ref={(el) => {
                slotRefs.current[s.id] = el
              }}
              onClick={() => !disabled && v && onAssign(s.id, null)}
              className={cn(
                'flex h-14 min-w-16 items-center justify-center rounded-xl border-2 border-dashed px-3 text-lg transition-colors',
                v
                  ? 'border-solid border-ink bg-parchment font-medium text-ink'
                  : 'border-ink/40 text-ink-soft',
              )}
            >
              {v ? labelFor(s.id, v) : s.placeholder}
            </div>
          )
        })}
      </div>

      {/* Token tray */}
      <div
        className="flex flex-wrap justify-center gap-2"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        {tokens.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onPointerDown={(e) => onPointerDown(e, t)}
            className={cn(
              'min-w-11 touch-none select-none rounded-lg border-2 border-ink/40 bg-paper px-3 py-2 text-base text-ink shadow-sm transition-colors hover:bg-ink/10 active:scale-95 disabled:opacity-50',
              drag?.token.id === t.id && drag.moved && 'opacity-30',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Floating drag ghost */}
      {drag && drag.moved && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border-2 border-ink bg-parchment px-3 py-2 text-base font-medium text-ink shadow-lg"
          style={{
            left: drag.x,
            top: drag.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {drag.token.label}
        </div>
      )}
    </div>
  )
}
