import type { AnalysisParams, FrameTable, NoteStats } from './types';
import type { Segment } from './segment';
import { centsDeviation, hzToCents, hzToMidi, midiToName } from './cents';
import { mad, median, pearson, quantile, theilSen } from './stats';

/** Per-note statistics for one segment. `dbOffset` is added to all levels. */
export function noteStats(
  fr: FrameTable,
  seg: Segment,
  index: number,
  p: AnalysisParams,
  dbOffset = 0,
): NoteStats {
  const hz = seg.map((i) => fr.f0[i]);
  const centsAbs = hz.map((h) => hzToCents(h, p.a4));
  const db = seg.map((i) => fr.rmsDb[i] + dbOffset);

  const medHz = median(hz);
  const medCentsAbs = median(centsAbs);
  const midi = Math.round(hzToMidi(medHz, p.a4));
  // Deviation of every frame from the note's nearest 12-TET pitch, so that
  // percentiles and slopes are in the same units as centsDev.
  const noteCentsAbs = (midi - 69) * 100;
  const dev = centsAbs.map((c) => c - noteCentsAbs);

  const span = Math.max(...db) - Math.min(...db);
  const fit = span >= 3 ? theilSen(db, dev) : { slope: NaN, intercept: NaN };
  const corr = span >= 3 ? pearson(db, dev) : NaN;
  const centsAtRef = Number.isFinite(p.refDb) && Number.isFinite(fit.slope)
    ? fit.slope * p.refDb + fit.intercept : NaN;

  return {
    index,
    startT: fr.t[seg[0]],
    endT: fr.t[seg[seg.length - 1]],
    frameRange: [seg[0], seg[seg.length - 1]],
    nFrames: seg.length,
    medianHz: medHz,
    medianCentsAbs: medCentsAbs,
    midi,
    name: midiToName(midi),
    centsDev: centsDeviation(medCentsAbs),
    madCents: mad(dev),
    p10: quantile(dev, 0.1),
    p90: quantile(dev, 0.9),
    medianDb: median(db),
    minDb: Math.min(...db),
    maxDb: Math.max(...db),
    slopeCentsPerDb: fit.slope,
    interceptCents: fit.intercept,
    corr,
    centsAtRef,
  };
}
