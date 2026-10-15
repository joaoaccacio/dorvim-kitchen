import { describe, expect, it } from 'vitest';
import { CANDIDATES, EVENTS, INGREDIENTS, RECIPES, STAGES } from '../src/game/content';
import { activeRestaurant, createCareer, equipmentCost, GameEngine, inspectionChecklist, supplyCost } from '../src/game/engine';
import type { GameState, Order } from '../src/game/types';

function game(stage = 1) {
  const state = createCareer('Dora', 'normal');
  state.stage = stage; state.xp = STAGES[stage - 1].xp;
  state.unlocked = RECIPES.filter(recipe => recipe.unlock <= stage).map(recipe => recipe.id);
  return new GameEngine(state);
}

function finish(engine: GameEngine, order: Order, score = 96) {
  expect(engine.execute({ type: 'prepare', orderId: order.id }).ok).toBe(true);
  const recipe = RECIPES.find(item => item.id === order.recipeId)!;
  for (const _step of recipe.steps) expect(engine.execute({ type: 'step', orderId: order.id, score }).ok).toBe(true);
  expect(order.status).toBe('ready');
  expect(engine.execute({ type: 'serve', orderId: order.id }).ok).toBe(true);
}

function hire(engine: GameEngine, role: string) {
  const candidate = CANDIDATES.find(item => item.role === role && item.unlock <= engine.state.stage && !engine.state.employees.some(employee => employee.id === item.id))!;
  expect(candidate).toBeTruthy();
  expect(engine.execute({ type: 'hire', candidateId: candidate.id }).ok).toBe(true);
  return engine.state.employees.find(employee => employee.id === candidate.id)!;
}

