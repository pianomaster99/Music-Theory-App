import * as Tone from 'tone'
import { midi, type Pitch } from '@/lib/theory/pitch'

// A tiny audio layer over Tone.js. The browser requires audio to start from a
// user gesture, so call ensureAudio() on the first interaction (e.g. pointer
// down) before playing.

let synth: Tone.PolySynth<Tone.Synth> | null = null
let started = false

export async function ensureAudio(): Promise<void> {
  if (!started) {
    await Tone.start()
    started = true
  }
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth).toDestination()
    synth.volume.value = -9
  }
}

function freqOf(pitch: Pitch): number {
  return Tone.Frequency(midi(pitch), 'midi').toFrequency() as number
}

/** Play a single pitch. No-op if audio hasn't been started yet. */
export function playPitch(pitch: Pitch, duration: Tone.Unit.Time = '8n'): void {
  if (!synth) return
  synth.triggerAttackRelease(freqOf(pitch), duration)
}

/**
 * Play several pitches. `mode: 'chord'` sounds them together; `'melodic'` plays
 * them in sequence with a small gap so the interval can be heard.
 */
export function playPitches(
  pitches: Pitch[],
  mode: 'chord' | 'melodic' = 'melodic',
  duration: Tone.Unit.Time = '4n',
): void {
  if (!synth || pitches.length === 0) return
  if (mode === 'chord') {
    synth.triggerAttackRelease(pitches.map(freqOf), duration)
    return
  }
  const now = Tone.now()
  const gap = 0.42
  pitches.forEach((p, i) => {
    synth!.triggerAttackRelease(freqOf(p), duration, now + i * gap)
  })
}
