import type { CookingAction, Recipe } from '../game/types';

type Point = { x: number; y: number };
type Particle = Point & { vx: number; vy: number; life: number; color: string };
interface CookingOptions {
  recipe: Recipe;
  stepIndex: number;
  equipment: number;
  reducedMotion: boolean;
  onComplete: (score: number) => void;
  onSound: (name: string) => void;
}

const W = 720;
const H = 400;
const TAU = Math.PI * 2;
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const copy: Record<CookingAction, { title: string; instruction: string; keys: string }> = {
  cut: { title: 'Corte com precisão', instruction: 'Deslize a faca de cima para baixo sobre cada marca. Mantenha cortes regulares.', keys: 'Teclado: ← → escolhem a marca · Espaço corta' },
  mix: { title: 'Encontre o ritmo', instruction: 'Misture em círculos no sentido horário, acompanhando a borda da tigela.', keys: 'Teclado: mantenha → para girar · ← inverte o sentido' },
  grill: { title: 'Cuide do ponto', instruction: 'Mantenha o calor na faixa verde. Vire na metade e retire quando o ponto estiver ideal.', keys: 'Teclado: ← → ajustam o fogo · Espaço vira e depois retira' },
  bake: { title: 'De olho no forno', instruction: 'Ajuste a temperatura e retire sua receita quando o indicador chegar à faixa verde.', keys: 'Teclado: ← → ajustam a temperatura · Espaço retira' },
  season: { title: 'A medida certa', instruction: 'Segure para temperar. Solte perto da medida indicada e finalize.', keys: 'Teclado: segure Espaço para dosar · Enter finaliza' },
  plate: { title: 'Componha o prato', instruction: 'Arraste cada preparo até a sua silhueta no prato. Os detalhes fazem a diferença.', keys: 'Teclado: ← → escolhem o preparo · Espaço posiciona' },
  drink: { title: 'Sirva em camadas', instruction: 'Escolha a base indicada. Leve a jarra ao copo ou segure o botão para servir 30 ml por camada.', keys: 'Teclado: 1, 2, 3 escolhem a base · segure Espaço para servir · Enter confirma' },
  wash: { title: 'Tudo brilhando', instruction: 'Passe a esponja sobre as impurezas. Esfregue até deixar toda a área limpa.', keys: 'Teclado: ← → escolhem a mancha · segure Espaço para esfregar' },
};

/** A self-contained, disposable interaction. The caller advances the recipe after onComplete. */
export class CookingGame {
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly live: HTMLDivElement;
  private readonly progress: HTMLProgressElement;
  private readonly controls: HTMLDivElement;
  private readonly abort = new AbortController();
  private readonly observer: ResizeObserver;
  private readonly action: CookingAction;
  private readonly keys = new Set<string>();
  private readonly particles: Particle[] = [];
  private frame = 0;
  private completionTimer = 0;
  private lastTime = 0;
  private uiTime = 0;
  private totalTime = 0;
  private destroyed = false;
  private finished = false;
  private result = 0;
  private pointer: Point = { x: 360, y: 200 };
  private previous: Point | null = null;
  private pressed = false;
  private selected = 0;
  private cutMarks = Array.from({ length: 7 }, (_, i) => 183 + i * 59);
  private cuts = new Set<number>();
  private cutErrors: number[] = [];
  private cutTimes: number[] = [];
  private mixAngle: number | null = null;
  private mixProgress = 0;
  private mixReverse = 0;
  private temperature = 180;
  private cooking = 0;
  private heatQuality = 0;
  private heatTime = 0;
  private flipped = false;
  private flipQuality = 0;
  private amount = 0;
  private pouring = false;
  private target = 12;
  private slider?: HTMLInputElement;
  private primary?: HTMLButtonElement;
  private drinkSelection = 0;
  private layers: { amount: number; ingredient: number }[] = [];
  private jar: Point = { x: 170, y: 190 };
  private draggingJar = false;
  private dragItem = -1;
  private plateErrors: number[] = [];
  private plateItems: (Point & { target: Point; placed: boolean; name: string })[] = [
    { x: 116, y: 115, target: { x: 437, y: 172 }, placed: false, name: 'preparo principal' },
    { x: 116, y: 215, target: { x: 489, y: 248 }, placed: false, name: 'legumes' },
    { x: 116, y: 312, target: { x: 389, y: 266 }, placed: false, name: 'folhas' },
    { x: 215, y: 310, target: { x: 445, y: 302 }, placed: false, name: 'molho' },
  ];
  private stains = Array.from({ length: 12 }, (_, i) => ({
    x: 172 + (i % 4) * 125 + Math.sin(i * 3) * 14,
    y: 115 + Math.floor(i / 4) * 87 + Math.cos(i * 2) * 10,
    dirt: 1,
  }));

  private get equipmentHelp(): number { return Math.min(4, Math.max(0, this.options.equipment)); }
  private get idealStart(): number { return 0.8 - this.equipmentHelp * 0.012; }
  private get idealEnd(): number { return 1.12 + this.equipmentHelp * 0.018; }

