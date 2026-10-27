import { defineConfig } from 'vite';

// Served at https://jomimc.github.io/TuningTracker/ when deployed to Pages.
// Vite dev server ignores base for localhost usage.
export default defineConfig({
  base: '/TuningTracker/',
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