describe('carreira e cozinha', () => {
  it('starts a playable, offline career with two real orders and complete defaults', () => {
    const engine = game();
    expect(engine.state.cash).toBe(240);
    expect(engine.execute({ type: 'open' }).ok).toBe(true);
    expect(activeRestaurant(engine.state).orders).toHaveLength(2);
    expect(engine.state.version).toBe(2);
    expect(engine.state.unlocked.length).toBeGreaterThan(2);
    const before = JSON.stringify(engine.state);
    engine.state.paused = true;
    engine.tick(3600);
    engine.state.paused = false;
    expect(JSON.stringify(engine.state)).toBe(before);
  });

  it('atomically reserves ingredients, persists individual steps and rewards each order once', () => {
    const engine = game(); engine.execute({ type: 'open' });
    const restaurant = activeRestaurant(engine.state);
    const order = restaurant.orders[0];
    const recipe = RECIPES.find(item => item.id === order.recipeId)!;
    const initial = structuredClone(restaurant.stock);
    expect(engine.execute({ type: 'prepare', orderId: order.id }).ok).toBe(true);
    for (const [id, quantity] of Object.entries(recipe.ingredients)) expect(restaurant.stock[id].quantity).toBe(initial[id].quantity - quantity);
    expect(engine.execute({ type: 'prepare', orderId: order.id }).ok).toBe(false);
    expect(engine.execute({ type: 'serve', orderId: order.id }).ok).toBe(false);
    engine.execute({ type: 'step', orderId: order.id, score: 95 });
    const restored = new GameEngine(JSON.parse(JSON.stringify(engine.state)) as GameState);
    const inFlight = activeRestaurant(restored.state).orders[0];
    expect(inFlight.stepIndex).toBe(1); expect(inFlight.scores).toEqual([95]);
    for (let step = 1; step < recipe.steps.length; step++) restored.execute({ type: 'step', orderId: order.id, score: 95 });
    expect(restored.execute({ type: 'step', orderId: order.id, score: 95 }).ok).toBe(false);
    const before = restored.state.cash;
    expect(restored.execute({ type: 'serve', orderId: order.id }).ok).toBe(true);
    expect(restored.state.cash).toBeGreaterThan(before);
    const paid = restored.state.cash;
    expect(restored.execute({ type: 'serve', orderId: order.id }).ok).toBe(false);
    expect(restored.state.cash).toBe(paid);
    expect(restored.state.servedTotal).toBe(1);
    expect(restored.state.taxes).toBeGreaterThan(0);
    expect(restored.state.reviews).toHaveLength(1);
  });

  it('never partially consumes a recipe if one ingredient is unavailable', () => {
    const engine = game(); engine.execute({ type: 'open' });
    const restaurant = activeRestaurant(engine.state), order = restaurant.orders[0];
    const recipe = RECIPES.find(item => item.id === order.recipeId)!;
    const id = Object.keys(recipe.ingredients)[0]; restaurant.stock[id].quantity = 0;
    const before = structuredClone(restaurant.stock);
    expect(engine.execute({ type: 'prepare', orderId: order.id }).ok).toBe(false);
    expect(restaurant.stock).toEqual(before);
    expect(order.status).toBe('waiting');
  });

  it('rejects duplicate or stale step callbacks even after saving and resuming a partial preparation', () => {
    const engine = game(); engine.execute({ type: 'open' });
    const order = activeRestaurant(engine.state).orders[0];
    engine.execute({ type: 'prepare', orderId: order.id });
    expect(engine.execute({ type: 'step', orderId: order.id, score: 97, stepIndex: 0 }).ok).toBe(true);
    const afterStep = JSON.stringify(engine.state);
    expect(engine.execute({ type: 'step', orderId: order.id, score: 97, stepIndex: 0 }).ok).toBe(false);
    expect(engine.execute({ type: 'step', orderId: order.id, score: 97, stepIndex: 2 }).ok).toBe(false);
    expect(engine.execute({ type: 'step', orderId: order.id, score: 97, stepIndex: NaN }).ok).toBe(false);
    expect(JSON.stringify(engine.state)).toBe(afterStep);
    const resumed = new GameEngine(JSON.parse(afterStep));
    expect(resumed.execute({ type: 'step', orderId: order.id, score: 97, stepIndex: 0 }).ok).toBe(false);
    expect(resumed.execute({ type: 'step', orderId: order.id, score: 94, stepIndex: 1 }).ok).toBe(true);
    expect(activeRestaurant(resumed.state).orders[0].scores).toEqual([97, 94]);
  });

  it('quality reflects technique, cleanliness, ingredient freshness and condition', () => {
    const quality = (score: number, clean: number, stockQuality: number, condition: number) => {
      const engine = game(); const restaurant = activeRestaurant(engine.state);
      restaurant.menu = ['salada_horta']; restaurant.cleanliness = clean; restaurant.condition = condition;
      Object.values(restaurant.stock).forEach(stock => { stock.quality = stockQuality; stock.expires = 1; });
      engine.execute({ type: 'open' });
      const order = restaurant.orders[0]; engine.execute({ type: 'prepare', orderId: order.id });
      RECIPES[0].steps.forEach(() => engine.execute({ type: 'step', orderId: order.id, score }));
      return order.quality;
    };
    expect(quality(96, 96, 98, 95)).toBeGreaterThan(quality(30, 96, 98, 95) + 30);
    expect(quality(75, 96, 98, 95)).toBeGreaterThan(quality(75, 25, 60, 20) + 10);
  });

  it('customers leave without paying and closing is idempotent', () => {
    const engine = game(); engine.execute({ type: 'open' });
    expect(engine.execute({ type: 'close' }).ok).toBe(false);
    engine.tick(100);
    expect(engine.state.daily.lost).toBeGreaterThan(0);
    engine.execute({ type: 'close' });
    const cash = engine.state.cash, reports = engine.state.reports.length;
    expect(engine.execute({ type: 'close' }).ok).toBe(false);
    engine.tick(1000);
    expect(engine.state.cash).toBe(cash); expect(engine.state.reports).toHaveLength(reports);
  });

  it.each(['casual', 'normal', 'especialista'] as const)('can progress through all five career stages in %s through actual service without grants', (difficulty) => {
    const engine = game(); engine.state.difficulty = difficulty; const visited = new Set([1]);
    for (let day = 0; day < 18 && engine.state.stage < 5; day++) {
      const restaurant = activeRestaurant(engine.state);
      // A focused, affordable menu keeps the career viable without speculative purchases.
      restaurant.menu = ['arroz_feijao'];
      for (const id of ['arroz', 'feijao', 'cebola']) {
        const stock = restaurant.stock[id];
        if (stock.quantity < 20 || stock.expires < engine.state.day) expect(engine.execute({ type: 'buy', ingredientId: id, quantity: 24, supplier: 'economico' }).ok).toBe(true);
      }
      if (restaurant.cleanliness < 70) expect(engine.execute({ type: 'clean' }).ok).toBe(true);
      if (restaurant.condition < 65) expect(engine.execute({ type: 'repair' }).ok).toBe(true);
      if (engine.state.taxes > 0 && engine.state.day >= engine.state.taxDue) expect(engine.execute({ type: 'payTax' }).ok).toBe(true);
      expect(engine.execute({ type: 'open' }).ok).toBe(true);
      while (engine.state.phase === 'service') {
        const order = restaurant.orders.find(item => item.status === 'waiting');
        if (order) finish(engine, order, 94);
        visited.add(engine.state.stage);
        engine.tick(12);
      }
      expect(engine.state.cash).toBeGreaterThan(0);
      expect(engine.state.debt ?? 0).toBe(0);
      if (engine.state.stage < 5) expect(engine.execute({ type: 'nextDay' }).ok).toBe(true);
    }
    expect([...visited]).toEqual([1, 2, 3, 4, 5]);
    expect(engine.state.stage).toBe(5);
    expect(engine.state.unlocked).toHaveLength(RECIPES.length);
    expect(engine.state.reliefUsed).toBe(false);
    expect(engine.state.servedTotal).toBeGreaterThan(50);
    expect(engine.state.cash).toBeGreaterThan(850);
  });
});

