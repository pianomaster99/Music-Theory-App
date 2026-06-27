// Minimal iterative radix-2 Cooley-Tukey FFT, specialised for real input.
//
// Matches numpy.fft.rfft's convention (X[k] = sum_n x[n] e^{-2πi kn/N}) closely
// enough for a power spectrum (magnitude is sign-of-exponent invariant). Used by
// the in-browser log-mel front-end so it mirrors ml/features.py.

/** Real-input FFT producing the one-sided power spectrum (n/2 + 1 bins). */
export class RealFFT {
  readonly n: number
  private readonly cos: Float32Array
  private readonly sin: Float32Array
  private readonly rev: Uint32Array
  private readonly re: Float32Array
  private readonly im: Float32Array
  private readonly pow: Float32Array

  constructor(n: number) {
    if ((n & (n - 1)) !== 0) throw new Error(`FFT size must be a power of two, got ${n}`)
    this.n = n
    this.re = new Float32Array(n)
    this.im = new Float32Array(n)
    this.pow = new Float32Array(n / 2 + 1)

    // Bit-reversal permutation indices.
    this.rev = new Uint32Array(n)
    const bits = Math.log2(n)
    for (let i = 0; i < n; i++) {
      let x = i
      let r = 0
      for (let b = 0; b < bits; b++) {
        r = (r << 1) | (x & 1)
        x >>= 1
      }
      this.rev[i] = r
    }

    // Twiddle factors for the forward transform (e^{-2πi k/n}).
    this.cos = new Float32Array(n / 2)
    this.sin = new Float32Array(n / 2)
    for (let k = 0; k < n / 2; k++) {
      const a = (-2 * Math.PI * k) / n
      this.cos[k] = Math.cos(a)
      this.sin[k] = Math.sin(a)
    }
  }

  /**
   * Compute the one-sided power spectrum |X[k]|^2 for k in [0, n/2].
   * `frame` must have length n. The returned array is reused between calls.
   */
  power(frame: Float32Array): Float32Array {
    const { n, re, im, rev, cos, sin, pow } = this
    // Load with bit-reversed order; input is real so imag starts at 0.
    for (let i = 0; i < n; i++) {
      re[i] = frame[rev[i]]
      im[i] = 0
    }
    // Iterative butterflies.
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1
      const step = n / len
      for (let i = 0; i < n; i += len) {
        let k = 0
        for (let j = i; j < i + half; j++) {
          const tw = k
          const c = cos[tw]
          const s = sin[tw]
          const jh = j + half
          const tre = c * re[jh] - s * im[jh]
          const tim = c * im[jh] + s * re[jh]
          re[jh] = re[j] - tre
          im[jh] = im[j] - tim
          re[j] += tre
          im[j] += tim
          k += step
        }
      }
    }
    for (let k = 0; k <= n / 2; k++) {
      pow[k] = re[k] * re[k] + im[k] * im[k]
    }
    return pow
  }
}
