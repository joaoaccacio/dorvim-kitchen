import "./style.css";
import {
  GameEngine,
  createCareer,
  activeRestaurant,
  equipmentCost,
  supplyCost,
  inspectionChecklist,
} from "./game/engine";
import {
  RECIPES,
  INGREDIENTS,
  EQUIPMENT,
  CANDIDATES,
  STAGES,
  SPECIALIZATIONS,
  ACHIEVEMENTS,
} from "./game/content";
import type {
  Command,
  Difficulty,
  GameState,
  Recipe,
  Role,
  Settings,
} from "./game/types";
import { RestaurantScene } from "./render/restaurant";
import { CookingGame } from "./render/cooking";
import { GameAudio } from "./platform/audio";
import { registerOffline } from "./platform/offline";
import {
  saveCareer,
  loadCareer,
  hasCareer,
  exportCareer,
  importCareer,
  saveSettings,
  loadSettings,
} from "./platform/save";
import { icon, food, escape as esc, money } from "./ui";

type View =
  | "restaurant"
  | "menu"
  | "staff"
  | "stock"
  | "finance"
  | "reputation"
  | "career"
  | "competitions"
  | "upgrades";
const NAV: { id: View; label: string; icon: string; stage?: number }[] = [
  { id: "restaurant", label: "Restaurante", icon: "restaurant" },
  { id: "menu", label: "Cardápio", icon: "menu" },
  { id: "stock", label: "Despensa", icon: "stock" },
  { id: "staff", label: "Equipe", icon: "staff", stage: 2 },
  { id: "upgrades", label: "Ateliê de melhorias", icon: "upgrade" },
  { id: "finance", label: "Livro-caixa", icon: "finance" },
  { id: "reputation", label: "Nossa reputação", icon: "heart" },
  { id: "career", label: "Sua jornada", icon: "career" },
  { id: "competitions", label: "Competições", icon: "trophy", stage: 3 },
];
const ROLES: Record<Role, string> = {
  auxiliar: "Auxiliar",
  cozinheiro: "Cozinheiro",
  chef: "Chef",
  garcom: "Garçom",
  faxineiro: "Faxineiro",
  gerente: "Gerente",
  estoquista: "Estoquista",
};
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
  document.querySelector<T>(selector);
const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));
const meter = (value: number, label = "", cls = "") =>
  `<div class="meter ${cls}" role="meter" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(clamp(value))}"><i style="width:${clamp(value)}%"></i></div>`;

