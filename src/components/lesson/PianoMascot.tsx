import type { MascotMood } from './Mascot'

// Pianomaster99 as an animated little upright-piano character:
//  - eyes sit on the lid up top,
//  - the keyboard is the mouth (the keys play/bob while he speaks),
//  - the two legs at the bottom are his legs.
// All drawn as one cohesive SVG so it reads as a single friendly creature.

const BODY = '#2b2622'
const BODY_LIGHT = '#3a342d'
const RECESS = '#140f0a'
const KEY = '#fdf8ee'
const OUTLINE = '#0c0a08'

// White-key boundaries across the keyboard mouth (used to place black keys).
const KEY_X = 33
const KEY_W = 54
const KEYS = 7
const WHITE_W = KEY_W / KEYS
// Black keys sit over the gaps following C, D, F, G, A (skip the E–F and B gaps).
const BLACK_GAPS = [1, 2, 4, 5, 6]

function pupilOffset(mood: MascotMood, slapping: boolean): { dx: number; dy: number } {
  if (slapping) return { dx: 0, dy: 2 }
  switch (mood) {
    case 'happy':
      return { dx: 0, dy: -1 }
    case 'thinking':
      return { dx: -3, dy: -2 }
    default:
      return { dx: 0, dy: 1 }
  }
}

// Either arm can hang/swing (idle), stretch out (reach), grip something (hold),
// or wave (wave). 'none' hides it (the default everywhere except the demos).
export type ArmPose = 'none' | 'idle' | 'reach' | 'hold' | 'wave'

// One mirrored arm: a jointed limb from the shoulder with a glove hand, plus an
// optional conductor's baton. Rotates about the shoulder; CSS drives the pose.
function MascotArm({
  side,
  pose,
  baton = false,
}: {
  side: 'l' | 'r'
  pose: ArmPose
  baton?: boolean
}) {
  const sx = side === 'r' ? 98 : 22
  const d = side === 'r' ? 1 : -1
  const handCx = sx + d * 26
  const handCy = 72
  const fistCx = sx + d * 25
  const thumbCx = sx + d * 21
  const limb = `M${sx} 76 Q${sx + d * 12} 69 ${sx + d * 24} 72`
  const hilite = `M${sx + d * 1} 75 Q${sx + d * 11} 71 ${sx + d * 22} 72`

  return (
    <g
      className={`mascot-arm mascot-arm-${side}--${pose}`}
      style={{ transformBox: 'view-box', transformOrigin: `${sx}px 76px` }}
    >
      <path d={limb} fill="none" stroke={BODY} strokeWidth={10} strokeLinecap="round" />
      <path d={hilite} fill="none" stroke={BODY_LIGHT} strokeWidth={3.4} strokeLinecap="round" opacity={0.6} />

      {baton && side === 'r' && (
        <g>
          <line x1={handCx} y1={handCy - 2} x2={handCx + 34} y2={handCy - 26} stroke="#5b4636" strokeWidth={4} strokeLinecap="round" />
          <line x1={handCx} y1={handCy - 2} x2={handCx + 34} y2={handCy - 26} stroke="#caa46e" strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={handCx + 35} cy={handCy - 27} r={8} fill="#fff3b0" opacity={0.4} className="choir-twinkle" />
          <circle cx={handCx + 35} cy={handCy - 27} r={4.5} fill="#fff6c8" stroke="#e6b800" strokeWidth={1.5} />
        </g>
      )}

      {pose === 'hold' ? (
        <g>
          <circle cx={fistCx} cy={71} r={5.8} fill={KEY} stroke={OUTLINE} strokeWidth={2.4} />
          <g stroke={OUTLINE} strokeWidth={1.4} strokeLinecap="round" opacity={0.65}>
            <line x1={fistCx - 2.4} y1={68.6} x2={fistCx - 2.4} y2={71.2} />
            <line x1={fistCx} y1={68.2} x2={fistCx} y2={70.8} />
            <line x1={fistCx + 2.4} y1={68.7} x2={fistCx + 2.4} y2={71.2} />
          </g>
        </g>
      ) : (
        <g>
          <circle cx={handCx} cy={handCy - 1} r={6.4} fill={KEY} stroke={OUTLINE} strokeWidth={2.4} />
          <ellipse cx={thumbCx} cy={66.4} rx={2.6} ry={3.4} fill={KEY} stroke={OUTLINE} strokeWidth={2} />
        </g>
      )}
    </g>
  )
}

