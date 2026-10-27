import type { AnalysisResult } from '../dsp/types';
import { encodeWav } from '../audio/wav';

export function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function framesCsv(r: AnalysisResult): string {
  const { t, f0Raw, f0, clarity, rmsDb, voiced } = r.frames;
  const lines = ['t_s,f0_raw_hz,f0_hz,clarity,rms_db,voiced'];
  for (let i = 0; i < t.length; i++) {
    lines.push([t[i].toFixed(4), num(f0Raw[i], 3), num(f0[i], 3), clarity[i].toFixed(3), rmsDb[i].toFixed(2), voiced[i]].join(','));
  }
  return lines.join('\n');
}

export function notesCsv(r: AnalysisResult): string {
  const cols = ['index', 'startT', 'endT', 'nFrames', 'name', 'midi', 'medianHz', 'medianCentsAbs', 'centsDev', 'centsAtRef',
    'madCents', 'p10', 'p90', 'medianDb', 'minDb', 'maxDb', 'slopeCentsPerDb', 'interceptCents', 'corr'] as const;
  const lines = [cols.join(',')];
  for (const n of r.notes) lines.push(cols.map((c) => (typeof n[c] === 'number' ? num(n[c] as number, 4) : String(n[c]))).join(','));
  return lines.join('\n');
}

export function sessionJson(r: AnalysisResult, meta: Record<string, unknown>): string {
  const fr = r.frames;
  const round = (a: ArrayLike<number>, d: number) => Array.from(a, (v) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null));
  return JSON.stringify({
    app: 'TuningTracker', version: 1, created: new Date().toISOString(), meta,
    params: r.params, durationS: r.durationS,
    frames: { sampleRate: fr.sampleRate, frameSize: fr.frameSize, hop: fr.hop,
      t: round(fr.t, 4), f0Raw: round(fr.f0Raw, 3), f0: round(fr.f0, 3), clarity: round(fr.clarity, 3), rmsDb: round(fr.rmsDb, 2), voiced: Array.from(fr.voiced) },
    notes: r.notes,
  });
}

export function wavBlob(samples: Float32Array, sampleRate: number): Blob {
  return encodeWav(samples, sampleRate);
}

function num(v: number, d: number): string {
  return Number.isFinite(v) ? v.toFixed(d) : '';
}
