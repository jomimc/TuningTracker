import type { AnalysisParams, FrameTable } from './types';
import { hzToCents } from './cents';
import { median } from './stats';

/** A note segment as a list of frame indices (voiced frames only). */
export type Segment = number[];

/**
 * Gap-based segmentation with a pitch-jump split.
 * - A new segment starts after an unvoiced gap longer than maxGapS.
 * - A new segment also starts when a frame departs more than jumpCents from
 *   the running median of the current segment (catches slurred notes and
 *   register jumps).
 * - Segments shorter than minDurS are dropped.
 * - The first onsetDiscardS of each segment is removed (settling time).
 */
export function segmentNotes(fr: FrameTable, p: AnalysisParams): Segment[] {
  const idx: number[] = [];
  for (let i = 0; i < fr.t.length; i++) if (fr.voiced[i]) idx.push(i);
  if (idx.length === 0) return [];

  const raw: Segment[] = [];
  let cur: number[] = [idx[0]];
  let curCents: number[] = [hzToCents(fr.f0[idx[0]], p.a4)];
  let runMed = curCents[0];

  for (let k = 1; k < idx.length; k++) {
    const i = idx[k];
    const c = hzToCents(fr.f0[i], p.a4);
    const gap = fr.t[i] - fr.t[idx[k - 1]];
    const jump = Math.abs(c - runMed) > p.jumpCents;
    if (gap > p.maxGapS || jump) {
      raw.push(cur);
      cur = [i];
      curCents = [c];
      runMed = c;
    } else {
      cur.push(i);
      curCents.push(c);
      // Running median over the last 25 frames keeps it responsive but stable.
      if (curCents.length > 25) curCents.shift();
      runMed = median(curCents);
    }
  }
  raw.push(cur);

  // Frames whose analysis window straddles the note boundary have a lower RMS
  // (part of the window is silence) but still a valid pitch, which biases the
  // cents-vs-dB fit. Trim half a window at both ends, plus the onset discard.
  const halfWin = fr.frameSize / (2 * fr.sampleRate);
  const out: Segment[] = [];
  for (const seg of raw) {
    const t0 = fr.t[seg[0]];
    const t1 = fr.t[seg[seg.length - 1]];
    if (t1 - t0 < p.minDurS) continue;
    const kept = seg.filter((i) => fr.t[i] - t0 >= Math.max(p.onsetDiscardS, halfWin) && t1 - fr.t[i] >= halfWin);
    if (kept.length >= 3) out.push(kept);
  }
  return out;
}
