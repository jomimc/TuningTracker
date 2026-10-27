# TuningTracker: planning questions and proposed defaults

Date: 2026-10-27. Status: answered 2026-10-27; decisions below. The question
list further down is kept for the reasoning; where it conflicts with the
decisions, the decisions win.

## Decisions (user answers, 2026-10-27)

Framing correction: **this is a measurement device, not a tuner.** It measures
what each note does; it does not tell the user a target pressure or "what to
tune to". Tuner-style features may come later. 12-TET is assumed throughout;
the reference pitch is only there so measured notes land near 12-TET names.
The "Framing: the pressure problem" section below is superseded by this.

| Q | Decision |
|---|---|
| 1 | Both audiences from the start. The only instrument-specific part is the pitch range: a whistle dropdown and/or a low/high note. No assumptions about note tuning, just measure. Add tolerance above/below the low/high notes when setting fmin/fmax for the tracker. |
| 2 | Default accepted: offline first, then live. |
| 3 | Dropped. No "tune to" concept. |
| 4 | Two recording modes: (a) per-note sweep soft-loud-soft; (b) play a tune naturally, which shows the levels each note is actually played at in performance. |
| 5 | C (reference note at session start, levels shifted to it) with A (relative per session) as the fallback when the reference note is off. |
| 6 | Dropped. No pressure sensor. |
| 7, 8 | Defaults accepted (single notes; before/after comparison after MVP). |
| 9 | No temperature field. |
| 10 | Start with A (pitchy / McLeod). The priority is minimal octave errors; the tracker must be swappable and may change once running. |
| 11 | Lowest note of interest: F2 (about 87 Hz). Nothing more extreme. Frame 2048 at 44.1/48 kHz still covers 3.7 periods; make frame size a parameter. |
| 12 | Gates stay as user-adjustable parameters. Live f0 extraction must be visualised on screen so the user can see tracking quality and re-run with changed parameters after playing. |
| 13 to 16 | Defaults accepted. In Q16, "cents at reference level" is a measurement at the session's reference level, not a target. |
| 17 | A4 = 440 default, adjustable. |
| 18 | A: 12-TET only. |
| 19 | Instrument profile: add a button that sets the lowest and highest notes by playing them. |
| 20 to 37 | Defaults accepted (cents units; ±5/±10 bands; vanilla TS + Vite; uPlot; three MVP views; raw-PCM record plus upload; no persistence in MVP; CSV/JSON/WAV/HTML export; PWA later; desktop first; Vitest with Python fixtures; validation study first; repo `TuningTracker` public under jomimc; MIT; Actions deploy on push to main; Discussions for feedback; HTML report for sharing). |

Original request context:  Research behind this is in `../litrev/`
(four reports: browser pitch tracking, pitch vs pressure and tuning practice,
existing tools survey, web stack and deploy). Evidence quality in those reports
is tagged; most domain numbers are forum-level, not peer-reviewed.

## What the research says, in short

- Nothing existing does this. No tuner found plots pitch against loudness, and no
  tool gives a per-note cents table from one scale recording in the browser.
- No browser pYIN exists. Options are pure-JS YIN/McLeod (pitchy, 0BSD; pitchfinder,
  licence unclear), Essentia.js (has `PitchYinProbabilistic`, but AGPL, ~10 MB,
  last release 2021), or writing a ~300-line pYIN in TypeScript from the paper.
- Physics: whistle pitch rises with pressure (forum estimates: ±20 cents of control,
  50+ when overblown). Free-reed pitch falls roughly linearly with pressure in the
  normal range (Cottingham), with upturns at very low and very high pressure. No
  published cents-per-kPa for either instrument; the app will have to measure it.
- Nobody defines a "tuning pressure". Whistle makers mostly tune to 12-TET with a
  Korg-style tuner and tune octave 1 slightly sharp to compensate a flat octave 2.
  Reed tuners quote ~10 cents tolerance and 2-4 cents drift over weeks.
- Chin & Xia (recorder, arXiv 2107.08727) found no clean amplitude-vs-pressure
  relation and ~300 ms settling after register jumps. So mic level is a proxy for
  pressure, not a measurement of it.
- GitHub Pages cannot set COOP/COEP headers: no SharedArrayBuffer, so no threaded
  WASM and no Pyodide. Single-threaded JS/WASM, AudioWorklet and Workers are fine.

## What your own Dynamic recordings show

Quick probe (`../projects/probe_dynamic/`): librosa pyin (fmin 150, fmax 3000,
frame 2048, hop 256) plus RMS dB, gap-segmented, then per note a linear fit of
cents against dB.

