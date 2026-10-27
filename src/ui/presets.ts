/** Instrument range presets: only the pitch range is instrument-specific. */
export interface RangePreset {
  id: string;
  label: string;
  low: string;
  high: string;
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: 'melodica', label: 'Melodica (F2 to F6)', low: 'F2', high: 'F6' },
  { id: 'whistle-d', label: 'Whistle in D (D5 to D7)', low: 'D5', high: 'D7' },
  { id: 'whistle-c', label: 'Whistle in C (C5 to C7)', low: 'C5', high: 'C7' },
  { id: 'whistle-bb', label: 'Whistle in Bb (Bb4 to Bb6)', low: 'Bb4', high: 'Bb6' },
  { id: 'whistle-a', label: 'Whistle in A (A4 to A6)', low: 'A4', high: 'A6' },
  { id: 'whistle-g', label: 'Whistle in G (G4 to G6)', low: 'G4', high: 'G6' },
  { id: 'whistle-f', label: 'Whistle in F (F4 to F6)', low: 'F4', high: 'F6' },
  { id: 'whistle-eb', label: 'Whistle in Eb (Eb4 to Eb6)', low: 'Eb4', high: 'Eb6' },
  { id: 'low-d', label: 'Low D whistle (D4 to D6)', low: 'D4', high: 'D6' },
  { id: 'accordion', label: 'Accordion treble (F3 to A6)', low: 'F3', high: 'A6' },
  { id: 'wide', label: 'Wide (C2 to C8)', low: 'C2', high: 'C8' },
];

/** Semitones of margin added below the low note and above the high note. */
export const RANGE_MARGIN_SEMITONES = 3;
