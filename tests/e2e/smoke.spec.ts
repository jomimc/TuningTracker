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