| Recording | Notes | cents/dB slope (typical) | r | dB span per note |
|---|---|---|---|---|
| Whistle_Dynamic | 20 | +2 to +6 (D5 to C6), +1 to +2 in octave 2 | 0.7 to 0.9 | 20 to 40 |
| Melodica_Full_Dynamic_1 | 37 | -0.3 to -1.5 for F3 to A5; about 0 from A#5 up | -0.5 to -0.9 | 30 to 40 |
| Accordion_Treble_Dynamic | 69 | -0.3 to -2 below C5; about 0 above | -0.4 to -0.9 | 15 to 30 |

Takeaways:
- Signs match the physics (whistle up, free reed down) and the effect is large:
  over a 30 dB sweep the whistle moves 60 to 150 cents, the low melodica reeds
  10 to 45 cents, the high melodica reeds almost nothing. So for the melodica the
  pressure problem is mostly a bass-register problem.
- The median cents values are quantised to 10-cent steps (-33, -23, -13, -3, 7,
  17). librosa's `pyin` default `resolution` is 0.1 semitone. The old prototype
  inherited this; any new tracker needs finer than 1-cent output.
- Whistle D6 shows std 93 cents: register jumps and octave errors inside one
  segment. The pitch-jump split (Q14) and post-jump discard (Q12) are needed.
- Whistle first-octave medians sit around -33 cents at the levels played, second
  octave +7 to +17. Whether that is the instrument or the sweep level
  distribution is exactly what the reference-level question (Q3) is about.

## Framing: the pressure problem

Two complementary outputs fall out of the same data (f0 and level per frame):

1. **Pitch at a reference level**: for each note, the cents deviation at the
   user's chosen "normal" loudness. This is the number you file the reed or
   adjust the hole to.
