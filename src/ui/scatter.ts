import type { AnalysisResult } from '../dsp/types';
import { hzToCents } from '../dsp/cents';
import { noteColour } from './pitchPlot';

/**
 * Hand-drawn canvas scatter of cents deviation (from each note's nearest
 * 12-TET pitch) against level in dBFS, one colour per note, with the
 * Theil-Sen fit line per note. Click a legend entry to isolate one note.
 */
export class ScatterPlot {
  private canvas: HTMLCanvasElement;
  private legend: HTMLElement;
  private result: AnalysisResult | null = null;
  selected: number | null = null;
  onSelect: ((idx: number | null) => void) | null = null;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'scatter';
    this.legend = document.createElement('div');
    this.legend.className = 'legend';
    container.append(this.canvas, this.legend);
    new ResizeObserver(() => this.draw()).observe(container);
  }

  setResult(r: AnalysisResult) {
    this.result = r;
    this.buildLegend();
    this.draw();
  }

  private buildLegend() {
    this.legend.innerHTML = '';
    if (!this.result) return;
    const all = document.createElement('button');
    all.textContent = 'all';
    all.className = this.selected === null ? 'on' : '';
    all.onclick = () => this.select(null);
    this.legend.append(all);
    for (const n of this.result.notes) {
      const b = document.createElement('button');
      b.textContent = this.result.params.mode === 'tune' ? n.name : `${n.index + 1}: ${n.name}`;
      b.style.borderColor = noteColour(n.index);
      b.className = this.selected === n.index ? 'on' : '';
      b.onclick = () => this.select(n.index);
      this.legend.append(b);
    }
  }

  select(idx: number | null) {
    this.selected = idx;
    this.buildLegend();
    this.draw();
    this.onSelect?.(idx);
  }

  draw() {
    const r = this.result;
    const cssW = this.canvas.parentElement?.clientWidth ?? 600;
    const cssH = 360;
    const dpr = devicePixelRatio || 1;
    this.canvas.width = cssW * dpr;
    this.canvas.height = cssH * dpr;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    const ctx = this.canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);
    if (!r || r.notes.length === 0) {
      ctx.fillStyle = '#888';
      ctx.fillText('No notes to plot', 20, 30);
      return;
    }
    const notes = this.selected === null ? r.notes : r.notes.filter((n) => n.index === this.selected);
    // Gather points.
    const pts: { x: number; y: number; idx: number }[] = [];
    for (const n of notes) {
      const seg = r.noteFrames[n.index];
      if (!seg) continue;
      const base = (n.midi - 69) * 100;
      for (const i of seg) {
        pts.push({ x: r.frames.rmsDb[i], y: hzToCents(r.frames.f0[i], r.params.a4) - base, idx: n.index });
      }
    }
    if (pts.length === 0) return;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const p of pts) { xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); }
    ymin = Math.min(ymin, -20); ymax = Math.max(ymax, 20);
    const padX = (xmax - xmin) * 0.05 + 1, padY = (ymax - ymin) * 0.05 + 1;
    xmin -= padX; xmax += padX; ymin -= padY; ymax += padY;
    const L = 50, R = 10, T = 10, B = 36;
    const sx = (x: number) => L + ((x - xmin) / (xmax - xmin)) * (cssW - L - R);
    const sy = (y: number) => T + ((ymax - y) / (ymax - ymin)) * (cssH - T - B);

    // Axes and grid.
    ctx.strokeStyle = '#ddd'; ctx.fillStyle = '#555'; ctx.font = '11px sans-serif'; ctx.lineWidth = 1;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const yStep = niceStep(ymax - ymin, 8);
    for (let y = Math.ceil(ymin / yStep) * yStep; y <= ymax; y += yStep) {
      ctx.beginPath(); ctx.moveTo(L, sy(y)); ctx.lineTo(cssW - R, sy(y));
      ctx.strokeStyle = y === 0 ? '#999' : '#e5e5e5'; ctx.stroke();
      ctx.fillText(y.toFixed(0), L - 6, sy(y));
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const xStep = niceStep(xmax - xmin, 8);
    for (let x = Math.ceil(xmin / xStep) * xStep; x <= xmax; x += xStep) {
      ctx.beginPath(); ctx.moveTo(sx(x), T); ctx.lineTo(sx(x), cssH - B); ctx.strokeStyle = '#eee'; ctx.stroke();
      ctx.fillText(x.toFixed(0), sx(x), cssH - B + 4);
    }
    ctx.fillText('level (dBFS)', (L + cssW - R) / 2, cssH - 16);
    ctx.save(); ctx.translate(12, (T + cssH - B) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('cents from 12-TET', 0, 0); ctx.restore();
    if (Number.isFinite(r.params.refDb)) {
      ctx.strokeStyle = '#c33'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(sx(r.params.refDb), T); ctx.lineTo(sx(r.params.refDb), cssH - B); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Points.
    for (const p of pts) {
      ctx.fillStyle = noteColour(p.idx) + 'aa';
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 2.2, 0, 2 * Math.PI); ctx.fill();
    }
    // Fit lines.
    for (const n of notes) {
      if (!Number.isFinite(n.slopeCentsPerDb)) continue;
      ctx.strokeStyle = noteColour(n.index); ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx(n.minDb), sy(n.slopeCentsPerDb * n.minDb + n.interceptCents));
      ctx.lineTo(sx(n.maxDb), sy(n.slopeCentsPerDb * n.maxDb + n.interceptCents));
      ctx.stroke();
    }
  }
}

function niceStep(range: number, target: number): number {
  const raw = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}
