// Real-time pitch detector: log-mel front-end -> ONNX PitchCRNN -> note reading.
//
// Runs the model on a rolling window of recent frames each tick and decodes the
// LATEST frame (causal streaming). The window is normalised the same way
// training normalised a clip ((x-mean)/(std+eps) over the whole input).

// wasm-only bundled build: Vite resolves the embedded .wasm via import.meta.url.
// Do NOT set ort.env.wasm.wasmPaths to /public — Vite cannot serve those .mjs
// glue files as ES modules in dev.
import * as ort from 'onnxruntime-web/wasm'
import { LogMelFrontEnd, type FrontendConfig } from './frontend'

// Single-threaded wasm avoids needing cross-origin isolation (SharedArrayBuffer).
ort.env.wasm.numThreads = 1

const MODEL_URL = '/models/pitch_crnn.onnx'
const FRONTEND_URL = '/models/pitch_frontend.json'
const WINDOW_FRAMES = 200 // ~2 s of context fed to the model each tick

export interface PitchReading {
  voiced: boolean
  voiceProb: number
  /** Continuous MIDI estimate (soft-argmax around the peak). */
  midi: number
  /** Nearest integer MIDI note. */
  noteMidi: number
  /** Cents deviation from the nearest semitone, -50..+50. */
  cents: number
  freq: number
  /** Softmax peak probability (pitch confidence). */
  confidence: number
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

export class PitchDetector {
  private session: ort.InferenceSession | null = null
  private frontend: LogMelFrontEnd | null = null
  private cfg: FrontendConfig | null = null
  ready = false

  async init(): Promise<void> {
    if (this.ready) return
    const cfg: FrontendConfig = await fetch(FRONTEND_URL).then((r) => {
      if (!r.ok) throw new Error(`failed to load ${FRONTEND_URL}: ${r.status}`)
      return r.json()
    })
    this.cfg = cfg
    this.frontend = new LogMelFrontEnd(cfg)
    this.session = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    })
    this.ready = true
  }

  pushSamples(chunk: Float32Array): void {
    this.frontend?.push(chunk)
  }

  /**
   * Whether a full window has been buffered. We wait for the whole window so the
   * per-window normalisation matches training (zero-padded frames would skew the
   * mean/std). This adds a ~2 s warm-up after Start.
   */
  hasEnoughAudio(): boolean {
    if (!this.frontend || !this.cfg) return false
    const need = (WINDOW_FRAMES - 1) * this.cfg.hop + this.cfg.win
    return this.frontend.sampleCount >= need
  }

  /** Run inference on the latest window. `sensitivity` is the voicing threshold. */
  async infer(sensitivity: number): Promise<PitchReading | null> {
    if (!this.session || !this.frontend || !this.cfg) return null
    const { n_mels, piano_midi_min, n_classes } = this.cfg

    const raw = this.frontend.logMelWindow(WINDOW_FRAMES)
    // Per-window normalisation (matches training's per-clip standardisation).
    let mean = 0
    for (let i = 0; i < raw.length; i++) mean += raw[i]
    mean /= raw.length
    let varAcc = 0
    for (let i = 0; i < raw.length; i++) {
      const d = raw[i] - mean
      varAcc += d * d
    }
    const std = Math.sqrt(varAcc / raw.length) + 1e-5
    const norm = new Float32Array(raw.length)
    for (let i = 0; i < raw.length; i++) norm[i] = (raw[i] - mean) / std

    const input = new ort.Tensor('float32', norm, [1, WINDOW_FRAMES, n_mels])
    const out = await this.session.run({ lm: input })
    const pitch = out.pitch_logits.data as Float32Array // [1, T, 88]
    const voice = out.voice_logits.data as Float32Array // [1, T]

    const last = WINDOW_FRAMES - 1
    const voiceProb = sigmoid(voice[last])
    const voiced = voiceProb >= sensitivity

    // Decode the last frame's pitch distribution.
    const base = last * n_classes
    let peak = 0
    let peakVal = -Infinity
    for (let c = 0; c < n_classes; c++) {
      const v = pitch[base + c]
      if (v > peakVal) {
        peakVal = v
        peak = c
      }
    }
    // Softmax around the peak for confidence + sub-semitone (soft-argmax).
    const lo = Math.max(0, peak - 2)
    const hi = Math.min(n_classes - 1, peak + 2)
    let z = 0
    for (let c = lo; c <= hi; c++) z += Math.exp(pitch[base + c] - peakVal)
    let wsum = 0
    let csum = 0
    let confidence = 0
    for (let c = lo; c <= hi; c++) {
      const p = Math.exp(pitch[base + c] - peakVal) / z
      wsum += p
      csum += p * c
      if (c === peak) confidence = p
    }
    const contClass = wsum > 0 ? csum / wsum : peak
    const midi = piano_midi_min + contClass
    const noteMidi = Math.round(midi)
    const cents = (midi - noteMidi) * 100
    const freq = 440 * Math.pow(2, (midi - 69) / 12)

    return { voiced, voiceProb, midi, noteMidi, cents, freq, confidence }
  }
}