class DorvimApp {
  root = document.getElementById("app")!;
  engine: GameEngine | null = null;
  scene: RestaurantScene | null = null;
  cooking: CookingGame | null = null;
  audio: GameAudio;
  settings: Settings;
  view: View = "restaurant";
  modal = "";
  supplier: "economico" | "horta" | "expresso" = "horta";
  menuFilter = "Todos";
  lastFrame = 0;
  lastPaint = 0;
  lastSave = 0;
  lastManagementPaint = 0;
  inspectionTimer = 0;
  orderSignature = "";
  lastNotice = "";
  lastServedCount = 0;
  lastAchievementCount = 0;
  lastReviewKey = "";
  lastPhase = "";
  savedText = "Progresso local";
  notificationTimer = 0;
  manualId: number | null = null;
  competitionStep = 0;
  competitionScores: number[] = [];
  lastCompetitionScore: number | null = null;
  constructor() {
    this.settings = loadSettings();
    document.documentElement.classList.toggle(
      "reduced-motion",
      this.settings.reducedMotion,
    );
    this.audio = new GameAudio(this.settings);
    this.root.addEventListener("click", (e) => this.click(e));
    this.root.addEventListener("change", (e) => this.change(e));
    this.root.addEventListener("submit", (e) => this.submit(e));
    document.addEventListener("keydown", (e) => this.key(e));
    document.addEventListener("visibilitychange", () => {
      this.lastFrame = 0;
      if (document.hidden && this.engine) this.save(false);
    });
    window.addEventListener("pagehide", () => {
      if (this.engine) this.save(false);
    });
    this.title();
    requestAnimationFrame((t) => this.frame(t));
  }
  get state() {
    return this.engine!.state;
  }
  get restaurant() {
    return activeRestaurant(this.state);
  }
  brand() {
    return `<span class="brand-mark">${icon("kitchen")}</span><span class="brand-word">dorvim<span>KITCHEN</span></span>`;
  }
  title() {
    this.scene?.destroy();
    this.cooking?.destroy();
    this.scene = null;
    this.cooking = null;
    this.engine = null;
    this.modal = "";
    this.root.innerHTML = `<main class="title-screen"><canvas id="title-canvas" aria-label="Restaurante isométrico Dorvim Kitchen"></canvas><div class="title-shade"></div><div class="title-top"><a class="brand" href="#" aria-label="Dorvim Kitchen">${this.brand()}</a><span class="edition">UM JOGO SOBRE FAZER ACONTECER</span><button class="icon-button title-settings" data-action="settings" title="Configurações">${icon("settings")}</button></div><section class="title-copy"><span class="eyebrow">DA PRIMEIRA PANELA À SUA PRÓPRIA HISTÓRIA</span><h1>Todo grande chef<br>começa com<br><em>um pequeno sonho.</em></h1><p>Abra as portas. Acenda o fogão.<br>O seu lugar à mesa está esperando.</p><div class="title-buttons">${hasCareer() ? `<button class="button primary large" data-action="continue">Continuar carreira ${icon("arrow")}</button>` : ""}<button class="button ${hasCareer() ? "glass" : "primary"} large" data-action="new">Nova carreira ${icon("arrow")}</button><button class="text-button light" data-action="load">Carregar carreira</button></div><div class="title-meta"><span>${icon("leaf")} Feito para jogar no seu ritmo</span><span>Offline · Sem contas · Sem compras</span></div></section><div class="title-footer"><span>COZINHE. CRESÇA. CONQUISTE.</span><button class="text-button light" data-action="credits">Créditos & controles</button><small>O progresso fica neste navegador. Apagar seus dados pode removê-lo.</small></div></main><div id="modal-layer"></div><div id="toasts" aria-live="polite"></div><input id="import-file" type="file" accept="application/json,.json" hidden>`;
    const state = createCareer("Dorvim", "casual");
    this.scene = new RestaurantScene($("#title-canvas") as HTMLCanvasElement, {
      onStation: () => {},
      reducedMotion: this.settings.reducedMotion,
    });
    this.scene.setMenuMode?.(true);
    this.scene.update(state);
  }
  start(state: GameState) {
    this.scene?.destroy();
    this.cooking?.destroy();
    this.scene = null;
    this.cooking = null;
    state.settings = { ...this.settings };
    state.paused = false;
    this.lastServedCount = state.servedTotal;
    this.lastAchievementCount = state.achievements.length;
    this.lastReviewKey = JSON.stringify(state.reviews[0] || null);
    this.engine = new GameEngine(state);
    this.view = "restaurant";
    this.modal = "";
    this.lastPhase = state.phase;
    this.manualId = null;
    this.lastNotice = state.notices.at(-1) || "";
    this.shell();
    this.save(false);
    const ongoing = this.restaurant.orders.find((o) => o.status === "manual");
    if (ongoing) this.openCooking(ongoing.id);
  }
  shell() {
    this.root.innerHTML = `<div class="game-shell"><aside class="sidebar"><a class="brand" href="#" data-action="home">${this.brand()}</a><div class="sidebar-caption">SUA CASA. SUA HISTÓRIA.</div><div class="location-select"><span class="tiny-label">ESTABELECIMENTO</span><select id="restaurant-select" aria-label="Restaurante ativo">${this.state.restaurants.map((r) => `<option value="${r.id}" ${r.id === this.state.activeRestaurant ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select><span class="location-dot">Portas abertas para um sonho</span></div><nav aria-label="Navegação principal">${NAV.map((n, i) => `<button class="nav-item ${n.id === this.view ? "active" : ""} ${i === 5 ? "nav-gap" : ""}" data-action="nav" data-view="${n.id}">${icon(n.icon)}<span>${n.label}</span>${n.stage && this.state.stage < n.stage ? `<small>${n.stage}</small>` : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="chef-card"><span class="chef-portrait">${icon("kitchen")}</span><div><strong>${esc(this.state.careerName)}</strong><span id="sidebar-stage">${this.stageName()}</span></div></div><div class="sidebar-tools"><button class="icon-button" data-action="save" title="Salvar carreira">${icon("save")}</button><button class="icon-button" data-action="settings" title="Configurações">${icon("settings")}</button><button class="text-button" data-action="home">Menu</button></div><small id="save-label">${this.savedText}</small></div></aside><div class="game-content"><header class="topbar"><div class="day-stamp">${icon("sun")}<span><small id="hud-day">DIA ${this.state.day}</small><strong id="hud-time">Antes de abrir</strong></span></div><div class="top-stats"><div class="stat reputation-stat">${icon("career")}<span><small>REPUTAÇÃO</small><strong id="hud-rep"></strong></span></div><div class="stat money-stat">${icon("coin")}<span><small>EM CAIXA</small><strong id="hud-cash"></strong></span></div></div><div class="time-controls"><button class="icon-button" data-action="pause" title="Pausar (espaço)" id="pause-button">${icon("pause")}</button><button class="speed-button" data-action="speed" id="speed-button">1×</button></div></header><main id="workspace"></main></div></div><div id="modal-layer"></div><div id="toasts" aria-live="polite"></div><input id="import-file" type="file" accept="application/json,.json" hidden>`;
    this.renderView();
    this.paintHUD();
  }
  stageName() {
    return STAGES[this.state.stage - 1]?.name || "Chef";
  }
  renderView() {
    this.scene?.destroy();
    this.scene = null;
    document
      .querySelectorAll('[data-action="nav"]')
      .forEach((n) =>
        n.classList.toggle(
          "active",
          (n as HTMLElement).dataset.view === this.view,
        ),
      );
    const workspace = $("#workspace")!;
    if (this.view === "restaurant") {
      workspace.innerHTML = `<div class="restaurant-layout"><section class="restaurant-main"><div class="view-heading restaurant-heading"><div><div class="eyebrow">O SABOR DE UM NOVO COMEÇO</div><h1>${esc(this.restaurant.name)}</h1><p>${esc(SPECIALIZATIONS.find((s) => s.id === this.restaurant.style)?.name || this.restaurant.style)} · <span id="shift-status"></span></p></div><div id="shift-button"></div></div><div class="scene-frame"><canvas id="restaurant-canvas" tabindex="0" aria-label="Restaurante interativo. Mova com WASD ou setas; E para interagir."></canvas><div class="scene-chapter"><span class="chapter-number">0${this.state.stage}</span><div><small>CAPÍTULO ${this.state.stage}</small><strong>${this.stageName()}</strong></div></div><div class="scene-controls"><span>${icon("kitchen")} Clique nas estações para interagir</span><span>WASD mover · E interagir</span></div><div id="pause-overlay" hidden><strong>Um respiro na cozinha.</strong><button class="button primary" data-action="pause">Continuar ${icon("play")}</button></div></div><div id="tutorial-strip"></div><div class="below-scene"><div class="daily-goal"><span class="round-icon">${icon("career")}</span><div><span class="tiny-label">A CONQUISTA DE HOJE</span><strong id="daily-goal"></strong><span id="daily-progress"></span></div></div><div class="hygiene-chip"><span>${icon("leaf")} Higiene <b id="hygiene-value"></b></span><div id="hygiene-bar"></div><button class="text-button" data-action="clean">Lavar estação ${icon("wash")}</button></div></div><div class="kitchen-notes"><span>${icon("heart")} <span id="latest-review">Cada prato é um convite para voltar.</span></span><button class="text-button" data-action="nav" data-view="reputation">Ver opiniões ${icon("arrow")}</button></div></section><aside class="order-rail"><div class="rail-heading"><div><span class="eyebrow">DA CASA PARA A MESA</span><h2>Comandas <span id="order-count">0</span></h2></div>${icon("menu")}</div><div class="rail-shift" id="rail-shift"></div><div id="order-list"></div><div class="rail-footer">${icon("clock")} O relógio para ao sair da aba.</div></aside></div>`;
      this.scene = new RestaurantScene(
        $("#restaurant-canvas") as HTMLCanvasElement,
        {
          onStation: (station) => this.station(station),
          onCustomer: (id) => this.openCooking(id),
          reducedMotion: this.settings.reducedMotion,
        },
      );
      this.scene.update(this.state);
      this.orderSignature = "";
      this.paintRestaurant();
    } else {
      const meta = NAV.find((n) => n.id === this.view)!;
      workspace.innerHTML = `<section class="management"><div class="view-heading"><div><div class="eyebrow">UMA CARREIRA FEITA À MÃO</div><h1>${meta.label}</h1><p>${this.subtitle()}</p></div><button class="button subtle" data-action="nav" data-view="restaurant">${icon("arrow", "flip")} Voltar à cozinha</button></div><div id="management-content">${this.managementContent()}</div></section>`;
    }
  }
  subtitle() {
    return (
      (
        {
          menu: "Seu jeito de cozinhar. O sabor que fica na memória.",
          stock: "Bons pratos começam muito antes do fogão.",
          staff: "Nenhuma grande cozinha cresce sozinha.",
          finance: "Crescer também é cuidar de cada pequena conta.",
          reputation: "Histórias que os seus clientes levam para casa.",
          career: "De avental novo a um nome que todo mundo conhece.",
          competitions: "O calor da cozinha. A emoção de um novo desafio.",
          upgrades: "Ferramentas melhores. Novas possibilidades.",
        } as Record<string, string>
      )[this.view] || ""
    );
  }
  managementContent() {
    switch (this.view) {
      case "menu":
        return this.menuView();
      case "stock":
        return this.stockView();
      case "staff":
        return this.staffView();
      case "upgrades":
        return this.upgradesView();
      case "finance":
        return this.financeView();
      case "career":
        return this.careerView();
      case "reputation":
        return this.reputationView();
      case "competitions":
        return this.competitionsView();
      default:
        return "";
    }
  }
  menuView() {
    const categories = ["Todos", ...new Set(RECIPES.map((r) => r.category))];
    return `<div class="section-toolbar"><div class="tabs">${categories.map((c) => `<button class="tab ${this.menuFilter === c ? "active" : ""}" data-action="category" data-category="${esc(c)}">${esc(c)}</button>`).join("")}</div><span class="subtle-copy">${this.restaurant.menu.length} pratos no cardápio · Preço afeta a procura</span></div><div class="recipe-grid">${RECIPES.filter(
      (r) => this.menuFilter === "Todos" || r.category === this.menuFilter,
    )
      .map((r) => {
        const unlocked = this.state.unlocked.includes(r.id);
        const enabled = this.restaurant.menu.includes(r.id);
        const price = this.restaurant.prices[r.id] || r.price;
        return `<article class="recipe-card ${!unlocked ? "locked" : ""}"><div class="recipe-art" style="--dish-color:${r.color}">${food(r, 130)}<span class="recipe-level">${unlocked ? `${r.seconds}s · ${"●".repeat(r.difficulty)}` : `CAPÍTULO ${r.unlock}`}</span></div><div class="recipe-body"><span class="tiny-label">${esc(r.category)}</span><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p><div class="recipe-facts"><span>Custo <b>${money(r.cost)}</b></span><span>Potencial <b>${r.potential}</b></span></div><div class="ingredient-line">${Object.entries(
          r.ingredients,
        )
          .map(
            ([id, n]) =>
              `${n} ${esc(INGREDIENTS.find((i) => i.id === id)?.name || id)}`,
          )
          .join(
            " · ",
          )}</div><div class="recipe-controls"><label>Preço <input aria-label="Preço de ${esc(r.name)}" data-price="${r.id}" type="number" min="${r.cost}" max="${r.price * 2}" step="0.1" value="${price}" ${!unlocked ? "disabled" : ""}></label><button class="button ${enabled ? "olive" : "subtle"} small" data-action="menu-toggle" data-id="${r.id}" ${!unlocked ? "disabled" : ""}>${enabled ? icon("check") + " No cardápio" : "Adicionar"}</button></div></div></article>`;
      })
      .join("")}</div>`;
  }
  stockView() {
    const stock = this.restaurant.stock;
    const suppliers = [
      {
        id: "economico",
        name: "Mercado da praça",
        text: "Preço baixo · Qualidade simples",
        tag: "ECONÔMICO",
      },
      {
        id: "horta",
        name: "Horta da Aurora",
        text: "Mais frescor · Qualidade superior",
        tag: "DA ESTAÇÃO",
      },
      {
        id: "expresso",
        name: "Rota do chef",
        text: "Premium · Conservação estendida",
        tag: "SELECIONADO",
      },
    ];
    return `<div class="supplier-row">${suppliers.map((s) => `<button class="supplier ${this.supplier === s.id ? "selected" : ""}" data-action="supplier" data-supplier="${s.id}"><span class="tiny-label">${s.tag}</span><h3>${s.name}</h3><span>${s.text}</span></button>`).join("")}</div><div class="notice-line">${icon("leaf")} Compra entregue na hora. Ingredientes vencem ao passar dos dias; a geladeira prolonga a conservação.</div><div class="stock-grid">${INGREDIENTS.map(
      (i) => {
        const item = stock[i.id];
        return `<article class="stock-item"><span class="ingredient-art" style="--ingredient:${i.color}"><i></i><b></b></span><div><h3>${esc(i.name)}</h3><span>${item?.quantity || 0} un. <span class="dot">·</span> ${item?.quantity ? `Qualidade ${Math.round(item.quality)} <span class="dot">·</span> ${item.expires < this.state.day ? "Vencido" : `Vence dia ${item.expires}`}` : "Prateleira vazia"}</span>${meter(item?.quantity ? Math.max(0, (100 * (item.expires - this.state.day)) / i.shelfLife) : 0, "Frescor")}</div><div class="stock-buy"><strong>${money(supplyCost(this.state, i.id, 1, this.supplier))}<small>/ un.</small></strong><button class="button subtle small" data-action="buy" data-id="${i.id}" data-quantity="5">+ 5</button><button class="button olive small" data-action="buy" data-id="${i.id}" data-quantity="10">+ 10</button></div></article>`;
      },
    ).join("")}</div>`;
  }
  staffView() {
    if (this.state.stage < 2)
      return this.lockedView(
        "Uma equipe começa com uma boa reputação.",
        "A contratação abre no capítulo 2. Cozinhe, sirva bons pratos e acumule experiência para chegar lá.",
        "staff",
      );
    const team = this.state.employees.filter(
      (e) =>
        (e.restaurantId ?? this.state.restaurants[0].id) ===
        this.state.activeRestaurant,
    );
    return `${this.transferPanel()}<div class="section-header"><div><h2>Quem faz a casa funcionar</h2><p>Salários no fechamento. Folga custa 50% da diária; dificuldade ajusta a folha.</p></div><span class="pill">${team.length} na equipe · ${money(team.reduce((s, e) => s + e.wage * (e.active ? 1 : 0.5) * (this.state.difficulty === "casual" ? 0.9 : this.state.difficulty === "especialista" ? 1.15 : 1), 0))} / dia</span></div>${
      team.length
        ? `<div class="team-grid">${team
            .map(
              (e) =>
                `<article class="employee-card"><div class="employee-top"><span class="avatar" style="--avatar:${e.role === "chef" ? "#bb7546" : e.role === "gerente" ? "#6b8090" : "#79946a"}">${icon(e.role === "garcom" ? "menu" : "kitchen")}</span><div><h3>${esc(e.name)}</h3><span>Nível ${e.level} · ${money(e.wage)} / dia</span></div><button class="tag-button ${e.active ? "on" : ""}" data-action="employee-toggle" data-id="${e.id}">${e.active ? "Em escala" : "Folga"}</button></div><label class="role-select">Função <select data-role="${e.id}">${Object.entries(
                  ROLES,
                )
                  .map(
                    ([id, name]) =>
                      `<option value="${id}" ${e.role === id ? "selected" : ""}>${name}</option>`,
                  )
                  .join(
                    "",
                  )}</select></label><div class="task-line"><i class="live-dot"></i>${esc(e.task || "Aguardando a abertura")}</div><div class="employee-metrics"><div>Habilidade <b>${Math.round(e.skill)}</b>${meter(e.skill, "Habilidade")}</div><div>Velocidade <b>${Math.round(e.speed)}</b>${meter(e.speed, "Velocidade")}</div><div>Fadiga <b>${Math.round(e.fatigue)}</b>${meter(e.fatigue, "Fadiga", "fatigue")}</div></div><div class="employee-extra">Higiene ${e.hygiene} · Organização ${e.organization} · Resistência ${e.stress}<br>Experiência ${e.experience} · ${e.served} pratos preparados</div><div class="employee-actions"><button class="button subtle small" data-action="train" data-id="${e.id}">Treinar · ${money(45 + e.level * 10)}</button><button class="button subtle small" data-action="promote" data-id="${e.id}">Promover</button><button class="text-button danger" data-action="fire" data-id="${e.id}">Demitir</button></div></article>`,
            )
            .join("")}</div>`
        : '<div class="empty-inline">Sua primeira contratação vai transformar a rotina da cozinha.</div>'
    }<div class="section-header"><div><h2>Talentos da vizinhança</h2><p>Auxiliares apoiam seu preparo; cozinheiros assumem comandas. Garçons servem; gerentes cuidam de outras unidades.</p></div></div><div class="candidate-grid">${CANDIDATES.filter(
      (c) => !this.state.employees.some((e) => e.id === c.id),
    )
      .map(
        (c) =>
          `<article class="candidate ${c.unlock > this.state.stage ? "locked" : ""}"><div class="candidate-header"><span class="avatar">${icon(c.role === "gerente" ? "finance" : "kitchen")}</span><div><h3>${esc(c.name)}</h3><span>${ROLES[c.role]} · ${money(c.wage)} / dia</span></div></div><p>${esc(c.bio)}</p><div class="candidate-stats"><span>Ritmo <b>${c.speed}</b></span><span>Cozinha <b>${c.skill}</b></span><span>Higiene <b>${c.hygiene}</b></span></div><button class="button olive full" data-action="hire" data-id="${c.id}" ${c.unlock > this.state.stage ? "disabled" : ""}>${c.unlock > this.state.stage ? `Capítulo ${c.unlock}` : "Contratar para esta unidade"}</button></article>`,
      )
      .join("")}</div>`;
  }
  transferPanel() {
    const remote = this.state.employees.filter(
      (e) => (e.restaurantId ?? 1) !== this.state.activeRestaurant,
    );
    if (!remote.length) return "";
    return `<form id="transfer-form" class="transfer-panel"><div><h3>O talento certo, na casa certa.</h3><p>Transfira alguém de outra unidade para ${esc(this.restaurant.name)}.</p></div><select name="employee" aria-label="Funcionário para transferir">${remote.map((e) => `<option value="${e.id}">${esc(e.name)} · ${ROLES[e.role]} · ${esc(this.state.restaurants.find((r) => r.id === (e.restaurantId ?? 1))?.name)}</option>`).join("")}</select><button class="button olive small" ${this.state.phase === "service" ? "disabled" : ""}>Transferir para esta casa</button></form>`;
  }
  upgradesView() {
    return `<div class="upgrade-banner"><div>${icon("upgrade")}<h2>Um pequeno investimento.<br>Uma grande diferença no serviço.</h2></div><p>Melhorias mudam velocidade, capacidade, frescor e consistência dos pratos.</p></div><div class="upgrade-grid">${EQUIPMENT.map(
      (e) => {
        const level = this.restaurant.equipment[e.id] || 0;
        return `<article class="upgrade-card"><span class="equipment-illustration eq-${e.id}">${icon(e.id.includes("geladeira") ? "stock" : e.id.includes("bancada") ? "menu" : e.id.includes("lava") ? "wash" : "kitchen")}<i></i></span><div><span class="tiny-label">${level >= e.max ? "COMPLETO" : `NÍVEL ${level} / ${e.max}`}</span><h3>${esc(e.name)}</h3><p>${esc(e.description)}</p><div class="level-pips">${Array.from({ length: e.max }, (_, i) => `<i class="${i < level ? "filled" : ""}"></i>`).join("")}</div></div><button class="button ${level >= e.max ? "subtle" : "olive"}" data-action="upgrade" data-id="${e.id}" ${level >= e.max || e.unlock > this.state.stage ? "disabled" : ""}>${e.unlock > this.state.stage ? `Capítulo ${e.unlock}` : level >= e.max ? "Instalado" : `${money(equipmentCost(this.restaurant, e.id))} ${icon("arrow")}`}</button></article>`;
      },
    ).join(
      "",
    )}</div><div class="section-header"><div><h2>A casa também tem seu tempero</h2><p>A decoração altera o ambiente e a percepção dos clientes.</p></div></div><div class="decor-row">${[
      { id: "acolhedor", name: "Madeira & afeto", color: "#b6814b" },
      { id: "botanico", name: "Jardim de sabores", color: "#648267" },
      { id: "noturno", name: "Luz de âmbar", color: "#526a77" },
    ]
      .map(
        (d) =>
          `<button class="decor-option ${this.restaurant.decor === d.id ? "selected" : ""}" data-action="decorate" data-id="${d.id}" style="--decor:${d.color}"><span class="decor-preview"><i></i><b></b></span><strong>${d.name}</strong><small>${this.restaurant.decor === d.id ? "Seu ambiente" : money(100)}</small></button>`,
      )
      .join(
        "",
      )}</div><div class="maintenance"><div><h3>Equipamentos bem cuidados, cozinha feliz.</h3><p>Condição atual: ${Math.round(this.restaurant.condition)}%. A manutenção previne falhas e ajuda no ponto dos pratos.</p></div><button class="button subtle" data-action="repair">Fazer manutenção</button></div>`;
  }
  financeView() {
    const ledger = this.state.ledger;
    const income = ledger
      .filter((t) => t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    const expense = -ledger
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + t.amount, 0);
    const cats: Record<string, number> = {};
    ledger
      .filter((t) => t.amount < 0)
      .forEach((t) => (cats[t.category] = (cats[t.category] || 0) - t.amount));
    const reports = this.state.reports.slice(-10);
    const max = Math.max(1, ...reports.map((r) => r.revenue));
    const debt = (this.state as GameState & { debt?: number }).debt || 0;
    return `<div class="finance-overview"><div class="ledger-book"><span class="eyebrow">LIVRO DA CASA</span><h2>O que entra.<br>O que faz crescer.</h2><span class="ledger-rule"></span><div><span>Receitas acumuladas</span><strong>${money(income)}</strong></div><div><span>Despesas acumuladas</span><strong>${money(expense)}</strong></div><div class="ledger-profit"><span>Resultado</span><strong>${money(income - expense)}</strong></div></div><div class="finance-chart"><div class="section-header"><h2>Seu movimento, dia a dia</h2><span class="tiny-label">ÚLTIMOS ${reports.length} DIAS</span></div>${reports.length ? `<div class="bar-chart">${reports.map((r) => `<div class="chart-col"><strong>${money(r.revenue)}</strong><div class="bar-set"><i style="height:${Math.max(3, (r.revenue / max) * 150)}px" title="Receita ${money(r.revenue)}"></i><i class="expense" style="height:${Math.max(3, (r.expenses / max) * 150)}px" title="Despesas ${money(r.expenses)}"></i></div><span>D${r.day}</span></div>`).join("")}</div><div class="chart-legend"><span>Receita</span><span>Despesa</span></div>` : '<div class="empty-inline">O primeiro fechamento inaugura seu histórico.</div>'}</div></div><div class="finance-columns"><article class="paper-panel"><div class="section-header"><h2>Tributos da vila</h2>${icon("menu")}</div><p>Taxa fictícia sobre vendas. Acumula a cada serviço e vence no dia indicado.</p><div class="bill-row"><span>Tributos acumulados</span><strong>${money(this.state.taxes)}</strong></div><div class="bill-row"><span>Pendências operacionais</span><strong>${money(debt)}</strong></div><div class="bill-row"><span>Próximo vencimento</span><strong>Dia ${this.state.taxDue}</strong></div><button class="button olive full" data-action="payTax" ${this.state.taxes + debt <= 0 ? "disabled" : ""}>Pagar tributos e pendências</button></article><article class="paper-panel"><h2>Onde o dinheiro foi</h2>${
      Object.keys(cats).length
        ? Object.entries(cats)
            .sort((a, b) => b[1] - a[1])
            .map(
              ([c, n]) =>
                `<div class="expense-category"><span>${esc(c)}</span><strong>${money(n)}</strong>${meter((n / Math.max(1, expense)) * 100, c)}</div>`,
            )
            .join("")
        : "<p>Ainda não há despesas registradas.</p>"
    }</article><article class="paper-panel"><h2>Sabores que sustentam a casa</h2>${
      Object.entries(this.state.sales)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 6)
        .map(([id, s]) => {
          const r = RECIPES.find((r) => r.id === id);
          return `<div class="best-seller">${food(r, 48)}<span><strong>${esc(r?.name)}</strong><small>${s.count} vendidos · margem estimada ${money(s.revenue - s.count * (r?.cost || 0))}</small></span></div>`;
        })
        .join("") || "<p>O seu primeiro pedido começa esta história.</p>"
    }</article></div><div class="section-header"><h2>Movimentações</h2><span>Mais recentes primeiro</span></div><div class="transaction-list">${
      ledger
        .slice(-35)
        .reverse()
        .map(
          (t) =>
            `<div><span class="transaction-day">D${t.day}</span><span><strong>${esc(t.label)}</strong><small>${esc(t.category)}</small></span><b class="${t.amount >= 0 ? "positive" : "negative"}">${t.amount >= 0 ? "+" : ""}${money(t.amount)}</b></div>`,
        )
        .join("") ||
      '<div class="empty-inline">Seu livro-caixa ainda está em branco.</div>'
    }</div>${this.state.cash < 100 ? `<div class="recovery-box"><div><h3>Uma chance de recomeçar</h3><p>A cooperativa oferece apoio emergencial uma única vez. Reduza o cardápio e opere sem equipe para recuperar sua margem.</p></div><button class="button subtle" data-action="relief" ${this.state.reliefUsed ? "disabled" : ""}>Solicitar apoio</button></div>` : ""}`;
  }
  reputationView() {
    const r = this.restaurant;
    const checklist = inspectionChecklist(this.state);
    return `<div class="reputation-hero"><span class="reputation-number">${(r.reputation / 20).toFixed(1)}<small>/ 5</small></span><div><span class="eyebrow">O BOCA A BOCA DA VIZINHANÇA</span><h2>${r.reputation > 75 ? "Uma mesa disputada." : r.reputation > 45 ? "Um endereço para guardar." : "Toda história começa com um convite."}</h2><p>Qualidade, espera, atendimento, preço e higiene compõem cada avaliação.</p></div></div><div class="reputation-columns"><article class="paper-panel inspection-panel"><div class="section-header"><h2>Vigilância do sabor</h2>${icon("leaf")}</div><p>Próxima visita prevista: dia ${this.state.inspectionDue}. Corrija os itens antes da inspeção.</p>${checklist.map((c) => `<div class="inspection-check"><span class="check-circle ${c.ok ? "good" : "bad"}">${icon(c.ok ? "check" : "close")}</span><span>${esc(c.label)}<small class="check-detail">${esc(c.detail)}</small></span><b>${c.ok ? "Em ordem" : "Corrigir"}</b></div>`).join("")}<div class="inspection-result">${esc(this.state.inspectionResult || "Nenhuma vistoria realizada. As regras são visíveis; o preparo está nas suas mãos.")}</div><div class="button-row"><button class="button olive" data-action="clean">Higienizar</button><button class="button subtle" data-action="inspect">Inspeção voluntária</button></div></article><div class="reviews-list">${
      this.state.reviews
        .slice(0, 12)
        .map(
          (r) =>
            `<article class="review-card"><div><span class="review-avatar">${esc(r.name.charAt(0))}</span><span><strong>${esc(r.name)}</strong><small>Dia ${r.day}</small></span><span class="review-score">${r.score.toFixed(1)} ${icon("career")}</span></div><p>“${esc(r.text)}”</p></article>`,
        )
        .join("") ||
      '<div class="empty-inline">Sirva o primeiro prato e dê aos clientes uma história para contar.</div>'
    }</div></div>`;
  }
  careerView() {
    return `<div class="journey-banner"><span class="eyebrow">A RECEITA É SUA</span><h2>${esc(this.state.careerName)},<br>o próximo capítulo está no forno.</h2><div class="journey-stats"><span><strong>${this.state.servedTotal}</strong> pratos servidos</span><span><strong>${this.state.xp}</strong> experiência</span><span><strong>${this.state.restaurants.length}</strong> estabelecimentos</span></div></div><div class="career-path">${STAGES.map((s, i) => `<div class="career-stop ${this.state.stage > i ? "reached" : ""} ${this.state.stage === i + 1 ? "current" : ""}"><span class="career-number">${this.state.stage > i + 1 ? icon("check") : `0${i + 1}`}</span><div><small>${s.xp} XP</small><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></div>${this.state.stage === i + 1 ? '<span class="pill">Você está aqui</span>' : ""}</div>`).join("")}</div><div class="section-header"><div><h2>Seu próximo endereço</h2><p>Gerentes mantêm outras unidades funcionando. Cada casa conserva cardápio, equipamentos, estoque e resultados próprios.</p></div></div><div class="location-grid">${this.state.restaurants.map((r) => `<article class="paper-panel location-card"><span class="tiny-label">UNIDADE 0${r.id}</span><h3>${esc(r.name)}</h3><p>${esc(SPECIALIZATIONS.find((s) => s.id === r.style)?.name || r.style)}</p><div class="location-facts"><span>Faturamento <b>${money(r.revenue)}</b></span><span>Resultado <b>${money(r.profit)}</b></span><span>Pratos servidos <b>${r.served}</b></span><span>Responsável <b>${esc(this.state.employees.find((e) => e.id === r.managerId)?.name || "Você")}</b></span></div><button class="button ${r.id === this.state.activeRestaurant ? "subtle" : "olive"} full" data-action="switch" data-id="${r.id}" ${r.id === this.state.activeRestaurant ? "disabled" : ""}>${r.id === this.state.activeRestaurant ? "Você está aqui" : "Visitar unidade"}</button></article>`).join("")}<form class="paper-panel expansion-form" id="expansion-form"><span class="tiny-label">CAPÍTULO 5 · EXPANSÃO</span><h3>Mais uma porta aberta</h3><label>Nome da nova casa<input name="restaurantName" maxlength="32" placeholder="Seu novo restaurante" required ${this.state.stage < 5 ? "disabled" : ""}></label><label>Especialização<select name="style" ${this.state.stage < 5 ? "disabled" : ""}>${SPECIALIZATIONS.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></label><button class="button primary full" ${this.state.stage < 5 ? "disabled" : ""}>${this.state.stage < 5 ? "Disponível no capítulo 5" : `Abrir unidade · ${money(850 + (this.state.restaurants.length - 1) * 350)}`}</button></form></div><div class="section-header"><h2>Marcas da sua história</h2><span>${this.state.achievements.length} conquistas</span></div><div class="achievement-grid">${ACHIEVEMENTS.map((a) => `<div class="achievement ${this.state.achievements.includes(a.id) ? "earned" : ""}"><span>${icon("trophy")}</span><div><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p></div>${this.state.achievements.includes(a.id) ? icon("check") : ""}</div>`).join("")}</div>`;
  }
  competitionsView() {
    if (this.state.stage < 3)
      return this.lockedView(
        "O seu talento merece um palco.",
        "No capítulo 3, a Copa Panela de Cobre abre as portas. Pratique seus gestos e refine seu cardápio.",
        "trophy",
      );
    const c = this.state.competition;
    return `<div class="competition-poster"><div class="poster-ornament">${icon("trophy")}</div><span class="eyebrow">UM ENCONTRO DE TALENTOS DA VILA</span><h2>Copa Panela<br><em>de Cobre</em></h2><p>Três rodadas. Um prato escolhido pela banca. A sua assinatura.</p><div class="competition-rounds"><span>01 <b>Classificatória</b><small>Qualidade 58+</small></span><i></i><span>02 <b>Semifinal</b><small>Qualidade 68+</small></span><i></i><span>03 <b>Grande final</b><small>Qualidade 78+</small></span></div><p class="competition-reward">Inscrição R$ 35 · Ingredientes fornecidos · Prêmio inicial R$ 250 + experiência</p>${c.active ? `<button class="button primary large" data-action="competition-play">Cozinhar rodada ${c.round + 1} ${icon("arrow")}</button><button class="text-button light" data-action="competition-withdraw">Sair da competição</button>` : `<button class="button primary large" data-action="competition-enter" ${this.state.phase === "service" ? "disabled" : ""}>Inscrever-se ${icon("arrow")}</button>${this.state.phase === "service" ? "<small>Encerre o serviço para competir com calma.</small>" : ""}`}<span class="competition-wins">${c.wins} títulos conquistados</span></div><div class="paper-panel competition-guide"><h2>Um desafio diferente do serviço</h2><p>Prepare o prato com os mesmos gestos da cozinha. Cada rodada eleva a qualidade exigida. Aqui não há clientes esperando: capriche na precisão. Sua apresentação conta tanto quanto o ponto.</p>${c.scores.length ? `<div class="score-row">${c.scores.map((s, i) => `<span>Rodada ${i + 1}<strong>${Math.round(s)}</strong></span>`).join("")}</div>` : ""}</div>`;
  }
  lockedView(title: string, text: string, mark: string) {
    return `<div class="locked-feature"><span>${icon(mark)}</span><h2>${title}</h2><p>${text}</p><button class="button olive" data-action="nav" data-view="restaurant">Voltar ao fogão ${icon("arrow")}</button></div>`;
  }
  paintHUD() {
    if (!this.engine) return;
    const s = this.state,
      r = this.restaurant;
    if (s.servedTotal > this.lastServedCount) this.audio.play("serve");
    this.lastServedCount = s.servedTotal;
    if (s.achievements.length > this.lastAchievementCount)
      this.audio.play("achievement");
    this.lastAchievementCount = s.achievements.length;
    const reviewKey = JSON.stringify(s.reviews[0] || null);
    if (reviewKey !== this.lastReviewKey && s.reviews[0])
      this.audio.play("review");
    this.lastReviewKey = reviewKey;
    const text = (id: string, value: string) => {
      const el = $(id);
      if (el) el.textContent = value;
    };
    text("#hud-day", `DIA ${s.day}`);
    text("#hud-cash", money(s.cash));
    text("#hud-rep", `${(r.reputation / 20).toFixed(1)} / 5`);
    const time = 11 * 60 + Math.min(s.elapsed / s.duration, 1) * 180;
    text(
      "#hud-time",
      s.phase === "service"
        ? `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(Math.floor(time % 60)).padStart(2, "0")}`
        : s.phase === "summary"
          ? "Serviço encerrado"
          : "Antes de abrir",
    );
    text("#sidebar-stage", this.stageName());
    text("#speed-button", `${s.speed}×`);
    const pause = $("#pause-button");
    if (pause) {
      pause.innerHTML = icon(s.paused ? "play" : "pause");
      pause.setAttribute("aria-label", s.paused ? "Continuar" : "Pausar");
    }
    if (this.view === "restaurant") this.paintRestaurant();
    if (s.event && !this.modal) this.showEvent();
    const notice = s.notices.at(-1);
    if (notice && notice !== this.lastNotice) {
      this.lastNotice = notice;
      this.toast(notice);
    }
    if (s.phase !== this.lastPhase) {
      this.lastPhase = s.phase;
      if (s.phase === "summary") {
        this.save(false);
        if (!this.modal) this.showSummary();
      }
    }
  }
  paintRestaurant() {
    if (!this.engine || !$("#order-list")) return;
    const s = this.state,
      r = this.restaurant;
    $("#shift-status")!.textContent =
      s.phase === "service"
        ? "Almoço em movimento"
        : s.phase === "summary"
          ? "Mais uma história servida"
          : "Prepare a casa para o almoço";
    const shiftKey = `${s.phase}|${Math.floor(s.elapsed) >= 45}|${!!r.closed}`;
    const shift = $("#shift-button")!;
    if (shift.dataset.key !== shiftKey) {
      shift.dataset.key = shiftKey;
      shift.innerHTML =
        s.phase === "service"
          ? `<button class="button subtle" data-action="close" ${s.elapsed < 45 ? "disabled" : ""}>Encerrar serviço</button>`
          : s.phase === "summary"
            ? '<button class="button primary" data-action="summary">Ver fechamento</button>'
            : `<button class="button primary" data-action="open">${icon("play")} Abrir restaurante</button>`;
    }
    const overlay = $("#pause-overlay");
    if (overlay) overlay.hidden = !s.paused;
    $("#rail-shift")!.innerHTML =
      `<span>${s.phase === "service" ? (s.elapsed / s.duration > 0.35 && s.elapsed / s.duration < 0.7 ? "HORÁRIO DE PICO" : "SERVIÇO DE ALMOÇO") : "SUA PRÓXIMA GRANDE IDEIA"}</span><b>${s.daily.served} pratos servidos</b>${meter((s.elapsed / s.duration) * 100, "Progresso do serviço")}`;
    $("#hygiene-value")!.textContent = `${Math.round(r.cleanliness)}%`;
    $("#hygiene-bar")!.innerHTML = meter(r.cleanliness, "Higiene");
    const target = s.day === 1 ? 3 : Math.min(12, 3 + s.stage * 2);
    $("#daily-goal")!.textContent = `Sirva ${target} pratos com o seu toque.`;
    $("#daily-progress")!.textContent =
      `${Math.min(target, s.daily.served)} de ${target} · Cada pedido constrói sua experiência`;
    const review = s.reviews[0];
    if (review)
      $("#latest-review")!.textContent = `“${review.text}” — ${review.name}`;
    $("#order-count")!.textContent = String(r.orders.length);
    const signature = JSON.stringify(
      r.orders.map((o) => [
        o.id,
        o.status,
        Math.ceil(o.patience / 2),
        Math.floor(o.progress * 20),
        o.stepIndex,
      ]),
    );
    if (this.orderSignature !== signature) {
      this.orderSignature = signature;
      $("#order-list")!.innerHTML = r.orders.length
        ? r.orders
            .map((o, i) => {
              const recipe = RECIPES.find((r) => r.id === o.recipeId)!;
              const ratio = o.patience / o.maxPatience;
              return `<article class="order-ticket ${o.status === "ready" ? "ready" : ""}"><div class="ticket-top"><span>COMANDA ${String(o.id).padStart(3, "0")}</span><span>${o.profile === "Crítico" ? "CONVIDADO ESPECIAL" : esc(o.profile)}</span></div><div class="ticket-dish">${food(recipe, 72)}<div><h3>${esc(recipe.name)}</h3><span>${esc(o.customer)} · ${money(r.prices[o.recipeId] || recipe.price)}</span></div></div><div class="patience-line"><span>${icon("clock")} ${o.status === "auto" ? esc(s.employees.find((e) => e.id === o.assigned)?.name || "Equipe preparando") : o.status === "manual" ? "Seu toque na cozinha" : o.status === "ready" ? "Pronto para ir à mesa" : ratio > 0.55 ? "Sem pressa. Capriche." : ratio > 0.25 ? "O cliente está esperando." : "Últimos instantes!"}</span><b>${Math.ceil(o.patience)}s</b></div>${meter(o.status === "auto" ? o.progress * 100 : ratio * 100, "Paciência", ratio < 0.3 ? "warning" : "")}<button class="button ${o.status === "ready" ? "primary" : "olive"} full" data-action="${o.status === "ready" ? "serve" : "prepare"}" data-id="${o.id}">${o.status === "ready" ? `Servir prato ${icon("arrow")}` : o.status === "manual" ? `Continuar preparo · ${o.stepIndex + 1}/${recipe.steps.length}` : o.status === "auto" ? "Assumir este preparo" : "Preparar " + (i === 0 ? "[1]" : "")}</button></article>`;
            })
            .join("")
        : `<div class="empty-orders"><span>${icon("menu")}</span><h3>${s.phase === "service" ? "Um breve respiro." : "Tudo começa com a primeira comanda."}</h3><p>${s.phase === "service" ? "Os próximos clientes já estão a caminho. Aproveite para limpar sua estação." : "Confira o cardápio e o estoque, depois abra as portas."}</p><div class="dashed-line"></div><small>DA COZINHA, COM CARINHO.</small></div>`;
    }
    const tips = [
      "Seu primeiro serviço: abra o restaurante e escolha uma comanda.",
      "Corte, misture e cuide do ponto. Cada etapa tem seu próprio gesto.",
      "Prato pronto? Sirva antes que o cliente perca a paciência.",
    ];
    const tutorial = $("#tutorial-strip")!;
    const tipIndex = Math.min(2, s.tutorial);
    const key = String(tipIndex) + (s.settings.showTips && s.servedTotal < 4);
    if (tutorial.dataset.key !== key) {
      tutorial.dataset.key = key;
      tutorial.innerHTML =
        s.settings.showTips && s.servedTotal < 4
          ? `<div class="tutorial-tip"><span class="tip-index">${tipIndex + 1}/3</span><span>${tips[tipIndex]}</span><button class="text-button" data-action="tip">${tipIndex < 2 ? "Próxima dica" : "Entendi"} ${icon("arrow")}</button></div>`
          : "";
    }
  }
  execute(command: Command, refresh = true) {
    if (!this.engine) return false;
    const result = this.engine.execute(command);
    if (result.message) this.toast(result.message, !result.ok);
    if (result.ok) {
      const type = command.type;
      this.audio.play(
        ["buy", "upgrade", "hire", "decorate", "expand"].includes(type)
          ? "buy"
          : type === "serve"
            ? "money"
            : type === "clean"
              ? "water"
              : "click",
      );
      this.save(false);
      this.paintHUD();
      if (refresh && this.view !== "restaurant") this.renderView();
      if (type === "nextDay" || type === "switch" || type === "expand")
        this.shell();
    }
    return result.ok;
  }
  station(station: string) {
    if (this.modal) return;
    this.audio.unlock();
    if (station === "sink") {
      this.clean();
      return;
    }
    if (station === "stock") {
      this.navigate("stock");
      return;
    }
    if (station === "menu") {
      this.navigate("menu");
      return;
    }
    if (station === "staff") {
      this.navigate("staff");
      return;
    }
    const order =
      this.restaurant.orders.find((o) => o.status === "manual") ||
      this.restaurant.orders.find((o) => o.status === "waiting");
    if (order) this.openCooking(order.id);
    else this.toast("Escolha uma comanda quando os clientes chegarem.");
  }
  navigate(view: View) {
    this.view = view;
    this.renderView();
    this.paintHUD();
  }
  openCooking(id: number) {
    if (!this.engine || (this.modal && this.modal !== "cooking")) return;
    const order = this.restaurant.orders.find((o) => o.id === id);
    if (!order) return;
    this.state.speed = 1;
    if (order.status === "ready") {
      this.execute({ type: "serve", orderId: id });
      return;
    }
    if (
      (order.status === "waiting" || order.status === "auto") &&
      !this.execute({ type: "prepare", orderId: id }, false)
    )
      return;
    this.manualId = id;
    this.modal = "cooking";
    this.state.tutorial = Math.max(1, this.state.tutorial);
    this.cookingStep();
  }
  cookingStep() {
    this.cooking?.destroy();
    this.cooking = null;
    const order = this.restaurant.orders.find((o) => o.id === this.manualId);
    if (!order) {
      this.closeModal();
      this.toast("Esta comanda saiu da fila.");
      return;
    }
    const recipe = RECIPES.find((r) => r.id === order.recipeId)!;
    if (order.status === "ready") {
      const q = Math.round(order.quality);
      $("#modal-layer")!.innerHTML =
        `<div class="modal-backdrop cooking-backdrop"><section class="modal dish-finished"><span class="eyebrow">PRONTO PARA ENCANTAR</span>${food(recipe, 180)}<h2>${esc(recipe.name)}</h2><div class="quality-badge">${q}<small>QUALIDADE</small></div><p>${q >= 80 ? "No ponto, com a sua assinatura." : q >= 55 ? "Um bom prato. A prática traz o próximo tempero." : "Há espaço para melhorar. Observe o retorno do cliente."}</p><div class="score-breakdown">${recipe.steps.map((s, i) => `<span>${esc(s.label)}<b>${Math.round(order.scores[i] || 0)}</b></span>`).join("")}<span>Ingredientes<b>${Math.round(order.ingredientQuality)}</b></span><span>Higiene<b>${Math.round(this.restaurant.cleanliness)}</b></span></div><button class="button primary large full" data-action="serve-finished" data-id="${order.id}">Levar à mesa ${icon("arrow")}</button><button class="text-button" data-action="close-modal">Voltar à cozinha</button></section></div>`;
      this.audio.play("oven");
      this.state.tutorial = 2;
      return;
    }
    $("#modal-layer")!.innerHTML =
      `<div class="modal-backdrop cooking-backdrop"><section class="modal cooking-modal" aria-label="Preparar ${esc(recipe.name)}"><div class="cooking-heading"><div><span class="eyebrow">COMANDA ${String(order.id).padStart(3, "0")} · SEU TOQUE FAZ A DIFERENÇA</span><h2>${esc(recipe.name)}</h2></div><button class="icon-button" data-action="close-modal" title="Voltar (seu preparo será preservado)">${icon("close")}</button></div><div class="step-track">${recipe.steps.map((s, i) => `<span class="${i < order.stepIndex ? "done" : i === order.stepIndex ? "current" : ""}"><b>${i < order.stepIndex ? icon("check") : i + 1}</b>${esc(s.label)}</span>`).join("")}</div><div id="cooking-game"></div><div class="cooking-footer"><span>${icon("clock")} O serviço continua. Cada gesto conta.</span><button class="text-button" data-action="close-modal">Guardar preparo e voltar</button></div></section></div>`;
    const expectedStep = order.stepIndex;
    this.cooking = new CookingGame($("#cooking-game")!, {
      recipe,
      stepIndex: expectedStep,
      equipment:
        this.restaurant.equipment[
          recipe.steps[order.stepIndex]?.action === "bake"
            ? "forno"
            : recipe.steps[order.stepIndex]?.action === "grill"
              ? recipe.equipment || "fogao"
              : "bancada"
        ] || 0,
      reducedMotion: this.settings.reducedMotion,
      onSound: (name) => this.audio.play(name),
      onComplete: (score) => {
        if (this.manualId !== order.id) return;
        const ok = this.execute(
          { type: "step", orderId: order.id, score, stepIndex: expectedStep },
          false,
        );
        if (ok)
          window.setTimeout(() => {
            if (this.modal === "cooking") this.cookingStep();
          }, 160);
      },
    });
  }
  clean() {
    if (!this.engine) return;
    if (this.state.phase === "summary") {
      this.toast("Avance para o próximo dia para preparar a casa.");
      return;
    }
    this.modal = "cleaning";
    $("#modal-layer")!.innerHTML =
      `<div class="modal-backdrop cooking-backdrop"><section class="modal cooking-modal"><div class="cooking-heading"><div><span class="eyebrow">CUIDAR TAMBÉM É COZINHAR</span><h2>Uma estação brilhando</h2></div><button class="icon-button" data-action="close-modal" title="Fechar">${icon("close")}</button></div><div id="cooking-game"></div></section></div>`;
    const recipe: Recipe = {
      id: "limpeza",
      name: "Higienizar bancada",
      category: "Limpeza",
      description: "",
      color: "#adbfaa",
      ingredients: {},
      steps: [
        {
          action: "wash",
          label: "Higienizar",
          hint: "Esfregue as manchas com movimentos do mouse.",
        },
      ],
      price: 0,
      cost: 0,
      difficulty: 1,
      unlock: 1,
      seconds: 5,
      potential: 100,
    };
    this.cooking = new CookingGame($("#cooking-game")!, {
      recipe,
      stepIndex: 0,
      equipment: this.restaurant.equipment.lava_loucas || 0,
      reducedMotion: this.settings.reducedMotion,
      onSound: (n) => this.audio.play(n),
      onComplete: () => {
        this.closeModal();
        this.execute({ type: "clean" });
      },
    });
  }
  competitionPlay() {
    const c = this.state.competition;
    if (!c.active) return;
    this.competitionStep = 0;
    this.competitionScores = [];
    this.lastCompetitionScore = null;
    this.modal = "competition";
    this.competitionCooking();
  }
  competitionCooking() {
    this.cooking?.destroy();
    this.cooking = null;
    const c = this.state.competition,
      recipe =
        RECIPES.find((r) => r.id === c.recipeId) ||
        RECIPES.find((r) => this.state.unlocked.includes(r.id))!;
    if (this.competitionStep >= recipe.steps.length) {
      const score =
        this.competitionScores.reduce((a, b) => a + b, 0) /
        this.competitionScores.length;
      const previousWins = this.state.competition.wins;
      this.execute(
        { type: "competitionScore", scores: this.competitionScores },
        false,
      );
      this.lastCompetitionScore = score;
      $("#modal-layer")!.innerHTML =
        `<div class="modal-backdrop"><section class="modal dish-finished"><span class="eyebrow">O VEREDITO DA BANCADA</span>${icon("trophy", "trophy-large")}<h2>${Math.round(score)} pontos</h2><p>${this.state.competition.active ? "Você passou! A próxima rodada espera pela sua assinatura." : this.state.competition.wins > previousWins ? "A Panela de Cobre tem um novo nome gravado." : "Uma boa disputa. A cozinha sempre oferece outra chance."}</p><button class="button primary full" data-action="competition-result">${this.state.competition.active ? "Próxima rodada" : "Voltar à carreira"} ${icon("arrow")}</button></section></div>`;
      this.audio.play("achievement");
      return;
    }
    $("#modal-layer")!.innerHTML =
      `<div class="modal-backdrop cooking-backdrop"><section class="modal cooking-modal"><div class="cooking-heading"><div><span class="eyebrow">COPA PANELA DE COBRE · RODADA ${c.round + 1}/3</span><h2>${esc(recipe.name)}</h2></div><button class="icon-button" data-action="close-modal" title="Voltar à competição">${icon("close")}</button></div><div class="competition-step-label">Etapa ${this.competitionStep + 1} de ${recipe.steps.length} · Meta da rodada: ${58 + c.round * 10}</div><div id="cooking-game"></div></section></div>`;
    this.cooking = new CookingGame($("#cooking-game")!, {
      recipe,
      stepIndex: this.competitionStep,
      equipment: 0,
      reducedMotion: this.settings.reducedMotion,
      onSound: (n) => this.audio.play(n),
      onComplete: (score) => {
        this.competitionScores.push(score);
        this.competitionStep++;
        setTimeout(() => {
          if (this.modal === "competition") this.competitionCooking();
        }, 120);
      },
    });
  }
  showInspection() {
    const checks = inspectionChecklist(this.state);
    const render = (current: number, finished = false) =>
      `<span class="eyebrow">VIGILÂNCIA DO SABOR · DIA ${this.state.day}</span><h2>Uma visita à casa.</h2><p>O fiscal percorre as estações. Cada critério segue as regras do relatório sanitário.</p><div class="inspection-sequence">${checks.map((c, i) => `<div class="inspection-check ${i > current ? "pending" : ""}"><span class="check-circle ${i <= current ? (c.ok ? "good" : "bad") : ""}">${icon(i <= current ? (c.ok ? "check" : "close") : "clock")}</span><span>${esc(c.label)}<small class="check-detail">${i <= current ? esc(c.detail) : "Aguardando verificação"}</small></span></div>`).join("")}</div>${finished ? `<div class="inspection-result">${esc(this.state.inspectionResult)}</div><button class="button olive full" data-action="close-modal">Cuidar da casa ${icon("arrow")}</button>` : `<p class="inspector-walking">Verificando ${esc(checks[Math.min(current + 1, checks.length - 1)].label.toLowerCase())}…</p>`}`;
    this.showModal("inspection", render(-1));
    let current = -1;
    const advance = () => {
      if (this.modal !== "inspection") return;
      current++;
      if (current === checks.length) {
        this.execute({ type: "inspect" }, false);
        this.showModal("inspection", render(current, true));
        return;
      }
      this.showModal("inspection", render(current));
      this.inspectionTimer = window.setTimeout(
        advance,
        this.settings.reducedMotion ? 70 : 420,
      );
    };
    this.inspectionTimer = window.setTimeout(advance, 300);
  }
  showModal(name: string, html: string, wide = false) {
    this.cooking?.destroy();
    this.cooking = null;
    this.modal = name;
    $("#modal-layer")!.innerHTML =
      `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true"><button class="icon-button modal-close" data-action="close-modal" title="Fechar">${icon("close")}</button>${html}</section></div>`;
    setTimeout(() => $("#modal-layer input")?.focus(), 30);
  }
  closeModal() {
    clearTimeout(this.inspectionTimer);
    this.cooking?.destroy();
    this.cooking = null;
    this.modal = "";
    this.manualId = null;
    const layer = $("#modal-layer");
    if (layer) layer.innerHTML = "";
    if (this.engine) {
      this.paintHUD();
      if (this.state.phase === "summary" && !this.modal) this.showSummary();
    }
  }
  showSettings() {
    this.showModal(
      "settings",
      `<span class="eyebrow">DO SEU JEITO</span><h2>Configurações</h2><p>A trilha e todos os efeitos são sintetizados no próprio jogo.</p><label class="range-label">Música <output id="music-output">${Math.round(this.settings.music * 100)}%</output><input id="music-setting" aria-label="Volume da música" type="range" min="0" max="1" step=".05" value="${this.settings.music}"></label><label class="range-label">Efeitos <output id="effects-output">${Math.round(this.settings.effects * 100)}%</output><input id="effects-setting" aria-label="Volume dos efeitos" type="range" min="0" max="1" step=".05" value="${this.settings.effects}"></label><label class="check-label"><input id="motion-setting" type="checkbox" ${this.settings.reducedMotion ? "checked" : ""}> Reduzir movimentos decorativos</label><label class="check-label"><input id="tips-setting" type="checkbox" ${this.settings.showTips ? "checked" : ""}> Mostrar dicas iniciais</label>${this.engine ? `<div class="settings-save"><button class="button olive" data-action="save">${icon("save")} Salvar carreira</button><button class="button subtle" data-action="export">${icon("download")} Exportar cópia</button></div>` : ""}<p class="local-notice">O progresso fica neste navegador. Exporte uma cópia para guardá-lo antes de apagar os dados do navegador.</p>`,
    );
  }
  showNew() {
    this.showModal(
      "new",
      `<span class="eyebrow">A SUA PRIMEIRA PÁGINA</span><h2>Vista o avental.</h2><p>Uma cozinha pequena, alguns ingredientes e uma história inteira pela frente.</p><form id="career-form"><label class="form-label">Como devemos chamar você?<input name="chefName" maxlength="24" value="Chef Dorvim" required autocomplete="off"></label><fieldset class="difficulty-options"><legend>Seu ritmo</legend><label><input type="radio" name="difficulty" value="casual"><strong>Casual</strong><span>Clientes pacientes, custos menores.</span></label><label><input type="radio" name="difficulty" value="normal" checked><strong>Normal</strong><span>Uma pitada de cada desafio.</span></label><label><input type="radio" name="difficulty" value="especialista"><strong>Especialista</strong><span>Margens justas, ritmo exigente.</span></label></fieldset>${hasCareer() ? '<p class="inline-warning">Uma nova carreira substitui o progresso local. Exporte sua carreira antes, se quiser guardá-la.</p>' : ""}<button class="button primary full large">Minha história começa aqui ${icon("arrow")}</button></form>`,
    );
  }
  showSummary() {
    this.cooking?.destroy();
    this.cooking = null;
    const report = this.state.reports.at(-1);
    if (!report) return;
    this.showModal(
      "summary",
      `<span class="eyebrow">FECHAMOS POR HOJE · DIA ${report.day}</span><h2>Mais um dia.<br>Mais um passo.</h2><div class="summary-score"><strong>${report.served}</strong><span>pratos com a sua história</span></div><div class="summary-grid"><span>Receitas do dia<b>${money(report.revenue)}</b></span><span>Despesas<b>${money(report.expenses)}</b></span><span>Resultado<b class="${report.revenue - report.expenses >= 0 ? "positive" : "negative"}">${money(report.revenue - report.expenses)}</b></span><span>Qualidade média<b>${Math.round(report.quality)} / 100</b></span><span>Gorjetas<b>${money(report.tips)}</b></span><span>Clientes que saíram<b>${report.lost}</b></span></div>${report.inspection ? `<div class="notice-line">${icon("leaf")} ${esc(report.inspection)}</div>` : ""}<div class="summary-progress"><span>${this.stageName()} · ${this.state.xp} XP</span>${meter(this.stageProgress(), "Experiência da carreira")}</div><button class="button primary large full" data-action="nextDay">Preparar o dia ${this.state.day + 1} ${icon("arrow")}</button><button class="text-button" data-action="summary-dismiss">Consultar a casa antes de avançar</button>`,
    );
  }
  stageProgress() {
    const current = STAGES[this.state.stage - 1]?.xp || 0,
      next = STAGES[this.state.stage]?.xp;
    return next ? ((this.state.xp - current) / (next - current)) * 100 : 100;
  }
  showEvent() {
    const e = this.state.event;
    if (!e) return;
    this.showModal(
      "event",
      `<span class="eyebrow">ALGO NOVO NA VIZINHANÇA</span>${icon("sun", "event-symbol")}<h2>${esc(e.title)}</h2><p>${esc(e.text)}</p><div class="event-choices">${e.choices.map((c, i) => `<button class="button subtle full" data-action="event" data-choice="${i}">${esc(c.label)} ${icon("arrow")}</button>`).join("")}</div>`,
    );
    this.audio.play("event");
  }
  showLoad() {
    this.showModal(
      "load",
      `<span class="eyebrow">UMA HISTÓRIA PARA RETOMAR</span><h2>Carregar carreira</h2><p>Retome o progresso deste navegador ou importe uma cópia exportada.</p><button class="button olive full large" data-action="continue" ${!hasCareer() ? "disabled" : ""}>${icon("save")} Carreira deste navegador</button><button class="button subtle full large" data-action="import">${icon("download")} Importar arquivo de carreira</button><p class="local-notice">Uma cópia de recuperação local é mantida automaticamente. Importar substitui o progresso atual após validar o arquivo.</p>`,
    );
  }
  showCredits() {
    this.showModal(
      "credits",
      `<span class="eyebrow">FEITO NO CALOR DA COZINHA</span><h2>Dorvim Kitchen</h2><p>Um simulador de carreira gastronômica da coleção Dorvim. Arte vetorial, cenário e áudio originais gerados pelo código. Sem serviços online ou recursos de terceiros durante o jogo.</p><div class="controls-list"><span>WASD / setas<b>Mover o chef</b></span><span>E<b>Usar estação próxima</b></span><span>1<b>Preparar primeira comanda</b></span><span>Espaço<b>Pausar / continuar</b></span><span>Esc<b>Voltar da interação</b></span><span>Ctrl / Cmd + S<b>Salvar carreira</b></span></div><p>Nas estações, siga as instruções para mouse ou teclado. A cozinha continua em movimento enquanto você prepara um prato.</p><small class="local-notice">Versão 1.0 · Salvamento v2 · Funciona offline após baixar a distribuição.</small>`,
    );
  }
  save(feedback = true) {
    if (!this.engine) return;
    const result = saveCareer(this.state);
    this.savedText = result.ok ? "Salvo neste navegador" : "Falha ao salvar";
    const label = $("#save-label");
    if (label) label.textContent = this.savedText;
    if (feedback) this.toast(result.message, !result.ok);
    if (!result.ok && !feedback) this.toast(result.message, true);
  }
  toast(message: string, error = false) {
    const layer = $("#toasts");
    if (!layer) return;
    const toast = document.createElement("div");
    toast.className = `toast ${error ? "error" : ""}`;
    toast.innerHTML = `${icon(error ? "close" : "check")}<span>${esc(message)}</span>`;
    layer.append(toast);
    while (layer.children.length > 3) layer.firstElementChild?.remove();
    setTimeout(() => toast.remove(), 4500);
  }
  click(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-action]",
    );
    if (!button || button.hasAttribute("disabled")) return;
    event.preventDefault();
    this.audio.unlock();
    this.audio.play("click");
    const action = button.dataset.action!,
      id = button.dataset.id || "";
    switch (action) {
      case "new":
        this.showNew();
        break;
      case "continue": {
        const result = loadCareer();
        if (result.state) {
          this.closeModal();
          this.start(result.state);
          if (result.recovered) this.toast(result.message);
        } else this.toast(result.message, true);
        break;
      }
      case "home":
        if (this.engine) {
          this.save(false);
          this.showModal(
            "home",
            `<span class="eyebrow">GUARDAR O AVENTAL</span><h2>Um descanso merecido.</h2><p>Seu progresso foi salvo neste navegador.</p><button class="button primary full large" data-action="return-title">Voltar ao menu inicial</button><button class="button subtle full" data-action="close-modal">Continuar na cozinha</button>`,
          );
        }
        break;
      case "return-title":
        this.title();
        break;
      case "load":
        this.showLoad();
        break;
      case "credits":
        this.showCredits();
        break;
      case "settings":
        this.showSettings();
        break;
      case "close-modal":
        this.closeModal();
        break;
      case "nav":
        this.navigate(button.dataset.view as View);
        break;
      case "save":
        this.save();
        break;
      case "export":
        if (this.engine) {
          const url = URL.createObjectURL(
            new Blob([exportCareer(this.state)], { type: "application/json" }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = `dorvim-kitchen-dia-${this.state.day}.json`;
          a.click();
          URL.revokeObjectURL(url);
          this.toast("Cópia de carreira exportada.");
        }
        break;
      case "import":
        $("#import-file")?.click();
        break;
      case "pause":
        if (this.engine) {
          this.state.paused = !this.state.paused;
          this.paintHUD();
        }
        break;
      case "speed":
        if (this.engine) {
          this.state.speed = this.state.speed === 1 ? 2 : 1;
          this.paintHUD();
        }
        break;
      case "open":
        this.execute({ type: "open" });
        break;
      case "close":
        this.execute({ type: "close" });
        break;
      case "nextDay":
        this.modal = "";
        $("#modal-layer")!.innerHTML = "";
        this.execute({ type: "nextDay" });
        break;
      case "summary":
        this.showSummary();
        break;
      case "summary-dismiss":
        this.modal = "";
        $("#modal-layer")!.innerHTML = "";
        break;
      case "prepare":
        this.openCooking(Number(id));
        break;
      case "serve":
        this.execute({ type: "serve", orderId: Number(id) });
        break;
      case "serve-finished":
        this.modal = "";
        this.manualId = null;
        $("#modal-layer")!.innerHTML = "";
        this.execute({ type: "serve", orderId: Number(id) });
        break;
      case "clean":
        this.clean();
        break;
      case "tip":
        this.state.tutorial++;
        if (this.state.tutorial > 2)
          this.settings.showTips = this.state.settings.showTips = false;
        this.paintHUD();
        break;
      case "category":
        this.menuFilter = button.dataset.category || "Todos";
        this.renderView();
        break;
      case "supplier":
        this.supplier = button.dataset.supplier as typeof this.supplier;
        this.renderView();
        break;
      case "buy":
        this.execute({
          type: "buy",
          ingredientId: id,
          quantity: Number(button.dataset.quantity),
          supplier: this.supplier,
        });
        break;
      case "hire":
        this.execute({ type: "hire", candidateId: id });
        break;
      case "fire":
      case "train":
      case "promote":
        this.execute({ type: action, employeeId: id });
        break;
      case "employee-toggle":
        this.execute({ type: "toggleEmployee", employeeId: id });
        break;
      case "upgrade":
        this.execute({ type: "upgrade", equipmentId: id });
        break;
      case "decorate":
        this.execute({ type: "decorate", decor: id });
        break;
      case "inspect":
        this.showInspection();
        break;
      case "repair":
      case "payTax":
      case "relief":
        this.execute({ type: action });
        break;
      case "menu-toggle":
        this.execute({
          type: "menu",
          recipeId: id,
          enabled: !this.restaurant.menu.includes(id),
        });
        break;
      case "switch":
        this.execute({ type: "switch", restaurantId: Number(id) });
        break;
      case "competition-enter":
        if (this.execute({ type: "competition", action: "enter" }))
          this.competitionPlay();
        break;
      case "competition-play":
        this.competitionPlay();
        break;
      case "competition-withdraw":
        this.execute({ type: "competition", action: "withdraw" });
        break;
      case "competition-result":
        this.closeModal();
        this.renderView();
        if (this.state.competition.active) this.competitionPlay();
        break;
      case "event":
        this.modal = "";
        $("#modal-layer")!.innerHTML = "";
        this.execute({ type: "event", choice: Number(button.dataset.choice) });
        break;
    }
  }
  async change(event: Event) {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (input.id === "restaurant-select") {
      this.execute({ type: "switch", restaurantId: Number(input.value) });
      return;
    }
    if (input.dataset.price) {
      this.execute({
        type: "price",
        recipeId: input.dataset.price,
        price: Number(input.value),
      });
      return;
    }
    if (input.dataset.role) {
      this.execute({
        type: "assign",
        employeeId: input.dataset.role,
        role: input.value as Role,
      });
      return;
    }
    if (input.id === "import-file") {
      const file = (input as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 2_000_000) {
        this.toast(
          "Arquivo muito grande. Escolha uma cópia de carreira Dorvim.",
          true,
        );
        return;
      }
      const result = importCareer(await file.text());
      if (result.state) {
        this.start(result.state);
        this.toast(result.message);
      } else this.toast(result.message, true);
      return;
    }
    if (input.id.endsWith("-setting")) {
      if (input.id === "music-setting")
        this.settings.music = Number(input.value);
      if (input.id === "effects-setting")
        this.settings.effects = Number(input.value);
      if (input.id === "motion-setting")
        this.settings.reducedMotion = (input as HTMLInputElement).checked;
      if (input.id === "tips-setting")
        this.settings.showTips = (input as HTMLInputElement).checked;
      this.audio.setSettings(this.settings);
      this.audio.play("click");
      saveSettings(this.settings);
      if (this.engine) this.state.settings = { ...this.settings };
      const music = $("#music-output"),
        effects = $("#effects-output");
      if (music)
        music.textContent = `${Math.round(this.settings.music * 100)}%`;
      if (effects)
        effects.textContent = `${Math.round(this.settings.effects * 100)}%`;
      document.documentElement.classList.toggle(
        "reduced-motion",
        this.settings.reducedMotion,
      );
    }
  }
  submit(event: SubmitEvent) {
    const form = event.target as HTMLFormElement;
    event.preventDefault();
    const data = new FormData(form);
    if (form.id === "career-form") {
      this.settings.showTips = true;
      this.start(
        createCareer(
          String(data.get("chefName") || "Chef Dorvim"),
          data.get("difficulty") as Difficulty,
        ),
      );
      this.audio.unlock();
    }
    if (form.id === "transfer-form") {
      const employee = this.state.employees.find(
        (e) => e.id === data.get("employee"),
      );
      if (employee)
        this.execute({
          type: "assign",
          employeeId: employee.id,
          role: employee.role,
        });
    }
    if (form.id === "expansion-form") {
      this.execute({
        type: "expand",
        name: String(data.get("restaurantName")),
        style: String(data.get("style")),
      });
    }
  }
  key(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      this.save();
      return;
    }
    if ((e.target as HTMLElement).matches("input,select,textarea")) return;
    if (e.key === "Escape" && this.modal) {
      this.closeModal();
      return;
    }
    if (!this.engine || this.modal) return;
    if (e.code === "Space") {
      e.preventDefault();
      this.state.paused = !this.state.paused;
      this.paintHUD();
    }
    if (e.key === "1") {
      const order = this.restaurant.orders.find(
        (o) =>
          o.status === "manual" ||
          o.status === "waiting" ||
          o.status === "ready",
      );
      if (order) this.openCooking(order.id);
    }
  }
  frame(time: number) {
    const dt = this.lastFrame
      ? Math.min(0.1, (time - this.lastFrame) / 1000)
      : 0;
    this.lastFrame = time;
    if (this.engine && !document.hidden) {
      const stops = [
        "settings",
        "home",
        "new",
        "load",
        "credits",
        "event",
        "competition",
        "inspection",
      ];
      if (!stops.includes(this.modal)) this.engine.tick(dt);
      if (this.scene) this.scene.update(this.state);
      if (
        this.manualId !== null &&
        !this.restaurant.orders.some((o) => o.id === this.manualId) &&
        this.modal === "cooking"
      ) {
        this.closeModal();
      }
      if (time - this.lastPaint > 350) {
        this.lastPaint = time;
        this.paintHUD();
      }
      if (
        this.view !== "restaurant" &&
        this.state.phase === "service" &&
        !this.modal &&
        time - this.lastManagementPaint > 2000 &&
        !$("#management-content")?.contains(document.activeElement)
      ) {
        this.lastManagementPaint = time;
        const content = $("#management-content");
        if (content) content.innerHTML = this.managementContent();
      }
      if (time - this.lastSave > 15000) {
        this.lastSave = time;
        this.save(false);
      }
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}

new DorvimApp();
registerOffline();
