import { createCareer } from '../game/engine';
import { RECIPES } from '../game/content';
import type { GameState, Settings, Restaurant, Employee, Order, Difficulty, Role } from '../game/types';

export const SAVE_KEY = 'dorvim-kitchen.save';
export const BACKUP_KEY = 'dorvim-kitchen.backup';
export const SETTINGS_KEY = 'dorvim-kitchen.settings';
const VERSION = 2;
const FORMAT = 'dorvim-kitchen';
const DEFAULT_SETTINGS: Settings = { music: 0.35, effects: 0.65, reducedMotion: false, showTips: true };
type Obj = Record<string, unknown>;
class InvalidSave extends Error {}
function invalid(): never { throw new InvalidSave('Os dados da carreira estão incompletos ou inválidos.'); }
function object(value: unknown): Obj {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Obj;
}
function number(value: unknown, min = -1e15, max = 1e15): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return invalid();
  return value;
}
function integer(value: unknown, min = 0, max = 1e12): number {
  const n = number(value, min, max);
  if (!Number.isSafeInteger(n)) return invalid();
  return n;
}
function string(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || value.length > max) return invalid();
  return value;
}
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') return invalid(); return value; }
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) return invalid();
  return value as T;
}
function list<T>(value: unknown, parse: (entry: unknown) => T, max = 10000): T[] {
  if (!Array.isArray(value) || value.length > max) return invalid();
  return value.map(parse);
}
function map<T>(value: unknown, parse: (entry: unknown) => T): Record<string, T> {
  const source = object(value);
  const result: Record<string, T> = {};
  if (Object.keys(source).length > 10000) return invalid();
  for (const [key, item] of Object.entries(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return invalid();
    result[key] = parse(item);
  }
  return result;
}
const count = (v: unknown) => integer(v);
const positive = (v: unknown) => number(v, 0);
const percentage = (v: unknown) => number(v, 0, 100);
const strings = (v: unknown) => list(v, (entry) => string(entry));
const ROLES: Role[] = ['auxiliar', 'cozinheiro', 'chef', 'garcom', 'faxineiro', 'gerente', 'estoquista'];
function settings(value: unknown): Settings {
  const v = object(value);
  return { music: number(v.music, 0, 1), effects: number(v.effects, 0, 1), reducedMotion: boolean(v.reducedMotion), showTips: boolean(v.showTips) };
}
function order(value: unknown): Order {
  const v = object(value);
  const maxPatience = number(v.maxPatience, 0.001);
  const result: Order = {
    id: integer(v.id, 1), recipeId: string(v.recipeId), customer: string(v.customer), profile: string(v.profile),
    patience: number(v.patience, 0, maxPatience), maxPatience,
    status: choice(v.status, ['waiting', 'manual', 'auto', 'ready']), progress: positive(v.progress),
    quality: percentage(v.quality), scores: list(v.scores, percentage, 100), stepIndex: integer(v.stepIndex, 0, 100), ingredientQuality: percentage(v.ingredientQuality),
  };
  if (v.assigned !== undefined) result.assigned = string(v.assigned);
  return result;
}
function restaurant(value: unknown): Restaurant {
  const v = object(value);
  const result: Restaurant = {
    id: integer(v.id, 1), name: string(v.name), style: string(v.style), equipment: map(v.equipment, count),
    decor: string(v.decor), reputation: percentage(v.reputation), cleanliness: percentage(v.cleanliness), condition: percentage(v.condition),
    stock: map(v.stock, (entry) => { const stock = object(entry); return { quantity: positive(stock.quantity), quality: percentage(stock.quality), expires: integer(stock.expires, 0) }; }),
    menu: strings(v.menu), prices: map(v.prices, positive), orders: list(v.orders, order, 1000),
    revenue: positive(v.revenue), served: count(v.served), lost: count(v.lost), profit: number(v.profit),
  };
  if (v.managerId !== undefined) result.managerId = string(v.managerId);
  if (v.closed !== undefined) result.closed = boolean(v.closed);
  const ids = result.orders.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) return invalid();
  return result;
}
function employee(value: unknown): Employee {
  const v = object(value);
  const result: Employee = {
    id: string(v.id), name: string(v.name), role: choice(v.role, ROLES), speed: percentage(v.speed), skill: percentage(v.skill),
    hygiene: percentage(v.hygiene), organization: percentage(v.organization), stress: percentage(v.stress), wage: positive(v.wage), unlock: count(v.unlock), bio: string(v.bio),
    level: integer(v.level, 1), experience: positive(v.experience), fatigue: percentage(v.fatigue), active: boolean(v.active), task: string(v.task), served: count(v.served),
  };
  if (v.restaurantId !== undefined) result.restaurantId = integer(v.restaurantId, 1);
  return result;
}
function validateState(value: unknown, legacy = false): GameState {
  const source = object(value);
  const name = string(source.careerName, 120);
  if (!name.trim()) return invalid();
  const difficulty: Difficulty = choice(source.difficulty, ['casual', 'normal', 'especialista']);
  // Monetary and ownership fields are mandatory even for legacy saves. Defaults must
  // never mint the opening balance or recreate a restaurant when a save is damaged.
  for (const key of ['day', 'cash', 'xp', 'stage', 'restaurants', 'employees']) if (!(key in source)) return invalid();
  const v: Obj = { ...source };
  if (legacy) {
    const defaults = createCareer(name, difficulty);
    // These systems were introduced in version 2. Core service/economy fields
    // must still exist, so migration cannot silently reset an in-progress day.
    const introduced: (keyof GameState)[] = ['settings', 'competition', 'event', 'tutorial', 'reports', 'achievements', 'taxes', 'taxDue', 'inspectionDue', 'inspectionResult', 'daily', 'sales', 'playTime', 'savedAt', 'notices', 'eventEffects', 'reliefUsed', 'debt'];
    for (const key of introduced) if (!(key in source)) v[key] = defaults[key];
  }
  const restaurants = list(v.restaurants, restaurant, 50);
  if (!restaurants.length || new Set(restaurants.map((r) => r.id)).size !== restaurants.length) return invalid();
  const employees = list(v.employees, employee, 1000);
  if (new Set(employees.map((e) => e.id)).size !== employees.length) return invalid();
  const competition = object(v.competition);
  const daily = object(v.daily);
  const result: GameState = {
    version: VERSION, careerName: name, difficulty, day: integer(v.day, 1), cash: positive(v.cash), xp: positive(v.xp), stage: count(v.stage),
    phase: choice(v.phase, ['planning', 'service', 'summary']), elapsed: positive(v.elapsed), duration: number(v.duration, 1), paused: boolean(v.paused), speed: number(v.speed, 0.25, 10),
    activeRestaurant: integer(v.activeRestaurant, 1), restaurants, employees, unlocked: strings(v.unlocked),
    ledger: list(v.ledger, (entry) => { const t = object(entry); return { day: integer(t.day, 1), category: string(t.category), label: string(t.label), amount: number(t.amount) }; }),
    reviews: list(v.reviews, (entry) => { const r = object(entry); return { day: integer(r.day, 1), name: string(r.name), score: number(r.score, 0, 5), text: string(r.text) }; }),
    reports: list(v.reports, (entry) => {
      const r = object(entry);
      return { day: integer(r.day, 1), revenue: positive(r.revenue), expenses: positive(r.expenses), served: count(r.served), lost: count(r.lost), quality: positive(r.quality), tips: positive(r.tips), ...(r.inspection === undefined ? {} : { inspection: string(r.inspection) }) };
    }),
    achievements: strings(v.achievements), settings: settings(v.settings),
    competition: { round: count(competition.round), scores: list(competition.scores, percentage, 100), enteredDay: count(competition.enteredDay), active: boolean(competition.active), wins: count(competition.wins), ...(competition.recipeId === undefined ? {} : { recipeId: string(competition.recipeId) }) },
    event: v.event === null ? null : (() => {
      const e = object(v.event);
      return { id: string(e.id), title: string(e.title), text: string(e.text), choices: list(e.choices, (entry) => { const c = object(entry); return { label: string(c.label), effect: string(c.effect) }; }, 20) };
    })(),
    tutorial: count(v.tutorial), nextOrderId: integer(v.nextOrderId, 1), spawnIn: number(v.spawnIn), servedTotal: count(v.servedTotal), qualityTotal: positive(v.qualityTotal),
    taxes: positive(v.taxes), taxDue: count(v.taxDue), inspectionDue: count(v.inspectionDue), inspectionResult: string(v.inspectionResult),
    daily: { revenue: positive(daily.revenue), expenses: positive(daily.expenses), served: count(daily.served), lost: count(daily.lost), quality: positive(daily.quality), tips: positive(daily.tips) },
    sales: map(v.sales, (entry) => { const sale = object(entry); return { count: count(sale.count), revenue: positive(sale.revenue) }; }),
    rng: integer(v.rng, 0, 0xffffffff), playTime: positive(v.playTime), savedAt: Math.min(positive(v.savedAt), Date.now()), notices: strings(v.notices),
  };
  if (!restaurants.some((r) => r.id === result.activeRestaurant)) return invalid();
  const recipeIds = new Set(RECIPES.map((recipe) => recipe.id));
  // Engine simulation dereferences menu and order recipes; structurally valid
  // but stale/unknown IDs must not reach those paths (including legacy imports).
  if (restaurants.some((r) => r.menu.some((id) => !recipeIds.has(id)) || r.orders.some((o) => !recipeIds.has(o.recipeId))) || result.unlocked.some((id) => !recipeIds.has(id))) return invalid();
  if (result.competition.recipeId !== undefined && !recipeIds.has(result.competition.recipeId)) return invalid();
  const allOrders = restaurants.flatMap((r) => r.orders.map((o) => o.id));
  if (new Set(allOrders).size !== allOrders.length || allOrders.some((id) => id >= result.nextOrderId)) return invalid();
  if (employees.some((e) => e.restaurantId !== undefined && !restaurants.some((r) => r.id === e.restaurantId))) return invalid();
  if (v.reliefUsed !== undefined) result.reliefUsed = boolean(v.reliefUsed);
  if (v.debt !== undefined) result.debt = positive(v.debt);
  if (v.eventEffects !== undefined) {
    const effects = object(v.eventEffects);
    result.eventEffects = { demand: number(effects.demand, 0, 100), supply: number(effects.supply, 0, 100), critic: boolean(effects.critic), ...(effects.absentId === undefined ? {} : { absentId: string(effects.absentId) }) };
  }
  return result;
}

