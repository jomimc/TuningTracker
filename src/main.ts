import { DEFAULT_PARAMS, type AnalysisParams, type AnalysisResult } from './dsp/types';
import { reanalyse } from './dsp/analyse';
import { midiToHz, nameToMidi, midiToName, hzToMidi } from './dsp/cents';
import { median } from './dsp/stats';
import { makeTracker } from './dsp/trackers';
import { decodeFile } from './audio/decode';
import { Recorder } from './audio/recorder';
import { runAnalysis } from './audio/runAnalysis';
import { PitchPlots } from './ui/pitchPlot';
import { ScatterPlot } from './ui/scatter';
import { NoteTable } from './ui/table';
import { LiveView } from './ui/live';
import { RANGE_PRESETS, RANGE_MARGIN_SEMITONES } from './ui/presets';
import { download, framesCsv, notesCsv, sessionJson, wavBlob } from './ui/exports';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- state ----------
let audio: { samples: Float32Array; sampleRate: number; name: string } | null = null;
let result: AnalysisResult | null = null;
const recorder = new Recorder();

// ---------- UI handles ----------
const presetSel = $<HTMLSelectElement>('preset');
const statusEl = $('status');
const resultsEl = $('results');
const plots = new PitchPlots($('pitchPlot'), $('levelPlot'));
const scatter = new ScatterPlot($('scatter'));
const table = new NoteTable($('table'));
const live = new LiveView($<HTMLCanvasElement>('live'), $('liveReadout'), DEFAULT_PARAMS);

for (const p of RANGE_PRESETS) presetSel.add(new Option(p.label, p.id));
presetSel.add(new Option('Custom', 'custom'));
presetSel.value = 'melodica';
presetSel.onchange = () => {
  const p = RANGE_PRESETS.find((x) => x.id === presetSel.value);
  if (p) { $<HTMLInputElement>('low').value = p.low; $<HTMLInputElement>('high').value = p.high; }
};
for (const id of ['low', 'high']) $<HTMLInputElement>(id).oninput = () => { presetSel.value = 'custom'; };

$('toggleParams').onclick = () => {
  const g = $('paramGrid');
  g.hidden = !g.hidden;
  $('toggleParams').textContent = g.hidden ? 'show' : 'hide';
};

// ---------- parameters ----------
function readParams(): AnalysisParams {
  const num = (id: string, fallback: number) => {
    const v = parseFloat($<HTMLInputElement>(id).value);
    return Number.isFinite(v) ? v : fallback;
  };
  const lowMidi = nameToMidi($<HTMLInputElement>('low').value);
  const highMidi = nameToMidi($<HTMLInputElement>('high').value);
  const a4 = num('a4', 440);
  const fmin = Number.isFinite(lowMidi) ? midiToHz(lowMidi - RANGE_MARGIN_SEMITONES, a4) : DEFAULT_PARAMS.fmin;
  const fmax = Number.isFinite(highMidi) ? midiToHz(highMidi + RANGE_MARGIN_SEMITONES, a4) : DEFAULT_PARAMS.fmax;
  let medianFrames = Math.round(num('medianFrames', 5));
  if (medianFrames % 2 === 0) medianFrames += 1;
  return {
    tracker: $<HTMLSelectElement>('tracker').value as 'mpm' | 'yin',
    frameSize: num('frameSize', 2048),
    hop: num('hop', 256),
    fmin, fmax,
    clarityMin: num('clarityMin', 0.9),
    noiseFloorDb: num('noiseFloorDb', -60),
    medianFrames,
    maxGapS: num('maxGapS', 0.05),
    minDurS: num('minDurS', 0.3),
    jumpCents: num('jumpCents', 50),
    onsetDiscardS: num('onsetDiscardS', 0.1),
    a4,
    refDb: num('refDb', NaN),
  };
}
const bands = () => ({
  greenCents: parseFloat($<HTMLInputElement>('green').value) || 5,
  amberCents: parseFloat($<HTMLInputElement>('amber').value) || 10,
});

// ---------- analysis ----------
async function analyseCurrent() {
  if (!audio) return;
  const p = readParams();
  if (p.fmin <= 0 || p.fmax <= p.fmin) { setStatus('Check the low/high notes.'); return; }
  setStatus('Analysing… 0%');
  setBusy(true);
  try {
    const r = await runAnalysis(audio.samples, audio.sampleRate, p, (f) => setStatus(`Analysing… ${Math.round(f * 100)}%`));
    showResult(r);
  } catch (e) {
    setStatus(`Analysis failed: ${(e as Error).message}`);
  } finally {
    setBusy(false);
  }
}

function regate() {
  if (!result) return;
  const p = readParams();
  showResult(reanalyse(result.frames, { ...result.params, ...p, tracker: result.params.tracker, frameSize: result.params.frameSize, hop: result.params.hop }));
}

function showResult(r: AnalysisResult) {
  result = r;
  resultsEl.hidden = false;
  const voiced = Array.from(r.frames.voiced).reduce((s, v) => s + v, 0) / r.frames.voiced.length;
  $('summary').textContent = `${audio?.name ?? ''} · ${r.durationS.toFixed(1)} s · ${r.frames.sampleRate} Hz · ${r.notes.length} notes · ${(voiced * 100).toFixed(0)}% voiced · ${r.params.tracker.toUpperCase()}`;
  plots.setResult(r);
  table.render(r, bands());
  scatter.setResult(r);
  setStatus('Done.');
  $<HTMLButtonElement>('rerun').disabled = false;
  $<HTMLButtonElement>('regate').disabled = false;
}

