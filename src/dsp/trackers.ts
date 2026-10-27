import { PitchDetector } from 'pitchy';

/**
 * A pitch tracker estimates f0 for one frame of samples.
 * Returns {f0: Hz (NaN if none), clarity: 0..1}.
 * Trackers are stateful (preallocated buffers) and sized to a frame length.
 */
export interface Tracker {
  readonly name: string;
  readonly frameSize: number;
  estimate(frame: Float32Array, sampleRate: number): { f0: number; clarity: number };
}

export interface TrackerOptions {
  frameSize: number;
  fmin: number;
  fmax: number;
}

/** McLeod Pitch Method via pitchy (normalised square difference + key-max picking). */
export class MpmTracker implements Tracker {
  readonly name = 'mpm';
  readonly frameSize: number;
  private det: PitchDetector<Float32Array>;
  private fmin: number;
  private fmax: number;

  constructor(opts: TrackerOptions) {
    this.frameSize = opts.frameSize;
    this.fmin = opts.fmin;
    this.fmax = opts.fmax;
    this.det = PitchDetector.forFloat32Array(opts.frameSize);
    // k from the MPM paper; we gate on clarity ourselves afterwards.
    this.det.clarityThreshold = 0.8;
    this.det.minVolumeDecibels = -80;
  }

  estimate(frame: Float32Array, sampleRate: number) {
    const [f0, clarity] = this.det.findPitch(frame, sampleRate);
    if (!(f0 > 0) || f0 < this.fmin || f0 > this.fmax) return { f0: NaN, clarity: 0 };
    return { f0, clarity };
  }
}

/**
 * YIN (de Cheveigné & Kawahara 2002), time-domain O(N*tau) implementation.
 * Clarity is 1 - d'(tau) at the chosen lag (1 = perfectly periodic).
 */
export class YinTracker implements Tracker {
  readonly name = 'yin';
  readonly frameSize: number;
  private tauMin: number;
  private tauMax: number;
  private d: Float32Array;
  private threshold: number;

  constructor(opts: TrackerOptions & { threshold?: number; sampleRate: number }) {
    this.frameSize = opts.frameSize;
    this.threshold = opts.threshold ?? 0.1;
    this.tauMin = Math.max(2, Math.floor(opts.sampleRate / opts.fmax));
    // Need W + tauMax <= frameSize, with W = frameSize/2 as in librosa.
    this.tauMax = Math.min(Math.floor(this.frameSize / 2) - 1, Math.ceil(opts.sampleRate / opts.fmin));
    this.d = new Float32Array(this.tauMax + 1);
  }

  estimate(frame: Float32Array, sampleRate: number) {
    const W = Math.floor(this.frameSize / 2);
    const d = this.d;
    const tauMax = this.tauMax;
    // Difference function d(tau) = sum_{j<W} (x[j] - x[j+tau])^2
    d[0] = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) {
        const diff = frame[j] - frame[j + tau];
        s += diff * diff;
      }
      d[tau] = s;
    }
    // Cumulative mean normalised difference d'(tau)
    let running = 0;
    const dn = d; // in place
    for (let tau = 1; tau <= tauMax; tau++) {
      running += d[tau];
      dn[tau] = running > 0 ? (d[tau] * tau) / running : 1;
    }
    // Absolute threshold: first tau in [tauMin, tauMax] with dn < threshold, then local min
    let tau = -1;
    for (let t = this.tauMin; t <= tauMax; t++) {
      if (dn[t] < this.threshold) {
        while (t + 1 <= tauMax && dn[t + 1] < dn[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) {
      // No dip under threshold: take the global minimum but report low clarity.
      let best = this.tauMin;
      for (let t = this.tauMin; t <= tauMax; t++) if (dn[t] < dn[best]) best = t;
      tau = best;
    }
    // Parabolic interpolation around tau
    let tauRefined = tau;
    if (tau > 1 && tau < tauMax) {
      const a = dn[tau - 1], b = dn[tau], c = dn[tau + 1];
      const denom = a - 2 * b + c;
      if (denom !== 0) tauRefined = tau + (0.5 * (a - c)) / denom;
    }
    const f0 = sampleRate / tauRefined;
    const clarity = Math.max(0, Math.min(1, 1 - dn[tau]));
    return { f0, clarity };
  }
}

export function makeTracker(
  kind: 'mpm' | 'yin',
  opts: TrackerOptions & { sampleRate: number },
): Tracker {
  return kind === 'yin' ? new YinTracker(opts) : new MpmTracker(opts);
}
