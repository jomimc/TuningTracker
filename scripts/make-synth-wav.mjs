// Generate a synthetic test recording: a D major scale with known detunings,
// each note with a soft-loud-soft level sweep and a whistle-like
// pitch/level coupling of +2 cents per dB. Output: tests/fixtures/audio/synth_scale.wav
// Usage: node scripts/make-synth-wav.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const SR = 48000;
const names = ['D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C#6', 'D6'];
const midi = [74, 76, 78, 79, 81, 83, 85, 86];
const detune = [0, 12, -20, 5, 0, 25, -8, 15];
const noteDur = 1.2, gap = 0.2, slope = 2; // cents per dB
const total = Math.ceil((names.length * (noteDur + gap) + 0.5) * SR);
const out = new Float32Array(total);
let pos = Math.round(0.25 * SR);
for (let k = 0; k < names.length; k++) {
  const n = Math.round(noteDur * SR);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const dbRel = 15 * Math.sin((Math.PI * t) / noteDur); // 0..15 dB swing
    const amp = 0.03 * Math.pow(10, dbRel / 20);
    const cents = (midi[k] - 69) * 100 + detune[k] + slope * dbRel;
    const hz = 440 * Math.pow(2, cents / 1200);
    phase += (2 * Math.PI * hz) / SR;
    const env = Math.min(1, i / (0.02 * SR), (n - i) / (0.02 * SR));
    out[pos + i] = amp * env * (Math.sin(phase) + 0.4 * Math.sin(2 * phase) + 0.2 * Math.sin(3 * phase));
  }
  pos += n + Math.round(gap * SR);
}
const buf = Buffer.alloc(44 + out.length * 2);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + out.length * 2, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(out.length * 2, 40);
for (let i = 0; i < out.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[i] * 32767))), 44 + i * 2);
mkdirSync('tests/fixtures/audio', { recursive: true });
writeFileSync('tests/fixtures/audio/synth_scale.wav', buf);
console.log(`wrote tests/fixtures/audio/synth_scale.wav (${(out.length / SR).toFixed(1)} s)`);
console.log('expected notes:', names.map((n, i) => `${n} ${detune[i] >= 0 ? '+' : ''}${detune[i]}`).join(', '));
