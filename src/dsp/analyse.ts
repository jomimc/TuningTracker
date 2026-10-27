import type { AnalysisParams, AnalysisResult, FrameTable, NoteStats } from './types';
import { analyseFrames, applyGates } from './frames';
import { segmentNotes } from './segment';
import { noteStats } from './notes';

/** Full pipeline: samples -> frames -> gates -> segments -> note stats. */
export function analyse(
  samples: Float32Array,
  sampleRate: number,
  p: AnalysisParams,
  onProgress?: (frac: number) => void,
): AnalysisResult {
  const frames = analyseFrames(samples, sampleRate, p, onProgress);
  return { frames, notes: notesFromFrames(frames, p), params: p, durationS: samples.length / sampleRate };
}

/** Re-run everything after the tracker (gates, segmentation, stats). */
export function reanalyse(frames: FrameTable, p: AnalysisParams): AnalysisResult {
  applyGates(frames, p);
  return { frames, notes: notesFromFrames(frames, p), params: p, durationS: frames.t[frames.t.length - 1] };
}

export function notesFromFrames(frames: FrameTable, p: AnalysisParams): NoteStats[] {
  const segs = segmentNotes(frames, p);
  return segs.map((s, i) => noteStats(frames, s, i, p));
}

export * from './types';
export * from './cents';
export * from './stats';
export { analyseFrames, applyGates, rmsDb } from './frames';
export { segmentNotes } from './segment';
export { noteStats } from './notes';
export { makeTracker, MpmTracker, YinTracker } from './trackers';
