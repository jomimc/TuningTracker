import type { AnalysisParams, FrameTable } from './types';
import { makeTracker } from './trackers';
import { medianFilter } from './stats';
import { hzToCents } from './cents';

/** RMS of a frame in dBFS (full-scale sine = -3 dB, full-scale square = 0 dB). */
export function rmsDb(frame: Float32Array): number {
  let s = 0;
  for (let i = 0; i < frame.length; i++) s += frame[i] * frame[i];
  const rms = Math.sqrt(s / frame.length);
  return 20 * Math.log10(rms + 1e-12);
}

/**
 * Run the tracker and RMS over the whole signal with centred frames
 * (zero-padded at the edges, like librosa center=True), so frame i is
 * centred at sample i*hop and t = i*hop/sr.
 */
export function analyseFrames(
  samples: Float32Array,
  sampleRate: number,
  p: AnalysisParams,
  onProgress?: (frac: number) => void,
): FrameTable {
  const { frameSize, hop } = p;
  const n = Math.floor(samples.length / hop) + 1;
  const tracker = makeTracker(p.tracker, { frameSize, fmin: p.fmin, fmax: p.fmax, sampleRate });
  const frame = new Float32Array(frameSize);
  const half = Math.floor(frameSize / 2);

  const t = new Float64Array(n);
  const f0Raw = new Float32Array(n);
  const clarity = new Float32Array(n);
  const db = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const start = i * hop - half;
    for (let j = 0; j < frameSize; j++) {
      const k = start + j;
      frame[j] = k >= 0 && k < samples.length ? samples[k] : 0;
    }
    t[i] = (i * hop) / sampleRate;
    db[i] = rmsDb(frame);
    const r = tracker.estimate(frame, sampleRate);
    f0Raw[i] = r.f0;
    clarity[i] = r.clarity;
    if (onProgress && (i & 255) === 0) onProgress(i / n);
  }

  const table: FrameTable = {
    t, f0Raw, clarity, rmsDb: db,
    f0: new Float32Array(n), voiced: new Uint8Array(n),
    sampleRate, frameSize, hop,
  };
  applyGates(table, p);
  return table;
}

/**
 * Recompute `voiced` and cleaned `f0` from the raw columns. Cheap, so the UI
 * can re-run it when the user changes a gate without re-tracking.
 */
export function applyGates(fr: FrameTable, p: AnalysisParams): void {
  const n = fr.t.length;
  const gated = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ok = Number.isFinite(fr.f0Raw[i]) && fr.clarity[i] >= p.clarityMin && fr.rmsDb[i] >= p.noiseFloorDb
      && fr.f0Raw[i] >= p.fmin && fr.f0Raw[i] <= p.fmax;
    gated[i] = ok ? fr.f0Raw[i] : NaN;
  }
  // Median filter in the cents domain, then convert back.
  const cents = new Float32Array(n);
  for (let i = 0; i < n; i++) cents[i] = Number.isFinite(gated[i]) ? hzToCents(gated[i], p.a4) : NaN;
  const smooth = medianFilter(cents, p.medianFrames);
  for (let i = 0; i < n; i++) {
    const v = Number.isFinite(smooth[i]);
    fr.voiced[i] = v ? 1 : 0;
    fr.f0[i] = v ? p.a4 * Math.pow(2, smooth[i] / 1200) : NaN;
  }
}
