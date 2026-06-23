import { useCallback, useId, useRef, useState } from 'react'
import {
  BOTTOM_LINE_STEP,
  TREBLE_LINE_STEPS,
  ledgerLineSteps,
  pitchFromDiatonicStep,
} from '@/lib/theory/staff'
import { diatonicStep, formatPitch, type Pitch } from '@/lib/theory/pitch'
import { ensureAudio, playPitch } from '@/lib/audio'
import { cn } from '@/lib/utils'

export interface StaffNote {
  id: string
  pitch: Pitch
  draggable?: boolean
  tone?: 'given' | 'answer'
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
const PADDING_TOP = 34
const PADDING_BOTTOM = 34
const CLEF_X = 22
const CLEF_SAFE_X = 70
const FIRST_NOTE_X = 104
const NOTE_SPACING = 60
const NOTE_RX = 8.5
const NOTE_RY = 7
const VIEW_WIDTH = 360
const RIGHT_EDGE = VIEW_WIDTH - 18
const DRAG_THRESHOLD = 4

const DEFAULT_MIN_STEP = 25 // G3
const DEFAULT_MAX_STEP = 43 // D6

const TONE_FILL: Record<NonNullable<StaffNote['tone']>, string> = {
  given: 'fill-ink-soft',
  answer: 'fill-[#9b3b2f]',
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
  const roughId = useId().replace(/:/g, '')
  const dragState = useRef<{ id: string; startY: number; moved: boolean } | null>(
    null,
  )

  const [xPositions, setXPositions] = useState<Record<string, number>>({})
  const [selectedId, setSelectedId] = useState<string | null>(
    notes.find((n) => n.draggable)?.id ?? null,
  )

  const height = PADDING_TOP + (maxStep - minStep) * STEP_PX + PADDING_BOTTOM

  const yForStep = useCallback(
    (step: number) => PADDING_TOP + (maxStep - step) * STEP_PX,
    [maxStep],
  )

  const defaultX = useCallback(
    (index: number) => Math.max(CLEF_SAFE_X, FIRST_NOTE_X + index * NOTE_SPACING),
    [],
  )
  const xForNote = (note: StaffNote, index: number) =>
    xPositions[note.id] ?? defaultX(index)

  const stepForClientY = useCallback(
    (clientY: number) => {
      const svg = svgRef.current
      if (!svg) return null
      const rect = svg.getBoundingClientRect()
      const ratio = height / rect.height
      const svgY = (clientY - rect.top) * ratio
      const snapped = Math.round(maxStep - (svgY - PADDING_TOP) / STEP_PX)
      return Math.max(minStep, Math.min(maxStep, snapped))
    },
    [height, maxStep, minStep],
  )

  const xForClientX = useCallback((clientX: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const ratio = VIEW_WIDTH / rect.width
    const svgX = (clientX - rect.left) * ratio
    return Math.max(CLEF_SAFE_X, Math.min(RIGHT_EDGE, svgX))
  }, [])

  const handlePointerDown = (e: React.PointerEvent, note: StaffNote) => {
    if (!note.draggable) return
    e.preventDefault()
    void ensureAudio()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setSelectedId(note.id)
    dragState.current = { id: note.id, startY: e.clientY, moved: false }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const state = dragState.current
    if (!state) return
    if (Math.abs(e.clientY - state.startY) > DRAG_THRESHOLD) state.moved = true
    if (!state.moved) return
    const note = notes.find((n) => n.id === state.id)
    if (!note) return

    const x = xForClientX(e.clientX)
    if (x !== null) setXPositions((prev) => ({ ...prev, [state.id]: x }))

    const step = stepForClientY(e.clientY)
    if (step !== null && diatonicStep(note.pitch) !== step) {
      const landed = pitchFromDiatonicStep(step, note.pitch.accidental)
      onNoteChange?.(state.id, landed)
      playPitch(landed)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const state = dragState.current
    dragState.current = null
    if (!state) return
    if (!state.moved) {
      // Tap (no drag) cycles the accidental: natural -> sharp -> flat.
      const note = notes.find((n) => n.id === state.id)
      if (note) {
        const next =
          note.pitch.accidental === 0 ? 1 : note.pitch.accidental === 1 ? -1 : 0
        const updated = { ...note.pitch, accidental: next }
        onNoteChange?.(state.id, updated)
        playPitch(updated)
      }
    }
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  const setAccidental = (acc: number) => {
    if (!selectedId) return
    const note = notes.find((n) => n.id === selectedId)
    if (note) {
      const updated = { ...note.pitch, accidental: acc }
      void ensureAudio()
      onNoteChange?.(selectedId, updated)
      playPitch(updated)
    }
  }

  const selectedNote = notes.find((n) => n.id === selectedId)

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className="w-full max-w-md rounded-md border-2 border-ink/40 p-2"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 30%, #f1e4c3 0%, #e6d3a4 60%, #d7bf8c 100%)',
          boxShadow:
            'inset 0 0 38px rgba(120,90,50,0.35), 0 2px 10px rgba(74,53,38,0.25)',
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
          className="w-full touch-none select-none"
          style={{ color: '#4a3526' }}
          role="img"
          aria-label="Music staff"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <defs>
            <filter id={`rough-${roughId}`} x="-15%" y="-15%" width="130%" height="130%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.018 0.024"
                numOctaves={2}
                seed={7}
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={2.8}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>

          <g>
            {/* Staff lines. The rough filter is applied per element (not to the
                whole group) so removing a note's accidental glyph repaints
                cleanly instead of leaving a stale mark. */}
            {TREBLE_LINE_STEPS.map((step) => (
              <line
                key={step}
                x1={12}
                x2={VIEW_WIDTH - 12}
                y1={yForStep(step)}
                y2={yForStep(step)}
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                filter={`url(#rough-${roughId})`}
              />
            ))}

            {/* Treble clef glyph */}
            <text
              x={CLEF_X}
              y={yForStep(BOTTOM_LINE_STEP) + LINE_GAP * 0.9}
              fontSize={LINE_GAP * 4.6}
              fill="currentColor"
              style={{ fontFamily: "'Noto Music', 'Bravura', serif" }}
              filter={`url(#rough-${roughId})`}
            >
              {'\uD834\uDD1E'}
            </text>

            {notes.map((note, i) => {
              const step = diatonicStep(note.pitch)
              const cx = xForNote(note, i)
              const cy = yForStep(step)
              const fill = TONE_FILL[note.tone ?? 'given']
              const isSelected = note.id === selectedId && note.draggable
              return (
                <g key={note.id}>
                  {ledgerLineSteps(step).map((ls) => (
                    <line
                      key={ls}
                      x1={cx - 16}
                      x2={cx + 16}
                      y1={yForStep(ls)}
                      y2={yForStep(ls)}
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      filter={`url(#rough-${roughId})`}
                    />
                  ))}
                  {note.pitch.accidental !== 0 && (
                    <text
                      x={cx - 23}
                      y={cy + 7}
                      fontSize={24}
                      fill="currentColor"
                      style={{ fontFamily: "'Noto Music', 'Bravura', serif" }}
                      filter={`url(#rough-${roughId})`}
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
                    className={cn(fill, note.draggable && 'cursor-grab')}
                    stroke={isSelected ? '#9b3b2f' : 'none'}
                    strokeWidth={isSelected ? 2.5 : 0}
                    filter={`url(#rough-${roughId})`}
                    onPointerDown={(e) => handlePointerDown(e, note)}
                  />
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {selectedNote?.draggable && (
        <div className="flex items-center gap-2 font-map text-ink">
          <span className="text-ink-soft">Accidental:</span>
          <div className="flex overflow-hidden rounded-md border-2 border-ink/40">
            {[
              { acc: -1, label: '\u266D', name: 'flat' },
              { acc: 0, label: '\u266E', name: 'natural' },
              { acc: 1, label: '\u266F', name: 'sharp' },
            ].map(({ acc, label, name }) => (
              <button
                key={acc}
                type="button"
                onClick={() => setAccidental(acc)}
                className={cn(
                  'h-9 w-10 text-lg leading-none transition-colors hover:bg-ink/10',
                  selectedNote.pitch.accidental === acc
                    ? 'bg-ink text-parchment hover:bg-ink'
                    : 'text-ink',
                )}
                aria-label={name}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="ml-2 text-lg tabular-nums">
            {formatPitch(selectedNote.pitch)}
          </span>
        </div>
      )}
    </div>
  )
}
