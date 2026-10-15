import { afterEach, describe, expect, it, vi } from 'vitest';
import { activeRestaurant, createCareer, GameEngine } from '../src/game/engine';
import { EQUIPMENT, EVENTS, RECIPES } from '../src/game/content';
import type { Command, GameState } from '../src/game/types';
import { BACKUP_KEY, SAVE_KEY, SETTINGS_KEY, deleteCareer, exportCareer, hasCareer, importCareer, loadCareer, loadSettings, saveCareer, saveSettings } from '../src/platform/save';

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  failOn: string | null = null;
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) {
    if (key === this.failOn) throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    this.data.set(key, value);
  }
}
function fullCareer(): GameState {
  const s = createCareer('Cozinha da Ana', 'especialista');
  s.day = 18; s.cash = 12543.75; s.xp = 920; s.stage = 4; s.phase = 'service'; s.elapsed = 91.2; s.paused = true; s.speed = 2;
  s.employees = [{ id: 'lena', name: 'Lena', role: 'chef', speed: 73, skill: 92, hygiene: 81, organization: 77, stress: 32, wage: 54, unlock: 2, bio: 'Chef de cozinha', level: 3, experience: 82, fatigue: 24, active: true, task: 'Preparando', served: 19, restaurantId: s.restaurants[0].id }];
  const r = s.restaurants[0];
  r.managerId = 'lena'; r.closed = false; r.reputation = 84; r.cleanliness = 73; r.condition = 92;
  r.stock = { tomato: { quantity: 8, quality: 89, expires: 21 } };
  r.orders = [{ id: 18, recipeId: r.menu[0] ?? 'soup', customer: 'Ana', profile: 'critico', patience: 40, maxPatience: 95, status: 'manual', progress: 12.5, quality: 84, scores: [82, 93], stepIndex: 2, ingredientQuality: 89, assigned: 'lena' }];
  r.revenue = 151; r.served = 8; r.lost = 1; r.profit = -32;
  const branch = structuredClone(r); branch.id = r.id + 1; branch.name = 'Filial'; branch.orders = []; delete branch.managerId;
  s.restaurants.push(branch);
  s.nextOrderId = 19; s.unlocked = RECIPES.map((recipe) => recipe.id);
  s.ledger = [{ day: 18, category: 'compra', label: 'Tomates', amount: -65.5 }];
  s.reviews = [{ day: 17, name: 'Cliente', score: 4.5, text: 'Uma delícia!' }];
  s.reports = [{ day: 17, revenue: 800, expenses: 370, served: 16, lost: 2, quality: 85, tips: 24, inspection: 'Aprovado' }];
  s.achievements = ['first-service']; s.settings = { music: 0.2, effects: 0.7, reducedMotion: true, showTips: false };
  s.competition = { round: 2, scores: [89, 92], enteredDay: 18, active: true, wins: 1, recipeId: RECIPES[0].id };
  s.event = { id: 'delivery', title: 'Entrega', text: 'Escolha o fornecedor', choices: [{ label: 'Horta', effect: 'fresh' }, { label: 'Mercado', effect: 'cheap' }] };
  s.tutorial = 4; s.spawnIn = 2.3; s.servedTotal = 91; s.qualityTotal = 7502;
  s.taxes = 153; s.taxDue = 21; s.inspectionDue = 20; s.inspectionResult = 'Boa higiene';
  s.daily = { revenue: 151, expenses: 183, served: 8, lost: 1, quality: 684, tips: 9 };
  s.sales = { pie: { count: 12, revenue: 420 } }; s.playTime = 1410; s.notices = ['Bom serviço!'];
  s.eventEffects = { demand: 1.2, supply: 1.1, critic: true, absentId: 'lena' }; s.reliefUsed = true; s.debt = 42;
  return s;
}
function expectedAfterSave(state: GameState, savedAt: number) { return { ...state, savedAt, version: 2 }; }
function v1(state: GameState): Record<string, unknown> { return { ...structuredClone(state), version: 1 }; }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('career storage', () => {
  it('round-trips the complete career, nested service, branches, staff, economy, tournament and preferences', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    const storage = new MemoryStorage(); const state = fullCareer();
    const before = structuredClone(state);
    expect(saveCareer(state, storage).ok).toBe(true);
    expect(state).toEqual(before);
    expect(loadCareer(storage)).toMatchObject({ state: expectedAfterSave(state, Date.now()), recovered: false });
    expect(hasCareer(storage)).toBe(true);
    deleteCareer(storage);
    expect(storage.length).toBe(0); expect(hasCareer(storage)).toBe(false);
  });
  it('rotates only valid primaries and recovers the previous valid career from corrupt JSON', () => {
    const storage = new MemoryStorage(); const state = createCareer('Backup');
    saveCareer(state, storage); const first = storage.getItem(SAVE_KEY);
    state.cash += 17; saveCareer(state, storage);
    expect(storage.getItem(BACKUP_KEY)).toBe(first);
    storage.setItem(SAVE_KEY, '{broken');
    const recovered = loadCareer(storage);
    expect(recovered.recovered).toBe(true); expect(recovered.state?.cash).toBe(state.cash - 17);
    state.cash += 8; expect(saveCareer(state, storage).ok).toBe(true);
    expect(storage.getItem(BACKUP_KEY)).toBe(first);
    expect(loadCareer(storage).state?.cash).toBe(state.cash);
  });
  it('rejects a modified payload without a matching integrity checksum', () => {
    const envelope = JSON.parse(exportCareer(createCareer('Integridade')));
    const payload = JSON.parse(envelope.payload); payload.cash += 100;
    envelope.payload = JSON.stringify(payload);
    expect(importCareer(JSON.stringify(envelope)).state).toBeNull();
  });
  it('rejects malformed nested objects, arrays, enum values and nonfinite monetary values', () => {
    const edits: ((state: Record<string, unknown>) => void)[] = [
      (s) => { s.restaurants = null; },
      (s) => { (s.restaurants as Record<string, unknown>[])[0].stock = { rice: null }; },
      (s) => { (s.restaurants as Record<string, unknown>[])[0].orders = [{ id: 1 }]; },
      (s) => { s.employees = [{ id: 'wrong' }]; },
      (s) => { s.competition = { scores: 'bad' }; },
      (s) => { s.settings = { music: 2, effects: 1, reducedMotion: false, showTips: true }; },
      (s) => { s.daily = []; },
      (s) => { s.cash = Infinity; },
      (s) => { delete s.cash; },
      (s) => { s.phase = 'cheating'; },
      (s) => { s.eventEffects = { demand: null, supply: 1, critic: false }; },
      (s) => { s.debt = -1; },
      (s) => { s.reliefUsed = 'false'; },
    ];
    for (const edit of edits) {
      const state = v1(createCareer('Validação')); edit(state);
      expect(importCareer(JSON.stringify(state)).state).toBeNull();
    }
  });
  it('migrates version 1 with absent modern systems without granting cash, ownership or time', () => {
    const original = createCareer('Legado'); original.cash = 31; original.day = 7;
    const legacy = v1(original);
    for (const key of ['competition', 'event', 'reports', 'achievements', 'daily', 'sales', 'notices', 'eventEffects', 'reliefUsed', 'debt']) delete legacy[key];
    const imported = importCareer(JSON.stringify(legacy));
    expect(imported.state).toMatchObject({ version: 2, careerName: 'Legado', cash: 31, day: 7, restaurants: original.restaurants });
    expect(imported.state?.competition.active).toBe(false);
    const envelope = { format: 'dorvim-kitchen', version: 1, state: legacy };
    expect(importCareer(JSON.stringify(envelope)).state?.cash).toBe(31);
  });
  it('reports unsupported newer saves and never advances cash or the day from future timestamps', () => {
    expect(importCareer(JSON.stringify({ version: 99, payload: '{}' }))).toMatchObject({ state: null, message: expect.stringMatching(/mais recente/) });
    const legacy = v1(createCareer('Amanhã')); legacy.savedAt = Date.now() + 86400_000 * 100;
    const imported = importCareer(JSON.stringify(legacy)).state!;
    expect(imported.savedAt).toBeLessThanOrEqual(Date.now());
    expect(imported.day).toBe(legacy.day); expect(imported.cash).toBe(legacy.cash);
  });
  it('preserves the primary and backup when quota prevents writing and explains recovery', () => {
    const storage = new MemoryStorage(); const s = createCareer('Quota');
    saveCareer(s, storage); s.cash += 3; saveCareer(s, storage);
    const primary = storage.getItem(SAVE_KEY);
    storage.failOn = SAVE_KEY; s.cash += 7;
    const result = saveCareer(s, storage);
    expect(result.ok).toBe(false); expect(result.message).toMatch(/cheio.*preservada/);
    expect(storage.getItem(SAVE_KEY)).toBe(primary);
    expect(loadCareer(storage).state?.cash).toBe(s.cash - 7);
    expect(importCareer(storage.getItem(BACKUP_KEY)!).state).not.toBeNull();
    storage.failOn = BACKUP_KEY;
    expect(saveCareer(s, storage).ok).toBe(false); expect(storage.getItem(SAVE_KEY)).toBe(primary);
  });
  it('rejects malformed imports without altering an existing save and imports exports', () => {
    const storage = new MemoryStorage(); const s = createCareer('Importação'); saveCareer(s, storage);
    const old = storage.getItem(SAVE_KEY);
    for (const text of ['', 'null', '[]', '123', '{', '{}']) expect(importCareer(text).state).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBe(old);
    expect(importCareer(exportCareer(s)).state?.careerName).toBe(s.careerName);
  });
  it('handles unavailable storage and validates separately saved settings', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(saveCareer(createCareer('Sem espaço')).ok).toBe(false);
    expect(loadCareer().state).toBeNull();
    const storage = new MemoryStorage(); vi.stubGlobal('localStorage', storage);
    const prefs = { music: 0, effects: 0.8, reducedMotion: true, showTips: false };
    saveSettings(prefs); expect(loadSettings()).toEqual(prefs);
    storage.setItem(SETTINGS_KEY, 'null');
    expect(loadSettings()).toMatchObject({ reducedMotion: false, showTips: true });
  });
});

