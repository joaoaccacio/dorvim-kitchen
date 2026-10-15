import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// Run Vite first: npm run dev. No application globals or test-only UI hooks are used.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';
const artifacts = process.env.ARTIFACT_DIR || '/tmp/dorvim-browser-artifacts';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(12_000);
const errors = [];
const steps = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const log = (message) => { steps.push(message); console.log(`✓ ${message}`); };
const action = (name) => page.locator(`[data-action="${name}"]`);
const nav = async (view) => page.locator(`.nav-item[data-view="${view}"]`).click();
const saved = () => page.evaluate(async () => {
  const { loadCareer } = await import('/src/platform/save.ts');
  const result = loadCareer();
  if (!result.state) throw new Error(result.message);
  return result.state;
});
const save = async () => { await page.keyboard.press('Control+s'); await expect(page.locator('#save-label')).toContainText('Salvo'); return saved(); };
const screenshot = async (name) => page.screenshot({ path: `${artifacts}/${name}.png`, animations: 'disabled' });

async function layout(label) {
  const problems = await page.evaluate(() => {
    const width = window.innerWidth;
    const result = [];
    if (document.documentElement.scrollWidth > width + 2) result.push(`page width ${document.documentElement.scrollWidth} exceeds ${width}`);
    for (const selector of ['.sidebar', '.topbar', '#workspace', '.scene-frame', '.order-rail']) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && (rect.left < -2 || rect.right > width + 2)) result.push(`${selector} extends outside viewport: ${rect.left}–${rect.right}`);
    }
    const lastNav = document.querySelector('.nav-item:last-child');
    if (lastNav && lastNav.getBoundingClientRect().bottom > window.innerHeight + 2) result.push('last navigation item is clipped below viewport');
    return result;
  });
  assert.deepEqual(problems, [], `${label}: ${problems.join('; ')}`);
}

