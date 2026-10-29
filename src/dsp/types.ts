/**
 * Core data types. Everything here is plain data so the DSP layer can be
 * unit-tested without a browser and so results serialise to JSON directly.
 */

/** Per-frame analysis results, column-oriented (one typed array per column). */
export interface FrameTable {
  /** Frame centre times in seconds. */
  t: Float64Array;
  /** f0 in Hz as tracked, NaN where no estimate. */
  f0Raw: Float32Array;
  /** f0 in Hz after cleaning (median filter, octave fold). NaN where unvoiced. */
  f0: Float32Array;
  /** Tracker confidence 0..1 (MPM clarity, or 1 - YIN aperiodicity). */
  clarity: Float32Array;
  /** Frame RMS level in dBFS. */
  rmsDb: Float32Array;
  /** True where the frame passed all gates. */
  voiced: Uint8Array;
  sampleRate: number;
  frameSize: number;
  hop: number;
}

export interface NoteStats {
  /** Index into the notes array. */
  index: number;
  startT: number;
  endT: number;
  /** Frame index range [first, last] inclusive. */
  frameRange: [number, number];
  nFrames: number;
  medianHz: number;
  /** Median cents relative to A4 (continuous, not rounded to a note). */
  medianCentsAbs: number;
  /** Nearest 12-TET MIDI note number. */
  midi: number;
  /** Note name like "D5". */
  name: string;
  /** Median deviation from the nearest 12-TET note, in cents. */
  centsDev: number;
  /** Median absolute deviation of cents within the note. */
  madCents: number;
  /** 10th and 90th percentile of cents deviation. */
  p10: number;
  p90: number;
  /** Level statistics in dBFS (after any reference shift). */
  medianDb: number;
  minDb: number;
  maxDb: number;
  /** Theil-Sen slope of cents against dB; NaN if dB span too small. */
  slopeCentsPerDb: number;
  /** Intercept so that cents = slope * db + intercept. */
  interceptCents: number;
  /** Pearson correlation of cents vs dB; NaN if undefined. */
  corr: number;
  /** Cents deviation predicted at the reference level (NaN if none). */
  centsAtRef: number;
  /** Number of separate played segments pooled into this row (1 in sequence mode). */
  occurrences: number;
  /** Total analysed duration in seconds (sum over occurrences). */
  durS: number;
}

/** One played segment on the timeline, and which row of `notes` it belongs to. */
export interface SegmentSpan {
  startT: number;
  endT: number;
  note: number;
}

export interface AnalysisParams {
  /**
   * 'sequence': each played note is its own row, in order.
   * 'tune': all occurrences of the same 12-TET note are pooled into one row.
   */
  mode: 'sequence' | 'tune';
  /** Sequence mode: keep at most this many notes (the first ones played). */
  maxNotes: number;
  /** 'mpm' (McLeod via pitchy) or 'yin'. */
  tracker: 'mpm' | 'yin';
  frameSize: number;
  hop: number;
  /** Lowest/highest f0 to accept, Hz (tracker search range incl. margin). */
  fmin: number;
  fmax: number;
  /** Minimum tracker confidence to count a frame as voiced. */
  clarityMin: number;
  /** Frames below this dBFS are unvoiced. */
  noiseFloorDb: number;
  /** Median filter length in frames for f0 cleaning (odd; 1 = off). */
  medianFrames: number;
  /** Segmentation: max unvoiced gap inside a note, seconds. */
  maxGapS: number;
  /** Segmentation: minimum note duration, seconds. */
  minDurS: number;
  /** Segmentation: split when a frame departs this many cents from the running median. */
  jumpCents: number;
  /** Discard this many seconds after each note onset (settling). */
  onsetDiscardS: number;
  /** Reference pitch for A4 in Hz. */
  a4: number;
  /** Reference level in dBFS at which centsAtRef is evaluated; NaN = none. */
  refDb: number;
}

export const DEFAULT_PARAMS: AnalysisParams = {
  mode: 'sequence',
  maxNotes: 50,
  tracker: 'mpm',
  frameSize: 2048,
  hop: 256,
  fmin: 80,
  fmax: 3300,
  clarityMin: 0.9,
  noiseFloorDb: -60,
  medianFrames: 5,
  maxGapS: 0.05,
  minDurS: 0.3,
  jumpCents: 50,
  onsetDiscardS: 0.1,
  a4: 440,
  refDb: NaN,
};

export interface AnalysisResult {
  frames: FrameTable;
  notes: NoteStats[];
  /** Frame indices belonging to each row of `notes`. */
  noteFrames: number[][];
  /** Every played segment on the timeline (more than notes.length in tune mode). */
  segments: SegmentSpan[];
  /** Sequence mode: number of notes dropped because of maxNotes. */
  truncated: number;
  params: AnalysisParams;
  durationS: number;
}
