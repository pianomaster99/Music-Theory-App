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

function pickVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null
  if (preferredVoice) return preferredVoice
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  // Prefer an English voice; fall back to the first available.
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
export function speak(text: string): void {
  if (!isSpeechSupported() || !isSpeechEnabled()) return
  const clean = text.replace(/[\u2014\u2013]/g, ', ').trim()
  if (!clean) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(clean)
  const voice = pickVoice()
  if (voice) utter.voice = voice
  utter.rate = 1
  utter.pitch = 1.1
  window.speechSynthesis.speak(utter)
}
