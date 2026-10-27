# TuningTracker

A browser-based measurement tool for fixed-pitch wind instruments (tin whistles,
melodicas, and similar) whose pitch depends on blowing pressure as well as
fingering.

It records or loads a clip, tracks the fundamental frequency (f0) and the
loudness over time, splits the clip into notes, and reports for each note:

- the median pitch in cents relative to 12-tone equal temperament,
- how the pitch moves with loudness (cents per dB), and
- the spread of pitch over the dynamic range that was played.

It is a measurement device, not a tuner: it shows what the instrument does, it
does not tell you what to do about it.

Everything runs client-side. There is no server.

## Status

Early development. See `docs/01_planning_questions.md` for the design
decisions.

## Using it

1. Pick a range preset (or type the lowest and highest note, or set them by
   playing). Only the range is instrument-specific.
2. Load an audio file (WAV, MP3, M4A) or press Record. While recording, the
   live trace shows what the tracker sees.
3. Read the note table: median cents from the nearest 12-TET note, the spread
   within the note, and the slope of cents against level in dB.
4. Adjust gates (clarity, noise floor, median filter, segmentation) and press
   "Re-apply gates only" to see the effect without re-tracking. Changing the
   tracker, frame size, hop or range needs "Re-run".
5. Export notes or frames as CSV, the whole session as JSON, or the audio as WAV.

Recording modes that make sense: a scale, a tune played naturally (shows the
levels each note is really played at), or each note swept soft-loud-soft (gives
the cents-per-dB slope).

Microphone capture disables the browser's auto gain, noise suppression and
echo cancellation. The applied settings are shown while recording. Avoid
Bluetooth microphones; their own processing cannot be switched off.

## Development

```
npm install
npm run dev            # local dev server at http://localhost:5173/TuningTracker/
npm test               # unit tests (Vitest), including parity with librosa pyin when fixtures exist
npm run test:e2e       # Playwright smoke tests in headless Chromium with a fake microphone
npm run fixtures:synth # regenerate tests/fixtures/audio/synth_scale.wav
npm run build          # type-check and production build to dist/
```

Layout: `src/dsp` is pure TypeScript with no browser dependencies (trackers,
gates, segmentation, statistics); `src/audio` is the browser glue (decode,
worklet capture, worker); `src/ui` is the DOM, plots and exports.

## Licence

MIT. See `LICENSE`.
