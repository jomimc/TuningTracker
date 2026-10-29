import type { AnalysisResult, NoteStats } from '../dsp/types';
import { noteColour } from './pitchPlot';

export interface TableOptions {
  greenCents: number;
  amberCents: number;
}

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '');
const signed = (v: number, d = 1) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(d)}` : '');

export class NoteTable {
  private el: HTMLElement;
  onSelect: ((idx: number | null) => void) | null = null;
  onUseAsRef: ((note: NoteStats) => void) | null = null;
  selected: number | null = null;

  constructor(container: HTMLElement) {
    this.el = container;
  }

  render(r: AnalysisResult, opts: TableOptions) {
    const hasRef = Number.isFinite(r.params.refDb);
    const tune = r.params.mode === 'tune';
    const rows = r.notes.map((n) => {
      const band = Math.abs(n.centsDev) <= opts.greenCents ? 'ok' : Math.abs(n.centsDev) <= opts.amberCents ? 'warn' : 'bad';
      const sel = this.selected === n.index ? ' sel' : '';
      return `<tr class="${sel}" data-idx="${n.index}">
        <td><span class="swatch" style="background:${noteColour(n.index)}"></span>${n.index + 1}</td>
        ${tune
          ? `<td>${n.occurrences}</td><td>${f(n.durS, 2)}</td>`
          : `<td>${f(n.startT, 2)}</td><td>${f(n.endT - n.startT, 2)}</td>`}
        <td><b>${n.name}</b></td>
        <td>${f(n.medianHz, 2)}</td>
        <td class="${band}">${signed(n.centsDev)}</td>
        <td>${hasRef ? signed(n.centsAtRef) : ''}</td>
        <td>${f(n.madCents)}</td>
        <td>${signed(n.p10, 0)} / ${signed(n.p90, 0)}</td>
        <td>${f(n.medianDb)}</td>
        <td>${f(n.maxDb - n.minDb)}</td>
        <td>${signed(n.slopeCentsPerDb, 2)}</td>
        <td>${f(n.corr, 2)}</td>
        <td>${n.nFrames}</td>
        <td><button class="mini" data-ref="${n.index}" title="Use this note's median level as the reference level">ref</button></td>
      </tr>`;
    }).join('');
    this.el.innerHTML = `<table class="notes">
      <thead><tr>
        <th>#</th>${tune
          ? '<th title="number of separate times the note was played">times</th><th title="total analysed time across all occurrences">total s</th>'
          : '<th>start s</th><th>dur s</th>'}<th>note</th><th>median Hz</th>
        <th title="median deviation from nearest 12-TET note">cents</th>
        <th title="cents predicted at the reference level from the slope fit">cents @ref</th>
        <th title="median absolute deviation of cents within the note">MAD</th>
        <th title="10th / 90th percentile of cents">p10/p90</th>
        <th>median dB</th><th>dB span</th>
        <th title="Theil-Sen slope of cents against dB">c/dB</th><th>r</th><th>frames</th><th></th>
      </tr></thead><tbody>${rows}</tbody></table>`;
    this.el.querySelectorAll<HTMLTableRowElement>('tr[data-idx]').forEach((tr) => {
      tr.onclick = (e) => {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        const idx = Number(tr.dataset.idx);
        this.selected = this.selected === idx ? null : idx;
        this.onSelect?.(this.selected);
      };
    });
    this.el.querySelectorAll<HTMLButtonElement>('button[data-ref]').forEach((b) => {
      b.onclick = () => this.onUseAsRef?.(r.notes[Number(b.dataset.ref)]);
    });
  }
}