function comparable(state: GameState): unknown {
  const plain = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  delete plain.savedAt;
  return plain;
}
function resumedEngine(engine: GameEngine): GameEngine {
  const imported = importCareer(exportCareer(engine.state));
  expect(imported.state, imported.message).not.toBeNull();
  expect(comparable(imported.state!)).toEqual(comparable(engine.state));
  return new GameEngine(imported.state!);
}

describe('save and simulation consistency', () => {
  it('continues identically through deterministic command/tick checkpoints with partial manual and automated jobs in two restaurants', () => {
    const initial = createCareer('Cozinhas conectadas');
    initial.cash = 25000; initial.xp = 2000; initial.stage = 5; initial.unlocked = RECIPES.map((recipe) => recipe.id);
    for (const equipment of EQUIPMENT) initial.restaurants[0].equipment[equipment.id] = equipment.max;
    const control = new GameEngine(initial);
    for (const candidateId of ['joana', 'lucas', 'nina', 'marina', 'davi', 'bia']) expect(control.execute({ type: 'hire', candidateId }).ok).toBe(true);
    expect(control.execute({ type: 'expand', name: 'Segunda cozinha', style: 'brasileira' }).ok).toBe(true);
    control.execute({ type: 'switch', restaurantId: 2 });
    expect(control.execute({ type: 'assign', employeeId: 'marina', role: 'gerente' }).ok).toBe(true);
    control.execute({ type: 'switch', restaurantId: 1 });
    expect(control.execute({ type: 'open' }).ok).toBe(true);
    const first = activeRestaurant(control.state).orders[0];
    expect(control.execute({ type: 'prepare', orderId: first.id }).ok).toBe(true);
    expect(control.execute({ type: 'step', orderId: first.id, score: 84 }).ok).toBe(true);
    control.tick(0.13);
    let restored = resumedEngine(control);
    let sawAuto = false, sawManual = false, sawRemote = false, sawSummary = false;
    const pair = (command: Command) => expect(restored.execute(command)).toEqual(control.execute(command));
    for (let index = 0; index < 180; index++) {
      const state = control.state;
      if (state.phase === 'summary') {
        sawSummary = true; pair({ type: 'nextDay' });
        if (state.event) pair({ type: 'event', choice: index % state.event.choices.length });
        pair({ type: 'clean' }); pair({ type: 'repair' });
        for (const ingredientId of Object.keys(activeRestaurant(state).stock)) pair({ type: 'buy', ingredientId, quantity: 8, supplier: 'horta' });
        pair({ type: 'open' });
      }
      if (state.phase === 'service') {
        const place = activeRestaurant(state);
        const manual = place.orders.find((order) => order.status === 'manual');
        const ready = place.orders.find((order) => order.status === 'ready');
        const waiting = place.orders.find((order) => order.status === 'waiting');
        if (manual) pair({ type: 'step', orderId: manual.id, score: 50 + index * 17 % 51 });
        else if (ready) pair({ type: 'serve', orderId: ready.id });
        else if (waiting && index % 3 === 0) pair({ type: 'prepare', orderId: waiting.id });
        if (index % 11 === 0) pair({ type: 'switch', restaurantId: state.activeRestaurant === 1 ? 2 : 1 });
        if (index % 13 === 0) pair({ type: 'buy', ingredientId: 'tomate', quantity: 3, supplier: 'economico' });
      }
      control.state.speed = restored.state.speed = [0.25, 1, 2, 3][index % 4];
      control.state.paused = restored.state.paused = index % 19 === 0;
      const seconds = 0.17 + (index * 47 % 53) / 13;
      control.tick(seconds); restored.tick(seconds);
      expect(comparable(restored.state)).toEqual(comparable(control.state));
      const orders = control.state.restaurants.flatMap((place) => place.orders);
      sawAuto ||= orders.some((order) => order.status === 'auto');
      sawManual ||= orders.some((order) => order.status === 'manual');
      sawRemote ||= control.state.restaurants[1].orders.length > 0;
      restored = resumedEngine(restored);
    }
    expect({ sawAuto, sawManual, sawRemote, sawSummary }).toEqual({ sawAuto: true, sawManual: true, sawRemote: true, sawSummary: true });
  });
  it('preserves debt, closures, one-time relief and fiscal outcomes without paying or granting money again after reload', () => {
    const state = createCareer('Fiscalização'); state.cash = 0; state.day = 3; state.stage = 3; state.xp = 400;
    state.restaurants[0].cleanliness = 0; state.restaurants[0].condition = 0;
    let engine = new GameEngine(state);
    expect(engine.execute({ type: 'inspect' }).ok).toBe(true);
    expect(engine.state.debt).toBeGreaterThan(0); expect(engine.state.restaurants[0].closed).toBe(true);
    engine = resumedEngine(engine);
    const debt = engine.state.debt;
    engine.execute({ type: 'inspect' }); expect(engine.state.debt).toBe(debt);
    expect(engine.execute({ type: 'relief' }).ok).toBe(true);
    const cash = engine.state.cash;
    engine = resumedEngine(engine);
    expect(engine.state.reliefUsed).toBe(true); expect(engine.state.debt).toBe(debt);
    expect(engine.execute({ type: 'relief' }).ok).toBe(false); expect(engine.state.cash).toBe(cash);
    engine.state.cash = 1000;
    engine.execute({ type: 'clean' }); engine.execute({ type: 'repair' }); engine.execute({ type: 'inspect' });
    engine = resumedEngine(engine);
    expect(engine.state.restaurants[0].closed).toBe(false);
    const beforeTax = engine.state.cash; const outstanding = engine.state.taxes + (engine.state.debt ?? 0);
    expect(engine.execute({ type: 'payTax' }).ok).toBe(true);
    engine = resumedEngine(engine);
    expect(engine.state.cash).toBeCloseTo(beforeTax - outstanding, 2); expect(engine.state.debt).toBe(0);
    expect(engine.execute({ type: 'payTax' }).ok).toBe(false);
  });
  it('resumes competition rounds and events with identical costs, prizes, stock and active modifiers', () => {
    const initial = createCareer('Circuito'); initial.cash = 2000; initial.stage = 3; initial.xp = 500;
    initial.unlocked = RECIPES.filter((recipe) => recipe.unlock <= 3).map((recipe) => recipe.id);
    let engine = new GameEngine(initial);
    expect(engine.execute({ type: 'competition', action: 'enter' }).ok).toBe(true);
    const recipe = RECIPES.find((entry) => entry.id === engine.state.competition.recipeId)!;
    for (let round = 0; round < 3; round++) {
      engine = resumedEngine(engine);
      expect(engine.state.competition.round).toBe(round);
      expect(engine.execute({ type: 'competitionScore', scores: recipe.steps.map(() => 92) }).ok).toBe(true);
    }
    expect(engine.state.competition.wins).toBe(1);
    const prizeCash = engine.state.cash;
    engine = resumedEngine(engine);
    expect(engine.execute({ type: 'competitionScore', scores: recipe.steps.map(() => 92) }).ok).toBe(false);
    expect(engine.state.cash).toBe(prizeCash);
    for (const event of EVENTS) {
      engine.state.event = structuredClone(event);
      engine = resumedEngine(engine);
      const result = engine.execute({ type: 'event', choice: 0 });
      expect(result.ok, event.id).toBe(true);
      expect(engine.state.event).toBeNull();
      engine = resumedEngine(engine);
    }
    expect(engine.state.eventEffects).toBeDefined();
  });
  it('rejects unknown recipe references that would otherwise crash service simulation', () => {
    for (const edit of [
      (state: GameState) => { state.restaurants[0].menu.push('receita-inexistente'); },
      (state: GameState) => { state.unlocked.push('receita-inexistente'); },
      (state: GameState) => { state.competition.recipeId = 'receita-inexistente'; },
    ]) {
      const state = createCareer('Referências'); edit(state);
      expect(importCareer(JSON.stringify({ ...state, version: 1 })).state).toBeNull();
    }
    const engine = new GameEngine(createCareer('Pedido inválido'));
    engine.execute({ type: 'open' }); engine.state.restaurants[0].orders[0].recipeId = 'receita-inexistente';
    expect(importCareer(JSON.stringify({ ...engine.state, version: 1 })).state).toBeNull();
  });
});