function select(idx: number | null) {
  plots.selected = idx; plots.redraw();
  table.selected = idx; if (result) table.render(result, bands());
  if (scatter.selected !== idx) scatter.select(idx);
}
table.onSelect = select;
scatter.onSelect = select;
table.onUseAsRef = (n) => {
  $<HTMLInputElement>('refDb').value = n.medianDb.toFixed(1);
  regate();
};

// ---------- source: file ----------
$<HTMLInputElement>('file').onchange = async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  setStatus(`Decoding ${f.name}…`);
  try {
    const d = await decodeFile(f);
    audio = { ...d, name: f.name };
    setStatus(`Loaded ${f.name}: ${(d.samples.length / d.sampleRate).toFixed(1)} s at ${d.sampleRate} Hz.`);
    await analyseCurrent();
  } catch (err) {
    setStatus(`Could not decode ${f.name}: ${(err as Error).message}. Try WAV, MP3 or M4A.`);
  }
};

// ---------- source: microphone ----------
const recBtn = $<HTMLButtonElement>('rec');
const stopBtn = $<HTMLButtonElement>('stop');
let recStart = 0;
let recTimer = 0;

recBtn.onclick = async () => {
  try {
    const p = readParams();
    live.start(p);
    await recorder.start({ onBlock: (s, sr) => live.push(s, sr) });
    $('liveWrap').hidden = false;
    recBtn.classList.add('on'); recBtn.disabled = true; stopBtn.disabled = false;
    recStart = performance.now();
    const s = recorder.appliedSettings;
    const proc = s ? `AGC ${fmtBool(s.autoGainControl)}, NS ${fmtBool(s.noiseSuppression)}, EC ${fmtBool(s.echoCancellation)}` : '';
    recTimer = window.setInterval(() => {
      $('recinfo').textContent = `recording ${((performance.now() - recStart) / 1000).toFixed(0)} s · ${recorder.sampleRate} Hz · ${proc}`;
    }, 250);
    setStatus('Recording. Play a scale, a tune, or sweep each note soft-loud-soft.');
  } catch (e) {
    live.stop();
    setStatus(`Microphone failed: ${(e as Error).message}`);
  }
};

stopBtn.onclick = async () => {
  clearInterval(recTimer);
  live.stop();
  const d = await recorder.stop();
  recBtn.classList.remove('on'); recBtn.disabled = false; stopBtn.disabled = true;
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  audio = { ...d, name: `recording-${stamp}.wav` };
  $('recinfo').textContent = `${(d.samples.length / d.sampleRate).toFixed(1)} s recorded`;
  await analyseCurrent();
};

// ---------- set range by playing ----------
async function setNoteByPlaying(targetId: 'low' | 'high') {
  if (recorder.recording) { setStatus('Stop the recording first.'); return; }
  const p = { ...readParams(), fmin: 40, fmax: 5000, clarityMin: 0.9 };
  live.start(p);
  $('liveWrap').hidden = false;
  const f0s: number[] = [];
  const tracker = makeTracker('mpm', { frameSize: 4096, fmin: 40, fmax: 5000, sampleRate: 48000 });
  const buf: Float32Array[] = [];
  let acc = 0;
  try {
    setStatus(`Play the ${targetId} note now (2 s)…`);
    await recorder.start({
      onBlock: (s, sr) => {
        live.push(s, sr);
        buf.push(s); acc += s.length;
        if (acc >= 4096) {
          const frame = new Float32Array(4096);
          let pos = 0;
          for (const b of buf) { const n = Math.min(b.length, 4096 - pos); frame.set(b.subarray(0, n), pos); pos += n; if (pos >= 4096) break; }
          buf.length = 0; acc = 0;
          const r = tracker.estimate(frame, sr);
          if (Number.isFinite(r.f0) && r.clarity >= 0.9) f0s.push(r.f0);
        }
      },
    }, 1024);
    await new Promise((res) => setTimeout(res, 2200));
    await recorder.stop();
  } catch (e) {
    setStatus(`Microphone failed: ${(e as Error).message}`);
  } finally {
    live.stop();
  }
  if (f0s.length < 5) { setStatus('No stable note detected. Try again, closer to the microphone.'); return; }
  const midi = Math.round(hzToMidi(median(f0s), readParams().a4));
  $<HTMLInputElement>(targetId).value = midiToName(midi);
  presetSel.value = 'custom';
  setStatus(`${targetId} note set to ${midiToName(midi)} (${median(f0s).toFixed(1)} Hz).`);
}
$('setLow').onclick = () => setNoteByPlaying('low');
$('setHigh').onclick = () => setNoteByPlaying('high');

// ---------- rerun / exports ----------
$('rerun').onclick = analyseCurrent;
$('regate').onclick = regate;
const base = () => (audio?.name ?? 'session').replace(/\.[^.]+$/, '');
$('dlNotes').onclick = () => result && download(new Blob([notesCsv(result)], { type: 'text/csv' }), `${base()}-notes.csv`);
$('dlFrames').onclick = () => result && download(new Blob([framesCsv(result)], { type: 'text/csv' }), `${base()}-frames.csv`);
$('dlJson').onclick = () => result && download(new Blob([sessionJson(result, { source: audio?.name, low: $<HTMLInputElement>('low').value, high: $<HTMLInputElement>('high').value, userAgent: navigator.userAgent })], { type: 'application/json' }), `${base()}.json`);
$('dlWav').onclick = () => audio && download(wavBlob(audio.samples, audio.sampleRate), `${base()}.wav`);

// ---------- helpers ----------
function setStatus(s: string) { statusEl.textContent = s; }
function setBusy(b: boolean) {
  for (const id of ['rerun', 'regate', 'rec']) $<HTMLButtonElement>(id).disabled = b;
}
function fmtBool(v: boolean | undefined) { return v === undefined ? '?' : v ? 'ON' : 'off'; }
