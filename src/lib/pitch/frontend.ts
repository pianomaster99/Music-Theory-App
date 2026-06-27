// In-browser log-mel front-end, a faithful port of ml/features.py.
//
// Uses the EXACT Hann window + Slaney mel filterbank exported by
// ml/export_onnx.py (public/models/pitch_frontend.json) so the model sees the
// same input distribution it trained on. We only reimplement framing + FFT +
// matmul + log here; the tables themselves come from Python.

import { RealFFT } from './fft'

export interface FrontendConfig {
  sr: number
  n_fft: number
  hop: number
  win: number
  n_mels: number
  fmin: number
  fmax: number
  n_classes: number
  piano_midi_min: number
  frame_rate: number
  hann: number[]
  mel_fb_shape: [number, number]
  mel_fb: number[]
}

/** Fixed-capacity ring buffer of mono audio samples. */
class SampleRing {
  private buf: Float32Array
  private write = 0
  private filled = 0
  constructor(capacity: number) {
    this.buf = new Float32Array(capacity)
  }

  push(chunk: Float32Array): void {
    const cap = this.buf.length
    for (let i = 0; i < chunk.length; i++) {
      this.buf[this.write] = chunk[i]
      this.write = (this.write + 1) % cap
    }
    this.filled = Math.min(cap, this.filled + chunk.length)
  }

  get count(): number {
    return this.filled
  }

  /** Copy the most recent `n` samples (oldest-first) into `out`; left-pads 0. */
  readLast(n: number, out: Float32Array): void {
    const cap = this.buf.length
    const avail = Math.min(n, this.filled)
    const pad = n - avail
    for (let i = 0; i < pad; i++) out[i] = 0
    // The most recent sample sits at (write-1); the oldest of the last `avail`
    // is at write-avail.
    let idx = (this.write - avail + cap * 2) % cap
    for (let i = 0; i < avail; i++) {
      out[pad + i] = this.buf[idx]
      idx = (idx + 1) % cap
    }
  }
}

export class LogMelFrontEnd {
  readonly cfg: FrontendConfig
  private readonly fft: RealFFT
  private readonly hann: Float32Array
  private readonly melFb: Float32Array // (n_mels * (n_fft/2+1)) row-major
  private readonly nBins: number
  private readonly ring: SampleRing
  private readonly winBuf: Float32Array
  private sampleBuf: Float32Array | null = null

  constructor(cfg: FrontendConfig, ringSeconds = 4) {
    this.cfg = cfg
    this.fft = new RealFFT(cfg.n_fft)
    this.hann = Float32Array.from(cfg.hann)
    this.melFb = Float32Array.from(cfg.mel_fb)
    this.nBins = cfg.n_fft / 2 + 1
    this.ring = new SampleRing(Math.ceil(cfg.sr * ringSeconds))
    this.winBuf = new Float32Array(cfg.win)
  }

  /** Feed freshly captured (16 kHz mono) samples. */
  push(samples: Float32Array): void {
    this.ring.push(samples)
  }

  get sampleCount(): number {
    return this.ring.count
  }

  /**
   * Compute raw (un-normalised) log-mel for the most recent `nFrames` frames.
   * Returns a Float32Array of length nFrames * n_mels (row-major, time-major).
   * Frame f spans samples [f*hop, f*hop + win) within the recent window, so the
   * last frame ends at the newest sample (causal / right-aligned).
   */
  logMelWindow(nFrames: number): Float32Array {
    const { hop, win, n_mels } = this.cfg
    const total = (nFrames - 1) * hop + win
    if (!this.sampleBuf || this.sampleBuf.length !== total) {
      this.sampleBuf = new Float32Array(total)
    }
    const samples = this.sampleBuf
    this.ring.readLast(total, samples)

    const out = new Float32Array(nFrames * n_mels)
    for (let f = 0; f < nFrames; f++) {
      const start = f * hop
      for (let i = 0; i < win; i++) this.winBuf[i] = samples[start + i] * this.hann[i]
      const power = this.fft.power(this.winBuf) // (nBins,)
      const base = f * n_mels
      for (let m = 0; m < n_mels; m++) {
        let acc = 0
        const row = m * this.nBins
        for (let k = 0; k < this.nBins; k++) acc += this.melFb[row + k] * power[k]
        out[base + m] = Math.log(acc + 1e-6)
      }
    }
    return out
  }
}
