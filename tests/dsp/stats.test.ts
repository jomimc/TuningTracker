import { describe, expect, it } from 'vitest';
import { mad, median, medianFilter, quantile, theilSen } from '../../src/dsp/stats';
import { centsDeviation, hzToCents, midiToName, nameToMidi } from '../../src/dsp/cents';

describe('stats', () => {
  it('median ignores NaN', () => {
    expect(median([3, NaN, 1, 2])).toBe(2);
    expect(median([])).toBeNaN();
  });
  it('quantile interpolates', () => {
    expect(quantile([0, 10], 0.25)).toBe(2.5);
  });
  it('mad', () => {
    expect(mad([1, 2, 3, 4, 100])).toBe(1);
  });
  it('theilSen recovers a line with outliers', () => {
    const x = Array.from({ length: 50 }, (_, i) => i);
    const y = x.map((v) => 2 * v + 1);
    y[10] = 500; y[20] = -300;
    const f = theilSen(x, y);
    expect(f.slope).toBeCloseTo(2, 5);
    expect(f.intercept).toBeCloseTo(1, 5);
  });
  it('medianFilter removes single-frame spikes but keeps NaN gaps', () => {
    const x = new Float32Array([1, 1, 50, 1, 1, NaN, 2, 2, 2]);
    const y = medianFilter(x, 3);
    expect(y[2]).toBe(1);
    expect(y[5]).toBeNaN();
    expect(y[6]).toBe(2);
  });
});

describe('cents', () => {
  it('round trips names', () => {
    expect(nameToMidi('A4')).toBe(69);
    expect(nameToMidi('F#3')).toBe(54);
    expect(nameToMidi('Bb3')).toBe(58);
    expect(midiToName(69)).toBe('A4');
    expect(midiToName(54)).toBe('F#3');
    expect(midiToName(29)).toBe('F1');
  });
  it('deviation lies in (-50, 50]', () => {
    expect(centsDeviation(1200)).toBe(0);
    expect(centsDeviation(1230)).toBe(30);
    expect(centsDeviation(1170)).toBe(-30);
    expect(hzToCents(880)).toBe(1200);
  });
});
