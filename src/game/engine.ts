import { CANDIDATES, EQUIPMENT, EVENTS, INGREDIENTS, RECIPES, SPECIALIZATIONS, STAGES } from './content';
import type { Command, Difficulty, Employee, GameState, Order, Recipe, Restaurant, Result, Role } from './types';

const clamp = (value: number, low = 0, high = 100) => Math.min(high, Math.max(low, value));
const money = (value: number) => Math.round(value * 100) / 100;
const recipeById = (id: string) => RECIPES.find(recipe => recipe.id === id);
const blankDaily = () => ({ revenue: 0, expenses: 0, served: 0, lost: 0, quality: 0, tips: 0 });
const roles: Role[] = ['auxiliar', 'cozinheiro', 'chef', 'garcom', 'faxineiro', 'gerente', 'estoquista'];
const customers = ['Lia', 'Caio', 'Dora', 'Miguel', 'Ravi', 'Bia', 'Nina', 'João', 'Clara', 'Theo'];
const suppliers = {
  economico: { price: 0.8, quality: 72, life: 0 },
  horta: { price: 1.2, quality: 98, life: 1 },
  expresso: { price: 1.55, quality: 100, life: 2 },
};

export function activeRestaurant(state: GameState): Restaurant {
  return state.restaurants.find(restaurant => restaurant.id === state.activeRestaurant) ?? state.restaurants[0];
}

export function getStage(state: GameState) { return STAGES[state.stage - 1] ?? STAGES[0]; }

export function equipmentCost(restaurant: Restaurant, equipmentId: string): number {
  const equipment = EQUIPMENT.find(item => item.id === equipmentId);
  return equipment ? money(equipment.price * (1 + (restaurant.equipment[equipmentId] ?? 0) * 0.55)) : Infinity;
}

export function supplyCost(state: GameState, ingredientId: string, quantity: number, supplier: keyof typeof suppliers): number {
  const ingredient = INGREDIENTS.find(item => item.id === ingredientId);
  return ingredient && suppliers[supplier] ? money(ingredient.price * quantity * suppliers[supplier].price * (state.eventEffects?.supply ?? 1) * (state.difficulty === 'casual' ? 0.9 : state.difficulty === 'especialista' ? 1.12 : 1)) : Infinity;
}

export function inspectionChecklist(state: GameState, restaurant = activeRestaurant(state)) {
  const staff = state.employees.filter(employee => employee.active && (employee.restaurantId ?? 1) === restaurant.id);
  const expired = Object.values(restaurant.stock).filter(stock => stock.quantity > 0 && stock.expires < state.day).length;
  return [
    { label: 'Ambiente limpo', detail: `${Math.round(restaurant.cleanliness)} / 100 · mínimo 60`, ok: restaurant.cleanliness >= 60 },
    { label: 'Ingredientes válidos', detail: expired ? `${expired} lote(s) vencido(s) · limpar para descartar` : 'Nenhum lote vencido', ok: expired === 0 },
    { label: 'Refrigeração', detail: `Geladeira nível ${restaurant.equipment.geladeira ?? 0} · mínimo 1`, ok: (restaurant.equipment.geladeira ?? 0) >= 1 },
    { label: 'Equipamentos conservados', detail: `${Math.round(restaurant.condition)} / 100 · mínimo 55`, ok: restaurant.condition >= 55 },
    { label: 'Higiene da equipe', detail: staff.length ? `${Math.round(staff.reduce((sum, employee) => sum + employee.hygiene, 0) / staff.length)} / 100 · mínimo 55` : 'Estação individual em ordem', ok: !staff.length || staff.reduce((sum, employee) => sum + employee.hygiene, 0) / staff.length >= 55 },
  ];
}

function newRestaurant(id: number, name: string, style: string, day: number): Restaurant {
  const equipment = Object.fromEntries(EQUIPMENT.map(item => [item.id, ['fogao', 'bancada', 'geladeira'].includes(item.id) ? 1 : 0]));
  const menu = RECIPES.filter(recipe => recipe.unlock === 1 && (!recipe.equipment || equipment[recipe.equipment] > 0)).slice(0, 3).map(recipe => recipe.id);
  return {
    id, name, style, equipment, decor: 'acolhedor', reputation: 62, cleanliness: 96, condition: 94,
    stock: Object.fromEntries(INGREDIENTS.map(ingredient => [ingredient.id, { quantity: id === 1 ? 18 : 10, quality: 90, expires: day + ingredient.shelfLife + 1 }])),
    menu, prices: Object.fromEntries(RECIPES.map(recipe => [recipe.id, recipe.price])), orders: [],
    revenue: 0, served: 0, lost: 0, profit: 0, closed: false,
  };
}

export function createCareer(name: string, difficulty: Difficulty = 'normal'): GameState {
  return {
    version: 2, careerName: name.trim().slice(0, 32) || 'Chef', difficulty: ['casual', 'normal', 'especialista'].includes(difficulty) ? difficulty : 'normal',
    day: 1, cash: 240, xp: 0, stage: 1, phase: 'planning', elapsed: 0, duration: 180, paused: false, speed: 1,
    activeRestaurant: 1, restaurants: [newRestaurant(1, 'Cantinho do Chef', 'brasileira', 1)], employees: [],
    unlocked: RECIPES.filter(recipe => recipe.unlock <= 1).map(recipe => recipe.id), ledger: [], reviews: [], reports: [], achievements: [],
    settings: { music: 0.25, effects: 0.65, reducedMotion: false, showTips: true },
    competition: { round: 0, scores: [], enteredDay: 0, active: false, wins: 0 }, event: null, tutorial: 0,
    nextOrderId: 1, spawnIn: 14, servedTotal: 0, qualityTotal: 0, taxes: 0, taxDue: 4, inspectionDue: 3, inspectionResult: '',
    daily: blankDaily(), sales: {}, rng: 47291, playTime: 0, savedAt: Date.now(), notices: [],
    eventEffects: { demand: 1, supply: 1, critic: false }, reliefUsed: false, debt: 0,
  };
}

export class GameEngine {
  constructor(public state: GameState) {}

