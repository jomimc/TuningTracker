import type { AnalysisParams, AnalysisResult } from '../dsp/types';
import { notesFromFrames } from '../dsp/analyse';
import type { WorkerRequest, WorkerResponse } from './analysis.worker';

/** Run the frame analysis in a Web Worker so the UI stays responsive. */
export function runAnalysis(
  samples: Float32Array,
  sampleRate: number,
  params: AnalysisParams,
  onProgress?: (frac: number) => void,
): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onerror = (e) => { worker.terminate(); reject(e.error ?? new Error(e.message)); };
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'progress') { onProgress?.(e.data.frac); return; }
      worker.terminate();
      const frames = e.data.frames;
      resolve({ frames, notes: notesFromFrames(frames, params), params, durationS: samples.length / sampleRate });
    };
    const req: WorkerRequest = { samples: samples.slice(), sampleRate, params };
    worker.postMessage(req, [req.samples.buffer]);
  });
}
