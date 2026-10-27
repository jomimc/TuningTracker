import { describe, expect, it } from 'vitest';
import { analyse, DEFAULT_PARAMS, reanalyse } from '../../src/dsp/analyse';
import { synthSequence } from '../../src/dsp/synth';
import { centsToHz, midiToHz, nameToMidi } from '../../src/dsp/cents';

const SR = 44100;

describe('pipeline on a synthetic scale', () => {
  // D major scale, each note detuned by a known amount.
  const names = ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'];
  const detune = [0, 12, -20, 5, 0, 33, -8, 15];
  const specs = names.map((n, i) => ({
    hz: centsToHz((nameToMidi(n) - 69) * 100 + detune[i]),
    durS: 0.6,
    amp: 0.2,
    harmonics: [1, 0.5, 0.25],
  }));
  const samples = synthSequence(specs, SR, 0.15);

  for (const tracker of ['mpm', 'yin'] as const) {
    it(`${tracker}: finds 8 notes with correct names and deviations`, () => {
      const res = analyse(samples, SR, { ...DEFAULT_PARAMS, tracker });
      expect(res.notes.map((n) => n.name)).toEqual(names);
      res.notes.forEach((n, i) => {
        expect(Math.abs(n.centsDev - detune[i]), `${n.name}`).toBeLessThan(2);
        expect(n.madCents).toBeLessThan(2);
      });
    });
  }

  it('reanalyse with stricter minimum duration drops all notes', () => {
    const res = analyse(samples, SR, DEFAULT_PARAMS);
    const res2 = reanalyse(res.frames, { ...DEFAULT_PARAMS, minDurS: 2 });
    expect(res2.notes.length).toBe(0);
  });
});

describe('pipeline on a dynamic sweep with pitch-level coupling', () => {
  // Amplitude ramps up and down; pitch rises 3 cents per dB of level, like a whistle.
  const base = midiToHz(nameToMidi('A5'));
  const durS = 3;
  const ampAt = (t: number) => 0.02 * Math.pow(10, (20 * Math.sin((Math.PI * t) / durS)) / 20); // 20 dB swing
  const n = Math.round(durS * SR);
  const samples = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const a = ampAt(t);
    const dbRel = 20 * Math.log10(a / 0.02); // 0..20
    const hz = base * Math.pow(2, (3 * dbRel) / 1200);
    phase += (2 * Math.PI * hz) / SR;
    samples[i] = a * Math.sin(phase);
  }

  it('recovers the cents-per-dB slope', () => {
    const res = analyse(samples, SR, { ...DEFAULT_PARAMS, onsetDiscardS: 0.05 });
    expect(res.notes.length).toBe(1);
    const note = res.notes[0];
    expect(note.name).toBe('A5');
    expect(Math.abs(note.slopeCentsPerDb - 3)).toBeLessThan(0.3);
    expect(note.maxDb - note.minDb).toBeGreaterThan(15);
    expect(note.corr).toBeGreaterThan(0.95);
  });

  it('a gradual sweep is not split by the jump rule', () => {
    const res = analyse(samples, SR, { ...DEFAULT_PARAMS, jumpCents: 20, onsetDiscardS: 0.05 });
    expect(res.notes.length).toBe(1);
  });
});

describe('jump split', () => {
  // Two slurred tones with no gap: A5 then A5 + 40 cents.
  const n1 = Math.round(0.8 * SR), n2 = Math.round(0.8 * SR);
  const samples = new Float32Array(n1 + n2);
  const hz1 = midiToHz(nameToMidi('A5')), hz2 = hz1 * Math.pow(2, 40 / 1200);
  let phase = 0;
  for (let i = 0; i < n1 + n2; i++) {
    phase += (2 * Math.PI * (i < n1 ? hz1 : hz2)) / SR;
    samples[i] = 0.2 * Math.sin(phase);
  }
  it('splits a 40-cent step when jumpCents is 30, not when 50', () => {
    const a = analyse(samples, SR, { ...DEFAULT_PARAMS, jumpCents: 30 });
    expect(a.notes.length).toBe(2);
    expect(Math.abs(a.notes[0].centsDev)).toBeLessThan(2);
    expect(Math.abs(a.notes[1].centsDev - 40)).toBeLessThan(2);
    const b = analyse(samples, SR, { ...DEFAULT_PARAMS, jumpCents: 50 });
    expect(b.notes.length).toBe(1);
  });
});
