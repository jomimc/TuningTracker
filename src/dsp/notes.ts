import type { AnalysisParams, FrameTable, NoteStats } from './types';
import { hzToCents, hzToMidi, midiToName } from './cents';
import { mad, median, pearson, quantile, theilSen } from './stats';

/**
 * Statistics over a set of frame indices: one played segment (sequence mode)
 * or the union of all occurrences of one note (tune mode).
 * `forceMidi` fixes the note identity; otherwise it is the nearest 12-TET note
 * to the median.
 */
export function noteStats(
  fr: FrameTable,
  frames: number[],
  index: number,
  p: AnalysisParams,
  opts: { forceMidi?: number; occurrences?: number } = {},
): NoteStats {
  const hz = frames.map((i) => fr.f0[i]);
  const centsAbs = hz.map((h) => hzToCents(h, p.a4));
  const db = frames.map((i) => fr.rmsDb[i]);

  const medHz = median(hz);
  const medCentsAbs = median(centsAbs);
  const midi = opts.forceMidi ?? Math.round(hzToMidi(medHz, p.a4));
  // Deviation of every frame from the note's 12-TET pitch, so that
  // percentiles and slopes are in the same units as centsDev.
  const noteCentsAbs = (midi - 69) * 100;
  const dev = centsAbs.map((c) => c - noteCentsAbs);

  // Loops rather than Math.max(...db): pooled notes can have tens of thousands of frames.
  let minDb = Infinity, maxDb = -Infinity;
  for (const d of db) { if (d < minDb) minDb = d; if (d > maxDb) maxDb = d; }
  const span = maxDb - minDb;
  const fit = span >= 3 ? theilSen(db, dev) : { slope: NaN, intercept: NaN };
  const corr = span >= 3 ? pearson(db, dev) : NaN;
  const centsAtRef = Number.isFinite(p.refDb) && Number.isFinite(fit.slope)
    ? fit.slope * p.refDb + fit.intercept : NaN;

  return {
    index,
    startT: fr.t[frames[0]],
    endT: fr.t[frames[frames.length - 1]],
    frameRange: [frames[0], frames[frames.length - 1]],
    nFrames: frames.length,
    medianHz: medHz,
    medianCentsAbs: medCentsAbs,
    midi,
    name: midiToName(midi),
    centsDev: medCentsAbs - noteCentsAbs,
    madCents: mad(dev),
    p10: quantile(dev, 0.1),
    p90: quantile(dev, 0.9),
    medianDb: median(db),
    minDb,
    maxDb,
    slopeCentsPerDb: fit.slope,
    interceptCents: fit.intercept,
    corr,
    centsAtRef,
    occurrences: opts.occurrences ?? 1,
    durS: (frames.length * fr.hop) / fr.sampleRate,
  };
}
