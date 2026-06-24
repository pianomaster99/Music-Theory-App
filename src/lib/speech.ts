// Tutor text-to-speech. The tutor (Pianomaster99) speaks whatever it types,
// using the browser's built-in Web Speech API. Preference is persisted so a
// learner's mute choice sticks.

const STORAGE_KEY = 'tutorSpeechEnabled'
const VOICE_KEY = 'tutorVoiceURI'
const RATE_KEY = 'tutorVoiceRate'

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

export function listVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return []
  return window.speechSynthesis.getVoices()
}

export function getVoiceURI(): string | null {
  return localStorage.getItem(VOICE_KEY)
}

export function setVoiceURI(uri: string): void {
  localStorage.setItem(VOICE_KEY, uri)
  preferredVoice = null
}

export function getRate(): number {
  const r = Number(localStorage.getItem(RATE_KEY))
  return r >= 0.5 && r <= 2 ? r : 1
}

export function setRate(rate: number): void {
  localStorage.setItem(RATE_KEY, String(rate))
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null
  if (preferredVoice) return preferredVoice
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  // Honor an explicitly chosen voice first.
  const chosen = getVoiceURI()
  if (chosen) {
    const match = voices.find((v) => v.voiceURI === chosen)
    if (match) {
      preferredVoice = match
      return match
    }
  }
  // Otherwise prefer an English voice; fall back to the first available.
  preferredVoice =
    voices.find((v) => /en[-_]/i.test(v.lang) && /google|natural|samantha/i.test(v.name)) ??
    voices.find((v) => /en[-_]/i.test(v.lang)) ??
    voices[0]
  return preferredVoice
}

export function cancelSpeech(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}

/** Speak a line of text, replacing anything currently being spoken. */
export function speak(text: string, force = false): void {
  if (!isSpeechSupported() || (!isSpeechEnabled() && !force)) return
  const clean = text.replace(/[\u2014\u2013]/g, ', ').trim()
  if (!clean) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(clean)
  const voice = pickVoice()
  if (voice) utter.voice = voice
  utter.rate = getRate()
  utter.pitch = 1.1
  window.speechSynthesis.speak(utter)
}