async function hold(key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function playStep(type, capture = false) {
  const canvas = page.locator('#cooking-game canvas');
  await expect(canvas).toBeVisible();
  await canvas.focus();
  const oldCanvas = await canvas.elementHandle();
  const rect = await canvas.boundingBox();
  assert.ok(rect, 'Cooking canvas is visible');
  // Keep the gesture's coordinates fixed: a completed wash can replace its canvas mid-swipe.
  const pointOnCanvas = (x, y) => page.mouse.move(rect.x + x * rect.width / 720, rect.y + y * rect.height / 400);
  if (capture) await screenshot(`cooking-${type}`);
  if (type === 'cut') {
    for (let index = 0; index < 7; index++) {
      await pointOnCanvas(183 + index * 59, 145);
      await page.mouse.down();
      await pointOnCanvas(183 + index * 59, 285);
      await page.mouse.up();
    }
  } else if (type === 'mix') {
    await pointOnCanvas(465, 215);
    await page.mouse.down();
    for (let index = 1; index <= 146; index++) {
      const angle = index / 48 * Math.PI * 2;
      await pointOnCanvas(360 + Math.cos(angle) * 105, 215 + Math.sin(angle) * 105);
    }
    await page.mouse.up();
  } else if (type === 'grill' || type === 'bake') {
    if (type === 'grill') {
      await expect.poll(() => page.locator('#cooking-game progress').evaluate((element) => element.value)).toBeGreaterThan(0.47);
      await page.keyboard.press('Space');
    }
    await expect.poll(() => page.locator('#cooking-game progress').evaluate((element) => element.value), { timeout: 9000 }).toBeGreaterThan(0.98);
    await page.keyboard.press('Space');
  } else if (type === 'season') {
    await hold('Space', 1540);
    await page.keyboard.press('Enter');
  } else if (type === 'plate') {
    for (const [x, y, targetX, targetY] of [[116, 115, 437, 172], [116, 215, 489, 248], [116, 312, 389, 266], [215, 310, 445, 302]]) {
      await pointOnCanvas(x, y); await page.mouse.down();
      await pointOnCanvas(targetX, targetY); await page.mouse.up();
    }
  } else if (type === 'drink') {
    for (let layer = 0; layer < 3; layer++) {
      await page.keyboard.press(String(layer + 1));
      await hold('Space', 1000);
      await page.keyboard.press('Enter');
    }
  } else if (type === 'wash') {
    for (let index = 0; index < 12; index++) {
      const x = 172 + (index % 4) * 125 + Math.sin(index * 3) * 14;
      const y = 115 + Math.floor(index / 4) * 87 + Math.cos(index * 2) * 10;
      await pointOnCanvas(x - 30, y); await page.mouse.down();
      for (let scrub = 0; scrub < 6; scrub++) await pointOnCanvas(x + (scrub % 2 ? -30 : 30), y);
      await page.mouse.up();
    }
  } else throw new Error(`No playable gesture for ${type}`);
  await page.waitForFunction((element) => !element.isConnected, oldCanvas, { timeout: 6000 });
  await oldCanvas.dispose();
}

async function fixture(mode) {
  // Navigate to the title first, so the previous career's pagehide autosave cannot overwrite a fixture.
  await page.goto(baseURL);
  await expect(action('new')).toBeVisible();
  await page.evaluate(async (fixtureMode) => {
    const { createCareer } = await import('/src/game/engine.ts');
    const { RECIPES } = await import('/src/game/content.ts');
    const { saveCareer, saveSettings } = await import('/src/platform/save.ts');
    const state = createCareer('Chef de Teste', 'casual');
    state.day = 6; state.xp = 1600; state.stage = 5; state.cash = 8000;
    state.unlocked = RECIPES.map((recipe) => recipe.id);
    state.settings = { music: 0.3, effects: 0.6, reducedMotion: true, showTips: false };
    state.taxes = 37; state.debt = 12; state.taxDue = 6; state.inspectionDue = 6;
    state.restaurants[0].menu = ['salada_horta'];
    for (const stock of Object.values(state.restaurants[0].stock)) stock.expires = 30;
    state.restaurants[0].equipment.forno = 1;
    state.restaurants[0].equipment.chapa = 1;
    if (fixtureMode === 'drink') state.restaurants[0].menu = ['suco_estacao'];
    if (fixtureMode === 'bake') state.restaurants[0].menu = ['bolo_caseiro'];
    const result = saveCareer(state);
    if (!result.ok) throw new Error(result.message);
    saveSettings(state.settings);
  }, mode);
  await page.reload();
  await action('continue').click();
  await expect(page.locator('.game-shell')).toBeVisible();
}

try {
  await page.goto(baseURL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: /Todo grande chef/ })).toBeVisible();
  await layout('title 1440');
  await screenshot('title-1440');
  await action('new').click();
  await page.locator('[name="chefName"]').fill('Chef Navegador');
  await page.locator('[name="difficulty"][value="casual"]').check();
  await page.getByRole('button', { name: /Minha história começa aqui/ }).click();
  assert.equal((await saved()).difficulty, 'casual');
  await layout('new career 1440');
  await screenshot('restaurant-1440');
  await action('open').click();
  await expect(page.locator('.order-ticket')).toHaveCount(2);
  const opened = await saved();
  const order = opened.restaurants[0].orders[0];
  const recipe = await page.evaluate(async (id) => (await import('/src/game/content.ts')).RECIPES.find((item) => item.id === id), order.recipeId);
  assert.ok(recipe, 'Opening creates an available recipe');
  await page.locator(`[data-action="prepare"][data-id="${order.id}"]`).click();
  await playStep(recipe.steps[0].action, true);
  const inFlight = await save();
  assert.equal(inFlight.restaurants[0].orders.find((item) => item.id === order.id).stepIndex, 1);
  await page.reload();
  await action('continue').click();
  await expect(page.locator('.cooking-modal')).toBeVisible();
  const resumed = await saved();
  assert.equal(resumed.restaurants[0].orders.find((item) => item.id === order.id).stepIndex, 1, 'Reload preserves completed gestures and resumes the next step');
  for (const step of recipe.steps.slice(1)) await playStep(step.action, true);
  await expect(action('serve-finished')).toBeVisible();
  const prepared = await saved();
  const dish = prepared.restaurants[0].orders.find((item) => item.id === order.id);
  assert.equal(dish.status, 'ready'); assert.equal(dish.scores.length, recipe.steps.length);
  assert.ok(dish.quality >= 75, `Precise gestures produce a good dish: ${dish.quality}`);
  await screenshot('dish-ready');
  await action('serve-finished').click();
  const served = await saved();
  assert.equal(served.servedTotal, 1); assert.ok(served.cash > opened.cash); assert.ok(served.xp > 0);
  assert.ok(served.reviews.length > 0); assert.ok(served.ledger.some((item) => item.category === 'vendas'));
  log(`New casual career, full ${recipe.name}, in-flight reload, service reward and review`);

  await action('pause').first().click();
  await expect(page.locator('#pause-overlay')).toBeVisible();
  const clock = await page.locator('#hud-time').textContent();
  await page.waitForTimeout(650);
  assert.equal(await page.locator('#hud-time').textContent(), clock);
  await action('settings').click();
  await page.locator('#music-setting').fill('0.15');
  await page.locator('#effects-setting').fill('0.4');
  await page.locator('#motion-setting').check();
  await expect(page.locator('#music-output')).toHaveText('15%');
  await expect(page.locator('#effects-output')).toHaveText('40%');
  await action('close-modal').click();
  const preferences = await page.evaluate(async () => (await import('/src/platform/save.ts')).loadSettings());
  assert.equal(preferences.music, 0.15); assert.equal(preferences.effects, 0.4); assert.equal(preferences.reducedMotion, true);
  log('Pause freezes service time; music, effects and motion settings persist');

  await nav('menu');
  const priceInput = page.locator('[data-price="salada_horta"]');
  const previousPrice = Number(await priceInput.inputValue());
  await priceInput.fill(String(previousPrice + 2)); await priceInput.blur();
  assert.equal((await saved()).restaurants[0].prices.salada_horta, previousPrice + 2);
  await nav('stock');
  const beforeStock = await saved();
  await page.locator('[data-action="buy"][data-id="tomate"][data-quantity="5"]').click();
  const afterStock = await saved();
  assert.equal(afterStock.restaurants[0].stock.tomate.quantity, beforeStock.restaurants[0].stock.tomate.quantity + 5);
  assert.ok(afterStock.cash < beforeStock.cash);
  await nav('upgrades');
  const beforeEquipment = await saved();
  await page.locator('[data-action="upgrade"][data-id="bancada"]').click();
  const afterEquipment = await saved();
  assert.equal(afterEquipment.restaurants[0].equipment.bancada, beforeEquipment.restaurants[0].equipment.bancada + 1);
  assert.ok(afterEquipment.cash < beforeEquipment.cash);
  log('Recipe price, immediate stock delivery and equipment purchase update saved state');

  await fixture('actions');
  await nav('finance');
  const beforeTax = await saved();
  await action('payTax').click();
  const afterTax = await saved();
  assert.equal(afterTax.taxes, 0); assert.equal(afterTax.debt, 0); assert.equal(beforeTax.cash - afterTax.cash, 49);
  await nav('reputation'); await action('inspect').click();
  await expect.poll(async () => (await saved()).inspectionResult).toMatch(/Aprovado/);
  await expect(page.locator('#modal-layer .inspection-result')).toContainText('Aprovado');
  await screenshot('inspection');
  await page.locator('#modal-layer .button[data-action="close-modal"]').click();
  await nav('staff');
  for (const id of ['joana', 'lucas', 'marina']) await page.locator(`[data-action="hire"][data-id="${id}"]`).click();
  assert.equal((await saved()).employees.length, 3);
  await page.locator('[data-action="train"][data-id="joana"]').click();
  assert.ok((await saved()).employees.find((item) => item.id === 'joana').skill > 76);
  await screenshot('staff');
  log('Advanced UI fixture: tax/debt payment, approved inspection, hiring and training');

  await nav('restaurant');
  await action('open').click();
  await page.locator('#speed-button').click();
  await expect(page.locator('.order-ticket').filter({ hasText: 'Equipe preparando' }).or(page.locator('.order-ticket').filter({ hasText: 'Joana Ferreira' })).first()).toBeVisible();
  await expect(page.locator('#daily-progress')).not.toHaveText(/^0 de/, { timeout: 24_000 });
  await save();
  assert.ok((await saved()).servedTotal >= 1, 'Cook prepares and waiter automatically serves');
  await expect(action('close')).toBeEnabled({ timeout: 25_000 });
  await action('close').click();
  await expect(action('nextDay')).toBeVisible();
  assert.ok((await saved()).reports.length > 0);
  await screenshot('service-report');
  await action('nextDay').click();
  assert.equal((await saved()).phase, 'planning');
  log('Hired cook and waiter automate service; day closes with an accounting report');

  await nav('competitions');
  await action('competition-enter').click();
  const competition = (await saved()).competition;
  assert.equal(competition.active, true);
  const competitionRecipe = await page.evaluate(async (id) => (await import('/src/game/content.ts')).RECIPES.find((item) => item.id === id), competition.recipeId);
  for (let round = 0; round < 3; round++) {
    for (const step of competitionRecipe.steps) await playStep(step.action, true);
    await expect(action('competition-result')).toBeVisible();
    await screenshot(`competition-round-${round + 1}`);
    assert.equal((await saved()).competition.round, round + 1);
    await action('competition-result').click();
  }
  assert.equal((await saved()).competition.wins, 1);
  log(`Three competition rounds played through genuine ${competitionRecipe.name} gestures; title awarded`);

  await nav('career');
  const beforeExpansion = await saved();
  await page.locator('[name="restaurantName"]').fill('Mesa do Jardim');
  await page.locator('[name="style"]').selectOption('massas');
  await page.locator('#expansion-form button').click();
  const expanded = await saved();
  assert.equal(expanded.restaurants.length, 2); assert.ok(expanded.cash < beforeExpansion.cash);
  await page.locator('#restaurant-select').selectOption('2');
  assert.equal((await saved()).activeRestaurant, 2);
  await nav('restaurant');
  await expect(page.locator('.restaurant-heading h1')).toHaveText('Mesa do Jardim');
  await page.locator('#restaurant-select').selectOption('1');
  await screenshot('expanded-network');
  log('Expansion creates a separate restaurant and the location switch visits both kitchens');

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    for (const view of ['restaurant', 'menu', 'stock', 'staff', 'upgrades', 'finance', 'reputation', 'career', 'competitions']) {
      await nav(view);
      await layout(`${view} ${viewport.width}×${viewport.height}`);
      await screenshot(`${view}-${viewport.width}`);
    }
  }
  log('All nine navigation screens fit 1440×1000 and 1024×768 without horizontal clipping');
  await save(); await page.reload(); await action('continue').click();
  const finalState = await saved();
  assert.equal(finalState.restaurants.length, 2); assert.equal(finalState.competition.wins, 1); assert.equal(finalState.employees.length, 3);
  for (const mode of ['drink', 'bake']) {
    await fixture(mode);
    await action('open').click();
    const extraOrder = (await saved()).restaurants[0].orders[0];
    const extraRecipe = await page.evaluate(async (id) => (await import('/src/game/content.ts')).RECIPES.find((item) => item.id === id), extraOrder.recipeId);
    await page.locator(`[data-action="prepare"][data-id="${extraOrder.id}"]`).click();
    for (const step of extraRecipe.steps) await playStep(step.action, true);
    await action('serve-finished').click();
    assert.equal((await saved()).servedTotal, 1);
  }
  log('Beverage layers and oven recipe also complete through integrated service; all eight actions exercised');
  assert.deepEqual(errors, [], 'Browser console and page errors');
  console.log(`\n${steps.length} browser workflows passed. Screenshots: ${artifacts}`);
} catch (error) {
  await screenshot('FAILURE').catch(() => {});
  console.error(`Browser errors: ${JSON.stringify(errors)}`);
  console.error(`Screenshots: ${artifacts}`);
  throw error;
} finally {
  await browser.close();
}