export function PianoMascot({
  mood = 'neutral',
  talking = false,
  slapping = false,
  armLeft = 'none',
  armRight = 'none',
  baton = false,
  className,
}: {
  mood?: MascotMood
  talking?: boolean
  slapping?: boolean
  armLeft?: ArmPose
  armRight?: ArmPose
  baton?: boolean
  className?: string
}) {
  const { dx, dy } = pupilOffset(mood, slapping)
  const happy = mood === 'happy' && !slapping

  return (
    <svg
      viewBox="0 0 120 150"
      className={className}
      style={{ overflow: 'visible' }}
      role="img"
      aria-label="Pianomaster99"
    >
      <g className="mascot-bob">
        {/* Legs + cartoon shoes (behind the body) */}
        <g className="mascot-legs">
          <rect x={44} y={110} width={9} height={30} rx={4.5} fill={BODY} stroke={OUTLINE} strokeWidth={3} />
          <rect x={67} y={110} width={9} height={30} rx={4.5} fill={BODY} stroke={OUTLINE} strokeWidth={3} />
          <ellipse cx={42} cy={141} rx={14} ry={7} fill={BODY} stroke={OUTLINE} strokeWidth={3} />
          <ellipse cx={80} cy={141} rx={14} ry={7} fill={BODY} stroke={OUTLINE} strokeWidth={3} />
        </g>

        {/* Body */}
        <rect x={18} y={34} width={84} height={80} rx={13} fill={BODY} stroke={OUTLINE} strokeWidth={3.5} />
        {/* Soft side highlight for a glossy, cartoon look */}
        <rect x={24} y={40} width={18} height={66} rx={9} fill={BODY_LIGHT} opacity={0.6} />

        {/* Lid up top, where the eyes live */}
        <rect x={13} y={22} width={94} height={22} rx={9} fill={BODY_LIGHT} stroke={OUTLINE} strokeWidth={3.5} />
        <rect x={13} y={20} width={94} height={7} rx={3.5} fill={BODY} stroke={OUTLINE} strokeWidth={3} />

        {/* Eyes */}
        {[46, 74].map((cx, i) => (
          <g key={cx} className="mascot-eye" style={{ animationDelay: `${i * 0.15}s` }}>
            <ellipse cx={cx} cy={36} rx={11} ry={12} fill="#fff" stroke={OUTLINE} strokeWidth={2.4} />
            <circle cx={cx + dx} cy={36 + dy} r={4.4} fill={OUTLINE} />
            <circle cx={cx + dx - 1.4} cy={34.6 + dy} r={1.4} fill="#fff" />
          </g>
        ))}

        {/* Eyebrows for thinking / scolding moods */}
        {(mood === 'thinking' || slapping) && (
          <g stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round">
            <line x1={38} y1={slapping ? 22 : 23} x2={53} y2={slapping ? 26 : 21} />
            <line x1={82} y1={slapping ? 22 : 23} x2={67} y2={slapping ? 26 : 21} />
          </g>
        )}

        {/* Rosy cheeks when happy */}
        {happy && (
          <>
            <ellipse cx={30} cy={62} rx={6} ry={4} fill="#e8896b" opacity={0.7} />
            <ellipse cx={90} cy={62} rx={6} ry={4} fill="#e8896b" opacity={0.7} />
          </>
        )}

        {/* Mouth = keyboard. Dark recess (throat) with bobbing keys (teeth). */}
        <rect x={30} y={68} width={60} height={32} rx={9} fill={RECESS} stroke={OUTLINE} strokeWidth={3} />

        <g className={talking ? 'mascot-keys mascot-keys--talking' : 'mascot-keys'}>
          {/* White keys */}
          {Array.from({ length: KEYS }).map((_, k) => (
            <rect
              key={`w${k}`}
              className="mascot-key"
              style={{ animationDelay: `${(k % 4) * 0.08}s` }}
              x={KEY_X + k * WHITE_W + 0.6}
              y={86}
              width={WHITE_W - 1.2}
              height={12}
              rx={1.6}
              fill={KEY}
              stroke={OUTLINE}
              strokeWidth={1}
            />
          ))}
          {/* Black keys */}
          {BLACK_GAPS.map((g) => (
            <rect
              key={`b${g}`}
              className="mascot-key"
              style={{ animationDelay: `${(g % 4) * 0.08 + 0.04}s` }}
              x={KEY_X + g * WHITE_W - 2.2}
              y={86}
              width={4.4}
              height={7}
              rx={1.2}
              fill={OUTLINE}
            />
          ))}
        </g>

        {/* Upper lip: covers the gap when quiet, slides up to "open" when talking */}
        <rect
          className={talking ? 'mascot-lip mascot-lip--talking' : 'mascot-lip'}
          x={29}
          y={66}
          width={62}
          height={20}
          rx={9}
          fill={BODY}
          stroke={OUTLINE}
          strokeWidth={3}
        />

        {/* A little frown stroke when scolded */}
        {slapping && (
          <path
            d="M40 104 Q60 96 80 104"
            fill="none"
            stroke={OUTLINE}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        )}

        {/* Arms: jointed limbs with glove hands that reach, grip, and wave. */}
        {armLeft !== 'none' && <MascotArm side="l" pose={armLeft} />}
        {armRight !== 'none' && <MascotArm side="r" pose={armRight} baton={baton} />}
      </g>
    </svg>
  )
}