describe('estoque, despesas e fiscalização', () => {
  it('prices suppliers, prevents invalid quantities and parallel overspending, and preserves expiry of mixed lots', () => {
    const engine = game(), restaurant = activeRestaurant(engine.state);
    restaurant.stock.tomate = { quantity: 2, quality: 70, expires: 1 };
    const price = supplyCost(engine.state, 'tomate', 4, 'horta');
    const initial = engine.state.cash;
    expect(engine.execute({ type: 'buy', ingredientId: 'tomate', quantity: 4, supplier: 'horta' }).ok).toBe(true);
    expect(engine.state.cash).toBeCloseTo(initial - price);
    expect(restaurant.stock.tomate.quantity).toBe(6); expect(restaurant.stock.tomate.expires).toBe(1);
    expect(restaurant.stock.tomate.quality).toBeGreaterThan(70);
    for (const quantity of [-1, 0, NaN, Infinity, 0.5, 101]) expect(engine.execute({ type: 'buy', ingredientId: 'tomate', quantity, supplier: 'horta' }).ok).toBe(false);
    engine.state.cash = price;
    expect(engine.execute({ type: 'buy', ingredientId: 'tomate', quantity: 4, supplier: 'horta' }).ok).toBe(true);
    expect(engine.execute({ type: 'buy', ingredientId: 'tomate', quantity: 4, supplier: 'horta' }).ok).toBe(false);
    expect(engine.state.cash).toBe(0);
  });

  it('expired ingredients cannot be cooked and cleaning disposes of them', () => {
    const engine = game(2), restaurant = activeRestaurant(engine.state);
    engine.state.day = 5; restaurant.stock.folhas.expires = 4;
    expect(inspectionChecklist(engine.state).find(item => item.label === 'Ingredientes válidos')?.ok).toBe(false);
    engine.execute({ type: 'clean' });
    expect(restaurant.stock.folhas.quantity).toBe(0);
    expect(engine.execute({ type: 'buy', ingredientId: 'folhas', quantity: 4, supplier: 'horta' }).ok).toBe(true);
    expect(restaurant.stock.folhas.expires).toBeGreaterThan(5);
  });

  it('premium express supplier offers better quality and shelf life at a higher price', () => {
    const garden = game(), premium = game();
    activeRestaurant(garden.state).stock.peixe.quantity = 0;
    activeRestaurant(premium.state).stock.peixe.quantity = 0;
    expect(garden.execute({ type: 'buy', ingredientId: 'peixe', quantity: 3, supplier: 'horta' }).ok).toBe(true);
    expect(premium.execute({ type: 'buy', ingredientId: 'peixe', quantity: 3, supplier: 'expresso' }).ok).toBe(true);
    const first = activeRestaurant(garden.state).stock.peixe, second = activeRestaurant(premium.state).stock.peixe;
    expect(second.quality).toBeGreaterThan(first.quality);
    expect(second.expires).toBeGreaterThan(first.expires);
    expect(premium.state.cash).toBeLessThan(garden.state.cash);
  });

  it('accrues tax, pays once and adds a visible bounded overdue surcharge', () => {
    const engine = game(); engine.execute({ type: 'open' });
    finish(engine, activeRestaurant(engine.state).orders[0]);
    const tax = engine.state.taxes, cash = engine.state.cash;
    expect(engine.execute({ type: 'payTax' }).ok).toBe(true);
    expect(engine.state.cash).toBeCloseTo(cash - tax);
    expect(engine.execute({ type: 'payTax' }).ok).toBe(false);
    engine.state.taxes = 20; engine.state.taxDue = 1;
    engine.tick(180); engine.execute({ type: 'nextDay' });
    expect(engine.state.taxes).toBe(20.8);
    expect(engine.state.notices.some(notice => notice.includes('vencidos'))).toBe(true);
  });

  it('bills salaries once per worked day, half pay on leave, and tracks unpaid obligations without negative cash', () => {
    const engine = game(2); const employee = hire(engine, 'cozinheiro');
    engine.execute({ type: 'open' }); engine.tick(180);
    expect(engine.state.ledger.filter(entry => entry.category === 'salarios')).toHaveLength(1);
    expect(engine.state.ledger.find(entry => entry.category === 'salarios')?.amount).toBe(-employee.wage);
    engine.execute({ type: 'close' });
    expect(engine.state.ledger.filter(entry => entry.category === 'salarios')).toHaveLength(1);
    engine.execute({ type: 'nextDay' }); engine.execute({ type: 'toggleEmployee', employeeId: employee.id });
    engine.state.cash = 2; engine.execute({ type: 'open' }); engine.tick(180);
    expect(engine.state.cash).toBe(0); expect(engine.state.debt).toBeGreaterThan(employee.wage * 0.5);
    const expenses = engine.state.daily.expenses;
    engine.state.cash = 200; engine.state.taxes = 0;
    expect(engine.execute({ type: 'payTax' }).ok).toBe(true);
    expect(engine.state.debt).toBe(0); expect(engine.state.daily.expenses).toBe(expenses);
  });

  it('uses known sanitation checks and allows a closed restaurant to recover without repeated fines', () => {
    const engine = game(2), restaurant = activeRestaurant(engine.state);
    restaurant.cleanliness = 5; restaurant.condition = 10;
    const before = engine.state.cash;
    expect(engine.execute({ type: 'inspect' }).ok).toBe(true);
    expect(restaurant.closed).toBe(true); expect(engine.state.cash).toBeLessThan(before);
    const fined = engine.state.cash;
    engine.execute({ type: 'inspect' }); expect(engine.state.cash).toBe(fined);
    expect(engine.execute({ type: 'open' }).ok).toBe(false);
    engine.execute({ type: 'clean' }); engine.execute({ type: 'clean' }); engine.execute({ type: 'repair' });
    expect(engine.execute({ type: 'inspect' }).ok).toBe(true);
    expect(restaurant.closed).toBe(false);
    const reputation = restaurant.reputation;
    engine.execute({ type: 'inspect' }); expect(restaurant.reputation).toBe(reputation);
    expect(engine.execute({ type: 'open' }).ok).toBe(true);
  });

  it('emergency relief is limited to one low-cash recovery and cannot be farmed', () => {
    const engine = game();
    expect(engine.execute({ type: 'relief' }).ok).toBe(false);
    engine.state.cash = 0;
    expect(engine.execute({ type: 'relief' }).ok).toBe(true);
    expect(engine.state.cash).toBe(140);
    engine.state.cash = 0;
    expect(engine.execute({ type: 'relief' }).ok).toBe(false);
  });
});

