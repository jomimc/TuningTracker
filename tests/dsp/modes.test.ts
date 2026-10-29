import { describe, expect, it } from 'vitest';
import { analyse, DEFAULT_PARAMS, reanalyse } from '../../src/dsp/analyse';
import { synthSequence } from '../../src/dsp/synth';
import { centsToHz, nameToMidi } from '../../src/dsp/cents';

const SR = 44100;
const tone = (name: string, cents: number, amp = 0.2) => ({
  hz: centsToHz((nameToMidi(name) - 69) * 100 + cents),
  durS: 0.6,
  amp,
  harmonics: [1, 0.5, 0.25],
});

// A short "tune": D5 E5 D5 F#5 E5 D5, with each occurrence slightly different.
const tune = [
  tone('D5', 0), tone('E5', 10), tone('D5', 4), tone('F#5', -20), tone('E5', 14), tone('D5', 8),
];
const samples = synthSequence(tune, SR, 0.15);

describe('tune mode', () => {
  const res = analyse(samples, SR, { ...DEFAULT_PARAMS, mode: 'tune' });

  it('pools occurrences into one row per note, sorted by pitch', () => {
    expect(res.notes.map((n) => n.name)).toEqual(['D5', 'E5', 'F#5']);
    expect(res.notes.map((n) => n.occurrences)).toEqual([3, 2, 1]);
    expect(res.segments.length).toBe(6);
    expect(res.segments.map((s) => s.note)).toEqual([0, 1, 0, 2, 1, 0]);
  });

  it('reports the pooled median and spread', () => {
    const [d, e, fs] = res.notes;
    // Median of equal-length occurrences at 0, 4 and 8 cents is 4 cents.
    expect(Math.abs(d.centsDev - 4)).toBeLessThan(1.5);
    expect(d.p90 - d.p10).toBeGreaterThan(6);
    expect(Math.abs(e.centsDev - 12)).toBeLessThan(3);
    expect(Math.abs(fs.centsDev + 20)).toBeLessThan(1.5);
    expect(d.nFrames).toBe(res.noteFrames[0].length);
    expect(d.durS).toBeGreaterThan(1.2);
  });

  it('switching mode on existing frames needs no re-tracking', () => {
    const seq = reanalyse(res.frames, { ...DEFAULT_PARAMS, mode: 'sequence' });
    expect(seq.notes.map((n) => n.name)).toEqual(['D5', 'E5', 'D5', 'F#5', 'E5', 'D5']);
    expect(seq.notes.every((n) => n.occurrences === 1)).toBe(true);
  });
});

describe('sequence mode', () => {
  it('keeps notes in order and stops at maxNotes', () => {
    const res = analyse(samples, SR, { ...DEFAULT_PARAMS, mode: 'sequence', maxNotes: 4 });
    expect(res.notes.map((n) => n.name)).toEqual(['D5', 'E5', 'D5', 'F#5']);
    expect(res.truncated).toBe(2);
    expect(res.segments.length).toBe(4);
  });

  it('has a default limit of 50', () => {
    expect(DEFAULT_PARAMS.maxNotes).toBe(50);
    const res = analyse(samples, SR, DEFAULT_PARAMS);
    expect(res.notes.length).toBe(6);
    expect(res.truncated).toBe(0);
  });
});
