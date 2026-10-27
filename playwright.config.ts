import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const fakeWav = resolve('tests/fixtures/audio/synth_scale.wav');

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173/TuningTracker/',
    browserName: 'chromium',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${fakeWav}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
    permissions: ['microphone'],
  },
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173/TuningTracker/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
