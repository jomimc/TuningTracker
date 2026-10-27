const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Cents of `hz` relative to A4 (`a4` Hz). */
export function hzToCents(hz: number, a4 = 440): number {
  return 1200 * Math.log2(hz / a4);
}

export function centsToHz(cents: number, a4 = 440): number {
  return a4 * Math.pow(2, cents / 1200);
}

/** Fractional MIDI number for `hz`. */
export function hzToMidi(hz: number, a4 = 440): number {
  return 69 + 12 * Math.log2(hz / a4);
}

export function midiToHz(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi: number): string {
  const m = Math.round(midi);
  const name = NOTE_NAMES[((m % 12) + 12) % 12];
  const octave = Math.floor(m / 12) - 1;
  return `${name}${octave}`;
}

/** Parse "D5", "F#3", "Bb4" to a MIDI number; returns NaN if unparseable. */
export function nameToMidi(name: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!m) return NaN;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()]!;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (parseInt(m[3], 10) + 1) * 12 + base + acc;
}

/** Deviation in cents from the nearest 12-TET note, in (-50, 50]. */
export function centsDeviation(centsAbs: number): number {
  const dev = centsAbs - 100 * Math.round(centsAbs / 100);
  return dev;
}
