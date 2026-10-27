import { analyseFrames } from '../dsp/frames';
import type { AnalysisParams, FrameTable } from '../dsp/types';

export interface WorkerRequest {
  samples: Float32Array;
  sampleRate: number;
  params: AnalysisParams;
}
export type WorkerResponse =
  | { type: 'progress'; frac: number }
  | { type: 'done'; frames: FrameTable };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { samples, sampleRate, params } = e.data;
  const frames = analyseFrames(samples, sampleRate, params, (frac) => {
    (self as unknown as Worker).postMessage({ type: 'progress', frac } satisfies WorkerResponse);
  });
  const msg: WorkerResponse = { type: 'done', frames };
  (self as unknown as Worker).postMessage(msg, [
    frames.t.buffer, frames.f0Raw.buffer, frames.f0.buffer, frames.clarity.buffer,
    frames.rmsDb.buffer, frames.voiced.buffer,
  ]);
};
