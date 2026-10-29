import type { AnalysisParams, AnalysisResult, FrameTable, NoteStats, SegmentSpan } from './types';
import { analyseFrames, applyGates } from './frames';
import { segmentNotes, type Segment } from './segment';
import { noteStats } from './notes';
import { hzToMidi } from './cents';
import { median } from './stats';

/** Full pipeline: samples -> frames -> gates -> segments -> note stats. */
export function analyse(
  samples: Float32Array,
  sampleRate: number,
  p: AnalysisParams,
  onProgress?: (frac: number) => void,
): AnalysisResult {
  const frames = analyseFrames(samples, sampleRate, p, onProgress);
  return { frames, ...notesFromFrames(frames, p), params: p, durationS: samples.length / sampleRate };
}

/** Re-run everything after the tracker (gates, segmentation, grouping, stats). */
export function reanalyse(frames: FrameTable, p: AnalysisParams): AnalysisResult {
  applyGates(frames, p);
  return { frames, ...notesFromFrames(frames, p), params: p, durationS: frames.t[frames.t.length - 1] };
}

export interface NotesOutput {
  notes: NoteStats[];
  noteFrames: number[][];
  segments: SegmentSpan[];
  truncated: number;
}

/** Segment the gated frames, then build rows according to `p.mode`. */
export function notesFromFrames(frames: FrameTable, p: AnalysisParams): NotesOutput {
  const segs = segmentNotes(frames, p);
  return p.mode === 'tune' ? groupByNote(frames, segs, p) : inSequence(frames, segs, p);
}

const span = (frames: FrameTable, s: Segment, note: number): SegmentSpan =>
  ({ startT: frames.t[s[0]], endT: frames.t[s[s.length - 1]], note });

/** Sequence mode: one row per played note, in order, at most p.maxNotes. */
function inSequence(frames: FrameTable, segs: Segment[], p: AnalysisParams): NotesOutput {
  const max = Math.max(1, Math.floor(p.maxNotes));
  const kept = segs.slice(0, max);
  return {
    notes: kept.map((s, i) => noteStats(frames, s, i, p)),
    noteFrames: kept,
    segments: kept.map((s, i) => span(frames, s, i)),
    truncated: segs.length - kept.length,
  };
}

/**
 * Tune mode: each segment is assigned to the nearest 12-TET note of its own
 * median, and all segments of the same note are pooled into one row.
 * Rows are sorted from low to high pitch.
 */
function groupByNote(frames: FrameTable, segs: Segment[], p: AnalysisParams): NotesOutput {
  const segMidi = segs.map((s) => Math.round(hzToMidi(median(s.map((i) => frames.f0[i])), p.a4)));
  const midis = [...new Set(segMidi)].sort((a, b) => a - b);
  const row = new Map(midis.map((m, i) => [m, i]));
  const noteFrames: number[][] = midis.map(() => []);
  const counts = midis.map(() => 0);
  segs.forEach((s, k) => {
    const r = row.get(segMidi[k])!;
    for (const i of s) noteFrames[r].push(i);
    counts[r]++;
  });
  return {
    notes: midis.map((m, r) => noteStats(frames, noteFrames[r], r, p, { forceMidi: m, occurrences: counts[r] })),
    noteFrames,
    segments: segs.map((s, k) => span(frames, s, row.get(segMidi[k])!)),
    truncated: 0,
  };
}

export * from './types';
export * from './cents';
export * from './stats';
export { analyseFrames, applyGates, rmsDb } from './frames';
export { segmentNotes } from './segment';
export { noteStats } from './notes';
export { makeTracker, MpmTracker, YinTracker } from './trackers';
