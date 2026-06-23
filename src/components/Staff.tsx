import { useCallback, useRef, useState } from 'react'
import {
  BOTTOM_LINE_STEP,
  TREBLE_LINE_STEPS,
  ledgerLineSteps,
  pitchFromDiatonicStep,
} from '@/lib/theory/staff'
import { diatonicStep, formatPitch, type Pitch } from '@/lib/theory/pitch'
import { cn } from '@/lib/utils'

export interface StaffNote {
  id: string
  pitch: Pitch
  draggable?: boolean
  /** Tailwind text/fill color class fragment, e.g. "primary" or "muted-foreground". */
  tone?: 'foreground' | 'primary' | 'muted'
}

export interface StaffProps {
  notes: StaffNote[]
  onNoteChange?: (id: string, pitch: Pitch) => void
  minStep?: number
  maxStep?: number
  className?: string
}

const STEP_PX = 9
const LINE_GAP = STEP_PX * 2
const PADDING_TOP = 30
const PADDING_BOTTOM = 30
const CLEF_X = 26
const FIRST_NOTE_X = 92
const NOTE_SPACING = 58
const NOTE_RX = 8
const NOTE_RY = 6.5
const VIEW_WIDTH = 340
const DRAG_THRESHOLD = 4

const DEFAULT_MIN_STEP = 25 // G3
const DEFAULT_MAX_STEP = 43 // D6

const TONE_FILL: Record<NonNullable<StaffNote['tone']>, string> = {
  foreground: 'fill-foreground',
  primary: 'fill-primary',
  muted: 'fill-muted-foreground',
}

const ACCIDENTAL_GLYPH: Record<number, string> = {
  [-1]: '\u266D',
  [0]: '',
  [1]: '\u266F',
}

export function Staff({
  notes,
  onNoteChange,
  minStep = DEFAULT_MIN_STEP,
  maxStep = DEFAULT_MAX_STEP,
  className,
}: StaffProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragState = useRef<{
    id: string
    startY: number
    moved: boolean
  } | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(
    notes.find((n) => n.draggable)?.id ?? null,
  )

  const height = PADDING_TOP + (maxStep - minStep) * STEP_PX + PADDING_BOTTOM

  const yForStep = useCallback(
    (step: number) => PADDING_TOP + (maxStep - step) * STEP_PX,
    [maxStep],
  )

  const stepForClientY = useCallback(
    (clientY: number) => {
      const svg = svgRef.current
      if (!svg) return null
      const rect = svg.getBoundingClientRect()
      const ratio = height / rect.height
      const svgY = (clientY - rect.top) * ratio
      const rawStep = maxStep - (svgY - PADDING_TOP) / STEP_PX
      const snapped = Math.round(rawStep)
      return Math.max(minStep, Math.min(maxStep, snapped))
    },
    [height, maxStep, minStep],
  )

  const handlePointerDown = (e: React.PointerEvent, note: StaffNote) => {
    if (!note.draggable) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setSelectedId(note.id)
    dragState.current = { id: note.id, startY: e.clientY, moved: false }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const state = dragState.current
    if (!state) return
    if (Math.abs(e.clientY - state.startY) > DRAG_THRESHOLD) state.moved = true
    if (!state.moved) return
    const step = stepForClientY(e.clientY)
    if (step === null) return
    const note = notes.find((n) => n.id === state.id)
    if (!note) return
    if (diatonicStep(note.pitch) === step) return
    onNoteChange?.(state.id, pitchFromDiatonicStep(step, note.pitch.accidental))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const state = dragState.current
    dragState.current = null
    if (!state) return
    // A tap without dragging cycles the accidental: natural -> # -> b -> natural.
    if (!state.moved) {
      const note = notes.find((n) => n.id === state.id)
      if (note) {
        const next = note.pitch.accidental === 0 ? 1 : note.pitch.accidental === 1 ? -1 : 0
        onNoteChange?.(state.id, { ...note.pitch, accidental: next })
      }
    }
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  const setAccidental = (acc: number) => {
    if (!selectedId) return
    const note = notes.find((n) => n.id === selectedId)
    if (!note) return
    onNoteChange?.(selectedId, { ...note.pitch, accidental: acc })
  }

  const selectedNote = notes.find((n) => n.id === selectedId)

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        className="w-full max-w-md touch-none select-none"
        role="img"
        aria-label="Music staff"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Staff lines */}
        {TREBLE_LINE_STEPS.map((step) => (
          <line
            key={step}
            x1={12}
            x2={VIEW_WIDTH - 12}
            y1={yForStep(step)}
            y2={yForStep(step)}
            className="stroke-foreground/70"
            strokeWidth={1.4}
          />
        ))}

        {/* Treble clef glyph */}
        <text
          x={CLEF_X}
          y={yForStep(BOTTOM_LINE_STEP) + LINE_GAP * 0.9}
          fontSize={LINE_GAP * 4.6}
          className="fill-foreground"
          style={{ fontFamily: "'Noto Music', 'Bravura', serif" }}
        >
          {'\uD834\uDD1E'}
        </text>

        {notes.map((note, i) => {
          const step = diatonicStep(note.pitch)
          const cx = FIRST_NOTE_X + i * NOTE_SPACING
          const cy = yForStep(step)
          const fill = TONE_FILL[note.tone ?? 'foreground']
          const isSelected = note.id === selectedId
          return (
            <g key={note.id}>
              {ledgerLineSteps(step).map((ls) => (
                <line
                  key={ls}
                  x1={cx - 16}
                  x2={cx + 16}
                  y1={yForStep(ls)}
                  y2={yForStep(ls)}
                  className="stroke-foreground/70"
                  strokeWidth={1.4}
                />
              ))}
              {note.pitch.accidental !== 0 && (
                <text
                  x={cx - 22}
                  y={cy + 6}
                  fontSize={22}
                  className={fill}
                  style={{ fontFamily: "'Noto Music', 'Bravura', serif" }}
                >
                  {ACCIDENTAL_GLYPH[note.pitch.accidental]}
                </text>
              )}
              <ellipse
                cx={cx}
                cy={cy}
                rx={NOTE_RX}
                ry={NOTE_RY}
                transform={`rotate(-20 ${cx} ${cy})`}
                className={cn(
                  fill,
                  note.draggable && 'cursor-grab',
                  isSelected && note.draggable && 'stroke-ring',
                )}
                strokeWidth={isSelected && note.draggable ? 2 : 0}
                onPointerDown={(e) => handlePointerDown(e, note)}
              />
            </g>
          )
        })}
      </svg>

      {selectedNote?.draggable && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Accidental:</span>
          <div className="flex overflow-hidden rounded-md border">
            {[
              { acc: -1, label: '\u266D' },
              { acc: 0, label: '\u266E' },
              { acc: 1, label: '\u266F' },
            ].map(({ acc, label }) => (
              <button
                key={acc}
                type="button"
                onClick={() => setAccidental(acc)}
                className={cn(
                  'h-9 w-10 text-lg leading-none transition-colors hover:bg-accent',
                  selectedNote.pitch.accidental === acc &&
                    'bg-primary text-primary-foreground hover:bg-primary',
                )}
                aria-label={
                  acc === -1 ? 'flat' : acc === 0 ? 'natural' : 'sharp'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <span className="ml-2 tabular-nums text-muted-foreground">
            {formatPitch(selectedNote.pitch)}
          </span>
        </div>
      )}
    </div>
  )
}
