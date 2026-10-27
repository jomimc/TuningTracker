import { describe, expect, it } from 'vitest';
import { makeTracker } from '../../src/dsp/trackers';
import { hzToCents } from '../../src/dsp/cents';

const SR = 48000;

function tone(hz: number, n: number, harmonics = [1]): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < harmonics.length; k++) v += harmonics[k] * Math.sin(2 * Math.PI * hz * (k + 1) * t + 0.3 * k);
    out[i] = 0.3 * v;
  }
  return out;
}

const testHz = [87.3, 146.8, 293.7, 587.3, 1174.7, 2349.3, 3100];

for (const kind of ['mpm', 'yin'] as const) {
  describe(`${kind} tracker`, () => {
    const tr = makeTracker(kind, { frameSize: 2048, fmin: 80, fmax: 3300, sampleRate: SR });

    it('finds pure tones within 2 cents across the range', () => {
      for (const hz of testHz) {
        const r = tr.estimate(tone(hz, 2048), SR);
        const err = hzToCents(r.f0, hz);
        expect(Math.abs(err), `${kind} at ${hz} Hz gave ${r.f0}`).toBeLessThan(2);
        expect(r.clarity).toBeGreaterThan(0.9);
      }
    });

    it('does not octave-jump on a harmonic-rich tone', () => {
      for (const hz of [146.8, 440, 1174.7]) {
        const r = tr.estimate(tone(hz, 2048, [1, 0.8, 0.6, 0.4, 0.2]), SR);
        expect(Math.abs(hzToCents(r.f0, hz)), `${kind} at ${hz} Hz gave ${r.f0}`).toBeLessThan(3);
      }
    });

    it('reports low clarity on noise', () => {
      const noise = new Float32Array(2048);
      let seed = 1;
      for (let i = 0; i < noise.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; noise[i] = seed / 2 ** 32 - 0.5; }
      const r = tr.estimate(noise, SR);
      expect(r.clarity).toBeLessThan(0.9);
    });
  });
}
