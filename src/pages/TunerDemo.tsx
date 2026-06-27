import { useCallback, useEffect, useRef, useState } from 'react'
import { PitchDetector, type PitchReading } from '@/lib/pitch/detector'
import { MicCapture } from '@/lib/pitch/mic'
import { formatPitch, pitchFromMidi } from '@/lib/theory/pitch'

type Status = 'idle' | 'loading' | 'listening' | 'error'

const TICK_MS = 60

export default function TunerDemo() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState<PitchReading | null>(null)
  const [sensitivity, setSensitivity] = useState(0.5)
  const [sampleRate, setSampleRate] = useState<number | null>(null)

  const detectorRef = useRef<PitchDetector | null>(null)
  const micRef = useRef<MicCapture | null>(null)
  const sensRef = useRef(sensitivity)
  const timerRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const smoothMidiRef = useRef<number | null>(null)

  useEffect(() => {
    sensRef.current = sensitivity
  }, [sensitivity])

  const stop = useCallback(async () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    await micRef.current?.stop()
    micRef.current = null
    smoothMidiRef.current = null
    setStatus('idle')
    setReading(null)
  }, [])

  useEffect(() => {
    return () => {
      void stop()
    }
  }, [stop])

  const start = useCallback(async () => {
    setError(null)
    setStatus('loading')
    try {
      if (!detectorRef.current) detectorRef.current = new PitchDetector()
      await detectorRef.current.init()

      const mic = new MicCapture()
      micRef.current = mic
      await mic.start((chunk) => detectorRef.current?.pushSamples(chunk))
      setSampleRate(mic.sampleRate)
      setStatus('listening')

      timerRef.current = window.setInterval(async () => {
        const det = detectorRef.current
        if (!det || busyRef.current || !det.hasEnoughAudio()) return
        busyRef.current = true
        try {
          const r = await det.infer(sensRef.current)
          if (r) {
            if (r.voiced) {
              // Light EMA on the continuous MIDI for a steadier readout.
              const prev = smoothMidiRef.current
              smoothMidiRef.current =
                prev === null ? r.midi : prev * 0.6 + r.midi * 0.4
            } else {
              smoothMidiRef.current = null
            }
            setReading(r)
          }
        } catch {
          // transient inference error; keep going
        } finally {
          busyRef.current = false
        }
      }, TICK_MS)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setStatus('error')
      await stop()
      setStatus('error')
    }
  }, [stop])

  const listening = status === 'listening'
  const voiced = listening && reading?.voiced
  const smid = smoothMidiRef.current
  const noteMidi = voiced && smid !== null ? Math.round(smid) : reading?.noteMidi ?? null
  const cents =
    voiced && smid !== null ? (smid - Math.round(smid)) * 100 : reading?.cents ?? 0
  const noteLabel =
    voiced && noteMidi !== null
      ? formatPitch(pitchFromMidi(noteMidi), { unicode: true })
      : '—'
  const centsClamped = Math.max(-50, Math.min(50, cents))

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="font-display text-3xl text-ink">Voice Pitch Tuner</h1>
        <p className="text-ink-soft">
          Sing or hum into your mic. The on-device model (CRNN, runs fully in your
          browser) detects the pitch in real time. Use the sensitivity slider to
          tune how readily it treats sound as a voiced note.
        </p>
      </header>

      <div className="flex items-center gap-3">
        {!listening ? (
          <button
            onClick={() => void start()}
            disabled={status === 'loading'}
            className="rounded-lg border border-ink bg-ink px-5 py-2 font-medium text-paper disabled:opacity-50"
          >
            {status === 'loading' ? 'Loading model…' : 'Start mic'}
          </button>
        ) : (
          <button
            onClick={() => void stop()}
            className="rounded-lg border border-red-500 px-5 py-2 font-medium text-red-600"
          >
            Stop
          </button>
        )}
        {sampleRate && listening && (
          <span className="text-xs text-ink-soft">mic @ {sampleRate} Hz</span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-400 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Note readout */}
      <div className="rounded-2xl border border-ink/20 bg-paper/60 p-8 text-center">
        <div
          className={`font-display leading-none transition-colors ${
            voiced ? 'text-ink' : 'text-ink/25'
          }`}
          style={{ fontSize: '6rem' }}
        >
          {noteLabel}
        </div>
        <div className="mt-2 h-5 text-sm text-ink-soft">
          {voiced && reading
            ? `${reading.freq.toFixed(1)} Hz · ${cents >= 0 ? '+' : ''}${cents.toFixed(0)} cents`
            : listening
              ? 'listening…'
              : 'press Start mic'}
        </div>

        {/* Cents needle */}
        <div className="relative mx-auto mt-5 h-10 w-full max-w-md">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-ink/20" />
          {/* tick marks at -50, 0, +50 */}
          {[-50, -25, 0, 25, 50].map((t) => (
            <div
              key={t}
              className={`absolute top-1/2 -translate-y-1/2 ${t === 0 ? 'h-6 w-0.5 bg-ink/50' : 'h-3 w-px bg-ink/25'}`}
              style={{ left: `${((t + 50) / 100) * 100}%` }}
            />
          ))}
          <div
            className={`absolute top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded transition-all duration-75 ${
              voiced
                ? Math.abs(cents) < 12
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
                : 'bg-transparent'
            }`}
            style={{ left: `${((centsClamped + 50) / 100) * 100}%` }}
          />
        </div>
        <div className="mt-1 flex max-w-md mx-auto justify-between text-[10px] text-ink-soft">
          <span>flat</span>
          <span>in tune</span>
          <span>sharp</span>
        </div>
      </div>

      {/* Sensitivity slider */}
      <div className="rounded-xl border border-ink/20 bg-paper/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="sens" className="font-medium text-ink">
            Sensitivity
          </label>
          <span className="text-sm text-ink-soft">{sensitivity.toFixed(2)}</span>
        </div>
        <input
          id="sens"
          type="range"
          min={0.05}
          max={0.95}
          step={0.01}
          value={sensitivity}
          onChange={(e) => setSensitivity(parseFloat(e.target.value))}
          className="w-full accent-ink"
        />
        <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
          <span>more sensitive (detects quiet/breathy)</span>
          <span>stricter (only confident notes)</span>
        </div>
        {listening && reading && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-ink-soft">
              voicing confidence {(reading.voiceProb * 100).toFixed(0)}%
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-ink/10">
              <div
                className={`h-full ${reading.voiced ? 'bg-emerald-500' : 'bg-ink/30'}`}
                style={{ width: `${Math.round(reading.voiceProb * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-ink-soft">
        Trained on settled-note labels (no shaky attacks or transitions). Expect stable
        note holds rather than tuner-style wavering — better for chord / note-sequence games.
      </p>
    </div>
  )
}
