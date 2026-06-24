import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  ensureAudio,
  getInstrumentId,
  INSTRUMENTS,
  playPitch,
  setInstrument,
} from '@/lib/audio'
import { pitch } from '@/lib/theory/pitch'
import {
  getRate,
  getVoiceURI,
  isSpeechSupported,
  listVoices,
  setRate as persistRate,
  setVoiceURI,
  speak,
} from '@/lib/speech'

export function SettingsDialog() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURIState] = useState<string>(getVoiceURI() ?? '')
  const [rate, setRateState] = useState<number>(getRate())
  const [instrument, setInstrumentState] = useState<string>(getInstrumentId())

  useEffect(() => {
    if (!isSpeechSupported()) return
    const update = () => setVoices(listVoices())
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () =>
      window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  const chooseVoice = (uri: string) => {
    setVoiceURIState(uri)
    setVoiceURI(uri)
    speak("Ahoy! I'm Pianomaster99, your guide.", true)
  }

  const chooseRate = (r: number) => {
    setRateState(r)
    persistRate(r)
  }

  const chooseInstrument = async (id: string) => {
    setInstrumentState(id)
    setInstrument(id)
    await ensureAudio()
    playPitch(pitch('C', 4), '4n')
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Settings">
          ⚙
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Sound settings</DialogTitle>
          <DialogDescription>
            Choose Pianomaster99&rsquo;s voice and the instrument that plays your notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {isSpeechSupported() ? (
            <div className="space-y-2">
              <Label htmlFor="voice">Tutor voice</Label>
              <select
                id="voice"
                value={voiceURI}
                onChange={(e) => chooseVoice(e.target.value)}
                className="w-full rounded-lg border-2 border-ink/40 bg-paper px-3 py-2 text-ink"
              >
                <option value="">Default</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-3 pt-1">
                <Label htmlFor="rate" className="shrink-0">
                  Speed
                </Label>
                <input
                  id="rate"
                  type="range"
                  min={0.6}
                  max={1.6}
                  step={0.1}
                  value={rate}
                  onChange={(e) => chooseRate(Number(e.target.value))}
                  className="w-full"
                />
                <span className="w-10 text-right text-sm text-ink-soft">
                  {rate.toFixed(1)}x
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => speak('Ahoy! I will guide you through music theory.', true)}
              >
                Test voice
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">
              Your browser doesn&rsquo;t support speech, so the tutor voice is unavailable.
            </p>
          )}

          <div className="space-y-2">
            <Label>Note instrument</Label>
            <div className="grid grid-cols-2 gap-2">
              {INSTRUMENTS.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => void chooseInstrument(i.id)}
                  className={cn(
                    'rounded-lg border-2 border-ink/40 py-2 text-ink transition-colors hover:bg-ink/10',
                    instrument === i.id && 'bg-ink text-parchment hover:bg-ink',
                  )}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
