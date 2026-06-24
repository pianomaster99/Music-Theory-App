import * as Tone from 'tone'
import { midi, type Pitch } from '@/lib/theory/pitch'

// A tiny audio layer over Tone.js. The browser requires audio to start from a
// user gesture, so call ensureAudio() on the first interaction (e.g. pointer
// down) before playing.

type SynthSetOptions = Parameters<Tone.PolySynth<Tone.Synth>['set']>[0]

export interface Instrument {
  id: string
  label: string
  options: SynthSetOptions
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: 'grand',
    label: 'Grand piano',
    options: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 1.2 },
    },
  },
  {
    id: 'musicbox',
    label: 'Music box',
    options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.5 },
    },
  },
  {
    id: 'organ',
    label: 'Pipe organ',
    options: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.4 },
    },
  },
  {
    id: 'toy',
    label: 'Toy synth',
    options: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.3 },
    },
  },
]

const INSTRUMENT_KEY = 'noteInstrument'

let synth: Tone.PolySynth<Tone.Synth> | null = null
let started = false
let currentId = getInstrumentId()

export function getInstrumentId(): string {
  const id = localStorage.getItem(INSTRUMENT_KEY)
  return INSTRUMENTS.some((i) => i.id === id) ? (id as string) : 'grand'
}

function optionsFor(id: string): SynthSetOptions {
  return (INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0]).options
}

function applyInstrument() {
  if (synth) synth.set(optionsFor(currentId))
}

export function setInstrument(id: string): void {
  currentId = id
  localStorage.setItem(INSTRUMENT_KEY, id)
  applyInstrument()
}

export async function ensureAudio(): Promise<void> {
  if (!started) {
    await Tone.start()
    started = true
  }
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth).toDestination()
    synth.volume.value = -9
    applyInstrument()
  }
}

function freqOf(pitch: Pitch): number {
  return Tone.Frequency(midi(pitch), 'midi').toFrequency() as number
}

let thwack: Tone.NoiseSynth | null = null

/** A short, sharp "thwack" — the ruler slapping the hand on a wrong answer. */
export async function playThwack(): Promise<void> {
  await ensureAudio()
  if (!thwack) {
    thwack = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.13, sustain: 0 },
    }).toDestination()
    thwack.volume.value = -10
  }
  thwack.triggerAttackRelease(0.08)
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
