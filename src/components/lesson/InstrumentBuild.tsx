import { useRef, useState } from 'react'
import { HandPiano } from '@/components/HandPiano'
import { Choir, type ChoirTheme } from '@/components/Choir'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/AuthProvider'
import { HAND_SKIN_FILTER } from '@/lib/profile'
import type { ValidationResult } from '@/lib/content/validate'
import type { Pitch } from '@/lib/theory/pitch'
import { FeatureTip } from './FeatureTip'
import { HAND_TIP, CHOIR_TIP } from './featureTips'
import { useStagePointer } from './stagePointerContext'

const THEMES: ChoirTheme[] = ['angels', 'argentina', 'orange']

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

interface InstrumentBuildProps {
  /** Which tool to render. */
  feature: 'piano' | 'choir'
  /** Stable seed (the step id) so the choir theme stays the same on resume. */
  seed: string
  /** Given/anchor notes to mark for the learner. */
  anchors: Pitch[]
  /** Whether the step is already solved (locks input). */
  solved: boolean
  /** Mechanic instruction shown above the tool. */
  instruction: string
  /** Submit the sounding pitches; returns the result so we can react to it. */
  onCheck: (pitches: Pitch[]) => ValidationResult
  /** Progressive hints Pianomaster99 reads aloud, if any. */
  hints?: string[]
  /** Called with the next hint text when the learner asks for one. */
  onHint?: (text: string) => void
}

/** Build an answer on the hand-piano or the choir (validated by sound). */
export function InstrumentBuild({
  feature,
  seed,
  anchors,
  solved,
  instruction,
  onCheck,
  hints,
  onHint,
}: InstrumentBuildProps) {
  if (feature === 'piano') {
    return (
      <PianoBuild
        anchors={anchors}
        solved={solved}
        instruction={instruction}
        onCheck={onCheck}
        hints={hints}
        onHint={onHint}
      />
    )
  }
  return (
    <ChoirBuild
      seed={seed}
      anchors={anchors}
      solved={solved}
      instruction={instruction}
      onCheck={onCheck}
      hints={hints}
      onHint={onHint}
    />
  )
}

/** A "Hint" button that walks Pianomaster99 through the step's hints in order. */
function HintButton({
  hints,
  onHint,
}: {
  hints?: string[]
  onHint?: (text: string) => void
}) {
  const [hintsShown, setHintsShown] = useState(0)
  if (!hints || hints.length === 0) return null
  return (
    <Button
      variant="outline"
      disabled={hintsShown >= hints.length}
      onClick={() => {
        const next = Math.min(hintsShown + 1, hints.length)
        setHintsShown(next)
        onHint?.(hints[next - 1])
      }}
    >
      Hint
    </Button>
  )
}

function PianoBuild({
  anchors,
  instruction,
  onCheck,
  hints,
  onHint,
}: Omit<InstrumentBuildProps, 'feature' | 'seed'>) {
  const { profile } = useAuth()
  const skinFilter = HAND_SKIN_FILTER[profile?.handSkin ?? 'light']
  const wrapRef = useRef<HTMLDivElement>(null)
  const pointer = useStagePointer()
  return (
    <div className="space-y-4">
      <FeatureTip {...HAND_TIP} />
      <p className="text-center text-sm text-ink-soft">{instruction}</p>
      <div ref={wrapRef}>
        <HandPiano
          octaves={2}
          highlight={anchors}
          skinFilter={skinFilter}
          onPlay={(pitches) => {
            const result = onCheck(pitches)
            if (!result.correct) pointer?.point(wrapRef.current, 'Try these keys')
          }}
        />
      </div>
      {hints && hints.length > 0 && (
        <div className="flex justify-center">
          <HintButton hints={hints} onHint={onHint} />
        </div>
      )}
    </div>
  )
}

function ChoirBuild({
  seed,
  anchors,
  instruction,
  onCheck,
  hints,
  onHint,
}: Omit<InstrumentBuildProps, 'feature'>) {
  const theme = THEMES[hashString(seed) % THEMES.length]
  const [singing, setSinging] = useState<Pitch[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)
  const pointer = useStagePointer()
  return (
    <div className="space-y-4">
      <FeatureTip {...CHOIR_TIP} />
      <p className="text-center text-sm text-ink-soft">{instruction}</p>
      <div ref={wrapRef}>
        <Choir
          theme={theme}
          octaves={2}
          highlight={anchors}
          onChange={setSinging}
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          onClick={() => {
            const result = onCheck(singing)
            if (!result.correct) pointer?.point(wrapRef.current, 'Listen again')
          }}
        >
          Check
        </Button>
        <HintButton hints={hints} onHint={onHint} />
      </div>
    </div>
  )
}
