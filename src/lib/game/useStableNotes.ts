// React hook: run the mic + pitch model and emit a "stable note" whenever a
// pitch is held steady for >= holdMs. This is what registers a sung answer note
// (the PRD: a quick <0.1s waver must NOT change the registered note).

import { useCallback, useEffect, useRef, useState } from 'react'
import { PitchDetector, type PitchReading } from '@/lib/pitch/detector'
import { MicCapture } from '@/lib/pitch/mic'

const TICK_MS = 60

export type MicStatus = 'idle' | 'loading' | 'listening' | 'error'

export interface StableNote {
  /** Pitch class 0-11. */
  pc: number
  midi: number
}

export interface UseStableNotesOptions {
  /** How long (ms) a pitch must be held to register. Default 500 (PRD). */
  holdMs?: number
  /** Voicing threshold (voiceProb) passed to the detector. Default 0.5. */
  sensitivity?: number
  /** Called once each time a held note registers. */
  onStableNote?: (note: StableNote) => void
}

export interface UseStableNotes {
  status: MicStatus
  error: string | null
  reading: PitchReading | null
  /** 0..1 progress of the current note toward registering (for a hold meter). */
  holdProgress: number
  /** Smoothed mic input level (RMS, ~0..1) for a volume meter. */
  level: number
  start: () => Promise<void>
  stop: () => Promise<void>
}

// The trained model's voicing head is over-conservative (collapsed to ~0 after
// the strict relabel), so we decide "is the user singing" from audio level +
// pitch confidence instead, and let the 0.5s same-note hold reject transients.
const LEVEL_THRESH = 0.02

export function useStableNotes(opts: UseStableNotesOptions = {}): UseStableNotes {
  const { holdMs = 500, sensitivity = 0.5 } = opts

  const [status, setStatus] = useState<MicStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState<PitchReading | null>(null)
  const [holdProgress, setHoldProgress] = useState(0)
  const [level, setLevel] = useState(0)
  const levelRef = useRef(0)

  const detectorRef = useRef<PitchDetector | null>(null)
  const micRef = useRef<MicCapture | null>(null)
  const timerRef = useRef<number | null>(null)
  const busyRef = useRef(false)

  // Candidate-hold state.
  const candidateRef = useRef<number | null>(null)
  const candidateStartRef = useRef(0)
  const emittedRef = useRef(false)

  // Keep the latest callback without restarting the loop.
  const onNoteRef = useRef(opts.onStableNote)
  useEffect(() => {
    onNoteRef.current = opts.onStableNote
  }, [opts.onStableNote])

  const stop = useCallback(async () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    await micRef.current?.stop()
    micRef.current = null
    candidateRef.current = null
    emittedRef.current = false
    levelRef.current = 0
    setLevel(0)
    setHoldProgress(0)
    setReading(null)
    setStatus('idle')
  }, [])

  useEffect(() => () => void stop(), [stop])

  const start = useCallback(async () => {
    setError(null)
    setStatus('loading')
    try {
      if (!detectorRef.current) detectorRef.current = new PitchDetector()
      await detectorRef.current.init()

      const mic = new MicCapture()
      micRef.current = mic
      await mic.start((chunk) => {
        // Track input loudness (RMS) for the volume meter + voicing decision.
        let s = 0
        for (let i = 0; i < chunk.length; i++) s += chunk[i] * chunk[i]
        const rms = Math.sqrt(s / Math.max(1, chunk.length))
        levelRef.current = levelRef.current * 0.6 + rms * 0.4
        setLevel(levelRef.current)
        detectorRef.current?.pushSamples(chunk)
      })
      setStatus('listening')

      timerRef.current = window.setInterval(async () => {
        const det = detectorRef.current
        if (!det || busyRef.current || !det.hasEnoughAudio()) return
        busyRef.current = true
        try {
          const r = await det.infer(sensitivity)
          if (!r) return
          // "Singing" = the model's voicing head fired (r.voiced, i.e.
          // voiceProb >= sensitivity) AND there's real input loudness. The level
          // gate rejects silent-room ghosts; voiceProb is the reliable voicing
          // signal from the retrained model.
          const singing = levelRef.current >= LEVEL_THRESH && r.voiced
          setReading({ ...r, voiced: singing })
          const now = performance.now()

          if (singing) {
            const m = r.noteMidi
            if (candidateRef.current === m) {
              const held = now - candidateStartRef.current
              setHoldProgress(Math.min(1, held / holdMs))
              if (!emittedRef.current && held >= holdMs) {
                emittedRef.current = true
                setHoldProgress(1)
                onNoteRef.current?.({ pc: ((m % 12) + 12) % 12, midi: m })
              }
            } else {
              // New candidate pitch: start its hold timer fresh.
              candidateRef.current = m
              candidateStartRef.current = now
              emittedRef.current = false
              setHoldProgress(0)
            }
          } else {
            // Silence/unvoiced resets the candidate so the SAME note can be sung
            // again later (you must release before re-registering it).
            candidateRef.current = null
            emittedRef.current = false
            setHoldProgress(0)
          }
        } catch {
          // transient inference error; keep going
        } finally {
          busyRef.current = false
        }
      }, TICK_MS)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
      await stop()
      setStatus('error')
    }
  }, [holdMs, sensitivity, stop])

  return { status, error, reading, holdProgress, level, start, stop }
}
