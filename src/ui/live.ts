import { makeTracker, type Tracker } from '../dsp/trackers';
import { rmsDb } from '../dsp/frames';
import { hzToCents, midiToName } from '../dsp/cents';
import type { AnalysisParams } from '../dsp/types';

/**
 * Live scrolling display during recording: f0 (cents from A4, note-name axis)
 * and level. Runs the tracker on the most recent frame every `stride` samples.
 */
export class LiveView {
  private canvas: HTMLCanvasElement;
  private readout: HTMLElement;
  private ring: Float32Array;
  private ringPos = 0;
  private filled = 0;
  private sinceLast = 0;
  private tracker: Tracker | null = null;
  private history: { cents: number; db: number; clarity: number }[] = [];
  private maxHistory = 600;
  private p: AnalysisParams;
  private sr = 0;
  private raf = 0;

  constructor(canvas: HTMLCanvasElement, readout: HTMLElement, p: AnalysisParams) {
    this.canvas = canvas;
    this.readout = readout;
    this.p = p;
    this.ring = new Float32Array(p.frameSize);
  }

  start(p: AnalysisParams) {
    this.p = p;
    this.ring = new Float32Array(p.frameSize);
    this.ringPos = 0; this.filled = 0; this.sinceLast = 0;
    this.tracker = null;
    this.history = [];
    const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { cancelAnimationFrame(this.raf); }

  /** Feed a block of samples from the recorder. */
  push(block: Float32Array, sampleRate: number) {
    if (!this.tracker || this.sr !== sampleRate) {
      this.sr = sampleRate;
      this.tracker = makeTracker(this.p.tracker, { frameSize: this.p.frameSize, fmin: this.p.fmin, fmax: this.p.fmax, sampleRate });
    }
    const stride = Math.max(this.p.hop, 1024);
    for (let i = 0; i < block.length; i++) {
      this.ring[this.ringPos] = block[i];
      this.ringPos = (this.ringPos + 1) % this.ring.length;
      this.filled = Math.min(this.filled + 1, this.ring.length);
      if (++this.sinceLast >= stride && this.filled === this.ring.length) {
        this.sinceLast = 0;
        this.analyseFrame();
      }
    }
  }

  private frameBuf = new Float32Array(0);
  private analyseFrame() {
    const n = this.ring.length;
    if (this.frameBuf.length !== n) this.frameBuf = new Float32Array(n);
    for (let j = 0; j < n; j++) this.frameBuf[j] = this.ring[(this.ringPos + j) % n];
    const db = rmsDb(this.frameBuf);
    const r = this.tracker!.estimate(this.frameBuf, this.sr);
    const ok = Number.isFinite(r.f0) && r.clarity >= this.p.clarityMin && db >= this.p.noiseFloorDb;
    this.history.push({ cents: ok ? hzToCents(r.f0, this.p.a4) : NaN, db, clarity: r.clarity });
    if (this.history.length > this.maxHistory) this.history.shift();
    if (ok) {
      const midi = 69 + hzToCents(r.f0, this.p.a4) / 100;
      const near = Math.round(midi);
      const dev = (midi - near) * 100;
      this.readout.textContent = `${midiToName(near)}  ${dev >= 0 ? '+' : ''}${dev.toFixed(0)} c   ${r.f0.toFixed(1)} Hz   ${db.toFixed(1)} dB   clarity ${r.clarity.toFixed(2)}`;
    } else {
      this.readout.textContent = `—   ${db.toFixed(1)} dB   clarity ${r.clarity.toFixed(2)}`;
    }
  }

  private draw() {
    const c = this.canvas;
    const dpr = devicePixelRatio || 1;
    const cssW = c.parentElement?.clientWidth ?? 600, cssH = 220;
    if (c.width !== cssW * dpr) { c.width = cssW * dpr; c.height = cssH * dpr; c.style.width = `${cssW}px`; c.style.height = `${cssH}px`; }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const h = this.history;
    if (h.length === 0) return;
    const L = 40, pitchH = 150, lvlTop = pitchH + 10, lvlH = cssH - lvlTop;
    // Pitch range: centre on the recent median, ±700 cents.
    const recent = h.slice(-60).map((x) => x.cents).filter(Number.isFinite).sort((a, b) => a - b);
    const centre = recent.length ? recent[Math.floor(recent.length / 2)] : 0;
    const cmin = Math.round((centre - 700) / 100) * 100, cmax = cmin + 1400;
    const sy = (cents: number) => ((cmax - cents) / (cmax - cmin)) * pitchH;
    const sx = (i: number) => L + ((i / this.maxHistory) * (cssW - L));
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#666'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let cc = cmin; cc <= cmax; cc += 100) {
      ctx.strokeStyle = cc % 1200 === 0 ? '#bbb' : '#eee';
      ctx.beginPath(); ctx.moveTo(L, sy(cc)); ctx.lineTo(cssW, sy(cc)); ctx.stroke();
      if (cc % 200 === 0) ctx.fillText(midiToName(69 + cc / 100), L - 4, sy(cc));
    }
    // f0 trace
    ctx.fillStyle = '#1a5';
    for (let i = 0; i < h.length; i++) {
      if (!Number.isFinite(h[i].cents)) continue;
      const dev = h[i].cents - Math.round(h[i].cents / 100) * 100;
      ctx.fillStyle = Math.abs(dev) <= 5 ? '#2a7' : Math.abs(dev) <= 15 ? '#e9a' : '#d44';
      ctx.fillRect(sx(i) - 1, sy(h[i].cents) - 1.5, 2, 3);
    }
    // level trace
    const dbMin = -70, dbMax = 0;
    ctx.strokeStyle = '#2a7'; ctx.lineWidth = 1; ctx.beginPath();
    let started = false;
    for (let i = 0; i < h.length; i++) {
      const y = lvlTop + ((dbMax - Math.max(dbMin, h[i].db)) / (dbMax - dbMin)) * lvlH;
      if (!started) { ctx.moveTo(sx(i), y); started = true; } else ctx.lineTo(sx(i), y);
    }
    ctx.stroke();
    ctx.fillStyle = '#666'; ctx.fillText('0', L - 4, lvlTop); ctx.fillText('-70', L - 4, lvlTop + lvlH - 4);
    ctx.strokeStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(L, lvlTop); ctx.lineTo(cssW, lvlTop); ctx.stroke();
  }
}
