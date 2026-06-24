// Tutor text-to-speech. The tutor (Pianomaster99) speaks whatever it types,
// using the browser's built-in Web Speech API. Preference is persisted so a
// learner's mute choice sticks.

const STORAGE_KEY = 'tutorSpeechEnabled'

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function isSpeechEnabled(): boolean {
  if (!isSpeechSupported()) return false
  return localStorage.getItem(STORAGE_KEY) !== 'off'
}

export function setSpeechEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  if (!enabled) cancelSpeech()
}

let preferredVoice: SpeechSynthesisVoice | null = null

// Rank voices so we land on the smoothest/most natural one installed. Neural
// and cloud ("online") voices score highest; robotic local voices score low.
function scoreVoice(v: SpeechSynthesisVoice): number {
  let s = 0
  if (/en[-_]/i.test(v.lang)) s += 10
  if (/en[-_]us/i.test(v.lang)) s += 2
  if (/natural|neural/i.test(v.name)) s += 9
  if (/online|premium|enhanced|wavenet/i.test(v.name)) s += 6
  if (/google/i.test(v.name)) s += 4
  if (/microsoft/i.test(v.name)) s += 3
  // Network-backed voices are usually the smooth ones.
  if (v.localService === false) s += 4
  return s
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null
  if (preferredVoice) return preferredVoice
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  // Pick the smoothest English voice installed (falling back to any voice).
  const english = voices.filter((v) => /en[-_]/i.test(v.lang))
  const pool = english.length > 0 ? english : voices
  preferredVoice = pool.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0]
  return preferredVoice
}

// --- Speaking state subscription -------------------------------------------
// Lets the mascot move its mouth (keyboard) in time with the tutor's voice.
type SpeakingListener = (speaking: boolean) => void
const speakingListeners = new Set<SpeakingListener>()

export function onSpeaking(fn: SpeakingListener): () => void {
  speakingListeners.add(fn)
  return () => {
    speakingListeners.delete(fn)
  }
}

function emitSpeaking(speaking: boolean): void {
  speakingListeners.forEach((l) => l(speaking))
}

let pendingSpeak: number | null = null
let keepAlive: number | null = null

function stopKeepAlive(): void {
  if (keepAlive != null) {
    window.clearInterval(keepAlive)
    keepAlive = null
  }
}

export function cancelSpeech(): void {
  if (pendingSpeak != null) {
    window.clearTimeout(pendingSpeak)
    pendingSpeak = null
  }
  stopKeepAlive()
  if (isSpeechSupported()) window.speechSynthesis.cancel()
  emitSpeaking(false)
}

/**
 * Speak a line of text, replacing anything currently being spoken. The whole
 * line goes out as a *single* utterance so it flows smoothly — punctuation
 * alone gives the natural pauses, with no choppy gaps between words.
 *
 * Chrome has two long-standing quirks we work around: speaking immediately
 * after cancel() silently drops the utterance (so we defer it a tick), and it
 * auto-pauses utterances after ~15s (so we nudge resume() on an interval).
 */
export function speak(text: string, force = false): void {
  if (!isSpeechSupported() || (!isSpeechEnabled() && !force)) return
  // Strip markdown emphasis and turn dashes into commas for natural pauses.
  const clean = text
    .replace(/[\u2014\u2013]/g, ', ')
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return

  const synth = window.speechSynthesis
  synth.cancel()
  if (pendingSpeak != null) window.clearTimeout(pendingSpeak)
  stopKeepAlive()

  const voice = pickVoice()
  const utter = new SpeechSynthesisUtterance(clean)
  if (voice) utter.voice = voice
  // A touch slower and gentler reads as warmer and less mechanical.
  utter.rate = 0.97
  utter.pitch = 0.95
  utter.onend = () => {
    emitSpeaking(false)
    stopKeepAlive()
  }
  utter.onerror = () => {
    emitSpeaking(false)
    stopKeepAlive()
  }

  emitSpeaking(true)
  keepAlive = window.setInterval(() => {
    if (synth.speaking) synth.resume()
  }, 8000)
  pendingSpeak = window.setTimeout(() => {
    pendingSpeak = null
    synth.speak(utter)
  }, 60)
}