describe('equipe, melhorias e expansão', () => {
  it('gates staff by career stage; a cook and waiter really prepare and deliver while a cleaner maintains hygiene', () => {
    const beginner = game(); expect(beginner.execute({ type: 'hire', candidateId: 'joana' }).ok).toBe(false);
    const engine = game(2); const cook = hire(engine, 'cozinheiro'); hire(engine, 'garcom'); hire(engine, 'faxineiro');
    const restaurant = activeRestaurant(engine.state); restaurant.menu = ['arroz_feijao']; restaurant.cleanliness = 55;
    engine.execute({ type: 'open' }); engine.tick(120);
    expect(engine.state.servedTotal).toBeGreaterThan(4);
    expect(cook.served).toBeGreaterThan(4); expect(cook.experience).toBeGreaterThan(30);
    expect(cook.fatigue).toBeGreaterThan(0);
    expect(restaurant.cleanliness).toBeGreaterThan(70);
    expect(engine.state.cash).toBeGreaterThan(300);
  });

  it('lets the player take over an automated recipe without reserving twice', () => {
    const engine = game(2); hire(engine, 'cozinheiro'); engine.execute({ type: 'open' }); engine.tick(1);
    const restaurant = activeRestaurant(engine.state), order = restaurant.orders.find(item => item.status === 'auto')!;
    const stock = structuredClone(restaurant.stock);
    expect(engine.execute({ type: 'prepare', orderId: order.id }).ok).toBe(true);
    expect(restaurant.stock).toEqual(stock); expect(order.status).toBe('manual'); expect(order.assigned).toBeUndefined();
  });

  it('trains attributes and promotes only with enough experience, with a transparent raise', () => {
    const engine = game(2), employee = hire(engine, 'cozinheiro');
    const skill = employee.skill, wage = employee.wage;
    expect(engine.execute({ type: 'promote', employeeId: employee.id }).ok).toBe(false);
    expect(engine.execute({ type: 'train', employeeId: employee.id }).ok).toBe(true);
    expect(employee.skill).toBe(skill + 7);
    employee.experience += 10;
    expect(engine.execute({ type: 'promote', employeeId: employee.id }).ok).toBe(true);
    expect(employee.level).toBe(2); expect(employee.wage).toBeCloseTo(wage * 1.15);
  });

  it('equipment unlocks recipes, extends valid stock lifetime, and enforces level and stage caps', () => {
    const engine = game(2), restaurant = activeRestaurant(engine.state); engine.state.cash = 5000;
    expect(engine.execute({ type: 'menu', recipeId: 'bolo_caseiro', enabled: true }).ok).toBe(false);
    expect(engine.execute({ type: 'upgrade', equipmentId: 'forno' }).ok).toBe(true);
    expect(engine.execute({ type: 'menu', recipeId: 'bolo_caseiro', enabled: true }).ok).toBe(true);
    const expires = restaurant.stock.tomate.expires, cost = equipmentCost(restaurant, 'geladeira'), cash = engine.state.cash;
    engine.execute({ type: 'upgrade', equipmentId: 'geladeira' });
    expect(restaurant.stock.tomate.expires).toBe(expires + 1); expect(engine.state.cash).toBeCloseTo(cash - cost);
    engine.execute({ type: 'upgrade', equipmentId: 'geladeira' });
    expect(engine.execute({ type: 'upgrade', equipmentId: 'geladeira' }).ok).toBe(false);
    expect(engine.execute({ type: 'upgrade', equipmentId: 'tablet' }).ok).toBe(false);
  });

  it('stockists buy needed valid ingredients with real cash rather than conjuring free stock', () => {
    const engine = game(3); const employee = hire(engine, 'estoquista');
    const restaurant = activeRestaurant(engine.state); restaurant.menu = ['arroz_feijao'];
    restaurant.stock.arroz.quantity = 2; const cash = engine.state.cash;
    engine.execute({ type: 'open' }); engine.tick(19);
    expect(restaurant.stock.arroz.quantity).toBe(10); expect(engine.state.cash).toBeLessThan(cash);
    expect(engine.state.ledger.some(entry => entry.label.includes(employee.name) && entry.category === 'estoque')).toBe(true);
  });

  it('secondary restaurants require an active local manager and incur their own costs', () => {
    const engine = game(5); engine.state.cash = 5000;
    expect(engine.execute({ type: 'expand', name: 'Casa do Mar', style: 'contemporanea' }).ok).toBe(true);
    const secondary = engine.state.restaurants[1]; secondary.menu = ['arroz_feijao'];
    engine.execute({ type: 'open' }); engine.tick(60);
    expect(secondary.served).toBe(0); expect(secondary.orders).toHaveLength(0);
    engine.execute({ type: 'close' }); engine.execute({ type: 'nextDay' });
    engine.execute({ type: 'switch', restaurantId: secondary.id });
    const manager = hire(engine, 'gerente');
    expect(secondary.managerId).toBe(manager.id);
    engine.execute({ type: 'switch', restaurantId: 1 }); engine.execute({ type: 'open' }); engine.tick(150);
    expect(secondary.served).toBeGreaterThan(0); expect(secondary.revenue).toBeGreaterThan(0);
    engine.tick(30);
    expect(engine.state.ledger.some(entry => entry.category === 'aluguel' && entry.label.includes('Casa do Mar'))).toBe(true);
    engine.execute({ type: 'nextDay' }); engine.execute({ type: 'toggleEmployee', employeeId: manager.id });
    const served = secondary.served; engine.execute({ type: 'open' }); engine.tick(180);
    expect(secondary.served).toBe(served);
  });

  it('preserves managed work across restaurant switches, and blocks abandoning a partial manual dish', () => {
    const engine = game(5); engine.state.cash = 5000;
    const manager = hire(engine, 'gerente');
    engine.execute({ type: 'expand', name: 'Segunda Casa', style: 'brasileira' });
    const secondary = engine.state.restaurants[1]; secondary.menu = ['arroz_feijao'];
    engine.execute({ type: 'switch', restaurantId: secondary.id });
    expect(engine.execute({ type: 'assign', employeeId: manager.id, role: 'gerente' }).ok).toBe(true);
    expect(engine.state.restaurants[0].managerId).toBeUndefined(); expect(secondary.managerId).toBe(manager.id);
    engine.execute({ type: 'switch', restaurantId: 1 }); engine.execute({ type: 'open' });
    const manual = activeRestaurant(engine.state).orders[0];
    engine.execute({ type: 'prepare', orderId: manual.id });
    engine.execute({ type: 'step', orderId: manual.id, score: 95, stepIndex: 0 });
    expect(engine.execute({ type: 'switch', restaurantId: secondary.id }).ok).toBe(false);
    const recipe = RECIPES.find(item => item.id === manual.recipeId)!;
    for (let index = 1; index < recipe.steps.length; index++) engine.execute({ type: 'step', orderId: manual.id, score: 95, stepIndex: index });
    engine.execute({ type: 'serve', orderId: manual.id }); engine.tick(20);
    const underway = secondary.orders.find(order => order.status === 'auto')!;
    expect(underway).toBeTruthy(); expect(underway.assigned).toBe(manager.id);
    const progress = underway.progress;
    expect(engine.execute({ type: 'switch', restaurantId: secondary.id }).ok).toBe(true);
    engine.tick(1);
    expect(underway.progress).toBeGreaterThan(progress);
    engine.tick(50);
    expect(secondary.served).toBeGreaterThan(0);
  });
});

