import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { AnalysisResult } from '../dsp/types';
import { hzToCents, midiToName } from '../dsp/cents';

const SYNC_KEY = 'tt-time';

export const NOTE_COLOURS = [
  '#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948',
  '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];
export const noteColour = (i: number) => NOTE_COLOURS[i % NOTE_COLOURS.length];

/** Two stacked, cursor-synced plots: pitch (cents from A4, note-name axis) and level (dBFS). */
export class PitchPlots {
  private pitch: uPlot;
  private level: uPlot;
  private result: AnalysisResult | null = null;
  /** Which note to highlight (null = all). */
  selected: number | null = null;

  constructor(pitchEl: HTMLElement, levelEl: HTMLElement) {
    const width = pitchEl.clientWidth || 800;
    const sync = uPlot.sync(SYNC_KEY);
    const cursor: uPlot.Cursor = { sync: { key: SYNC_KEY, setSeries: false }, drag: { x: true, y: false } };

    this.pitch = new uPlot({
      width, height: 320,
      cursor,
      scales: { x: { time: false } },
      axes: [
        { label: 'time (s)' },
        {
          label: 'pitch',
          size: 60,
          incrs: [100, 200, 300, 500, 700, 1200, 2400],
          values: (_u, splits) => splits.map((c) => (Number.isInteger(c / 100) ? midiToName(69 + c / 100) : '')),
        },
      ],
      series: [
        { label: 't' },
        { label: 'raw', stroke: 'rgba(0,0,0,0)', points: { show: true, size: 3, fill: '#bbb', stroke: '#bbb' }, paths: () => null, value: (_u, v) => fmtHz(v) },
        { label: 'f0', stroke: '#222', width: 1.5, points: { show: false }, value: (_u, v) => fmtHz(v) },
      ],
      hooks: {
        drawClear: [(u) => this.drawNotes(u)],
      },
    }, [[], [], []], pitchEl);

    this.level = new uPlot({
      width, height: 140,
      cursor,
      scales: { x: { time: false } },
      axes: [{ label: 'time (s)' }, { label: 'level (dBFS)', size: 60 }],
      series: [{ label: 't' }, { label: 'level', stroke: '#2a7', width: 1, points: { show: false }, value: (_u, v) => (v == null ? '' : v.toFixed(1)) }],
      hooks: { drawClear: [(u) => this.drawNotes(u, true)] },
    }, [[], []], levelEl);

    sync.sub(this.pitch);
    sync.sub(this.level);
    new ResizeObserver(() => this.resize(pitchEl.clientWidth)).observe(pitchEl);
  }

  resize(width: number) {
    if (width > 0) {
      this.pitch.setSize({ width, height: 320 });
      this.level.setSize({ width, height: 140 });
    }
  }

  setResult(r: AnalysisResult) {
    this.result = r;
    const { t, f0Raw, f0, rmsDb } = r.frames;
    const n = t.length;
    const ts = Array.from(t);
    const raw: (number | null)[] = new Array(n);
    const clean: (number | null)[] = new Array(n);
    const lv: (number | null)[] = new Array(n);
    for (let i = 0; i < n; i++) {
      raw[i] = Number.isFinite(f0Raw[i]) ? hzToCents(f0Raw[i], r.params.a4) : null;
      clean[i] = Number.isFinite(f0[i]) ? hzToCents(f0[i], r.params.a4) : null;
      lv[i] = Number.isFinite(rmsDb[i]) && rmsDb[i] > -100 ? rmsDb[i] : null;
    }
    this.pitch.setData([ts, raw, clean]);
    this.level.setData([ts, lv]);
  }

  redraw() { this.pitch.redraw(); this.level.redraw(); }

  private drawNotes(u: uPlot, levelPlot = false) {
    if (!this.result) return;
    const ctx = u.ctx;
    const { top, height } = u.bbox;
    ctx.save();
    ctx.font = `${12 * devicePixelRatio}px sans-serif`;
    ctx.textBaseline = 'top';
    for (const n of this.result.notes) {
      const x0 = u.valToPos(n.startT, 'x', true);
      const x1 = u.valToPos(n.endT, 'x', true);
      const sel = this.selected === null || this.selected === n.index;
      ctx.fillStyle = noteColour(n.index) + (sel ? '33' : '14');
      ctx.fillRect(x0, top, Math.max(1, x1 - x0), height);
      if (!levelPlot && x1 - x0 > 24 * devicePixelRatio) {
        ctx.fillStyle = sel ? '#333' : '#aaa';
        const sign = n.centsDev >= 0 ? '+' : '';
        ctx.fillText(`${n.name} ${sign}${n.centsDev.toFixed(0)}`, x0 + 3, top + 3);
      }
    }
    ctx.restore();
  }
}

function fmtHz(centsFromA4: number | null): string {
  if (centsFromA4 == null) return '';
  const midi = 69 + centsFromA4 / 100;
  const nearest = Math.round(midi);
  const dev = (midi - nearest) * 100;
  const hz = 440 * Math.pow(2, centsFromA4 / 1200);
  return `${hz.toFixed(1)} Hz  ${midiToName(nearest)} ${dev >= 0 ? '+' : ''}${dev.toFixed(0)}c`;
}
