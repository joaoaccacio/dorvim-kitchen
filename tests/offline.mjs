import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

// Test the built application and its real UI, without importing development modules.
// BASE_URL can target an already running production deployment; otherwise start preview.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const origin = new URL(baseURL).origin;
const repository = fileURLToPath(new URL('../', import.meta.url));
let preview = null;
let previewOutput = '';
let browser = null;
try {
  if (!process.env.BASE_URL) {
    preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { cwd: repository, stdio: ['ignore', 'pipe', 'pipe'] });
    preview.stdout.on('data', (chunk) => { previewOutput += chunk; });
    preview.stderr.on('data', (chunk) => { previewOutput += chunk; });
    preview.on('error', (error) => { previewOutput += error.message; });
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (preview.exitCode !== null) throw new Error(`Production preview exited: ${previewOutput}`);
      try { const response = await fetch(baseURL, { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } } catch { /* Preview is still starting. */ }
      await delay(100);
    }
    assert.ok(ready, `Production preview did not become ready: ${previewOutput}`);
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'allow' });
  const externalRequests = [];
  const errors = [];
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) externalRequests.push(request.url());
  });
  const page = await context.newPage();
  let offlinePhase = false;
  const offlineResponses = [];
  page.on('response', (response) => { if (offlinePhase) offlineResponses.push({ url: response.url(), worker: response.fromServiceWorker() }); });
  page.setDefaultTimeout(15_000);
  page.on('pageerror', (error) => errors.push(error.message));
  const action = (name) => page.locator(`[data-action="${name}"]`);
  const savedState = () => page.evaluate(() => {
    const stored = localStorage.getItem('dorvim-kitchen.save');
    if (!stored) throw new Error('The UI did not save the career.');
    return JSON.parse(JSON.parse(stored).payload);
  });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await expect(action('new')).toBeVisible();
  await page.waitForFunction(() => 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller), undefined, { timeout: 20_000 });
  const offlineCache = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith('dorvim-kitchen-offline-'));
    const urls = (await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map((request) => request.url)))).flat();
    return { names, urls };
  });
  assert.equal(offlineCache.names.length, 1, 'One active offline build is installed.');
  assert.ok(offlineCache.urls.some((url) => new URL(url).pathname.endsWith('/index.html')), 'The offline index is cached.');
  assert.ok(offlineCache.urls.some((url) => /\/assets\/.*\.js$/.test(new URL(url).pathname)), 'The production JavaScript is cached.');
  assert.ok(offlineCache.urls.some((url) => /\/assets\/.*\.css$/.test(new URL(url).pathname)), 'The production styles are cached.');
  await action('new').click();
  await page.locator('input[name="chefName"]').fill('Chef Sem Internet');
  await page.locator('#career-form button[type="submit"], #career-form button').last().click();
  await expect(page.locator('.chef-card strong')).toHaveText('Chef Sem Internet');
  await expect(page.locator('#restaurant-canvas')).toBeVisible();
  await action('save').click();
  await expect(page.locator('#save-label')).toContainText('Salvo');
  const before = await savedState();

  offlinePhase = true;
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(action('continue')).toBeVisible();
  await action('continue').click();
  await expect(page.locator('.chef-card strong')).toHaveText('Chef Sem Internet');
  await expect(page.locator('#restaurant-canvas')).toBeVisible();
  await expect(page.locator('#hud-day')).toHaveText(`DIA ${before.day}`);
  const after = await savedState();
  for (const field of ['careerName', 'day', 'cash', 'xp', 'restaurants', 'employees', 'competition', 'eventEffects', 'reliefUsed', 'debt']) assert.deepEqual(after[field], before[field], `Offline reload preserves ${field}.`);
  await action('open').click();
  await expect(page.locator('.order-ticket').first()).toBeVisible();
  await expect(page.locator('#order-count')).toHaveText('2');
  await action('prepare').first().click();
  await expect(page.locator('#cooking-game canvas')).toBeVisible();
  for (const extension of ['js', 'css']) assert.ok(offlineResponses.some((response) => new URL(response.url).pathname.endsWith(`.${extension}`) && response.worker), `Offline ${extension} is served by the service worker.`);
  assert.deepEqual(externalRequests, [], 'The production game makes no external HTTP requests.');
  assert.deepEqual(errors, [], 'The offline game has no uncaught browser errors.');
  console.log('✓ Production service worker cached the complete local bundle.');
  console.log('✓ Offline reload restored the saved career and playable restaurant/cooking UI.');
  console.log('✓ No external HTTP requests or uncaught browser errors.');
  await context.close();
} finally {
  if (browser) await browser.close();
  if (preview && preview.exitCode === null) preview.kill('SIGTERM');
}
