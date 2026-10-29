import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const WAV = resolve('tests/fixtures/audio/synth_scale.wav');
const EXPECTED = ['D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C#6', 'D6'];
const DETUNE = [0, 12, -20, 5, 0, 25, -8, 15];

async function readTable(page: Page) {
  const rows = page.locator('table.notes tbody tr');
  const n = await rows.count();
  const out: { name: string; cents: number; slope: number }[] = [];
  for (let i = 0; i < n; i++) {
    const cells = await rows.nth(i).locator('td').allInnerTexts();
    out.push({ name: cells[3], cents: parseFloat(cells[5]), slope: parseFloat(cells[11]) });
  }
  return out;
}

test('loads without console errors and analyses an uploaded file', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/TuningTracker/');
  await expect(page.locator('h1')).toHaveText('TuningTracker');
  await page.selectOption('#preset', 'whistle-d');
  await page.setInputFiles('#file', WAV);
  await expect(page.locator('#status')).toHaveText(/Done/, { timeout: 30_000 });

  const notes = await readTable(page);
  expect(notes.map((n) => n.name)).toEqual(EXPECTED);
  notes.forEach((n, i) => {
    // Median over a ±15 dB sweep with +2 c/dB coupling sits above the base detune.
    expect(Math.abs(n.cents - DETUNE[i])).toBeLessThan(25);
    expect(Math.abs(n.slope - 2)).toBeLessThan(0.5);
  });
  await page.screenshot({ path: 'test-results/upload.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('records from the (fake) microphone and analyses', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/TuningTracker/');
  await page.selectOption('#preset', 'whistle-d');
  await page.click('#rec');
  await expect(page.locator('#recinfo')).toHaveText(/recording/, { timeout: 10_000 });
  await expect(page.locator('#liveReadout')).not.toHaveText('—', { timeout: 10_000 });
  await page.waitForTimeout(6000);
  await page.click('#stop');
  await expect(page.locator('#status')).toHaveText(/Done/, { timeout: 30_000 });
  const notes = await readTable(page);
  expect(notes.length).toBeGreaterThanOrEqual(3);

  // Save audio: headless Chromium has no native dialog, so stub the picker
  // and check a WAV is written through it.
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__saved = null;
    w.showSaveFilePicker = async (opts: { suggestedName: string; startIn: string }) => ({
      createWritable: async () => ({
        write: async (b: Blob) => { w.__saved = { name: opts.suggestedName, startIn: opts.startIn, size: b.size, type: b.type }; },
        close: async () => {},
      }),
    });
  });
  await expect(page.locator('#saveAudio')).toBeEnabled();
  await page.click('#saveAudio');
  await expect(page.locator('#status')).toHaveText(/Saved recording-.*\.wav/);
  const saved = await page.evaluate(() => (window as unknown as { __saved: { name: string; startIn: string; size: number; type: string } }).__saved);
  expect(saved.startIn).toBe('downloads');
  expect(saved.type).toBe('audio/wav');
  expect(saved.size).toBeGreaterThan(100_000);
  await page.screenshot({ path: 'test-results/record.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('re-applying gates updates the table without re-tracking', async ({ page }) => {
  await page.goto('/TuningTracker/');
  await page.selectOption('#preset', 'whistle-d');
  await page.setInputFiles('#file', WAV);
  await expect(page.locator('#status')).toHaveText(/Done/, { timeout: 30_000 });
  await page.fill('#minDurS', '5');
  await page.click('#regate');
  await expect(page.locator('table.notes tbody tr')).toHaveCount(0);
  await page.fill('#minDurS', '0.3');
  await page.click('#regate');
  await expect(page.locator('table.notes tbody tr')).toHaveCount(8);
});

test('switching modes and limiting the number of notes', async ({ page }) => {
  await page.goto('/TuningTracker/');
  await page.selectOption('#preset', 'whistle-d');
  await page.setInputFiles('#file', WAV);
  await expect(page.locator('#status')).toHaveText(/Done/, { timeout: 30_000 });

  await page.fill('#maxNotes', '5');
  await page.locator('#maxNotes').dispatchEvent('change');
  await expect(page.locator('table.notes tbody tr')).toHaveCount(5);
  await expect(page.locator('#status')).toHaveText(/3 later notes were ignored/);

  // Every note of the synthetic scale is distinct, so tune mode gives 8 rows of 1 occurrence each.
  await page.selectOption('#mode', 'tune');
  await expect(page.locator('table.notes thead')).toContainText('times');
  await expect(page.locator('table.notes tbody tr')).toHaveCount(8);
  await expect(page.locator('#summary')).toContainText('8 distinct notes from 8 played');
  await page.screenshot({ path: 'test-results/tune-mode.png', fullPage: true });
});

test('save without a native picker shows a name dialog and downloads with that name', async ({ page }) => {
  // Behave like Firefox/Safari: no File System Access API.
  await page.addInitScript(() => { delete (window as unknown as Record<string, unknown>).showSaveFilePicker; });
  await page.goto('/TuningTracker/');
  await page.selectOption('#preset', 'whistle-d');
  await page.setInputFiles('#file', WAV);
  await expect(page.locator('#status')).toHaveText(/Done/, { timeout: 30_000 });

  await page.click('#saveAudio');
  await expect(page.locator('#saveDialog')).toBeVisible();
  await expect(page.locator('#saveName')).toHaveValue('synth_scale.wav');

  // Cancel saves nothing.
  await page.click('#saveDialog button[value="cancel"]');
  await expect(page.locator('#saveDialog')).toBeHidden();

  await page.click('#saveAudio');
  await page.fill('#saveName', 'melodica take 1');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#saveConfirm')]);
  expect(dl.suggestedFilename()).toBe('melodica take 1.wav');
  await expect(page.locator('#status')).toHaveText(/Saved melodica take 1\.wav/);

  // Exports use the same dialog.
  await page.click('#dlNotes');
  await expect(page.locator('#saveName')).toHaveValue('synth_scale-notes.csv');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#saveConfirm')]);
  expect(dl2.suggestedFilename()).toBe('synth_scale-notes.csv');
});