  constructor(container: HTMLElement, private readonly options: CookingOptions) {
    this.action = options.recipe.steps[options.stepIndex]?.action ?? 'cut';
    this.temperature = this.action === 'bake' ? 190 : 180;
    const stepTarget = options.recipe.steps[options.stepIndex]?.target;
    if (this.action === 'season' && stepTarget && stepTarget >= 3 && stepTarget <= 60) this.target = stepTarget;
    this.root = document.createElement('div');
    this.root.className = 'cooking-game';
    this.root.style.cssText = 'width:100%;min-width:0;color:var(--ink,#243d31)';
    const heading = document.createElement('div');
    heading.className = 'cooking-heading';
    heading.style.cssText = 'display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap';
    const title = document.createElement('strong');
    title.textContent = copy[this.action].title;
    title.style.cssText = 'font-size:18px';
    const badge = document.createElement('span');
    badge.textContent = `${options.stepIndex + 1} / ${options.recipe.steps.length} etapas`;
    badge.style.cssText = 'font-size:12px;background:#e8eddb;color:#3f6544;border-radius:20px;padding:5px 11px;font-weight:700';
    heading.append(title, badge);
    const instruction = document.createElement('p');
    instruction.textContent = copy[this.action].instruction;
    instruction.style.cssText = 'font-size:13px;line-height:1.6;margin:0 0 10px;color:#687461';
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'application');
    this.canvas.setAttribute('aria-label', `${copy[this.action].title}. ${copy[this.action].instruction} ${copy[this.action].keys}`);
    this.canvas.style.cssText = 'display:block;width:100%;height:auto;aspect-ratio:1.8;border-radius:16px;touch-action:none;cursor:crosshair;outline-offset:4px';
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Este navegador não disponibiliza Canvas 2D.');
    this.ctx = context;
    this.controls = document.createElement('div');
    this.controls.className = 'cooking-controls';
    this.controls.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:12px';
    this.live = document.createElement('div');
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');
    this.live.style.cssText = 'font-size:13px;font-weight:650;text-align:center;min-height:20px;margin-top:11px;color:#49624c';
    this.progress = document.createElement('progress');
    this.progress.max = 1;
    this.progress.value = 0;
    this.progress.setAttribute('aria-label', 'Progresso da etapa');
    this.progress.style.cssText = 'display:block;width:100%;height:6px;margin:10px 0;accent-color:#557b49;border:0';
    const keyboard = document.createElement('p');
    keyboard.textContent = copy[this.action].keys;
    keyboard.style.cssText = 'font-size:11px;line-height:1.6;color:#7d8378;margin:8px 0 0;text-align:center';
    this.root.append(heading, instruction, this.canvas, this.controls, this.live, this.progress, keyboard);
    container.append(this.root);
    this.makeControls();
    this.listen();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.canvas);
    this.resize();
    this.updateStatus();
    this.frame = requestAnimationFrame(this.tick);
    // Focus is intentionally scoped to this interaction, without scrolling the page.
    this.canvas.focus({ preventScroll: true });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.completionTimer);
    this.abort.abort();
    this.observer.disconnect();
    this.keys.clear();
    this.root.remove();
  }

  private button(label: string, action: () => void, primary = false): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = `border:1px solid ${primary ? '#385e3f' : '#d6d9c7'};border-radius:10px;padding:10px 15px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;background:${primary ? '#385e3f' : '#fffdf5'};color:${primary ? '#fffdf4' : '#38533f'};min-height:40px`;
    button.addEventListener('click', () => { if (!this.finished) action(); }, { signal: this.abort.signal });
    this.controls.append(button);
    return button;
  }

  private holdButton(label: string): HTMLButtonElement {
    const button = this.button(label, () => {} , true);
    button.addEventListener('pointerdown', (event) => {
      if (this.finished) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      this.pouring = true;
    }, { signal: this.abort.signal });
    const release = () => { this.pouring = false; };
    button.addEventListener('pointerup', release, { signal: this.abort.signal });
    button.addEventListener('pointercancel', release, { signal: this.abort.signal });
    button.addEventListener('lostpointercapture', release, { signal: this.abort.signal });
    button.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); this.pouring = true; }
    }, { signal: this.abort.signal });
    button.addEventListener('keyup', (event) => {
      if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); this.pouring = false; }
    }, { signal: this.abort.signal });
    button.addEventListener('blur', release, { signal: this.abort.signal });
    return button;
  }

  private makeControls(): void {
    if (this.action === 'grill' || this.action === 'bake') {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:10px;font-size:12px;font-weight:600';
      const text = document.createElement('span');
      text.textContent = this.action === 'bake' ? 'Temperatura' : 'Intensidade do fogo';
      this.slider = document.createElement('input');
      this.slider.type = 'range';
      this.slider.min = this.action === 'bake' ? '140' : '120';
      this.slider.max = '240';
      this.slider.step = '5';
      this.slider.value = String(this.temperature);
      this.slider.style.cssText = 'accent-color:#557b49;width:150px;max-width:25vw';
      this.slider.setAttribute('aria-label', text.textContent);
      this.slider.addEventListener('input', () => { this.temperature = Number(this.slider!.value); }, { signal: this.abort.signal });
      label.append(text, this.slider);
      this.controls.append(label);
      this.primary = this.button(this.action === 'grill' ? 'Virar preparo' : 'Retirar do forno', () => this.cookingAction(), true);
    } else if (this.action === 'season') {
      this.holdButton('Segure para temperar');
      this.button('Finalizar tempero', () => this.finishSeason());
    } else if (this.action === 'drink') {
      ['1 · Cítrico', '2 · Frutas vermelhas', '3 · Água com gás'].forEach((name, i) => {
        const button = this.button(name, () => { this.drinkSelection = i; this.canvas.focus({ preventScroll: true }); this.updateDrinkButtons(); });
        button.dataset.ingredient = String(i);
        button.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      });
      this.holdButton('Segure para servir');
      this.button('Confirmar camada', () => this.confirmLayer());
      this.updateDrinkButtons();
    } else if (this.action === 'cut') {
      this.button('← Marca', () => this.select(-1, 7));
      this.button('Cortar marca selecionada', () => this.cut(this.selected, 3), true);
      this.button('Marca →', () => this.select(1, 7));
    } else if (this.action === 'mix') {
      const button = this.holdButton('Segure para misturar ↻');
      button.setAttribute('aria-label', 'Segure para misturar no sentido horário');
    } else if (this.action === 'plate') {
      this.button('← Preparo', () => this.select(-1, 4));
      this.button('Posicionar preparo selecionado', () => this.placeSelected(), true);
      this.button('Preparo →', () => this.select(1, 4));
    } else if (this.action === 'wash') {
      this.button('← Mancha', () => this.select(-1, this.stains.length));
      this.holdButton('Segure para esfregar');
      this.button('Mancha →', () => this.select(1, this.stains.length));
    }
  }

  private updateDrinkButtons(): void {
    this.controls.querySelectorAll<HTMLButtonElement>('[data-ingredient]').forEach((button) => {
      const active = Number(button.dataset.ingredient) === this.drinkSelection;
      button.setAttribute('aria-pressed', String(active));
      button.style.background = active ? '#e0ead4' : '#fffdf5';
      button.style.borderColor = active ? '#557b49' : '#d6d9c7';
    });
  }

  private select(direction: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.selected = (this.selected + direction + count) % count;
      if (this.action === 'cut' && this.cuts.has(this.selected)) continue;
      if (this.action === 'plate' && this.plateItems[this.selected].placed) continue;
      if (this.action === 'wash' && this.stains[this.selected].dirt <= 0) continue;
      break;
    }
    this.updateStatus();
  }

  private listen(): void {
    const signal = this.abort.signal;
    this.canvas.addEventListener('pointerdown', (event) => {
      if (this.finished) return;
      event.preventDefault();
      this.canvas.focus({ preventScroll: true });
      this.canvas.setPointerCapture(event.pointerId);
      this.pressed = true;
      this.pointer = this.coordinates(event);
      this.previous = this.pointer;
      if (this.action === 'mix') this.mixAngle = Math.atan2(this.pointer.y - 215, this.pointer.x - 360);
      if (this.action === 'plate') this.dragItem = this.plateItems.findIndex((item) => !item.placed && distance(item, this.pointer) < 58);
      if (this.action === 'drink' && distance(this.pointer, this.jar) < 95) this.draggingJar = true;
      if (this.action === 'season') this.pouring = true;
    }, { signal });
    this.canvas.addEventListener('pointermove', (event) => {
      if (this.finished) return;
      const point = this.coordinates(event);
      this.pointer = point;
      if (!this.pressed) return;
      if (this.action === 'cut' && this.previous) {
        const a = this.previous;
        if ((a.y <= 215 && point.y > 215) || (a.y >= 215 && point.y < 215)) {
          const t = (215 - a.y) / (point.y - a.y);
          const x = a.x + (point.x - a.x) * t;
          const closest = this.cutMarks.reduce((best, mark, i) => Math.abs(mark - x) < Math.abs(this.cutMarks[best] - x) ? i : best, 0);
          if (Math.abs(this.cutMarks[closest] - x) < 28 + this.equipmentHelp * 3) this.cut(closest, Math.abs(this.cutMarks[closest] - x));
          else this.burst(x, 215, '#c88760', 4);
        }
      }
      if (this.action === 'mix') {
        const radius = Math.hypot(point.x - 360, point.y - 215);
        const angle = Math.atan2(point.y - 215, point.x - 360);
        if (this.mixAngle !== null && radius > 35 && radius < 175) {
          let delta = angle - this.mixAngle;
          if (delta > Math.PI) delta -= TAU;
          if (delta < -Math.PI) delta += TAU;
          if (Math.abs(delta) < 1.3) this.addMix(delta);
        }
        this.mixAngle = angle;
      }
      if (this.action === 'plate' && this.dragItem >= 0) Object.assign(this.plateItems[this.dragItem], point);
      if (this.action === 'drink' && this.draggingJar) this.jar = { x: clamp(point.x, 110, 600), y: clamp(point.y, 85, 310) };
      if (this.action === 'wash' && this.previous) {
        const d = Math.min(90, distance(this.previous, point));
        const steps = Math.max(1, Math.ceil(d / 10));
        for (let i = 1; i <= steps; i++) {
          const spot = { x: this.previous.x + (point.x - this.previous.x) * i / steps, y: this.previous.y + (point.y - this.previous.y) * i / steps };
          this.scrub(spot, d / steps / 105);
        }
      }
      this.previous = point;
    }, { signal });
    const release = () => {
      if (this.action === 'plate' && this.dragItem >= 0 && !this.finished) this.drop(this.dragItem);
      this.pressed = false;
      this.pouring = false;
      this.draggingJar = false;
      this.dragItem = -1;
      this.previous = null;
      this.mixAngle = null;
    };
    this.canvas.addEventListener('pointerup', release, { signal });
    this.canvas.addEventListener('pointercancel', release, { signal });
    this.canvas.addEventListener('lostpointercapture', release, { signal });
    this.canvas.addEventListener('keydown', (event) => {
      if (this.finished || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Digit1', 'Digit2', 'Digit3'].includes(event.code)) return;
      event.preventDefault();
      this.keys.add(event.code);
      const horizontal = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
      if (horizontal && ['cut', 'plate', 'wash'].includes(this.action)) this.select(horizontal, this.action === 'cut' ? 7 : this.action === 'plate' ? 4 : this.stains.length);
      if (horizontal && (this.action === 'grill' || this.action === 'bake')) {
        this.temperature = clamp(this.temperature + horizontal * 5, this.action === 'bake' ? 140 : 120, 240);
        if (this.slider) this.slider.value = String(this.temperature);
      }
      if (this.action === 'drink' && event.code.startsWith('Digit')) {
        this.drinkSelection = Number(event.code.slice(-1)) - 1;
        this.updateDrinkButtons();
      }
      if (event.repeat) return;
      if (event.code === 'Space') {
        if (this.action === 'cut') this.cut(this.selected, 3);
        if (this.action === 'plate') this.placeSelected();
        if (this.action === 'grill' || this.action === 'bake') this.cookingAction();
      }
      if (event.code === 'Enter') {
        if (this.action === 'season') this.finishSeason();
        if (this.action === 'drink') this.confirmLayer();
      }
    }, { signal });
    this.canvas.addEventListener('keyup', (event) => { this.keys.delete(event.code); }, { signal });
    this.root.addEventListener('focusout', () => { this.keys.clear(); this.pouring = false; }, { signal });
    window.addEventListener('blur', () => { this.keys.clear(); release(); }, { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.keys.clear(); release(); this.lastTime = 0; }
    }, { signal });
  }

  private coordinates(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * W, y: (event.clientY - rect.top) / rect.height * H };
  }

  private resize(): void {
    const width = this.canvas.getBoundingClientRect().width || W;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const height = width * H / W;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
    this.draw();
  }

  private tick = (now: number): void => {
    if (this.destroyed) return;
    const dt = this.lastTime && !document.hidden ? Math.min((now - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = now;
    this.totalTime += dt;
    if (!this.finished) this.update(dt);
    this.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.life -= dt; });
    for (let i = this.particles.length - 1; i >= 0; i--) if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    this.draw();
    this.uiTime += dt;
    if (this.uiTime > 0.22) { this.uiTime = 0; this.updateStatus(); }
    this.frame = requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    const holding = this.pouring || this.keys.has('Space');
    if (this.action === 'mix') {
      if (this.keys.has('ArrowRight') || holding) this.addMix(dt * 5.8);
      if (this.keys.has('ArrowLeft')) this.addMix(-dt * 4);
    }
    if (this.action === 'grill' || this.action === 'bake') {
      const ideal = this.action === 'bake' ? 190 : 180;
      this.cooking += dt / 6.2 * (this.temperature / ideal);
      this.heatTime += dt;
      this.heatQuality += clamp(1 - Math.abs(this.temperature - ideal) / (65 + this.equipmentHelp * 8)) * dt;
      if (this.cooking >= 1.38) this.finish(this.cookScore() * 0.45);
    }
    if (this.action === 'season' && holding) {
      this.amount = Math.min(this.target * 2, this.amount + dt * this.target * 0.65);
      if (this.amount >= this.target * 2) { this.pouring = false; this.keys.delete('Space'); }
    }
    if (this.action === 'drink' && (holding || (this.draggingJar && this.jar.x > 270 && this.jar.x < 425 && this.jar.y < 190))) this.amount = Math.min(65, this.amount + dt * 30);
    if (this.action === 'wash' && holding) {
      const stain = this.stains[this.selected];
      this.pointer = { x: stain.x + Math.sin(this.totalTime * 25) * 15, y: stain.y + Math.cos(this.totalTime * 22) * 10 };
      this.scrub(this.pointer, dt * 2.6);
      if (stain.dirt <= 0) this.select(1, this.stains.length);
    }
  }

  private cut(index: number, error: number): void {
    if (this.finished || this.cuts.has(index)) return;
    this.cuts.add(index);
    this.cutErrors.push(error);
    this.cutTimes.push(this.totalTime);
    this.options.onSound('cut');
    this.burst(this.cutMarks[index], 215, '#8ca864', 9);
    if (this.cuts.size === this.cutMarks.length) {
      const intervals = this.cutTimes.slice(1).map((time, i) => time - this.cutTimes[i]);
      const mean = intervals.reduce((sum, n) => sum + n, 0) / Math.max(1, intervals.length);
      const variation = intervals.reduce((sum, n) => sum + Math.abs(n - mean), 0) / Math.max(1, intervals.length);
      const precision = 1 - this.cutErrors.reduce((sum, n) => sum + n, 0) / this.cutErrors.length / (35 + this.equipmentHelp * 4);
      this.finish(60 + precision * 30 + clamp(1 - variation / Math.max(0.3, mean)) * 10);
    } else this.select(1, 7);
    this.updateStatus();
  }

  private addMix(delta: number): void {
    if (this.finished) return;
    if (delta >= 0) this.mixProgress += delta;
    else { this.mixReverse += Math.abs(delta); this.mixProgress = Math.max(0, this.mixProgress + delta * 0.3); }
    if (this.mixProgress >= TAU * 3) this.finish(100 - Math.min(35, this.mixReverse * 3));
  }

  private cookingAction(): void {
    if (this.finished) return;
    if (this.action === 'grill' && !this.flipped) {
      this.flipped = true;
      this.flipQuality = clamp(1 - Math.abs(this.cooking - 0.5) / 0.5);
      this.options.onSound('flip');
      this.burst(360, 205, '#eeb769', 12);
      if (this.primary) this.primary.textContent = 'Retirar da grelha';
    } else this.finish(this.cookScore());
    this.updateStatus();
  }

  private cookScore(): number {
    const doneness = clamp(1 - Math.abs(this.cooking - 1) / (0.85 + this.equipmentHelp * 0.06));
    const control = this.heatTime ? this.heatQuality / this.heatTime : 1;
    return this.action === 'grill' ? doneness * 60 + control * 20 + this.flipQuality * 20 : doneness * 80 + control * 20;
  }

  private finishSeason(): void {
    if (this.amount <= 0 || this.finished) return;
    this.finish(100 * clamp(1 - Math.abs(this.amount - this.target) / this.target));
  }

  private placeSelected(): void {
    if (this.finished) return;
    const item = this.plateItems[this.selected];
    if (item.placed) return;
    item.x = item.target.x;
    item.y = item.target.y;
    this.drop(this.selected);
  }

  private drop(index: number): void {
    const item = this.plateItems[index];
    const error = distance(item, item.target);
    if (error > 64 + this.equipmentHelp * 5) {
      this.live.textContent = 'Aproxime o preparo de sua silhueta no prato.';
      return;
    }
    item.x = item.target.x;
    item.y = item.target.y;
    item.placed = true;
    this.plateErrors.push(error);
    this.options.onSound('place');
    this.burst(item.x, item.y, '#c4a35e', 7);
    if (this.plateItems.every((part) => part.placed)) this.finish(100 - this.plateErrors.reduce((sum, n) => sum + n, 0) / 4 * 0.4);
    else this.select(1, 4);
  }

  private confirmLayer(): void {
    if (this.finished || this.amount <= 0) return;
    this.layers.push({ amount: this.amount, ingredient: this.drinkSelection });
    this.amount = 0;
    this.pouring = false;
    this.keys.delete('Space');
    this.options.onSound('pour');
    if (this.layers.length === 3) {
      const accuracy = this.layers.reduce((sum, layer) => sum + clamp(1 - Math.abs(layer.amount - 30) / 30), 0) / 3;
      const order = this.layers.reduce((sum, layer, i) => sum + (layer.ingredient === i ? 1 : 0), 0) / 3;
      this.finish(accuracy * 75 + order * 25);
    } else {
      this.drinkSelection = this.layers.length;
      this.updateDrinkButtons();
      this.jar = { x: 170, y: 190 };
    }
    this.updateStatus();
  }

  private scrub(point: Point, strength: number): void {
    if (this.finished) return;
    this.stains.forEach((stain) => {
      if (stain.dirt <= 0 || distance(point, stain) > 42) return;
      const before = stain.dirt;
      stain.dirt = Math.max(0, stain.dirt - strength * (1 + this.equipmentHelp * 0.1));
      if (before > 0 && stain.dirt <= 0) { this.options.onSound('clean'); this.burst(stain.x, stain.y, '#d6edf0', 5); }
    });
    if (this.stains.every((stain) => stain.dirt <= 0)) this.finish(100);
  }

  private finish(score: number): void {
    if (this.finished || this.destroyed) return;
    this.finished = true;
    this.pouring = false;
    this.keys.clear();
    this.result = Math.round(clamp(score + Math.min(4, Math.max(0, this.options.equipment - 1)), 0, 100));
    this.progress.value = 1;
    this.live.textContent = `Etapa concluída! Qualidade: ${this.result} de 100.`;
    this.controls.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input').forEach((control) => { control.disabled = true; });
    this.options.onSound(this.result >= 75 ? 'success' : 'done');
    this.completionTimer = window.setTimeout(() => {
      if (!this.destroyed) this.options.onComplete(this.result);
    }, this.options.reducedMotion ? 150 : 550);
  }

  private updateStatus(): void {
    if (this.finished) return;
    let status = '';
    let progress = 0;
    if (this.action === 'cut') { progress = this.cuts.size / 7; status = `${this.cuts.size} / 7 cortes · marca ${this.selected + 1} selecionada`; }
    if (this.action === 'mix') { progress = this.mixProgress / (TAU * 3); status = `${Math.floor(progress * 100)}% misturado · sentido horário ↻`; }
    if (this.action === 'grill' || this.action === 'bake') {
      progress = this.cooking;
      const point = this.cooking < this.idealStart ? 'ainda cozinhando' : this.cooking <= this.idealEnd ? 'ponto ideal — retire agora!' : 'passando do ponto!';
      status = `${this.temperature} °C · ${point}${this.action === 'grill' && !this.flipped ? this.cooking >= 0.4 && this.cooking <= 0.65 ? ' · hora de virar!' : ' · ainda precisa virar' : ''}`;
      if (this.slider) this.slider.setAttribute('aria-valuetext', `${this.temperature} graus Celsius`);
    }
    if (this.action === 'season') { progress = this.amount / this.target; status = `${this.amount.toFixed(1)} g / ${this.target} g · ${Math.abs(this.amount - this.target) < this.target * 0.1 ? 'medida ideal!' : 'dose com cuidado'}`; }
    if (this.action === 'plate') { progress = this.plateItems.filter((item) => item.placed).length / 4; status = `${Math.round(progress * 4)} / 4 preparos · selecionado: ${this.plateItems[this.selected].name}`; }
    if (this.action === 'drink') { progress = (this.layers.length + clamp(this.amount / 30)) / 3; status = `Camada ${this.layers.length + 1} / 3 · ${['cítrico', 'frutas vermelhas', 'água com gás'][this.layers.length]} · ${this.amount.toFixed(0)} / 30 ml`; }
    if (this.action === 'wash') { progress = 1 - this.stains.reduce((sum, stain) => sum + stain.dirt, 0) / this.stains.length; status = `${Math.floor(progress * 100)}% limpo · mancha ${this.selected + 1} selecionada`; }
    if (this.live.textContent !== status) this.live.textContent = status;
    this.progress.value = clamp(progress);
  }

  private burst(x: number, y: number, color: string, count: number): void {
    if (this.options.reducedMotion) return;
    for (let i = 0; i < count; i++) this.particles.push({ x, y, vx: Math.cos(i * 2.4) * (25 + i * 6), vy: Math.sin(i * 2.4) * 45 - 35, life: 0.5 + i * 0.025, color });
  }

  private round(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string): void {
    const c = this.ctx;
    c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.stroke(); }
  }

  private ellipse(x: number, y: number, rx: number, ry: number, color: string): void {
    this.ctx.beginPath(); this.ctx.ellipse(x, y, rx, ry, 0, 0, TAU); this.ctx.fillStyle = color; this.ctx.fill();
  }

  private text(text: string, x: number, y: number, size = 15, color = '#496048', align: CanvasTextAlign = 'center'): void {
    this.ctx.font = `600 ${size}px system-ui, sans-serif`; this.ctx.fillStyle = color; this.ctx.textAlign = align; this.ctx.textBaseline = 'middle'; this.ctx.fillText(text, x, y);
  }

  private board(): void {
    const c = this.ctx;
    c.fillStyle = '#f0ecd9'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#e5dfc9'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 70) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    this.round(38, 35, 644, 334, 24, '#d6b88c');
    this.round(33, 28, 654, 334, 24, '#e5cda8', '#c8ac80');
    c.globalAlpha = 0.22;
    for (let i = 0; i < 16; i++) {
      c.strokeStyle = '#b79567'; c.beginPath(); c.moveTo(52, 50 + i * 19); c.bezierCurveTo(200, 35 + i * 19, 500, 64 + i * 19, 668, 45 + i * 19); c.stroke();
    }
    c.globalAlpha = 1;
    this.round(58, 153, 12, 82, 6, '#c9ae83');
    this.herb(643, 319, 0.4);
    this.herb(650, 62, 2.6);
  }

  private herb(x: number, y: number, angle: number): void {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.rotate(angle);
    c.strokeStyle = '#5f7849'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 25); c.lineTo(0, -25); c.stroke();
    for (let i = 0; i < 4; i++) {
      c.save(); c.translate(0, 17 - i * 12); c.rotate(i % 2 ? -0.7 : 0.7); this.ellipse(i % 2 ? -7 : 7, -6, 6, 12, i % 2 ? '#64864e' : '#789557'); c.restore();
    }
    c.restore();
  }

  private plate(x = 440, y = 216, radius = 143): void {
    this.ellipse(x + 3, y + 10, radius + 3, radius * 0.88, '#bba27e');
    this.ellipse(x, y, radius, radius * 0.88, '#fbfaf0');
    this.ellipse(x, y, radius - 15, (radius - 15) * 0.88, '#e6e7d9');
    this.ellipse(x, y - 1, radius - 19, (radius - 19) * 0.88, '#fffdf4');
  }

  private draw(): void {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    this.board();
    if (this.action === 'cut') this.drawCut();
    if (this.action === 'mix') this.drawMix();
    if (this.action === 'grill') this.drawGrill();
    if (this.action === 'bake') this.drawBake();
    if (this.action === 'season') this.drawSeason();
    if (this.action === 'plate') this.drawPlate();
    if (this.action === 'drink') this.drawDrink();
    if (this.action === 'wash') this.drawWash();
    this.particles.forEach((p) => { c.globalAlpha = clamp(p.life * 2); this.ellipse(p.x, p.y, 3, 3, p.color); });
    c.globalAlpha = 1;
    if (this.finished) {
      c.fillStyle = '#fffdf0d9'; c.fillRect(0, 0, W, H);
      this.ellipse(360, 158, 40, 40, '#e2ebd5');
      this.text('✓', 360, 159, 38, '#4d7348');
      this.text('Etapa concluída', 360, 227, 26, '#294931');
      this.text(`${this.result} / 100 de qualidade`, 360, 262, 16, '#6d7a61');
    }
  }

  private drawCut(): void {
    const c = this.ctx;
    const label = (this.options.recipe.steps[this.options.stepIndex]?.label ?? '').toLowerCase();
    const ingredient = /tomate|guarnição|vegetais/.test(label) ? 'tomato' : /cebola|aromática|recheio/.test(label) ? 'onion' : /fruta|polpa/.test(label) ? 'fruit' : /peixe|frango|porções|carne|cortes/.test(label) ? 'protein' : /massa/.test(label) ? 'dough' : 'green';
    this.text('SIGA AS MARCAS', 360, 72, 12, '#7e704f');
    this.ellipse(360, 244, 239, 22, '#c3a77b');
    const palette = ingredient === 'tomato' ? ['#ad4c37', '#de7855', '#efa278'] : ingredient === 'onion' ? ['#a87591', '#d8bbce', '#efdae7'] : ingredient === 'fruit' ? ['#c7993f', '#e6bd5e', '#f4d88b'] : ingredient === 'protein' ? ['#bd806f', '#dfa491', '#edc2aa'] : ingredient === 'dough' ? ['#bc9853', '#dfc27d', '#eddaa3'] : ['#3e6940', '#81a857', '#bed38b'];
    this.round(135, 178, 454, 75, 36, palette[0]);
    this.round(143, 184, 438, 59, 27, palette[1]);
    this.round(150, 190, 425, 44, 22, palette[2]);
    if (ingredient === 'tomato' || ingredient === 'onion') {
      for (let i = 0; i < 6; i++) {
        this.ellipse(178 + i * 72, 214, 34, 35, palette[0]);
        this.ellipse(178 + i * 72, 214, 29, 30, palette[1]);
        this.ellipse(178 + i * 72, 214, 21, 23, palette[2]);
        if (ingredient === 'tomato') {
          for (let n = 0; n < 5; n++) this.ellipse(178 + i * 72 + Math.cos(n * 1.25) * 16, 214 + Math.sin(n * 1.25) * 17, 2, 3, '#f5d58d');
          this.herb(178 + i * 72, 179, 1.5);
        } else this.ellipse(178 + i * 72, 214, 10, 13, '#fbefe7');
      }
    } else for (let i = 0; i < 30; i++) this.ellipse(165 + i * 13.6, 202 + (i % 3) * 10, 3, 2, ingredient === 'protein' ? '#f4d0b9' : '#e4e6ab');
    this.cutMarks.forEach((x, i) => {
      c.lineWidth = this.selected === i ? 3 : 2;
      c.strokeStyle = this.cuts.has(i) ? '#fff7de' : this.selected === i ? '#a96039' : '#f7f0d6';
      c.setLineDash(this.cuts.has(i) ? [] : [6, 5]); c.beginPath(); c.moveTo(x, 152); c.lineTo(x, 266); c.stroke(); c.setLineDash([]);
      this.text(this.cuts.has(i) ? '✓' : String(i + 1), x, 289, 15, this.cuts.has(i) ? '#4e713e' : '#947751');
      if (this.cuts.has(i)) {
        this.ellipse(x + 7, 224, 14, 35, palette[0]);
        this.ellipse(x + 8, 223, 10, 29, palette[1]);
        this.ellipse(x + 9, 223, 4, 19, palette[2]);
      }
    });
    const knifeX = this.pressed ? this.pointer.x : this.cutMarks[this.selected];
    const knifeY = this.pressed ? this.pointer.y - 70 : 108;
    c.save(); c.translate(knifeX, knifeY); c.rotate(-0.2);
    this.round(-6, -27, 14, 43, 5, '#6b4931');
    c.fillStyle = '#e9eee8'; c.beginPath(); c.moveTo(-7, 15); c.lineTo(19, 15); c.lineTo(17, 88); c.quadraticCurveTo(-7, 87, -7, 58); c.closePath(); c.fill();
    c.strokeStyle = '#aab8af'; c.lineWidth = 2; c.stroke(); c.restore();
  }

  private drawMix(): void {
    const c = this.ctx;
    this.ellipse(360, 240, 162, 127, '#b39c78');
    this.ellipse(360, 215, 162, 135, '#f8f4e6');
    this.ellipse(360, 215, 144, 119, '#a89d79');
    this.ellipse(360, 211, 138, 113, '#e7b86b');
    const swirl = this.options.reducedMotion ? this.mixProgress : this.mixProgress + this.totalTime * 0.15;
    c.save(); c.translate(360, 211); c.rotate(swirl);
    c.lineWidth = 7; c.strokeStyle = '#f5d58e';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(i * 12 - 12, 0, 90 - i * 25, 72 - i * 18, 0, i, i + Math.PI * 1.5); c.stroke(); }
    for (let i = 0; i < 15; i++) {
      const angle = i * 2.4;
      this.ellipse(Math.cos(angle) * (35 + i * 4), Math.sin(angle) * (27 + i * 3), 5, 3, i % 3 ? '#8c9c50' : '#dc8352');
    }
    c.restore();
    c.save(); c.translate(360, 211); c.rotate(swirl);
    this.round(30, -10, 166, 14, 7, '#a7794b');
    this.ellipse(28, -3, 34, 24, '#c3915a'); this.ellipse(24, -4, 22, 15, '#a97745');
    c.restore();
    this.text('↻', 583, 189, 58, '#78915d');
    this.text('3 voltas suaves', 580, 241, 13, '#7b765a');
    this.text(`${Math.min(100, Math.floor(this.mixProgress / (TAU * 3) * 100))}%`, 360, 365, 16, '#5f7048');
  }

  private heatBar(y: number): void {
    const c = this.ctx;
    this.round(185, y, 350, 12, 6, '#c9b99b');
    if (this.action === 'grill') this.round(185 + 350 * 0.4 / 1.38, y, 350 * 0.23 / 1.38, 12, 3, this.flipped ? '#b7be91' : '#9daf73');
    this.round(185 + 350 * this.idealStart / 1.38, y, 350 * (this.idealEnd - this.idealStart) / 1.38, 12, 3, '#77925a');
    const x = 185 + clamp(this.cooking / 1.38) * 350;
    c.fillStyle = '#fffdf0'; c.strokeStyle = '#4b5e42'; c.lineWidth = 2; c.beginPath(); c.arc(x, y + 6, 9, 0, TAU); c.fill(); c.stroke();
    this.text('CRU', 185, y + 29, 10, '#7b745e', 'left');
    if (this.action === 'grill') this.text('VIRAR', 316, y + 29, 10, '#6e814e');
    this.text('IDEAL', 431, y + 29, 10, '#557547');
    this.text('PASSADO', 535, y + 29, 10, '#7b745e', 'right');
  }

  private drawGrill(): void {
    const c = this.ctx;
    this.round(153, 71, 418, 238, 28, '#474b3e');
    this.round(167, 84, 390, 209, 21, '#333c32');
    this.round(568, 158, 65, 53, 12, '#474b3e');
    for (let i = 0; i < 10; i++) { this.round(184 + i * 37, 99, 9, 178, 4, '#626450'); }
    const cooked = clamp(this.cooking * 0.8);
    const ingredients = this.options.recipe.ingredients ?? {};
    const pale = !ingredients.carne && !ingredients.frango;
    const r = Math.round((pale ? 239 : 216) - cooked * 65), g = Math.round((pale ? 201 : 151) - cooked * 43), b = Math.round((pale ? 123 : 107) - cooked * 52);
    c.save(); c.translate(360, 184); c.rotate(this.flipped ? 0.16 : -0.12);
    this.ellipse(0, 7, 114, 72, '#2b342a');
    this.round(-106, -65, 212, 126, 46, `rgb(${r},${g},${b})`, '#a76e4b');
    c.save(); c.beginPath(); c.roundRect(-105, -64, 210, 124, 45); c.clip();
    c.strokeStyle = this.flipped ? '#75472d' : '#ab6343'; c.lineWidth = 7;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 35 - 50, -80); c.lineTo(i * 35 + 50, 80); c.stroke(); }
    c.restore();
    this.ellipse(59, -25, 16, 11, '#f2c395');
    this.herb(-45, -5, 1.5); c.restore();
    this.steam(360, 95);
    this.text(`${this.temperature} °C`, 110, 101, 17, this.temperature >= 165 && this.temperature <= 195 ? '#4e713f' : '#b1673e');
    this.text(this.flipped ? '✓ Virado' : '↻ Vire na metade', 360, 51, 13, '#726448');
    this.heatBar(324);
  }

  private drawBake(): void {
    const c = this.ctx;
    this.round(149, 49, 422, 254, 22, '#657063');
    this.round(161, 60, 398, 43, 12, '#e1e4d5');
    this.ellipse(191, 81, 12, 12, '#8c9a83');
    this.ellipse(228, 81, 12, 12, '#8c9a83');
    this.round(391, 69, 133, 25, 5, '#344637');
    this.text(`${this.temperature} °C`, 457, 82, 16, '#d7e6a4');
    this.round(171, 113, 378, 172, 14, '#293a30');
    this.round(186, 126, 348, 147, 8, '#4c4c32');
    this.round(197, 244, 327, 8, 4, '#9a9981');
    const browning = clamp(this.cooking);
    this.ellipse(360, 233, 120, 13, '#282e26');
    this.round(249, 199, 222, 38, 12, '#a97443');
    this.ellipse(360, 197, 112, 49, `rgb(${Math.round(236 - browning * 30)},${Math.round(204 - browning * 66)},${Math.round(145 - browning * 67)})`);
    for (let i = 0; i < 4; i++) { c.strokeStyle = '#f4dfa4'; c.lineWidth = 7; c.beginPath(); c.moveTo(290 + i * 43, 177); c.lineTo(307 + i * 43, 204); c.stroke(); }
    c.fillStyle = '#f7d797'; c.globalAlpha = 0.12; c.fillRect(186, 126, 348, 147); c.globalAlpha = 1;
    this.steam(360, 150);
    this.heatBar(324);
  }

  private drawSeason(): void {
    const c = this.ctx;
    this.plate(360, 241, 135);
    this.food(360, 224, 0, 1.35);
    this.food(414, 274, 1, 0.8);
    this.food(300, 278, 2, 0.9);
    const pour = this.pouring || this.keys.has('Space');
    c.save(); c.translate(pour ? 395 : 430, pour ? 88 : 76); c.rotate(pour ? -0.75 : -0.15);
    this.round(-23, -22, 46, 69, 9, '#f7f3da', '#c4b78d');
    this.round(-23, 34, 46, 17, 4, '#96a581');
    for (let i = 0; i < 5; i++) this.ellipse(-14 + i * 7, 45, 2, 2, '#526747');
    this.round(-14, -7, 28, 25, 3, '#dfc68c'); this.text('SAL', 0, 6, 10, '#7e7150'); c.restore();
    const grains = Math.min(80, Math.floor(this.amount * 5));
    for (let i = 0; i < grains; i++) this.ellipse(290 + (i * 43.7) % 140, 189 + (i * 29.3) % 87, 1.3, 1.4, '#fbf1cb');
    if (pour) for (let i = 0; i < 17; i++) {
      const t = this.options.reducedMotion ? i / 17 : ((this.totalTime * 1.6 + i / 17) % 1);
      this.ellipse(370 + Math.sin(i * 4.2) * t * 35, 115 + t * 118, 1.7, 2, '#fbf8df');
    }
    this.round(91, 120, 130, 123, 15, '#f7f4e7', '#d1bd95');
    this.text('MEDIDA', 156, 145, 11, '#8a8267');
    this.text(`${this.amount.toFixed(1)} g`, 156, 180, 27, Math.abs(this.amount - this.target) < this.target * 0.1 ? '#557b49' : '#657052');
    this.text(`alvo: ${this.target} g`, 156, 218, 13, '#8b836b');
  }

  private food(x: number, y: number, kind: number, scale = 1, ghost = false): void {
    const c = this.ctx;
    const ingredients = this.options.recipe.ingredients ?? {};
    const recipe = this.options.recipe.id ?? '';
    c.save(); c.translate(x, y); c.scale(scale, scale); if (ghost) c.globalAlpha = 0.2;
    if (kind === 0) {
      if (recipe.includes('salada')) {
        for (let i = 0; i < 7; i++) { c.save(); c.rotate(i * 0.9); this.ellipse(15, -6, 18, 34, i % 2 ? '#739859' : '#91ad6a'); c.restore(); }
        this.ellipse(-18, -7, 18, 17, '#d76f50'); this.ellipse(-18, -7, 11, 10, '#efaa77');
        this.ellipse(22, 12, 17, 16, '#d76f50'); this.ellipse(22, 12, 10, 9, '#efaa77');
      } else if (recipe.includes('sanduiche') || recipe.includes('hamburguer')) {
        this.round(-47, 12, 94, 21, 10, '#d29b53');
        this.round(-49, 4, 98, 13, 5, '#7f9a54');
        this.round(-46, -5, 92, 13, 4, '#b66543');
        this.round(-48, -13, 96, 11, 3, '#e5c263');
        c.fillStyle = '#e0af67'; c.beginPath(); c.ellipse(0, -13, 48, 30, 0, Math.PI, TAU); c.fill();
        for (let i = 0; i < 9; i++) this.ellipse(-32 + (i * 17) % 65, -20 - (i % 3) * 7, 2, 1, '#fff0bd');
      } else if (recipe.includes('massa')) {
        this.ellipse(0, 5, 53, 32, '#c98c59');
        c.strokeStyle = '#e4bf62'; c.lineWidth = 7;
        for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(Math.sin(i * 2) * 6, -i * 3, 45 - i * 4, 20 - i, i * 0.2, 0, TAU * 0.9); c.stroke(); }
        this.ellipse(-19, 0, 10, 7, '#c96643'); this.ellipse(20, -14, 11, 8, '#cc7047'); this.herb(9, -20, 0.8);
      } else if (recipe.includes('risoto') || recipe.includes('arroz')) {
        this.ellipse(0, 4, 51, 33, '#d2b983');
        this.ellipse(0, 0, 49, 30, '#e8d9a9');
        for (let i = 0; i < 35; i++) this.ellipse(Math.cos(i * 2.4) * (8 + i), Math.sin(i * 2.4) * (4 + i * 0.65), 4, 1.6, i % 4 ? '#f8edc9' : '#c7ae70');
        if (recipe.includes('feijao')) for (let i = 0; i < 12; i++) this.ellipse(15 + Math.cos(i * 2.4) * 27, 3 + Math.sin(i * 2.4) * 17, 7, 4, '#976448');
      } else if (recipe.includes('bolo') || recipe.includes('torta')) {
        c.fillStyle = '#ca9a58'; c.beginPath(); c.moveTo(-44, -18); c.lineTo(38, -26); c.lineTo(39, 20); c.lineTo(-44, 26); c.closePath(); c.fill();
        c.fillStyle = '#efd298'; c.beginPath(); c.moveTo(-44, -18); c.lineTo(0, -40); c.lineTo(38, -26); c.lineTo(-2, -3); c.closePath(); c.fill();
        this.round(-42, 0, 77, 6, 2, '#e9c27d');
        this.ellipse(-4, -27, 11, 8, '#bc6e50'); this.herb(14, -32, 1);
      } else if (recipe.includes('omelete')) {
        this.ellipse(0, 4, 51, 32, '#c7944c');
        this.ellipse(0, -3, 52, 31, '#e4bf60');
        for (let i = 0; i < 10; i++) this.ellipse(Math.cos(i * 2.4) * 35, Math.sin(i * 2.4) * 18, 3, 2, i % 2 ? '#91a25a' : '#cd8c47');
        c.strokeStyle = '#d6a84d'; c.lineWidth = 3; c.beginPath(); c.moveTo(-45, 4); c.quadraticCurveTo(0, 17, 45, 4); c.stroke();
      } else {
      this.ellipse(0, 7, 49, 27, '#b8a083');
      this.round(-47, -29, 94, 53, 20, ingredients.peixe ? '#d5bf88' : '#ce8a53');
      c.strokeStyle = '#975634'; c.lineWidth = 4;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 24 - 9, -23); c.lineTo(i * 24 + 10, 18); c.stroke(); }
      this.ellipse(22, -10, 7, 4, '#efc582');
      }
    } else if (kind === 1) {
      for (let i = 0; i < 5; i++) {
        const xx = Math.cos(i * 2.3) * 23, yy = Math.sin(i * 2.3) * 17;
        this.ellipse(xx, yy, 17, 15, i % 2 ? '#df8655' : '#b5c36c');
        this.ellipse(xx, yy, 9, 8, i % 2 ? '#f0ac6b' : '#d9df9b');
      }
    } else if (kind === 2) {
      for (let i = 0; i < 6; i++) {
        c.save(); c.rotate(i * 1.1); this.ellipse(12, -10, 11, 23, i % 2 ? '#75955c' : '#8eaa68'); c.restore();
      }
      this.ellipse(0, 0, 5, 5, '#bed09a');
    } else {
      c.strokeStyle = '#a9623a'; c.lineWidth = 8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-25, -3); c.bezierCurveTo(-11, -17, 10, 13, 26, -4); c.stroke();
      this.ellipse(33, -5, 4, 4, '#a9623a');
    }
    c.restore();
  }

  private drawPlate(): void {
    const c = this.ctx;
    this.plate();
    this.text('PREPAROS', 125, 60, 11, '#897657');
    this.plateItems.forEach((item, index) => {
      if (!item.placed) {
        c.save(); c.setLineDash([4, 5]); c.strokeStyle = '#b7c5a2'; c.lineWidth = 2; c.beginPath(); c.ellipse(item.target.x, item.target.y, index ? 35 : 54, index ? 28 : 37, 0, 0, TAU); c.stroke(); c.restore();
        this.food(item.target.x, item.target.y, index, 0.9, true);
      }
      if (this.selected === index && !item.placed) { c.strokeStyle = '#81945d'; c.lineWidth = 2; c.beginPath(); c.arc(item.x, item.y, index === 0 ? 59 : 45, 0, TAU); c.stroke(); }
      this.food(item.x, item.y, index, 0.9);
      if (item.placed) this.text('✓', item.x + 39, item.y - 26, 13, '#7c9659');
    });
  }

  private drawDrink(): void {
    const c = this.ctx;
    const colors = ['#e8bd50', '#c76a76', '#cde4c4'];
    this.ellipse(390, 328, 71, 13, '#baa37e');
    c.save(); c.beginPath(); c.moveTo(334, 126); c.lineTo(447, 126); c.lineTo(433, 317); c.quadraticCurveTo(390, 331, 347, 317); c.closePath(); c.clip();
    c.fillStyle = '#f4f5de'; c.fillRect(330, 124, 120, 205);
    let y = 317;
    const all = [...this.layers, ...(this.amount > 0 ? [{ amount: this.amount, ingredient: this.drinkSelection }] : [])];
    all.forEach((layer) => {
      const height = layer.amount * 1.85;
      y -= height;
      c.fillStyle = colors[layer.ingredient]; c.fillRect(330, y, 120, height + 1);
      c.fillStyle = '#ffffff3d'; c.fillRect(330, y, 120, 3);
    });
    for (let i = 0; i < 12; i++) {
      const bubbleY = this.options.reducedMotion ? 170 + i * 11 : 310 - ((this.totalTime * 20 + i * 29) % 170);
      this.ellipse(357 + (i * 17) % 65, bubbleY, 2, 2, '#fff9d5');
    }
    c.restore();
    c.strokeStyle = '#b2c4b0'; c.lineWidth = 3; c.beginPath(); c.moveTo(334, 126); c.lineTo(347, 317); c.quadraticCurveTo(390, 331, 433, 317); c.lineTo(447, 126); c.stroke();
    this.ellipse(390, 127, 57, 9, '#ffffff88'); c.strokeStyle = '#a9bba5'; c.beginPath(); c.ellipse(390, 127, 57, 9, 0, 0, TAU); c.stroke();
    c.strokeStyle = '#ffffffaa'; c.lineWidth = 5; c.beginPath(); c.moveTo(346, 145); c.lineTo(356, 300); c.stroke();
    this.ellipse(437, 133, 22, 22, '#b1c363'); this.ellipse(437, 133, 17, 17, '#e6e6a4');
    for (let i = 0; i < 6; i++) { c.strokeStyle = '#b1c363'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(437, 133); c.lineTo(437 + Math.cos(i * TAU / 6) * 16, 133 + Math.sin(i * TAU / 6) * 16); c.stroke(); }
    const pouring = this.pouring || this.keys.has('Space') || (this.draggingJar && this.jar.x > 270 && this.jar.x < 425 && this.jar.y < 190);
    const jar = pouring && !this.draggingJar ? { x: 285, y: 101 } : this.jar;
    c.save(); c.translate(jar.x, jar.y); c.rotate(pouring ? 0.65 : -0.1);
    this.round(-43, -54, 78, 104, 12, '#f5f4de', '#b8c1a4');
    this.round(-36, -11, 64, 54, 5, colors[this.drinkSelection]);
    c.strokeStyle = '#b8c1a4'; c.lineWidth = 7; c.beginPath(); c.ellipse(-49, -4, 21, 33, 0, 1.1, 5.2); c.stroke();
    c.fillStyle = '#f5f4de'; c.beginPath(); c.moveTo(28, -53); c.lineTo(55, -53); c.lineTo(34, -31); c.fill(); c.restore();
    if (pouring) { c.strokeStyle = colors[this.drinkSelection]; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(jar.x + 32, jar.y - 12); c.quadraticCurveTo(385, 90, 385, Math.max(146, y)); c.stroke(); }
    this.text(`${this.amount.toFixed(0)} / 30 ml`, 556, 174, 24, '#6b7953');
    this.text(`Camada ${Math.min(3, this.layers.length + 1)} de 3`, 556, 211, 13, '#867a5c');
    this.text(['CÍTRICO', 'FRUTAS VERMELHAS', 'ÁGUA COM GÁS'][Math.min(2, this.layers.length)], 390, 69, 12, '#7d7352');
  }

  private drawWash(): void {
    const c = this.ctx;
    this.round(104, 65, 514, 277, 18, '#dde2d1', '#b0bda4');
    this.round(117, 78, 488, 250, 12, '#edf0e1');
    for (let i = 0; i < 9; i++) {
      c.strokeStyle = '#dce3ce'; c.lineWidth = 1; c.beginPath(); c.moveTo(135 + i * 54, 86); c.lineTo(135 + i * 54, 317); c.stroke();
    }
    this.stains.forEach((stain, i) => {
      if (stain.dirt <= 0) {
        this.text('✧', stain.x, stain.y, 25, '#b2c8a1');
        return;
      }
      c.save(); c.globalAlpha = stain.dirt * 0.75;
      for (let n = 0; n < 5; n++) this.ellipse(stain.x + Math.cos(n * 2.5) * 11, stain.y + Math.sin(n * 2.5) * 9, 15 + n, 9 + n, i % 3 ? '#a08d62' : '#ab7654');
      c.restore();
      if (i === this.selected) { c.setLineDash([3, 4]); c.strokeStyle = '#78956b'; c.lineWidth = 2; c.beginPath(); c.arc(stain.x, stain.y, 36, 0, TAU); c.stroke(); c.setLineDash([]); }
    });
    const point = this.pressed || this.pouring || this.keys.has('Space') ? this.pointer : this.stains[this.selected];
    c.save(); c.translate(point.x, point.y); c.rotate(-0.2);
    this.round(-27, -13, 57, 35, 9, '#adb96b'); this.round(-27, -21, 57, 31, 9, '#e7c668');
    for (let i = 0; i < 8; i++) this.ellipse(-17 + (i * 13) % 37, -12 + (i * 7) % 16, 2, 1.5, '#c2a750');
    c.restore();
    if (this.pressed || this.pouring || this.keys.has('Space')) {
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4 + (this.options.reducedMotion ? 0 : this.totalTime);
        this.ellipse(point.x + Math.cos(a) * (22 + i * 3), point.y + Math.sin(a) * (15 + i * 3), 4 + i % 3, 4 + i % 3, '#fcfff2cc');
      }
    }
    this.text('UMA COZINHA BOA COMEÇA PELO CUIDADO', 360, 365, 11, '#7c805f');
  }

  private steam(x: number, y: number): void {
    if (this.options.reducedMotion) return;
    const c = this.ctx;
    c.save(); c.strokeStyle = '#fff4d4'; c.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const phase = (this.totalTime * 0.5 + i / 3) % 1;
      c.globalAlpha = (1 - phase) * 0.5; c.beginPath();
      c.moveTo(x - 40 + i * 40, y - phase * 40);
      c.bezierCurveTo(x - 55 + i * 40, y - phase * 40 - 15, x - 25 + i * 40, y - phase * 40 - 22, x - 40 + i * 40, y - phase * 40 - 40); c.stroke();
    }
    c.restore();
  }
}