2. **Level at which the note is in tune**: invert the per-note cents-vs-level
   curve. For a whistle maker this is arguably the better view: an instrument is
   "in tune" when that level rises smoothly and consistently across the scale
   (Tunborough's stated design goal on Chiff & Fipple).

Both need a per-note cents-vs-level curve, which needs the player to sweep
dynamics on each note. Scale/tune recordings give only the first number, at
whatever level was played.

---

## Questions

Format: question, options, proposed default in bold. "A/B/C" letters are only
for referring back.

### Section 1: scope and measurement model

**Q1. Which audience is the first target for the MVP?**
A. You and the melodica (one instrument, one user, fast iteration).
B. Whistle makers (needs register handling, key selection, sharing).
C. Both from day one.
**Default: A, with the data model designed for B** (instrument profiles with
key, register, target table), so nothing is thrown away.

**Q2. Which modes ship first?**
A. Offline file analysis only (upload or record, then analyse).
B. Live tuner display only.
C. Offline first, live second.
**Default: C.** Offline is testable against your Python prototype; live adds
AudioWorklet and mobile headaches that can wait.

**Q3. How should "what to tune to" be defined?**
A. User-set reference level: user plays at "normal" loudness, app stores the dB
   value, all tuning numbers are reported at that level by interpolating each
   note's cents-vs-dB fit.
B. Midpoint of the dynamic range: for each note, report pitch at the middle of
   the level range the player actually produced in a sweep.
C. Both views, with A as the headline number and B as a secondary column.
D. External pressure sensor (see Q6).
**Default: C.** A is what a reed tuner wants. B is what a whistle maker wants
and needs no calibration.

**Q4. Per-note sweep protocol.** The pressure dependence can only be measured
if each note is swept.
A. Free sweep: play each note soft-to-loud-to-soft, hold ~3 s; app fits slope.
B. Stepped: three levels (soft, normal, loud) held ~1 s each, guided by on-screen
   prompts.
C. Both allowed; app detects which was done from the level trace.
**Default: A** for the analysis, with on-screen guidance; B as a later option.

**Q5. Reference-level calibration across sessions.** Mic distance and device
gain change the dB reading.
A. Treat level as relative per session; store the reference level per session.
B. Calibrate once per device+instrument by playing one fixed note at normal
   loudness; store in the instrument profile.
C. Use a reference note each session (e.g. play bell note at normal loudness
   first) and shift all levels so that note sits at 0 dB.
**Default: C** (cheap, robust, forces a consistent start ritual). B as an
optional stored value.

**Q6. Should real pressure measurement be in scope?** A mouthpiece T-piece plus
a cheap sensor (MPX5010 on an Arduino or ESP32) via Web Serial or Web Bluetooth
would turn the proxy into a measurement. For a melodica this is easy to plumb.
A. Out of scope.
B. Design the frame record with an optional `pressure` column now, build the
   device integration later.
C. Build it in the first version.
**Default: B.** Web Serial is Chromium-only, Web Bluetooth is not on iOS Safari,
so it can never be the only path.

**Q7. Melodica chords.** When several reeds sound at once they share the air
supply, so per-reed pressure drops. Is "pitch of a note in a chord" something
you want to measure (polyphonic f0, much harder) or only single notes?
**Default: single notes only.** Polyphony out of scope.

**Q8. Before/after comparison.** Reed filing and hole adjustment are iterative.
Should the app compare two sessions of the same instrument side by side?
**Default: yes, but after the MVP** (needs persistence, Q26).

**Q9. Temperature and warm-up.** Both instruments move several cents with
temperature. Record it?
A. Ignore.
B. Optional free-text/number field per session.
**Default: B.** No automatic correction.

### Section 2: analysis pipeline and targets

**Q10. f0 tracker.**
A. `pitchy` (McLeod pitch method, 0BSD, pure JS, returns pitch + clarity).
   Small, permissive, no HMM, so octave errors need a gate and median filter.
B. Own TypeScript pYIN (multi-threshold YIN + Viterbi), written from Mauch &
   Dixon 2014. Closest to your librosa results, ~300 lines, needs validation.
C. Essentia.js `PitchYinProbabilistic`. Real pYIN-like, but AGPL, ~10 MB,
   stale since 2021, unstable API.
**Default: A for the first build, with the tracker behind an interface so B can
replace it.** Decide on B after measuring A against librosa pYIN on your 16
recordings (Q31). I'd expect MPM to be fine on steady wind tones; the risk is
breathy low notes and the whistle's second octave.

**Q11. Frame size and hop.**
**Default: 2048-sample frame, 256-sample hop at the device rate (44.1 or 48 kHz),
matching your Python prototype.** Lowest note of interest sets the frame: melodica
F2 at 87 Hz is marginal with 2048 at 48 kHz (about 4 periods). Do you need below
~150 Hz? If yes, 4096 for the melodica profile.

**Q12. Voicing and quality gates.**
**Default: drop frames with clarity below 0.9 (tune on data), RMS below a
noise floor set from the first 0.5 s or a user "silence" button, and the first
300 ms after any onset or register jump** (Chin & Xia settling time). Make the
300 ms a setting.

**Q13. Octave-error handling.**
A. Your current fold-to-median trick per segment.
B. Median filter on cents plus the fold.
C. Full HMM (only with Q10-B).
**Default: B.**

**Q14. Note segmentation.**
A. Gap-based (your method): split on unvoiced gaps, drop segments shorter than
   a minimum duration.
B. Gap-based plus pitch-jump split: also split when a frame departs more than
   N cents from the segment's running median (catches slurred notes).
C. Onset detection (spectral flux) as the primary cue.
**Default: B with N = 50 cents, min duration 0.3 s, max gap 50 ms.** Tony-style
HMM note transcription is rejected: it snaps to semitones and hides the
detuning we want to see.

**Q15. Note identity.**
A. Nearest 12-TET note to the segment median (what you do now).
B. User supplies the expected sequence (e.g. "D major scale, two octaves") and
   the app aligns segments to it; handles instruments more than 50 cents off.
**Default: A, with B as an optional "expected scale" setting** for whistle makers
whose prototypes may be far off.

**Q16. Per-note statistics.** Proposed set (my proposal, not sourced):
median cents; cents at reference level (from the fit); cents-per-dB slope by
Theil-Sen; p10-p90 cents range and the dB span covered; sustain std (MAD);
number of frames. Optional: attack pitch minus sustain pitch.
**Default: ship all of these; show median, cents-at-reference and slope in the
table, rest on expand.** Anything to drop or add?

**Q17. Reference pitch.** **Default: A4 = 440 Hz, user-settable, stored per
instrument profile.** Harmonicas and some accordions sit at 442 to 445.

**Q18. Temperament / target table.**
A. 12-TET only.
B. 12-TET plus a selectable just-intonation offset table relative to the
   instrument's key.
C. Fully editable per-note offset table (StroboSoft "sweetened tuning" style),
   importable and exportable as JSON.
**Default: C, pre-filled with 12-TET and a JI preset.** Makers said breath
variation outweighs JI vs ET, so this is cheap to include but not central.

**Q19. Instrument profile.** **Default fields: name, type (whistle | melodica |
other), key (whistle), A4, target table, reference level, notes.** Whistle
register (octave 1 vs 2) inferred from pitch, not fingering.

**Q20. Hz, cents, or both in tables and plots?** **Default: cents everywhere, Hz
on hover and in exports.**

**Q21. Tolerance band for "in tune" colouring.** **Default: ±5 cents green,
±10 amber, beyond red, user-settable.** Forum tolerance was 10 to 15 cents.

### Section 3: app, stack, repo

**Q22. Framework.**
A. Vanilla TypeScript + Vite (no framework; DOM by hand).
B. Preact + Vite (small, React-like, still simple).
C. Svelte 5.
**Default: A.** The DSP core must be framework-free regardless, so this choice
only affects the UI layer and can change later.

**Q23. Charts.**
A. uPlot (MIT, ~21 KB gzip, fast canvas; scatter and shaded regions need custom
   draw hooks).
B. Plotly.js (everything built in, ~500 KB gzip, heavy on phones).
**Default: A**, falling back to B if the scatter view fights uPlot.

**Q24. Views for the MVP.** Proposed:
1. Pitch-over-time ribbon in cents, note segments shaded, level trace beneath.
2. Per-note table (Q16) with colour band (Q21).
3. Cents-vs-level scatter per note with fitted line, one panel per note or
   overlaid.
4. Live needle/strobe (later, Q2).
**Default: 1 to 3 in the MVP.** Anything missing?

**Q25. Input paths.**
**Default: file upload (WAV, MP3, M4A; Ogg/Opus flagged as unreliable on Safari)
and in-app record capturing raw PCM from the worklet, saved as WAV.** No
MediaRecorder: lossy codecs change amplitude. `getUserMedia` with echo
cancellation, noise suppression and auto gain all off; show the applied
settings in the UI; warn against Bluetooth mics.

**Q26. Persistence.**
A. None; everything in memory, export to download.
B. IndexedDB (Dexie) for sessions, note tables and WAV blobs.
**Default: A for MVP, B right after** (needed for Q8).

**Q27. Export formats.** **Default: CSV of frames, CSV of notes, JSON of the whole
session, WAV of the recording, and a self-contained HTML report.**

**Q28. Offline / PWA.** **Default: add vite-plugin-pwa once the MVP works**, so
the app loads in a workshop without connectivity.

**Q29. Mobile.** **Default: desktop first, phone must work for file upload and
display; live mic on iOS Safari is tested last.**

**Q30. Testing strategy.**
**Default:** Vitest on the DSP core against fixtures generated by a Python
script (librosa pyin + RMS on your 16 recordings, downsampled to short WAV
clips), tolerance ±5 cents on per-note medians and agreement on segment count.
Playwright with Chromium fake-mic flags later.

**Q31. Validation step before the web build.** I propose a short Python study in
`projects/validate_trackers/`: run pyin, YIN and MPM (via a Python MPM or by
calling the JS from Node) on the 16 recordings and the Dynamic sweeps, and report
per-note median agreement and octave-error rate. **Default: do it; one day of
work; it settles Q10.**

**Q32. Repo name and visibility.**
**Default: `TuningTracker`, public, under jomimc.** Public is needed for GitHub
Pages on a free account (flagging: I believe private-repo Pages needs a paid
plan, not verified). Alternative names: `tuning-tracker`, `windtuner`,
`breathtuner`.

**Q33. Licence.** **Default: MIT.** Rules out depending on GPL/AGPL libraries
(pitchfinder is possibly GPL, Essentia.js is AGPL).

**Q34. What lives in the repo?** **Default: app source, tests, fixtures (short
clips only, not the full m4a set), a `scripts/` dir with the Python reference
generator, and a `docs/` dir.** Research notes stay in `TuningHelper/litrev/`
unless you want them public.

**Q35. Deployment trigger.** **Default: GitHub Actions on push to `main`, Pages
source set to Actions, `base: '/TuningTracker/'`.** Work on branches, merge to
main to deploy.

**Q36. Feedback channel for whistle makers.** **Default: GitHub Discussions
plus a "paste your session JSON" issue template.**

**Q37. Sharing results without a server.** **Default: downloadable HTML report;
no URL-encoding of data.**

---

## Proposed phases (for discussion, not started)

0. Validation study in Python (Q31). Fixture generation.
1. DSP core in TypeScript with parity tests: f0, RMS, segmentation, per-note stats.
2. Offline UI: upload or record, three views, export. Deploy to Pages.
3. Sweep mode: guided per-note dynamics, slope fits, in-tune-level view.
4. Live mode with AudioWorklet; mobile testing.
5. Persistence, before/after comparison, PWA, instrument profiles sharing.

## Open items I could not settle

- Whether MPM/YIN in JS reaches ±2 cents on whistle second-octave notes (test).
- Whether iOS Safari honours the processing-off constraints today (device test).
- `decodeAudioData` support for .m4a on all three browsers (test; MDN silent).
- Your lowest note of interest (sets the frame size, Q11).