describe('eventos, torneios e coerência da simulação', () => {
  it('event choices have distinct effects, charge stated prices and resolve only once', () => {
    const engine = game(3), restaurant = activeRestaurant(engine.state);
    engine.state.cash = 1000; engine.state.event = structuredClone(EVENTS.find(event => event.id === 'festival')!);
    const cash = engine.state.cash;
    expect(engine.execute({ type: 'event', choice: 0 }).ok).toBe(true);
    expect(engine.state.cash).toBe(cash - 45); expect(engine.state.eventEffects?.demand).toBe(1.35);
    expect(engine.execute({ type: 'event', choice: 0 }).ok).toBe(false);
    engine.state.event = structuredClone(EVENTS.find(event => event.id === 'fair')!);
    const fruit = restaurant.stock.fruta.quantity;
    engine.execute({ type: 'event', choice: 0 }); expect(restaurant.stock.fruta.quantity).toBe(fruit + 8);
    engine.state.event = structuredClone(EVENTS.find(event => event.id === 'heat')!);
    const clean = restaurant.cleanliness; engine.execute({ type: 'event', choice: 1 });
    expect(restaurant.cleanliness).toBe(clean - 12); expect(engine.state.eventEffects?.demand).toBeLessThan(1);
    engine.state.event = structuredClone(EVENTS.find(event => event.id === 'critic')!);
    engine.execute({ type: 'event', choice: 0 }); engine.execute({ type: 'open' });
    expect(restaurant.orders[0].profile).toBe('Crítico'); expect(restaurant.orders[1].profile).not.toBe('Crítico');
  });

  it('competition has three judged rounds, a real prize, failure, and no duplicate payout', () => {
    const engine = game(3); const initial = engine.state.cash;
    expect(engine.execute({ type: 'competition', action: 'enter' }).ok).toBe(true);
    expect(engine.state.cash).toBe(initial - 35);
    const recipe = RECIPES.find(item => item.id === engine.state.competition.recipeId)!;
    expect(engine.execute({ type: 'competitionScore', scores: [99] }).ok).toBe(false);
    for (let round = 0; round < 3; round++) {
      expect(engine.execute({ type: 'competitionScore', scores: recipe.steps.map(() => 91) }).ok).toBe(true);
      expect(engine.state.competition.round).toBe(round + 1);
    }
    expect(engine.state.competition.wins).toBe(1); expect(engine.state.cash).toBe(initial - 35 + 250);
    expect(engine.state.daily.revenue).toBe(250); expect(engine.state.daily.expenses).toBe(35);
    expect(engine.state.taxes).toBe(0);
    const cash = engine.state.cash;
    expect(engine.execute({ type: 'competitionScore', scores: recipe.steps.map(() => 91) }).ok).toBe(false);
    expect(engine.execute({ type: 'competition', action: 'enter' }).ok).toBe(false);
    expect(engine.state.cash).toBe(cash);
    engine.state.day++;
    engine.execute({ type: 'competition', action: 'enter' });
    engine.execute({ type: 'competitionScore', scores: recipe.steps.map(() => 20) });
    expect(engine.state.competition.active).toBe(false); expect(engine.state.competition.wins).toBe(1);
  });

  it('higher prices reduce orders and invalid numeric inputs never poison state', () => {
    const count = (ratio: number) => {
      const engine = game(); const restaurant = activeRestaurant(engine.state); restaurant.menu = ['arroz_feijao'];
      engine.execute({ type: 'price', recipeId: 'arroz_feijao', price: 22 * ratio }); engine.execute({ type: 'open' });
      for (let i = 0; i < 30; i++) { for (const order of [...restaurant.orders]) engine.execute({ type: 'cancel', orderId: order.id }); engine.tick(5); }
      return engine.state.nextOrderId;
    };
    expect(count(0.7)).toBeGreaterThan(count(2));
    const engine = game(); const before = JSON.stringify(engine.state);
    engine.tick(NaN); engine.tick(-5); engine.tick(Infinity);
    expect(engine.execute({ type: 'price', recipeId: 'arroz_feijao', price: NaN }).ok).toBe(false);
    expect(engine.execute({ type: 'price', recipeId: 'arroz_feijao', price: -1 }).ok).toBe(false);
    expect(JSON.stringify(engine.state)).toBe(before);
  });

  it('uses deterministic bounded ticks and never advances a new day from a long elapsed timestamp', () => {
    const first = game(2), second = game(2);
    hire(first, 'cozinheiro'); hire(first, 'garcom'); hire(second, 'cozinheiro'); hire(second, 'garcom');
    first.execute({ type: 'open' }); second.execute({ type: 'open' });
    first.tick(90); for (let i = 0; i < 90; i++) second.tick(1);
    expect(first.state.cash).toBe(second.state.cash); expect(first.state.servedTotal).toBe(second.state.servedTotal);
    expect(activeRestaurant(first.state).orders).toEqual(activeRestaurant(second.state).orders);
    first.tick(3600);
    expect(first.state.day).toBe(1); expect(first.state.phase).toBe('summary'); expect(first.state.reports).toHaveLength(1);
    expect(first.state.elapsed).toBe(first.state.duration);
  });
});