  private ok(message: string): Result { return { ok: true, message }; }
  private no(message: string): Result { return { ok: false, message }; }
  private random() {
    this.state.rng = (Math.imul(this.state.rng, 1664525) + 1013904223) >>> 0;
    return this.state.rng / 4294967296;
  }
  private notice(text: string) { this.state.notices = [...this.state.notices.slice(-5), text]; }
  private record(category: string, label: string, amount: number) {
    this.state.ledger.push({ day: this.state.day, category, label, amount: money(amount) });
    if (this.state.ledger.length > 400) this.state.ledger.splice(0, this.state.ledger.length - 400);
  }
  private spend(amount: number, category: string, label: string): boolean {
    amount = money(amount);
    if (!Number.isFinite(amount) || amount < 0 || this.state.cash + 0.001 < amount) return false;
    this.state.cash = money(this.state.cash - amount);
    this.state.daily.expenses = money(this.state.daily.expenses + amount);
    this.record(category, label, -amount);
    return true;
  }
  private bill(amount: number, category: string, label: string) {
    amount = money(amount);
    const paid = Math.min(this.state.cash, amount);
    this.state.cash = money(this.state.cash - paid);
    this.state.debt = money((this.state.debt ?? 0) + amount - paid);
    this.state.daily.expenses = money(this.state.daily.expenses + amount);
    this.record(category, paid < amount ? `${label} · R$ ${money(amount - paid).toFixed(2)} pendentes` : label, -paid);
    if (paid < amount) this.notice(`R$ ${money(amount - paid).toFixed(2)} em pendências. Quite nas finanças.`);
  }
  private earn(amount: number, category: string, label: string) {
    amount = money(amount);
    this.state.cash = money(this.state.cash + amount);
    this.record(category, label, amount);
  }
  private staff(restaurant: Restaurant) {
    return this.state.employees.filter(employee => employee.active && (employee.restaurantId ?? 1) === restaurant.id && employee.id !== this.state.eventEffects?.absentId);
  }
  private milestone(id: string, message: string) {
    if (!this.state.achievements.includes(id)) { this.state.achievements.push(id); this.notice(message); }
  }
  private progress() {
    const previous = this.state.stage;
    this.state.stage = STAGES.reduce((stage, item, index) => this.state.xp >= item.xp ? index + 1 : stage, 1);
    this.state.unlocked = RECIPES.filter(recipe => recipe.unlock <= this.state.stage).map(recipe => recipe.id);
    if (this.state.stage > previous) this.notice(`Carreira: ${getStage(this.state).name}. Novas possibilidades na casa!`);
    if (this.state.servedTotal >= 1) this.milestone('first_service', 'Primeiro prato entregue. A história começou.');
    if (this.state.servedTotal >= 10) this.milestone('ten_served', 'Dez pratos, muitas histórias.');
    if (this.state.servedTotal >= 100) this.milestone('hundred_served', 'Cem clientes servidos. Uma cozinha de respeito.');
    if (this.state.cash >= 2000) this.milestone('cash_reserve', 'Reserva de R$ 2.000 construída.');
    if (this.state.unlocked.length === RECIPES.length) this.milestone('all_recipes', 'Todo o caderno de receitas está disponível.');
    if (this.state.employees.length >= 5) this.milestone('full_team', 'Uma brigada completa para chamar de sua.');
  }
  private available(restaurant: Restaurant, recipe: Recipe): boolean {
    return this.state.unlocked.includes(recipe.id) && (!recipe.equipment || (restaurant.equipment[recipe.equipment] ?? 0) > 0);
  }
  private canReserve(restaurant: Restaurant, recipe: Recipe): boolean {
    return Object.entries(recipe.ingredients).every(([id, quantity]) => {
      const stock = restaurant.stock[id];
      return stock && stock.quantity >= quantity && stock.expires >= this.state.day;
    });
  }
  private reserve(restaurant: Restaurant, order: Order, recipe: Recipe) {
    const entries = Object.entries(recipe.ingredients);
    order.ingredientQuality = entries.reduce((sum, [id]) => {
      const stock = restaurant.stock[id];
      const freshness = stock.expires === this.state.day ? 10 : stock.expires === this.state.day + 1 ? 3 : 0;
      return sum + stock.quality - freshness;
    }, 0) / entries.length;
    for (const [id, quantity] of entries) restaurant.stock[id].quantity -= quantity;
  }
  private quality(restaurant: Restaurant, order: Order, scores: number[]) {
    const preparation = scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length);
    const assistant = this.staff(restaurant).find(employee => employee.role === 'auxiliar');
    const equipment = Math.min(100, 80 + Object.values(restaurant.equipment).reduce((sum, level) => sum + level, 0) * 2);
    const potential = (recipeById(order.recipeId)?.potential ?? 100) + Math.max(0, Object.values(restaurant.equipment).reduce((sum, level) => sum + level, 0) - 3) * 0.8;
    return Math.min(potential, clamp(preparation * 0.7 + order.ingredientQuality * 0.18 + restaurant.cleanliness * 0.05 + restaurant.condition * 0.04 + equipment * 0.03 + (assistant ? assistant.skill * 0.04 : 0)));
  }
  private spawn(restaurant: Restaurant) {
    const capacity = 3 + Math.min(4, restaurant.equipment.balcao ?? 0) + Math.floor(this.state.stage / 2);
    if (restaurant.closed || restaurant.orders.length >= capacity) return;
    const recipes = restaurant.menu.map(recipeById).filter((recipe): recipe is Recipe => !!recipe && this.available(restaurant, recipe) && this.canReserve(restaurant, recipe));
    if (!recipes.length) return;
    const recipe = recipes[Math.floor(this.random() * recipes.length)];
    const profiles = ['Habitual', 'Família', 'Apressado', 'Exigente'];
    const profile = this.state.eventEffects?.critic ? 'Crítico' : profiles[this.state.stage === 1 ? Math.floor(this.random() * 2) : Math.floor(this.random() * profiles.length)];
    if (profile === 'Crítico') this.state.eventEffects!.critic = false;
    const patience = (profile === 'Apressado' ? 65 : profile === 'Crítico' ? 105 : 90) * (this.state.difficulty === 'casual' ? 1.35 : this.state.difficulty === 'especialista' ? 0.85 : 1) + (restaurant.equipment.balcao ?? 0) * 8;
    restaurant.orders.push({ id: this.state.nextOrderId++, recipeId: recipe.id, customer: customers[Math.floor(this.random() * customers.length)], profile, patience, maxPatience: patience, status: 'waiting', progress: 0, quality: 0, scores: [], stepIndex: 0, ingredientQuality: 90 });
  }
  private deliver(restaurant: Restaurant, order: Order) {
    const recipe = recipeById(order.recipeId)!;
    const price = restaurant.prices[recipe.id] ?? recipe.price;
    const waiting = order.patience / order.maxPatience;
    const priceFairness = clamp(100 - Math.max(0, price / recipe.price - 1) * 65);
    const experience = clamp(order.quality * 0.66 + waiting * 14 + restaurant.cleanliness * 0.09 + priceFairness * 0.08 + (restaurant.decor === 'acolhedor' ? 3 : 6));
    const tip = order.quality >= 78 ? money(price * (order.quality >= 92 ? 0.15 : 0.08) * Math.max(0.4, waiting)) : 0;
    this.earn(price + tip, 'vendas', `${recipe.name} · ${order.customer}`);
    this.state.daily.revenue = money(this.state.daily.revenue + price);
    this.state.daily.tips = money(this.state.daily.tips + tip);
    this.state.daily.served++;
    this.state.daily.quality += order.quality;
    this.state.servedTotal++;
    this.state.qualityTotal += order.quality;
    this.state.taxes = money(this.state.taxes + price * (this.state.difficulty === 'casual' ? 0.045 : this.state.difficulty === 'especialista' ? 0.08 : 0.06));
    restaurant.revenue = money(restaurant.revenue + price + tip);
    restaurant.profit = money(restaurant.profit + price + tip - recipe.cost);
    restaurant.served++;
    const reputationDelta = (experience - 65) * 0.035 * (order.profile === 'Crítico' ? 3 : 1);
    restaurant.reputation = clamp(restaurant.reputation + reputationDelta);
    this.state.xp += Math.round(8 + order.quality * 0.15 + recipe.difficulty * 1.5);
    const sale = this.state.sales[recipe.id] ?? { count: 0, revenue: 0 };
    this.state.sales[recipe.id] = { count: sale.count + 1, revenue: money(sale.revenue + price) };
    const reviewScore = money(clamp(experience / 20, 1, 5));
    let text = order.quality >= 88 ? 'Preparo caprichado, deu vontade de voltar.' : order.quality < 55 ? 'O preparo precisava de mais atenção.' : 'Uma refeição gostosa, sem complicação.';
    if (waiting < 0.25) text = 'Gostei do prato, mas esperei bastante.';
    else if (priceFairness < 75) text = 'Boa comida, preço um pouco salgado.';
    else if (restaurant.cleanliness < 50) text = 'A cozinha precisava de uma boa limpeza.';
    if (this.state.servedTotal % 2 === 1 || order.profile === 'Crítico') this.state.reviews = [{ day: this.state.day, name: order.profile === 'Crítico' ? `${order.customer}, crítica local` : order.customer, score: reviewScore, text }, ...this.state.reviews].slice(0, 30);
    if (order.quality >= 95) this.milestone('perfect_dish', 'Prato de assinatura: qualidade acima de 95.');
    if (restaurant.reputation >= 90) this.milestone('five_stars', 'Uma casa cinco estrelas.');
    if (order.assigned) {
      const employee = this.state.employees.find(person => person.id === order.assigned);
      if (employee) { employee.served++; employee.experience += 8; employee.task = 'Aguardando novo pedido'; }
    }
    restaurant.orders = restaurant.orders.filter(item => item.id !== order.id);
    restaurant.cleanliness = clamp(restaurant.cleanliness - 1.1);
    this.progress();
  }

  execute(command: Command): Result {
    const state = this.state;
    const restaurant = activeRestaurant(state);
    if (!command || typeof command.type !== 'string') return this.no('Ação inválida.');
    switch (command.type) {
      case 'open': {
        if (state.phase !== 'planning') return this.no('Abra a casa durante o planejamento.');
        if (restaurant.closed) return this.no('Corrija a higiene e a conservação, depois peça nova inspeção.');
        if (!restaurant.menu.some(id => { const recipe = recipeById(id); return recipe && this.available(restaurant, recipe) && this.canReserve(restaurant, recipe); })) return this.no('Adicione ao cardápio uma receita com ingredientes válidos.');
        if (state.competition.active) return this.no('Conclua ou abandone a competição antes do serviço.');
        state.phase = 'service'; state.elapsed = 0; state.spawnIn = 18; state.paused = false;
        this.spawn(restaurant); this.spawn(restaurant); state.tutorial = Math.max(1, state.tutorial);
        return this.ok('Portas abertas. Os primeiros pedidos chegaram!');
      }
      case 'close':
        if (state.phase !== 'service') return this.no('O serviço ainda não começou.');
        if (state.elapsed < 45 && restaurant.orders.length) return this.no('Atenda os pedidos ou complete 45 segundos de serviço.');
        this.closeDay(); return this.ok('Serviço encerrado. Confira o resultado do dia.');
      case 'nextDay': {
        if (state.phase !== 'summary') return this.no('Encerre o serviço antes de avançar.');
        state.day++; state.phase = 'planning'; state.elapsed = 0; state.daily = blankDaily(); state.inspectionResult = '';
        state.eventEffects = { demand: 1, supply: 1, critic: false };
        for (const employee of state.employees) { employee.fatigue = Math.max(0, employee.fatigue - 70); employee.task = employee.active ? 'Pronto para o serviço' : 'Folga'; }
        for (const place of state.restaurants) place.orders = [];
        if (state.day > state.taxDue && state.taxes > 0) {
          const penalty = money(Math.min(12, state.taxes * 0.04)); state.taxes = money(state.taxes + penalty);
          this.notice(`Tributos vencidos: acréscimo de R$ ${penalty.toFixed(2)}. Pague nas finanças.`);
        }
        state.event = state.stage >= 2 && state.day % 2 === 0 ? structuredClone(EVENTS[Math.floor((state.day / 2 - 1) % EVENTS.length)]) : null;
        return this.ok(`Dia ${state.day}. Uma nova chance de fazer bonito.`);
      }
      case 'prepare': {
        const order = restaurant.orders.find(item => item.id === command.orderId);
        if (state.phase !== 'service' || !order || !['waiting', 'auto'].includes(order.status)) return this.no('Esse pedido não está disponível para preparo.');
        if (restaurant.orders.some(item => item.status === 'manual')) return this.no('Conclua ou cancele o preparo que está na bancada.');
        const recipe = recipeById(order.recipeId)!;
        if (!this.available(restaurant, recipe)) return this.no('Esta receita precisa de um equipamento.');
        if (order.status === 'waiting') {
          if (!this.canReserve(restaurant, recipe)) return this.no('Faltam ingredientes válidos. Reponha o estoque.');
          this.reserve(restaurant, order, recipe);
        }
        if (order.assigned) { const employee = state.employees.find(item => item.id === order.assigned); if (employee) employee.task = 'Jogador assumiu a bancada'; }
        order.status = 'manual'; order.assigned = undefined;
        return this.ok(`Na bancada: ${recipe.name}.`);
      }
      case 'step': {
        const order = restaurant.orders.find(item => item.id === command.orderId);
        if (state.phase !== 'service' || !order || order.status !== 'manual') return this.no('Nenhum preparo manual neste pedido.');
        if (command.stepIndex !== undefined && (!Number.isInteger(command.stepIndex) || command.stepIndex !== order.stepIndex)) return this.no('Esta etapa já foi concluída ou o preparo mudou.');
        if (!Number.isFinite(command.score) || command.score < 0 || command.score > 100) return this.no('Pontuação inválida.');
        const recipe = recipeById(order.recipeId)!;
        if (order.stepIndex >= recipe.steps.length) return this.no('O prato já está pronto.');
        order.scores.push(command.score); order.stepIndex++; order.progress = order.stepIndex / recipe.steps.length;
        if (order.stepIndex >= recipe.steps.length) {
          order.quality = this.quality(restaurant, order, order.scores); order.status = 'ready';
          restaurant.cleanliness = clamp(restaurant.cleanliness - recipe.steps.length * 0.3);
          state.tutorial = Math.max(2, state.tutorial);
          return this.ok(`Prato pronto · qualidade ${Math.round(order.quality)}. Sirva enquanto está quente.`);
        }
        return this.ok('Boa! Próxima etapa.');
      }
      case 'serve': {
        const order = restaurant.orders.find(item => item.id === command.orderId);
        if (state.phase !== 'service' || !order || order.status !== 'ready') return this.no('O prato precisa estar pronto para servir.');
        this.deliver(restaurant, order); state.tutorial = Math.max(3, state.tutorial);
        return this.ok('Pedido entregue. Mais uma mesa feliz.');
      }
      case 'cancel': {
        const order = restaurant.orders.find(item => item.id === command.orderId);
        if (!order || state.phase !== 'service') return this.no('Pedido não encontrado.');
        restaurant.orders = restaurant.orders.filter(item => item.id !== order.id);
        restaurant.lost++; state.daily.lost++; restaurant.reputation = clamp(restaurant.reputation - 1);
        return this.ok('Pedido cancelado. Ingredientes já preparados são descartados.');
      }
      case 'buy': {
        if (!Number.isInteger(command.quantity) || command.quantity < 1 || command.quantity > 100 || !Object.hasOwn(suppliers, command.supplier)) return this.no('Escolha entre 1 e 100 unidades e um fornecedor.');
        const ingredient = INGREDIENTS.find(item => item.id === command.ingredientId);
        if (!ingredient) return this.no('Ingrediente desconhecido.');
        const cost = supplyCost(state, ingredient.id, command.quantity, command.supplier);
        if (!this.spend(cost, 'estoque', `${ingredient.name} · ${command.quantity} un.`)) return this.no('Saldo insuficiente para esta compra.');
        this.addStock(restaurant, ingredient.id, command.quantity, suppliers[command.supplier].quality, suppliers[command.supplier].life);
        return this.ok(`${ingredient.name} chegou à despensa.`);
      }
      case 'clean': {
        const expired = Object.values(restaurant.stock).some(stock => stock.quantity > 0 && stock.expires < state.day);
        if (restaurant.cleanliness >= 99 && !expired) return this.no('A cozinha já está limpa.');
        if (!this.spend(6, 'manutencao', 'Limpeza e descarte sanitário')) return this.no('A limpeza custa R$ 6. Use o apoio emergencial se precisar.');
        restaurant.cleanliness = clamp(restaurant.cleanliness + 45 + (restaurant.equipment.lava_loucas ?? 0) * 8);
        for (const stock of Object.values(restaurant.stock)) if (stock.expires < state.day) stock.quantity = 0;
        return this.ok('Bancadas higienizadas. Lotes vencidos descartados.');
      }
      case 'repair': {
        if (restaurant.condition >= 99) return this.no('Os equipamentos já estão conservados.');
        if (!this.spend(25, 'manutencao', 'Revisão dos equipamentos')) return this.no('A manutenção custa R$ 25.');
        restaurant.condition = clamp(restaurant.condition + 45); return this.ok('Equipamentos revisados e funcionando melhor.');
      }
      case 'payTax': {
        const total = money(state.taxes + (state.debt ?? 0));
        if (total <= 0) return this.no('Tudo em dia.');
        if (state.cash < total) return this.no(`São necessários R$ ${total.toFixed(2)} para quitar as pendências.`);
        state.cash = money(state.cash - total);
        state.daily.expenses = money(state.daily.expenses + state.taxes);
        if (state.taxes) this.record('tributos', 'Tributos quitados', -state.taxes);
        if (state.debt) this.record('pendencias', 'Quitação de custos já contabilizados', -state.debt);
        state.taxes = 0; state.debt = 0; state.taxDue = Math.max(state.day + 3, state.taxDue); return this.ok('Contas em dia. Próximo vencimento em três dias.');
      }
      case 'relief': {
        if (state.reliefUsed || state.cash >= 40) return this.no(state.reliefUsed ? 'O apoio de início de carreira já foi utilizado.' : 'O apoio é reservado a saldos abaixo de R$ 40.');
        state.reliefUsed = true; this.earn(140, 'apoio', 'Apoio único da comunidade');
        for (const ingredient of INGREDIENTS) this.addStock(restaurant, ingredient.id, 6, 85, 0);
        restaurant.cleanliness = Math.max(85, restaurant.cleanliness); restaurant.condition = Math.max(75, restaurant.condition);
        this.notice('A comunidade ajudou. Um apoio por carreira, sem cobrança.');
        return this.ok('R$ 140 e uma cesta de ingredientes. Sua cozinha tem uma segunda chance.');
      }
      case 'inspect': return this.inspect(restaurant);
      case 'hire': {
        const candidate = CANDIDATES.find(item => item.id === command.candidateId);
        if (state.stage < 2 || !candidate || candidate.unlock > state.stage) return this.no('Essa contratação ainda não está disponível na carreira.');
        if (state.employees.some(employee => employee.id === candidate.id)) return this.no('Essa pessoa já faz parte da equipe.');
        if (state.employees.filter(employee => (employee.restaurantId ?? 1) === restaurant.id).length >= state.stage + 2) return this.no('Equipe completa nesta unidade. Avance na carreira ou transfira alguém.');
        state.employees.push({ ...candidate, level: 1, experience: 0, fatigue: 0, active: true, task: 'Pronto para o serviço', served: 0, restaurantId: restaurant.id });
        if (candidate.role === 'gerente') restaurant.managerId = candidate.id;
        this.progress(); return this.ok(`${candidate.name} entrou para a equipe. Salário cobrado ao fechar cada dia.`);
      }
      case 'fire': {
        const employee = state.employees.find(item => item.id === command.employeeId);
        if (!employee) return this.no('Funcionário não encontrado.');
        if (state.phase === 'service') return this.no('Faça alterações de equipe entre os serviços.');
        state.employees = state.employees.filter(item => item.id !== employee.id);
        for (const place of state.restaurants) if (place.managerId === employee.id) place.managerId = undefined;
        return this.ok(`${employee.name} deixou a equipe.`);
      }
      case 'train': {
        const employee = state.employees.find(item => item.id === command.employeeId);
        if (!employee || state.phase === 'service') return this.no('Treine a equipe entre os serviços.');
        if (employee.skill >= 100 && employee.speed >= 100 && employee.hygiene >= 100) return this.no('Treinamento concluído: atributos máximos.');
        if (!this.spend(45 + employee.level * 10, 'equipe', `Treinamento de ${employee.name}`)) return this.no('Saldo insuficiente para o treinamento.');
        employee.skill = clamp(employee.skill + 7); employee.speed = clamp(employee.speed + 5); employee.hygiene = clamp(employee.hygiene + 7); employee.organization = clamp(employee.organization + 5); employee.experience += 25;
        return this.ok(`${employee.name} voltou do treinamento com novas técnicas.`);
      }
      case 'promote': {
        const employee = state.employees.find(item => item.id === command.employeeId);
        if (!employee || employee.level >= 5 || employee.experience < employee.level * 30) return this.no('A promoção exige experiência de trabalho ou treinamento.');
        if (state.phase === 'service') return this.no('Promova a equipe entre os serviços.');
        employee.experience -= employee.level * 30; employee.level++; employee.wage = money(employee.wage * 1.15); employee.skill = clamp(employee.skill + 5); employee.speed = clamp(employee.speed + 4); employee.stress = clamp(employee.stress + 4);
        return this.ok(`${employee.name} foi promovido ao nível ${employee.level}. Novo salário: R$ ${employee.wage.toFixed(2)}.`);
      }
      case 'toggleEmployee': {
        const employee = state.employees.find(item => item.id === command.employeeId);
        if (!employee || state.phase === 'service') return this.no('Ajuste as escalas entre os serviços.');
        employee.active = !employee.active; employee.task = employee.active ? 'Pronto para o serviço' : 'Folga'; return this.ok(employee.active ? 'Pessoa incluída na escala.' : 'Folga concedida. Meio salário neste dia.');
      }
      case 'assign': {
        const employee = state.employees.find(item => item.id === command.employeeId);
        if (!employee || state.phase === 'service' || !roles.includes(command.role)) return this.no('Reorganize a equipe entre os serviços.');
        const requiredStage = command.role === 'gerente' ? 5 : command.role === 'chef' ? 3 : command.role === 'estoquista' ? 3 : 2;
        if (state.stage < requiredStage) return this.no('Essa função ainda não está disponível.');
        const occupied = state.employees.filter(item => (item.restaurantId ?? 1) === restaurant.id && item.id !== employee.id).length;
        if (occupied >= state.stage + 2) return this.no('Não há vagas nesta unidade.');
        for (const place of state.restaurants) if (place.managerId === employee.id) place.managerId = undefined;
        employee.role = command.role; employee.restaurantId = restaurant.id;
        if (employee.role === 'gerente') restaurant.managerId = employee.id;
        return this.ok(`${employee.name} agora trabalha nesta unidade.`);
      }
      case 'upgrade': {
        const equipment = EQUIPMENT.find(item => item.id === command.equipmentId);
        if (!equipment || equipment.unlock > state.stage) return this.no('Este equipamento ainda não está disponível.');
        const level = restaurant.equipment[equipment.id] ?? 0;
        if (level >= equipment.max) return this.no('Este equipamento já está no nível máximo.');
        if (!this.spend(equipmentCost(restaurant, equipment.id), 'equipamentos', `${equipment.name} · nível ${level + 1}`)) return this.no('Saldo insuficiente para essa melhoria.');
        restaurant.equipment[equipment.id] = level + 1;
        if (equipment.id === 'geladeira') for (const stock of Object.values(restaurant.stock)) if (stock.expires >= state.day) stock.expires++;
        restaurant.condition = clamp(restaurant.condition + 8);
        return this.ok(`${equipment.name} instalado. A cozinha ganhou novas possibilidades.`);
      }
      case 'menu': {
        const recipe = recipeById(command.recipeId);
        if (!recipe || !state.unlocked.includes(recipe.id) || typeof command.enabled !== 'boolean') return this.no('Esta receita ainda não está no seu caderno.');
        if (command.enabled) {
          if (!this.available(restaurant, recipe)) return this.no('Instale o equipamento necessário antes de oferecer este prato.');
          if (!restaurant.menu.includes(recipe.id)) restaurant.menu.push(recipe.id);
        } else {
          if (restaurant.menu.length === 1 && restaurant.menu.includes(recipe.id)) return this.no('Mantenha pelo menos um prato no cardápio.');
          restaurant.menu = restaurant.menu.filter(id => id !== recipe.id);
        }
        return this.ok('Cardápio atualizado.');
      }
      case 'price': {
        const recipe = recipeById(command.recipeId);
        if (!recipe || !state.unlocked.includes(recipe.id) || !Number.isFinite(command.price) || command.price < recipe.cost || command.price > recipe.price * 2) return this.no('Defina um preço entre o custo e o dobro do valor sugerido.');
        restaurant.prices[recipe.id] = money(command.price); return this.ok('Preço atualizado. O público leva o valor em conta.');
      }
      case 'expand': {
        if (state.stage < 5 || state.phase === 'service') return this.no('Abra novas unidades no estágio Empresário, entre os serviços.');
        if (state.restaurants.length >= 4) return this.no('Sua rede já atingiu quatro unidades.');
        if (!SPECIALIZATIONS.some(style => style.id === command.style)) return this.no('Escolha uma especialização válida.');
        if (!command.name.trim() || command.name.trim().length > 32) return this.no('Escolha um nome de até 32 letras.');
        const cost = 850 + (state.restaurants.length - 1) * 350;
        if (!this.spend(cost, 'expansao', `Abertura de ${command.name.trim()}`)) return this.no(`A nova unidade custa R$ ${cost}.`);
        const place = newRestaurant(Math.max(...state.restaurants.map(item => item.id)) + 1, command.name.trim(), command.style, state.day);
        place.equipment.chapa = 1; place.equipment.forno = 1;
        if (command.style === 'massas') place.equipment.fogao = 2;
        if (command.style === 'confeitaria') { place.equipment.forno = 2; place.equipment.liquidificador = 1; }
        if (command.style === 'contemporanea') { place.equipment.chapa = 2; place.equipment.exaustor = 1; }
        const categories: Record<string, string[]> = { brasileira: ['Brasileiros', 'Lanches'], massas: ['Massas'], confeitaria: ['Confeitaria', 'Bebidas'], contemporanea: ['Autorais', 'Assinaturas'] };
        const favored = RECIPES.filter(recipe => (categories[command.style] ?? []).includes(recipe.category) && this.available(place, recipe));
        if (favored.length) place.menu = favored.slice(0, 4).map(recipe => recipe.id);
        state.restaurants.push(place); this.milestone('second_restaurant', 'A família cresceu: uma nova casa abriu as portas.');
        return this.ok('Unidade inaugurada. Contrate ou transfira um gerente para operá-la à distância.');
      }
      case 'switch':
        if (!state.restaurants.some(item => item.id === command.restaurantId)) return this.no('Unidade não encontrada.');
        if (state.phase === 'service' && restaurant.orders.some(order => order.status === 'manual')) return this.no('Conclua o preparo manual antes de trocar de unidade.');
        state.activeRestaurant = command.restaurantId; return this.ok('Você chegou à outra cozinha.');
      case 'decorate':
        if (!['acolhedor', 'botanico', 'bistro', 'noturno'].includes(command.decor)) return this.no('Escolha uma decoração disponível.');
        if (restaurant.decor === command.decor) return this.no('Essa decoração já está instalada.');
        if (!this.spend(100, 'reforma', 'Nova decoração do salão')) return this.no('A reforma custa R$ 100.');
        restaurant.decor = command.decor; restaurant.reputation = clamp(restaurant.reputation + 2); return this.ok('O salão ganhou uma nova personalidade.');
      case 'competition': return this.competition(command.action);
      case 'competitionScore': return this.competitionScore(command.scores);
      case 'event': return this.resolveEvent(command.choice);
      default: return this.no('Ação desconhecida.');
    }
  }

  private addStock(restaurant: Restaurant, id: string, quantity: number, quality: number, bonusLife: number) {
    const ingredient = INGREDIENTS.find(item => item.id === id);
    if (!ingredient) return;
    const old = restaurant.stock[id];
    const usable = old && old.expires >= this.state.day ? old.quantity : 0;
    const expires = this.state.day + ingredient.shelfLife + (restaurant.equipment.geladeira ?? 0) + bonusLife;
    restaurant.stock[id] = {
      quantity: usable + quantity,
      quality: money(((usable ? old.quality * usable : 0) + quality * quantity) / (usable + quantity)),
      // A mixed lot retains its earliest expiry; purchases never rejuvenate old stock.
      expires: usable ? Math.min(old.expires, expires) : expires,
    };
  }

  private closeDay() {
    const state = this.state;
    if (state.phase !== 'service') return;
    for (const restaurant of state.restaurants) {
      for (const order of restaurant.orders) { restaurant.lost++; state.daily.lost++; restaurant.reputation = clamp(restaurant.reputation - (order.status === 'ready' ? 0.4 : 0.8)); }
      restaurant.orders = [];
      const operating = !restaurant.closed && (restaurant.id === state.activeRestaurant || this.staff(restaurant).some(employee => employee.id === restaurant.managerId && employee.role === 'gerente'));
      const rent = restaurant.id === 1 ? 12 + Math.max(0, state.stage - 1) * 3 : 24;
      this.bill(rent, 'aluguel', `${restaurant.name} · aluguel`);
      if (operating) this.bill(5 + state.stage * 1.5, 'utilidades', `${restaurant.name} · água e energia`);
      restaurant.profit = money(restaurant.profit - rent - (operating ? 5 + state.stage * 1.5 : 0));
    }
    for (const employee of state.employees) {
      const wage = money(employee.wage * (employee.active ? 1 : 0.5) * (state.difficulty === 'casual' ? 0.9 : state.difficulty === 'especialista' ? 1.15 : 1));
      this.bill(wage, 'salarios', `${employee.name} · ${employee.active ? 'salário' : 'folga remunerada'}`);
      const restaurant = state.restaurants.find(item => item.id === (employee.restaurantId ?? 1));
      if (restaurant) restaurant.profit = money(restaurant.profit - wage);
      if (employee.active) employee.experience += 5;
      employee.task = employee.active ? 'Serviço encerrado' : 'Folga';
    }
    if (state.day >= state.inspectionDue) this.inspect(activeRestaurant(state));
    state.reports.push({ day: state.day, ...state.daily, quality: state.daily.served ? money(state.daily.quality / state.daily.served) : 0, inspection: state.inspectionResult || undefined });
    if (state.reports.length > 90) state.reports.shift();
    state.phase = 'summary'; state.paused = false; state.event = null;
    this.progress();
  }

  private inspect(restaurant: Restaurant): Result {
    if (this.state.stage < 2 && this.state.day < 3) return this.no('Primeira visita sanitária prevista para o dia 3.');
    const checklist = inspectionChecklist(this.state, restaurant);
    const failures = checklist.filter(item => !item.ok);
    const severe = restaurant.cleanliness < 20 || restaurant.condition < 15 || failures.length >= 4;
    const closedBefore = !!restaurant.closed;
    if (!failures.length) {
      restaurant.closed = false; restaurant.reputation = clamp(restaurant.reputation + (closedBefore ? 1 : this.state.inspectionDue <= this.state.day ? 0.3 : 0));
      this.state.inspectionResult = 'Aprovado · todos os cinco critérios em ordem.';
    } else if (severe) {
      const fine = 35 + failures.length * 8;
      if (!closedBefore) this.bill(fine, 'fiscalizacao', 'Correção sanitária · interdição temporária');
      restaurant.closed = true; restaurant.reputation = clamp(restaurant.reputation - (closedBefore ? 0 : 3));
      this.state.inspectionResult = `Interdição temporária · ${failures.map(item => item.label).join(', ')}. Limpe, revise e peça nova inspeção.`;
    } else if (failures.length >= 2) {
      if (this.state.inspectionDue <= this.state.day) this.bill(failures.length * 8, 'fiscalizacao', 'Multa sanitária proporcional');
      this.state.inspectionResult = `Advertência · ${failures.map(item => item.label).join(', ')}. Corrija até a próxima visita.`;
    } else this.state.inspectionResult = `Recomendação · ${failures[0].label}. Corrija antes da próxima visita.`;
    this.state.inspectionDue = this.state.day + (failures.length ? 2 : 3);
    this.notice(this.state.inspectionResult);
    return this.ok(this.state.inspectionResult);
  }

  private competition(action: 'enter' | 'withdraw'): Result {
    const state = this.state;
    if (action === 'withdraw') {
      if (!state.competition.active) return this.no('Você não está em uma competição.');
      state.competition.active = false; return this.ok('Inscrição encerrada. A taxa não é reembolsada.');
    }
    if (action !== 'enter' || state.stage < 3 || state.phase === 'service') return this.no('O circuito abre no estágio Chef profissional, fora do serviço.');
    if (state.competition.active || state.competition.enteredDay === state.day) return this.no('Uma inscrição por dia. Termine a competição atual.');
    const restaurant = activeRestaurant(state);
    const recipe = RECIPES.filter(item => this.available(restaurant, item) && item.difficulty >= 2).sort((a, b) => b.unlock - a.unlock)[0] ?? RECIPES[0];
    if (!this.spend(35, 'competicao', 'Inscrição · Panela de Cobre')) return this.no('A inscrição custa R$ 35. Ingredientes fornecidos pelo circuito.');
    state.competition = { round: 0, scores: [], enteredDay: state.day, active: true, wins: state.competition.wins, recipeId: recipe.id };
    return this.ok('Classificatórias, semifinal e final. Ingredientes do circuito; técnica, tempo e apresentação.');
  }

  private competitionScore(scores: number[]): Result {
    const competition = this.state.competition;
    const recipe = recipeById(competition.recipeId ?? '');
    if (!competition.active || !recipe || !Array.isArray(scores) || scores.length !== recipe.steps.length || scores.some(score => !Number.isFinite(score) || score < 0 || score > 100)) return this.no('Conclua todas as etapas do desafio antes de enviar.');
    const score = money(scores.reduce((sum, value) => sum + value, 0) / scores.length);
    competition.scores.push(score); competition.round++;
    const targets = [58, 68, 78];
    if (score < targets[competition.round - 1]) { competition.active = false; this.state.xp += 18; this.progress(); return this.ok(`Nota ${score}. Faltou pouco. Você ganhou experiência para a próxima edição.`); }
    this.state.xp += 25;
    if (competition.round < 3) { this.progress(); return this.ok(`Nota ${score}. Classificado para ${competition.round === 1 ? 'a semifinal' : 'a final'}!`); }
    competition.active = false; competition.wins++;
    const prize = 250 + Math.min(3, competition.wins - 1) * 75;
    this.earn(prize, 'premios', 'Panela de Cobre · campeão');
    this.state.daily.revenue = money(this.state.daily.revenue + prize);
    this.state.xp += 100;
    activeRestaurant(this.state).reputation = clamp(activeRestaurant(this.state).reputation + 5);
    this.milestone('competition_winner', 'Sua primeira Panela de Cobre. Um novo capítulo na carreira.'); this.progress();
    return this.ok(`Campeão da Panela de Cobre! R$ ${prize} e reconhecimento na cidade.`);
  }

  private resolveEvent(choice: number): Result {
    const state = this.state;
    const event = state.event;
    if (!event || !Number.isInteger(choice) || choice < 0 || choice >= event.choices.length) return this.no('Escolha uma opção do evento atual.');
    const effect = event.choices[choice].effect;
    const restaurant = activeRestaurant(state);
    const costs: Record<string, number> = { festival: 45, critic: 0, repair: 40, supplies: 55, workshop: 60, donation: 40, heat: 25, fair: 65 };
    if (effect === 'decline' || effect === 'ignore' || effect === 'dismiss') {
      if (event.id === 'heat') { restaurant.cleanliness = clamp(restaurant.cleanliness - 12); state.eventEffects = { ...(state.eventEffects ?? { demand: 1, supply: 1, critic: false }), demand: 0.9 }; }
      if (event.id === 'repair') restaurant.condition = clamp(restaurant.condition - 12);
      state.event = null; return this.ok('Decisão tomada. Siga com o planejamento.');
    }
    if (!Object.hasOwn(costs, effect)) return this.no('Opção de evento desconhecida.');
    if (!this.spend(costs[effect], 'eventos', event.title)) return this.no('O saldo não cobre essa escolha. Você pode recusar o convite.');
    state.eventEffects ??= { demand: 1, supply: 1, critic: false };
    switch (effect) {
      case 'festival': state.eventEffects.demand = 1.35; restaurant.reputation = clamp(restaurant.reputation + 1); break;
      case 'critic': state.eventEffects.critic = true; break;
      case 'repair': restaurant.condition = clamp(restaurant.condition + 35); break;
      case 'supplies': {
        const ids = new Set(restaurant.menu.flatMap(id => Object.keys(recipeById(id)?.ingredients ?? {})));
        for (const id of ids) this.addStock(restaurant, id, 6, 78, 0); break;
      }
      case 'workshop': for (const employee of this.staff(restaurant)) { employee.experience += 12; employee.skill = clamp(employee.skill + 3); } state.xp += 40; this.progress(); break;
      case 'donation': restaurant.reputation = clamp(restaurant.reputation + 3); state.xp += 15; this.progress(); break;
      case 'heat': restaurant.cleanliness = clamp(restaurant.cleanliness + 15); for (const stock of Object.values(restaurant.stock)) if (stock.expires >= state.day) stock.quality = clamp(stock.quality + 3); break;
      case 'fair': for (const id of ['fruta', 'tomate', 'folhas']) this.addStock(restaurant, id, 8, 98, 1); break;
    }
    state.event = null; return this.ok('Escolha confirmada. Sua decisão já está valendo na cozinha.');
  }

  tick(seconds: number): void {
    const state = this.state;
    if (!Number.isFinite(seconds) || seconds <= 0 || state.paused || state.phase !== 'service') return;
    let remaining = Math.min(seconds, 3600) * clamp(state.speed, 0.25, 3);
    while (remaining > 0 && state.phase === 'service') {
      const dt = Math.min(0.5, remaining, Math.max(0, state.duration - state.elapsed));
      if (dt <= 0) { this.closeDay(); break; }
      remaining -= dt; state.elapsed += dt; state.playTime += dt;
      const active = activeRestaurant(state);
      const operating = state.restaurants.filter(restaurant => !restaurant.closed && (restaurant.id === active.id || this.staff(restaurant).some(employee => employee.id === restaurant.managerId && employee.role === 'gerente')));
      for (const restaurant of operating) this.simulateRestaurant(restaurant, dt, restaurant.id === active.id);
      for (const restaurant of state.restaurants.filter(item => !operating.includes(item))) {
        for (const order of [...restaurant.orders]) {
          order.patience -= dt;
          if (order.patience <= 0) { restaurant.orders = restaurant.orders.filter(item => item.id !== order.id); restaurant.lost++; state.daily.lost++; restaurant.reputation = clamp(restaurant.reputation - 0.8); }
        }
      }
      state.spawnIn -= dt;
      if (state.spawnIn <= 0 && state.elapsed < state.duration - 28) {
        for (const restaurant of operating) this.spawn(restaurant);
        const ratios = active.menu.map(id => { const recipe = recipeById(id)!; return (active.prices[id] ?? recipe.price) / recipe.price; });
        const averagePrice = ratios.reduce((sum, ratio) => sum + ratio, 0) / Math.max(1, ratios.length);
        const demand = clamp((1.5 - averagePrice * 0.5) * (0.7 + active.reputation / 150) * (state.eventEffects?.demand ?? 1) * (1 + Math.min(active.menu.length - 1, 5) * 0.035), 0.35, 2);
        const rush = state.elapsed > 65 && state.elapsed < 130 ? 0.75 : 1;
        state.spawnIn = (state.stage === 1 ? 19 : Math.max(10, 18 - state.stage)) * rush / demand;
      }
      if (state.elapsed >= state.duration) this.closeDay();
    }
  }

  private simulateRestaurant(restaurant: Restaurant, dt: number, playerPresent: boolean) {
    const staff = this.staff(restaurant);
    const cleaner = staff.find(employee => employee.role === 'faxineiro');
    const assistant = staff.find(employee => employee.role === 'auxiliar');
    const manager = staff.find(employee => employee.role === 'gerente' && employee.id === restaurant.managerId);
    restaurant.cleanliness = clamp(restaurant.cleanliness - dt * (0.022 + restaurant.orders.length * 0.004) + dt * (cleaner ? cleaner.hygiene * 0.0035 : 0) + dt * (restaurant.equipment.lava_loucas ?? 0) * 0.025);
    restaurant.condition = clamp(restaurant.condition - dt * 0.015 / (1 + (restaurant.equipment.exaustor ?? 0) * 0.4));
    for (const employee of staff) {
      employee.fatigue = clamp(employee.fatigue + dt * (0.08 + (100 - employee.stress) * 0.001));
      if (employee.role === 'faxineiro') employee.task = restaurant.cleanliness < 95 ? 'Higienizando as bancadas' : 'Conferindo a limpeza';
      if (employee.role === 'auxiliar') employee.task = 'Mise en place · melhora qualidade e velocidade';
      if (employee.role === 'gerente') employee.task = playerPresent ? 'Organizando a equipe' : 'Gerenciando o serviço desta unidade';
      if (employee.role === 'estoquista') {
        employee.task = 'Conferindo estoque e validade';
        // A bounded work cadence prevents one purchase per animation frame.
        const previous = Math.floor((this.state.elapsed - dt) / 18);
        if (Math.floor(this.state.elapsed / 18) > previous) {
          const ingredientIds = [...new Set(restaurant.menu.flatMap(id => Object.keys(recipeById(id)?.ingredients ?? {})))];
          const id = ingredientIds.find(ingredientId => !restaurant.stock[ingredientId] || restaurant.stock[ingredientId].quantity < 4 || restaurant.stock[ingredientId].expires < this.state.day);
          if (id) {
            const cost = supplyCost(this.state, id, 8, 'economico');
            if (this.spend(cost, 'estoque', `${employee.name} · reposição automática`)) { this.addStock(restaurant, id, 8, 78 + employee.organization * 0.1, 0); employee.experience++; employee.task = `Reposição de ${INGREDIENTS.find(item => item.id === id)!.name}`; }
            else employee.task = 'Sem saldo para repor ingredientes';
          }
        }
      }
    }
    const cooks = staff.filter(employee => employee.role === 'cozinheiro' || employee.role === 'chef');
    // Visiting a managed unit must not strand the manager's in-flight preparation.
    if (manager && !cooks.length) cooks.push(manager);
    const cookingCapacity = 1 + (restaurant.equipment.bancada ?? 0) + (restaurant.equipment.fogao ?? 0);
    for (const cook of cooks.slice(0, cookingCapacity)) {
      let order = restaurant.orders.find(item => item.status === 'auto' && item.assigned === cook.id);
      if (!order) {
        order = restaurant.orders.find(item => item.status === 'waiting' && this.canReserve(restaurant, recipeById(item.recipeId)!));
        if (order) { this.reserve(restaurant, order, recipeById(order.recipeId)!); order.status = 'auto'; order.assigned = cook.id; }
        else { cook.task = restaurant.orders.some(item => item.status === 'waiting') ? 'Aguardando ingredientes válidos' : 'Bancada livre'; continue; }
      }
      const recipe = recipeById(order.recipeId)!;
      cook.task = `Preparando ${recipe.name}`;
      const levels = (restaurant.equipment.fogao ?? 0) + (restaurant.equipment[recipe.equipment ?? 'bancada'] ?? 0);
      const beverage = recipe.category === 'Bebidas' || recipe.steps.some(step => step.action === 'drink') ? (restaurant.equipment.liquidificador ?? 0) * 0.12 : 0;
      const speed = (0.55 + cook.speed / 100) * (1 + levels * 0.12 + beverage) * (1 - cook.fatigue * 0.003) * (assistant ? 1 + assistant.speed * 0.002 : 1) * (manager ? 1 + manager.organization * 0.001 : 1) * (cook.role === 'gerente' ? 0.65 : 1);
      order.progress = clamp(order.progress + dt * speed / Math.max(7, recipe.seconds), 0, 1);
      if (order.progress >= 1) {
        const consistency = clamp(cook.skill + (cook.level - 1) * 2 - cook.fatigue * 0.09 - (100 - cook.stress) * 0.035);
        order.scores = recipe.steps.map(() => consistency); order.stepIndex = recipe.steps.length;
        order.quality = this.quality(restaurant, order, order.scores); order.status = 'ready'; cook.task = 'Prato no passe, aguardando retirada';
      }
    }
    for (const order of [...restaurant.orders]) {
      order.patience -= dt * (order.status === 'manual' || order.status === 'auto' ? 0.38 : 1);
      if (order.status === 'ready') order.quality = clamp(order.quality - dt * 0.035);
      if (order.patience <= 0) {
        restaurant.orders = restaurant.orders.filter(item => item.id !== order.id); restaurant.lost++; this.state.daily.lost++;
        restaurant.reputation = clamp(restaurant.reputation - (order.profile === 'Crítico' ? 3 : 0.8));
        this.notice(`${order.customer} foi embora. Observe o tempo dos pedidos.`);
      }
    }
    const waiter = staff.find(employee => employee.role === 'garcom') ?? manager;
    if (waiter) {
      const ready = restaurant.orders.find(order => order.status === 'ready');
      const cadence = waiter.role === 'garcom' ? Math.max(1, 6 - waiter.speed * 0.04 - (restaurant.equipment.tablet ?? 0) * 0.4) : 6;
      const serveNow = Math.floor(this.state.elapsed / cadence) > Math.floor((this.state.elapsed - dt) / cadence);
      if (ready) { waiter.task = `Servindo ${recipeById(ready.recipeId)!.name}`; if (serveNow) { waiter.experience += 3; if (ready.assigned !== waiter.id) waiter.served++; this.deliver(restaurant, ready); } }
      else if (waiter.role === 'garcom') waiter.task = 'Conferindo o passe';
    }
  }
}
