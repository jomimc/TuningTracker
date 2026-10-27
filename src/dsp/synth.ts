/** Test-signal helpers (also used by the UI self-test). */

export interface ToneSpec {
  hz: number;
  durS: number;
  /** Linear amplitude 0..1, or a function of time for sweeps. */
  amp: number | ((tS: number) => number);
  /** Relative amplitudes of harmonics 1..N (default: fundamental only). */
  harmonics?: number[];
}

/** Concatenate tones separated by `gapS` of silence. */
export function synthSequence(specs: ToneSpec[], sampleRate: number, gapS = 0.1): Float32Array {
  const total = specs.reduce((s, x) => s + x.durS + gapS, 0);
  const out = new Float32Array(Math.ceil(total * sampleRate));
  let pos = 0;
  for (const spec of specs) {
    const n = Math.round(spec.durS * sampleRate);
    const h = spec.harmonics ?? [1];
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const a = typeof spec.amp === 'function' ? spec.amp(t) : spec.amp;
      let v = 0;
      for (let k = 0; k < h.length; k++) v += h[k] * Math.sin(2 * Math.PI * spec.hz * (k + 1) * t);
      // short fade to avoid clicks
      const env = Math.min(1, i / (0.01 * sampleRate), (n - i) / (0.01 * sampleRate));
      out[pos + i] = a * env * v;
    }
    pos += n + Math.round(gapS * sampleRate);
  }
  return out;
}
