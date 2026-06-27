// Microphone capture -> 16 kHz mono Float32 chunks.
//
// Requests a 16 kHz AudioContext (so samples match the model's sample rate). If
// the browser ignores the hint (e.g. Safari forces 44.1/48 kHz) we linearly
// resample each block down to 16 kHz. A ScriptProcessorNode is used for broad
// compatibility (deprecated but simplest); routed through a muted gain so the
// mic isn't played back.

const TARGET_SR = 16000

function resampleLinear(input: Float32Array, fromSr: number, toSr: number): Float32Array {
  if (fromSr === toSr) return input
  const ratio = toSr / fromSr
  const outLen = Math.max(1, Math.round(input.length * ratio))
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const srcPos = i / ratio
    const i0 = Math.floor(srcPos)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const frac = srcPos - i0
    out[i] = input[i0] * (1 - frac) + input[i1] * frac
  }
  return out
}

export class MicCapture {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private muted: GainNode | null = null

  /** Actual context sample rate (for diagnostics). */
  sampleRate = TARGET_SR

  async start(onSamples: (chunk: Float32Array) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    // Try to get a 16 kHz context; fall back to default + resample.
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    try {
      this.ctx = new Ctor({ sampleRate: TARGET_SR })
    } catch {
      this.ctx = new Ctor()
    }
    await this.ctx.resume()
    this.sampleRate = this.ctx.sampleRate

    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.processor = this.ctx.createScriptProcessor(2048, 1, 1)
    const ctxSr = this.ctx.sampleRate
    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      // Copy out (the buffer is reused by the browser).
      const chunk = new Float32Array(input.length)
      chunk.set(input)
      onSamples(ctxSr === TARGET_SR ? chunk : resampleLinear(chunk, ctxSr, TARGET_SR))
    }
    // Muted sink so onaudioprocess fires without audible feedback.
    this.muted = this.ctx.createGain()
    this.muted.gain.value = 0
    this.source.connect(this.processor)
    this.processor.connect(this.muted)
    this.muted.connect(this.ctx.destination)
  }

  async stop(): Promise<void> {
    if (this.processor) {
      this.processor.onaudioprocess = null
      this.processor.disconnect()
    }
    this.source?.disconnect()
    this.muted?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close()
    this.processor = null
    this.source = null
    this.muted = null
    this.stream = null
    this.ctx = null
  }
}
