import * as Tone from 'tone'
import { midi, type Pitch } from '@/lib/theory/pitch'

// A tiny audio layer over Tone.js. The browser requires audio to start from a
// user gesture, so call ensureAudio() on the first interaction (e.g. pointer
// down) before playing. Notes use a real sampled grand piano (Tone.Sampler)
// for a smooth, non-synthetic sound, with a synth fallback while samples load.

// A grand-piano-ish synth used only while the sampled piano is still loading.
const FALLBACK_SYNTH_OPTIONS = {
  oscillator: { type: 'triangle' as const },
  envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 1.2 },
}

// Free, CDN-hosted sample sets (verified reachable). No API keys, no payment.
const SALAMANDER = 'https://tonejs.github.io/audio/salamander/'
const SOUNDFONT = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/'

// Salamander Grand Piano: a sparse multi-note map; Tone interpolates the rest.
const PIANO_URLS: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3', A1: 'A1.mp3',
  C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3', A2: 'A2.mp3',
  C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3',
  C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3',
  C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3',
  C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3', A6: 'A6.mp3',
  C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3', A7: 'A7.mp3',
  C8: 'C8.mp3',
}

let synth: Tone.PolySynth<Tone.Synth> | null = null
let piano: Tone.Sampler | null = null
let busInput: Tone.Gain | null = null
let started = false

/**
 * Shared master bus: gentle EQ + a touch of reverb + a limiter so everything
 * sounds warm and glued rather than dry and clicky. Created lazily so choir
 * voices can connect even before the audio context is running.
 */
function ensureBus(): Tone.Gain {
  if (!busInput) {
    const input = new Tone.Gain(1)
    const eq = new Tone.EQ3({ low: 1.5, mid: 0, high: -2.5 })
    const reverb = new Tone.Reverb({ decay: 1.8, preDelay: 0.01, wet: 0.16 })
    const limiter = new Tone.Limiter(-1)
    input.chain(eq, reverb, limiter, Tone.getDestination())
    busInput = input
  }
  return busInput
}

export async function ensureAudio(): Promise<void> {
  if (!started) {
    await Tone.start()
    started = true
  }
  const bus = ensureBus()
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth)
    synth.volume.value = -9
    synth.set(FALLBACK_SYNTH_OPTIONS)
    synth.connect(bus)
  }
  if (!piano) {
    piano = new Tone.Sampler({ urls: PIANO_URLS, baseUrl: SALAMANDER, release: 1 })
    piano.volume.value = -6
    piano.connect(bus)
  }
}

// A minimal shared shape so the sampled piano and the synth are interchangeable.
interface NoteVoice {
  triggerAttackRelease(
    notes: Tone.Unit.Frequency | Tone.Unit.Frequency[],
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time,
  ): unknown
  triggerAttack(notes: Tone.Unit.Frequency, time?: Tone.Unit.Time): unknown
  triggerRelease(notes: Tone.Unit.Frequency, time?: Tone.Unit.Time): unknown
  releaseAll(time?: Tone.Unit.Time): unknown
}

/** The sampled piano once loaded, else the synth fallback (covers loading). */
function activeVoice(): NoteVoice | null {
  if (piano && piano.loaded) {
    return piano as unknown as NoteVoice
  }
  return (synth as unknown as NoteVoice) ?? null
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
    })
    thwack.volume.value = -10
    thwack.connect(ensureBus())
  }
  thwack.triggerAttackRelease(0.08)
}

/** Play a single pitch. No-op if audio hasn't been started yet. */
export function playPitch(pitch: Pitch, duration: Tone.Unit.Time = '8n'): void {
  activeVoice()?.triggerAttackRelease(freqOf(pitch), duration)
}

/**
 * Play concert A (A4 = 440 Hz) for ~half a second as a tuning reference.
 * Must be called from a user gesture (it starts the audio context).
 */
