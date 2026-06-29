import { diatonicStep, type Pitch } from '@/lib/theory/pitch'
import { cn } from '@/lib/utils'

// A compact, read-only GRAND staff (treble + bass) that shows the notes the
// player has registered so far. Empty slots show faint placeholder note-heads so
// the player knows how many notes the answer needs. On a wrong note the parent
// flips `wrong` briefly, which shakes the staff and flashes a red tint.

interface Props {
  notes: Pitch[]
  need: number
  wrong?: boolean
  className?: string
}

// Diatonic step positions (letter+octave). C4 (middle C) = 28.
const TREBLE_LINES = [30, 32, 34, 36, 38] // E4 G4 B4 D5 F5
const BASS_LINES = [18, 20, 22, 24, 26] // G2 B2 D3 F3 A3
const MIDDLE_C = 28

const STEP_PX = 6
const PAD = 24
const MAX_STEP = 46 // headroom for ledger lines above treble
const MIN_STEP = 10 // headroom below bass
const VIEW_W = 260
const FIRST_X = 78
const SLOT_DX = 34

const HEIGHT = PAD * 2 + (MAX_STEP - MIN_STEP) * STEP_PX

function yForStep(step: number): number {
  return PAD + (MAX_STEP - step) * STEP_PX
}

/** Ledger-line steps needed to reach `step` on a grand staff. */
function grandLedgers(step: number): number[] {
  const out: number[] = []
  if (step >= 40) for (let s = 40; s <= step; s += 2) out.push(s) // above treble
  else if (step <= 16) for (let s = 16; s >= step; s -= 2) out.push(s) // below bass
  else if (step === MIDDLE_C) out.push(MIDDLE_C) // middle C between staves
  return out
}

function NoteHead({ x, step }: { x: number; step: number }) {
  const cy = yForStep(step)
  return (
    <>
      {grandLedgers(step).map((ls) => (
        <line
          key={ls}
          x1={x - 11}
          x2={x + 11}
          y1={yForStep(ls)}
          y2={yForStep(ls)}
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      ))}
      <ellipse
        cx={x}
        cy={cy}
        rx={7}
        ry={5.6}
        transform={`rotate(-20 ${x} ${cy})`}
        className="fill-ink"
      />
    </>
  )
}

export default function GameStaff({ notes, need, wrong, className }: Props) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-md rounded-xl border-2 p-2 transition-colors',
        wrong ? 'border-red-500 bg-red-500/10' : 'border-ink/30 bg-parchment-dark/40',
        wrong && 'motion-safe:animate-[staffshake_0.4s_ease-in-out]',
        className,
      )}
    >
      <style>{`@keyframes staffshake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}`}</style>
      <svg
        viewBox={`0 0 ${VIEW_W} ${HEIGHT}`}
        className="w-full"
        style={{ color: '#4a3526' }}
        role="img"
        aria-label="Grand staff"
      >
        {/* staff lines */}
        {[...TREBLE_LINES, ...BASS_LINES].map((step) => (
          <line
            key={step}
            x1={12}
            x2={VIEW_W - 12}
            y1={yForStep(step)}
            y2={yForStep(step)}
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        ))}
        {/* left brace + barlines joining the two staves */}
        <line x1={12} x2={12} y1={yForStep(38)} y2={yForStep(18)} stroke="currentColor" strokeWidth={2} />
        <line x1={VIEW_W - 12} x2={VIEW_W - 12} y1={yForStep(38)} y2={yForStep(18)} stroke="currentColor" strokeWidth={2} />

        {/* clefs */}
        <text
          x={20}
          y={yForStep(32) + 16}
          fontSize={46}
          fill="currentColor"
          style={{ fontFamily: "'Noto Music', 'Bravura', serif" }}
        >
          {'\uD834\uDD1E'}
        </text>
        <text
          x={22}
          y={yForStep(24) + 8}
          fontSize={30}
          fill="currentColor"
          style={{ fontFamily: "'Noto Music', 'Bravura', serif" }}
        >
          {'\uD834\uDD22'}
        </text>

        {/* registered notes (empty slots show nothing until sung) */}
        {Array.from({ length: need }).map((_, i) => {
          const x = FIRST_X + i * SLOT_DX
          const note = notes[i]
          if (!note) return null
          const step = diatonicStep(note)
          return (
            <g key={i}>
              {note.accidental === 1 && (
                <text
                  x={x - 20}
                  y={yForStep(step) + 6}
                  fontSize={20}
                  fill="currentColor"
                  style={{ fontFamily: "'Noto Music', 'Bravura', serif" }}
                >
                  {'\u266F'}
                </text>
              )}
              <NoteHead x={x} step={step} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
