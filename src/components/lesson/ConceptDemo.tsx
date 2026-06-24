import { HandPiano } from '@/components/HandPiano'
import { Choir, type ChoirTheme } from '@/components/Choir'
import { useAuth } from '@/lib/auth/AuthProvider'
import { HAND_SKIN_FILTER } from '@/lib/profile'
import { midi, pitchFromMidi, type Pitch } from '@/lib/theory/pitch'

const THEMES: ChoirTheme[] = ['angels', 'argentina', 'orange']

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * A pre-configured, playable illustration for a concept step: the hand-piano
 * with the example keys lit, or the choir with the matching singers already
 * singing. Lets intros preview the same tools the problems use.
 */
export function ConceptDemo({
  feature,
  pitches,
  seed,
}: {
  feature: 'piano' | 'choir'
  pitches: Pitch[]
  seed: string
}) {
  const { profile } = useAuth()

  if (feature === 'choir') {
    const lo = Math.min(...pitches.map(midi))
    const hi = Math.max(...pitches.map(midi))
    const octaves = Math.max(1, Math.ceil((hi - lo) / 12))
    const theme = THEMES[hashString(seed) % THEMES.length]
    return (
      <div className="space-y-2">
        <Choir
          theme={theme}
          startPitch={pitchFromMidi(lo)}
          octaves={octaves}
          highlight={pitches}
          presetSinging={pitches}
          showBaton={false}
        />
        <p className="text-center text-sm text-ink-soft">
          The ⭐ singers are holding the example. Tap any singer to hear them.
        </p>
      </div>
    )
  }

  const skinFilter = HAND_SKIN_FILTER[profile?.handSkin ?? 'light']
  // Frame the keyboard so all example notes fit: start at middle C (C4 = 60),
  // or lower if the example dips below it.
  const start = pitchFromMidi(Math.min(60, ...pitches.map(midi)))

  return (
    <div className="space-y-2">
      <HandPiano
        startPitch={start}
        octaves={2}
        highlight={pitches}
        skinFilter={skinFilter}
      />
      <p className="text-center text-sm text-ink-soft">
        The glowing keys are the example. Drag the hand and press to hear it.
      </p>
    </div>
  )
}
