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

## Development

```
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run build      # production build to dist/
```

## Licence

MIT. See `LICENSE`.