// FNV-1a detects accidental truncation or corruption; it is not an authentication mechanism.
function checksum(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function encode(state: GameState): string {
  const validated = validateState({ ...state, version: VERSION, savedAt: Date.now() });
  const payload = JSON.stringify(validated);
  const text = JSON.stringify({ format: FORMAT, version: VERSION, checksum: checksum(payload), payload });
  if (text.length > 10_000_000) throw new InvalidSave('O arquivo de carreira excede o limite permitido.');
  return text;
}
function decode(text: string): GameState {
  if (text.length > 10_000_000) throw new InvalidSave('O arquivo de carreira excede o limite permitido.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new InvalidSave('O arquivo de carreira está corrompido.'); }
  const envelope = object(value);
  const version = integer(envelope.version, 1, 100000);
  if (version > VERSION) throw new InvalidSave('Esta carreira pertence a uma versão mais recente do Dorvim Kitchen.');
  if (envelope.format !== undefined && envelope.format !== FORMAT) return invalid();
  if (version === VERSION) {
    if (envelope.format !== FORMAT || typeof envelope.payload !== 'string' || envelope.checksum !== checksum(envelope.payload)) throw new InvalidSave('A verificação de integridade da carreira falhou.');
    let state: unknown;
    try { state = JSON.parse(envelope.payload); } catch { return invalid(); }
    if (object(state).version !== VERSION) return invalid();
    return validateState(state);
  }
  // Version 1 used either a raw state or an envelope with data/state/payload.
  let legacy: unknown = envelope.payload ?? envelope.state ?? envelope.data ?? envelope;
  if (typeof legacy === 'string') {
    if (envelope.checksum !== undefined && envelope.checksum !== checksum(legacy)) return invalid();
    try { legacy = JSON.parse(legacy); } catch { return invalid(); }
  } else if (envelope.checksum !== undefined && envelope.checksum !== checksum(JSON.stringify(legacy))) return invalid();
  if (object(legacy).version !== undefined && object(legacy).version !== 1) return invalid();
  return validateState(legacy, true);
}
function storageOrNull(storage?: Storage): Storage | null {
  if (storage) return storage;
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
function errorMessage(error: unknown): string {
  return error instanceof InvalidSave ? error.message : 'Não foi possível acessar o armazenamento. Exporte a carreira para guardar uma cópia.';
}

export function saveCareer(state: GameState, storage?: Storage): { ok: boolean; message: string } {
  const target = storageOrNull(storage);
  if (!target) return { ok: false, message: 'O navegador não disponibilizou armazenamento. Exporte sua carreira para guardar uma cópia.' };
  try {
    const next = encode(state);
    const old = target.getItem(SAVE_KEY);
    let validOld = false;
    if (old) { try { decode(old); validOld = true; } catch { /* Preserve a valid backup if the primary is damaged. */ } }
    if (validOld) target.setItem(BACKUP_KEY, old!);
    target.setItem(SAVE_KEY, next);
    return { ok: true, message: 'Carreira salva neste navegador.' };
  } catch (error) {
    const full = error instanceof Error && /quota|storage.*full|NS_ERROR_DOM_QUOTA_REACHED/i.test(`${error.name} ${error.message}`);
    return { ok: false, message: full ? 'O armazenamento está cheio. A última cópia válida foi preservada; exporte a carreira atual para não perder progresso.' : errorMessage(error) };
  }
}
export function loadCareer(storage?: Storage): { state: GameState | null; recovered: boolean; message: string } {
  const target = storageOrNull(storage);
  if (!target) return { state: null, recovered: false, message: 'Armazenamento indisponível neste navegador.' };
  try {
    const primary = target.getItem(SAVE_KEY);
    let failure = '';
    if (primary) { try { return { state: decode(primary), recovered: false, message: 'Carreira carregada.' }; } catch (error) { failure = errorMessage(error); } }
    const backup = target.getItem(BACKUP_KEY);
    if (backup) { try { return { state: decode(backup), recovered: true, message: 'O último salvamento estava danificado. Recuperamos a cópia de segurança anterior.' }; } catch (error) { if (!failure) failure = errorMessage(error); } }
    return { state: null, recovered: false, message: failure || 'Nenhuma carreira salva neste navegador.' };
  } catch (error) { return { state: null, recovered: false, message: errorMessage(error) }; }
}
export function hasCareer(storage?: Storage): boolean { return loadCareer(storage).state !== null; }
export function deleteCareer(storage?: Storage): void {
  const target = storageOrNull(storage);
  if (!target) return;
  try { target.removeItem(SAVE_KEY); target.removeItem(BACKUP_KEY); } catch { /* The interface can still start a fresh, unsaved career. */ }
}
export function exportCareer(state: GameState): string { return encode(state); }
export function importCareer(text: string): { state: GameState | null; message: string } {
  try { return { state: decode(text), message: 'Carreira importada. Salve para guardá-la neste navegador.' }; }
  catch (error) { return { state: null, message: errorMessage(error) }; }
}
export function saveSettings(value: Settings): void {
  try { storageOrNull()?.setItem(SETTINGS_KEY, JSON.stringify(settings(value))); } catch { /* Settings remain usable for this session. */ }
}
export function loadSettings(): Settings {
  try { const text = storageOrNull()?.getItem(SETTINGS_KEY); return text ? settings(JSON.parse(text)) : { ...DEFAULT_SETTINGS }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
