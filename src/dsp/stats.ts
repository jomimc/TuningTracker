/** Small numeric helpers over plain arrays. NaNs are ignored everywhere. */

export function finite(xs: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < xs.length; i++) if (Number.isFinite(xs[i])) out.push(xs[i]);
  return out;
}

export function quantile(xs: ArrayLike<number>, q: number): number {
  const v = finite(xs).sort((a, b) => a - b);
  if (v.length === 0) return NaN;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export function median(xs: ArrayLike<number>): number {
  return quantile(xs, 0.5);
}

/** Median absolute deviation (unscaled). */
export function mad(xs: ArrayLike<number>): number {
  const m = median(xs);
  if (!Number.isFinite(m)) return NaN;
  const dev = finite(xs).map((x) => Math.abs(x - m));
  return median(dev);
}

export function pearson(xs: ArrayLike<number>, ys: ArrayLike<number>): number {
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i], y = ys[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  if (n < 3) return NaN;
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return NaN;
  return cov / Math.sqrt(vx * vy);
}

/**
 * Theil-Sen robust line fit y = slope * x + intercept.
 * Uses all pairs up to a cap, then random pairs beyond it to bound cost.
 */
export function theilSen(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  maxPairs = 20000,
): { slope: number; intercept: number } {
  const x: number[] = [], y: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) { x.push(xs[i]); y.push(ys[i]); }
  }
  const n = x.length;
  if (n < 3) return { slope: NaN, intercept: NaN };
  const slopes: number[] = [];
  const allPairs = (n * (n - 1)) / 2;
  if (allPairs <= maxPairs) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = x[j] - x[i];
      if (dx !== 0) slopes.push((y[j] - y[i]) / dx);
    }
  } else {
    // Deterministic pseudo-random pairs so results are reproducible.
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let k = 0; k < maxPairs; k++) {
      const i = Math.floor(rnd() * n), j = Math.floor(rnd() * n);
      const dx = x[j] - x[i];
      if (i !== j && dx !== 0) slopes.push((y[j] - y[i]) / dx);
    }
  }
  if (slopes.length === 0) return { slope: NaN, intercept: NaN };
  const slope = median(slopes);
  const intercept = median(y.map((yi, i) => yi - slope * x[i]));
  return { slope, intercept };
}

/** Running median filter of odd length `k`; NaNs are skipped within the window. */
export function medianFilter(xs: Float32Array, k: number): Float32Array {
  if (k <= 1) return xs.slice();
  const half = Math.floor(k / 2);
  const out = new Float32Array(xs.length);
  const win: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    win.length = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(xs.length - 1, i + half); j++) {
      if (Number.isFinite(xs[j])) win.push(xs[j]);
    }
    out[i] = Number.isFinite(xs[i]) && win.length > 0 ? median(win) : NaN;
  }
  return out;
}