export async function playReferenceA(durationSec = 0.5): Promise<void> {
  await ensureAudio()
  activeVoice()?.triggerAttackRelease(440, durationSec)
}

/** Begin sustaining a pitch (held until stopNote). Starts audio if needed. */
export async function startNote(pitch: Pitch): Promise<void> {
  await ensureAudio()
  activeVoice()?.triggerAttack(freqOf(pitch))
}

/** Release a sustained pitch started with startNote. */
export function stopNote(pitch: Pitch): void {
  activeVoice()?.triggerRelease(freqOf(pitch))
}

/** Release every sustained note (e.g. when leaving the choir). */
export function stopAllNotes(): void {
  activeVoice()?.releaseAll()
}

// --- Choir voices ----------------------------------------------------------
// Each choir theme is a sampled human voice from the FluidR3 GM soundfonts so
// they actually sound like people: angelic "aah"s, warm tenor "ooh"s, and a
// silly high orange.

export interface ChoirVoice {
  start(pitch: Pitch): void
  stop(pitch: Pitch): void
  stopAll(): void
  dispose(): void
}

// Sparse natural-note map across the choir range; Tone interpolates between.
function vocalUrls(): Record<string, string> {
  const urls: Record<string, string> = {}
  for (const oct of [3, 4, 5, 6]) {
    for (const n of ['C', 'E', 'G', 'A']) urls[`${n}${oct}`] = `${n}${oct}.mp3`
  }
  return urls
}

function makeVocalSampler(inst: string, release: number): Tone.Sampler {
  return new Tone.Sampler({
    urls: vocalUrls(),
    baseUrl: `${SOUNDFONT}${inst}-mp3/`,
    release,
  })
}

/**
 * Build a sustaining sampled voice for a choir theme. Nodes are created
 * immediately; call ensureAudio() (from a user gesture) before the first note.
 */
export function createChoirVoice(theme: string): ChoirVoice {
  const bus = ensureBus()
  const extras: { dispose(): void }[] = []
  let transpose = 0
  let sampler: Tone.Sampler

  if (theme === 'argentina') {
    // Warm tenors: real vocal "ooh"s dropped an octave.
    sampler = makeVocalSampler('voice_oohs', 0.5)
    sampler.volume.value = -5
    transpose = -12
    sampler.connect(bus)
  } else if (theme === 'orange') {
    // Funny, annoying: vocal "ooh"s an octave up with a wobble.
    sampler = makeVocalSampler('voice_oohs', 0.3)
    sampler.volume.value = -9
    transpose = 12
    const vibrato = new Tone.Vibrato({ frequency: 7, depth: 0.4 })
    sampler.chain(vibrato, bus)
    extras.push(vibrato)
  } else {
    // Angels: lush sampled choir "aah"s with extra reverb.
    sampler = makeVocalSampler('choir_aahs', 1.4)
    sampler.volume.value = -3
    const reverb = new Tone.Reverb({ decay: 3, wet: 0.4 })
    sampler.chain(reverb, bus)
    extras.push(reverb)
  }

  const freq = (pitch: Pitch) =>
    Tone.Frequency(midi(pitch) + transpose, 'midi').toFrequency() as number

  return {
    start: (pitch) => {
      if (sampler.loaded) sampler.triggerAttack(freq(pitch))
    },
    stop: (pitch) => {
      if (sampler.loaded) sampler.triggerRelease(freq(pitch))
    },
    stopAll: () => {
      if (sampler.loaded) sampler.releaseAll()
    },
    dispose: () => {
      sampler.dispose()
      extras.forEach((n) => n.dispose())
    },
  }
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
  const voice = activeVoice()
  if (!voice || pitches.length === 0) return
  if (mode === 'chord') {
    voice.triggerAttackRelease(pitches.map(freqOf), duration)
    return
  }
  const now = Tone.now()
  const gap = 0.42
  pitches.forEach((p, i) => {
    voice.triggerAttackRelease(freqOf(p), duration, now + i * gap)
  })
}
