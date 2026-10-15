import type { GameState, Order, Restaurant } from '../game/types';

type Point = { x: number; y: number };
type SceneOptions = {
  onStation: (station: string) => void;
  onCustomer?: (orderId: number) => void;
  reducedMotion?: boolean;
};
type Station = { id: string; label: string; x: number; y: number; z: number; reachX: number; reachY: number };
type Drawable = { depth: number; draw: () => void };

const WIDTH = 900;
const HEIGHT = 650;
const stations: Station[] = [
  { id: 'stock', label: 'Despensa', x: 1.05, y: .85, z: 54, reachX: 1.1, reachY: 2 },
  { id: 'prep', label: 'Bancada de preparo', x: 3.5, y: .9, z: 48, reachX: 3.4, reachY: 2 },
  { id: 'grill', label: 'Fogão', x: 5.2, y: .85, z: 48, reachX: 5.2, reachY: 2 },
  { id: 'oven', label: 'Forno', x: 6.75, y: .85, z: 48, reachX: 6.75, reachY: 2 },
  { id: 'sink', label: 'Pia & limpeza', x: 8.35, y: .85, z: 48, reachX: 8.3, reachY: 2 },
  { id: 'menu', label: 'Cardápio da casa', x: 9.45, y: 6.4, z: 28, reachX: 8.9, reachY: 6.3 },
  { id: 'staff', label: 'Equipe', x: 1.2, y: 6.7, z: 22, reachX: 1.7, reachY: 6.2 },
];

/** A small, hand-painted restaurant diorama. Coordinates and hit areas share one projection. */
export class RestaurantScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly options: SceneOptions;
  private readonly resizeObserver: ResizeObserver;
  private state?: GameState;
  private frame = 0;
  private lastTime = 0;
  private time = 0;
  private pixelRatio = 1;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private menuMode = false;
  private hover: string | null = null;
  private mouse: Point = { x: -1000, y: -1000 };
  private chef: Point = { x: 4.1, y: 2.3 };
  private target: Point | null = null;
  private keys = new Set<string>();
  private customerHits: { point: Point; order: Order }[] = [];
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, options: SceneOptions) {
    this.canvas = canvas;
    this.options = options;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível abrir a ilustração do restaurante.');
    this.ctx = context;
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Restaurante Dorvim em perspectiva. Clique nas estações ou mova o chef com WASD e use E para interagir.');
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerleave', this.pointerLeave);
    canvas.addEventListener('click', this.click);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
  }

  update(state: GameState): void {
    this.state = state;
  }

  setMenuMode(value: boolean): void {
    this.menuMode = value;
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerleave', this.pointerLeave);
    this.canvas.removeEventListener('click', this.click);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
  }

  private restaurant(): Restaurant | undefined {
    return this.state?.restaurants.find(r => r.id === this.state?.activeRestaurant) ?? this.state?.restaurants[0];
  }

  private resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width || WIDTH);
    const height = Math.max(1, bounds.height || HEIGHT);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.pixelRatio);
    this.canvas.height = Math.round(height * this.pixelRatio);
    this.scale = Math.min(width / WIDTH, height / HEIGHT);
    this.offsetX = (width - WIDTH * this.scale) / 2;
    this.offsetY = (height - HEIGHT * this.scale) / 2;
  }

  private animate = (now: number): void => {
    if (this.disposed) return;
    const dt = Math.min((now - (this.lastTime || now)) / 1000, .045);
    this.lastTime = now;
    const reduced = this.options.reducedMotion || this.state?.settings.reducedMotion;
    if (!reduced && (!this.state?.paused || this.menuMode)) this.time += dt;
    if (!this.menuMode) this.moveChef(dt);
    this.paint();
    this.frame = requestAnimationFrame(this.animate);
  };

  private moveChef(dt: number): void {
    if (document.querySelector('.modal-backdrop')) { this.keys.clear(); return; }
    let dx = 0;
    let dy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) { dx -= 1; dy -= 1; }
    if (this.keys.has('s') || this.keys.has('arrowdown')) { dx += 1; dy += 1; }
    if (this.keys.has('a') || this.keys.has('arrowleft')) { dx -= 1; dy += 1; }
    if (this.keys.has('d') || this.keys.has('arrowright')) { dx += 1; dy -= 1; }
    if (dx || dy) this.target = null;
    else if (this.target) {
      dx = this.target.x - this.chef.x;
      dy = this.target.y - this.chef.y;
      if (Math.hypot(dx, dy) < .08) { this.target = null; dx = 0; dy = 0; }
    }
    const length = Math.hypot(dx, dy);
    if (length) {
      const distance = Math.min(length, dt * 2.2);
      this.chef.x = Math.max(.65, Math.min(9.4, this.chef.x + dx / length * distance));
      this.chef.y = Math.max(1.65, Math.min(7.4, this.chef.y + dy / length * distance));
    }
  }

  private pointerMove = (event: PointerEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();
    this.mouse = { x: (event.clientX - bounds.left - this.offsetX) / this.scale, y: (event.clientY - bounds.top - this.offsetY) / this.scale };
    this.hover = this.findStation(this.mouse)?.id ?? null;
    const customer = this.customerHits.some(hit => Math.hypot(hit.point.x - this.mouse.x, hit.point.y - this.mouse.y) < 26);
    this.canvas.style.cursor = this.hover || customer ? 'pointer' : 'default';
  };

  private pointerLeave = (): void => {
    this.hover = null;
    this.mouse = { x: -1000, y: -1000 };
    this.canvas.style.cursor = 'default';
  };

  private click = (event: MouseEvent): void => {
    if (this.menuMode) return;
    const bounds = this.canvas.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left - this.offsetX) / this.scale, y: (event.clientY - bounds.top - this.offsetY) / this.scale };
    for (const hit of this.customerHits) {
      if (Math.hypot(hit.point.x - point.x, hit.point.y - point.y) < 27) {
        this.options.onCustomer?.(hit.order.id);
        return;
      }
    }
    const station = this.findStation(point);
    if (station) {
      this.target = { x: station.reachX, y: station.reachY };
      this.options.onStation(station.id);
      return;
    }
    const x = (point.x - 414) / 43;
    const y = (point.y - 189) / 22;
    const world = { x: (x + y) / 2, y: (y - x) / 2 };
    if (world.x > .3 && world.x < 9.7 && world.y > 1.5 && world.y < 7.7) this.target = world;
  };

  private keyDown = (event: KeyboardEvent): void => {
    const element = event.target as HTMLElement | null;
    if (document.querySelector('.modal-backdrop') || element?.closest('input,textarea,select,[contenteditable="true"],dialog,[role="dialog"]') || event.metaKey || event.ctrlKey || event.altKey || this.menuMode) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      this.keys.add(key);
      if (key.startsWith('arrow') && document.activeElement === this.canvas) event.preventDefault();
    }
    if (key === 'e' && !event.repeat) {
      const nearest = [...stations].sort((a, b) => Math.hypot(a.reachX - this.chef.x, a.reachY - this.chef.y) - Math.hypot(b.reachX - this.chef.x, b.reachY - this.chef.y))[0];
      if (Math.hypot(nearest.reachX - this.chef.x, nearest.reachY - this.chef.y) < 2.3) this.options.onStation(nearest.id);
    }
  };

  private keyUp = (event: KeyboardEvent): void => { this.keys.delete(event.key.toLowerCase()); };
  private blur = (): void => { this.keys.clear(); };

  private findStation(point: Point): Station | undefined {
    let nearest: Station | undefined;
    let distance = Infinity;
    for (const station of stations) {
      const p = this.project(station.x, station.y, station.z);
      const d = Math.hypot(point.x - p.x, (point.y - p.y) * 1.3);
      if (d < 44 && d < distance) { distance = d; nearest = station; }
    }
    return nearest;
  }

  private project(x: number, y: number, z = 0): Point { return { x: 414 + (x - y) * 43, y: 189 + (x + y) * 22 - z }; }

  private polygon(points: Point[], fill: string | CanvasGradient, stroke?: string, lineWidth = 1): void {
    const c = this.ctx;
    c.beginPath();
    points.forEach((point, i) => { if (i === 0) c.moveTo(point.x, point.y); else c.lineTo(point.x, point.y); });
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lineWidth; c.stroke(); }
  }

  private line(points: Point[], color: string, width = 1): void {
    const c = this.ctx;
    c.beginPath();
    points.forEach((point, i) => { if (i === 0) c.moveTo(point.x, point.y); else c.lineTo(point.x, point.y); });
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
  }

  private ellipse(x: number, y: number, rx: number, ry: number, color: string | CanvasGradient, stroke?: string): void {
    const c = this.ctx;
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = color; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }

  private box(x: number, y: number, w: number, d: number, h: number, top: string, front: string, side: string, z = 0): void {
    const p = (a: number, b: number, c = 0) => this.project(a, b, c + z);
    this.polygon([p(x, y + d, h), p(x + w, y + d, h), p(x + w, y + d), p(x, y + d)], front);
    this.polygon([p(x + w, y, h), p(x + w, y + d, h), p(x + w, y + d), p(x + w, y)], side);
    this.polygon([p(x, y, h), p(x + w, y, h), p(x + w, y + d, h), p(x, y + d, h)], top);
  }

  private floorQuad(x: number, y: number, w: number, d: number, color: string, z = 0): void {
    this.polygon([this.project(x, y, z), this.project(x + w, y, z), this.project(x + w, y + d, z), this.project(x, y + d, z)], color);
  }

  private text(label: string, x: number, y: number, size: number, color: string, font = 'sans-serif', align: CanvasTextAlign = 'center'): void {
    const c = this.ctx;
    c.fillStyle = color; c.font = `${size}px ${font}`; c.textAlign = align; c.fillText(label, x, y);
  }

  private paint(): void {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.pixelRatio * this.scale, 0, 0, this.pixelRatio * this.scale, this.pixelRatio * this.offsetX, this.pixelRatio * this.offsetY);
    c.lineJoin = 'round';
    const restaurant = this.restaurant();
    this.background();
    this.architecture(restaurant);
    const objects: Drawable[] = [];
    const add = (depth: number, draw: () => void) => objects.push({ depth, draw });
    add(.7, () => this.fridge(.35, .22, restaurant));
    add(2.35, () => this.pantry(1.7, .28));
    add(3.8, () => this.prep(2.85, .3, restaurant));
    add(5.4, () => this.stove(4.55, .3, restaurant));
    add(7, () => this.oven(6.15, .3, restaurant));
    add(8.6, () => this.sink(7.75, .3, restaurant));
    add(10.2, () => this.plant(9.5, .6, 1.15));
    add(3.9, () => this.plant(.55, 3.45, 1.05));
    add(5.9, () => this.plant(.55, 5.5, .8));
    add(8, () => this.bench(.45, 6.4));
    add(7.2, () => this.serviceCounter(4.35, 2.75, restaurant));
    add(12.9, () => this.chalkboard(9.4, 6.4));
    add(16.8, () => this.plant(9.45, 7.35, .78));
    const tables = [
      { x: 2.3, y: 4.1, style: 0 },
      { x: 5.15, y: 4.65, style: 1 },
      { x: 8.05, y: 3.8, style: 2 },
      { x: 4.2, y: 6.8, style: 3 },
      { x: 7.65, y: 6.65, style: 4 },
    ];
    const orders = restaurant?.orders ?? [];
    this.customerHits = [];
    for (const [index, table] of tables.entries()) {
      add(table.x + table.y - .8, () => this.chair(table.x - .72, table.y - .4, 0));
      add(table.x + table.y + .8, () => this.chair(table.x + .76, table.y + .43, 1));
      add(table.x + table.y + .18, () => this.table(table.x, table.y, table.style, restaurant));
      const order = orders[index];
      if (order || this.menuMode || (this.state?.phase !== 'service' && index < 2)) {
        add(table.x + table.y - .25, () => this.person(table.x - .78, table.y - .23, index + 2, false, true));
        if (order) {
          add(30, () => this.orderBubble(table.x - .78, table.y - .23, order));
        } else if (this.menuMode && index % 2 === 0) {
          add(table.x + table.y + 1.25, () => this.person(table.x + .8, table.y + .45, index + 7, false, true));
        }
      }
    }
    add(this.chef.x + this.chef.y + .15, () => this.person(this.chef.x, this.chef.y, 0, true, false, this.target !== null || this.keys.size > 0));
    const employees = this.state?.employees.filter(employee => employee.active && (employee.restaurantId ?? 1) === (restaurant?.id ?? 1)) ?? [];
    const staffCount = Math.min(4, employees.length + (this.menuMode ? 2 : 0));
    for (let i = 0; i < staffCount; i++) {
      const phase = this.time * .36 + i * 2.3;
      const role = employees[i]?.role;
      const kitchen = role !== 'garcom' && role !== 'faxineiro';
      const x = kitchen ? 2 + i * 1.8 + Math.sin(phase) * .65 : 4.8 + Math.sin(phase) * 2.3;
      const y = kitchen ? 1.95 + Math.cos(phase * .8) * .13 : 4.3 + Math.cos(phase) * 1.2;
      add(x + y + .2, () => this.person(x, y, i + 10, kitchen, false, true));
    }
    objects.sort((a, b) => a.depth - b.depth).forEach(item => item.draw());
    this.foreground();
    this.lamps();
    this.atmosphere(restaurant);
    if (!this.menuMode) this.interactionHints();
  }

  private background(): void {
    const c = this.ctx;
    const sky = c.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#dfe8df'); sky.addColorStop(.55, '#f0eee0'); sky.addColorStop(1, '#e6ddcc');
    c.fillStyle = sky; c.fillRect(0, 0, WIDTH, HEIGHT);
    // Quiet neighborhood silhouettes give the cutaway a place in the world.
    c.globalAlpha = .38;
    const buildings = [
      { x: 29, y: 123, w: 101, h: 160, color: '#b6c8bf' },
      { x: 136, y: 99, w: 65, h: 169, color: '#d1c5af' },
      { x: 222, y: 147, w: 111, h: 96, color: '#bdcfc4' },
      { x: 698, y: 114, w: 89, h: 201, color: '#c0c9b7' },
      { x: 797, y: 159, w: 100, h: 185, color: '#c8b9a6' },
    ];
    for (const b of buildings) {
      c.fillStyle = b.color; c.fillRect(b.x, b.y, b.w, b.h);
      this.polygon([{ x: b.x - 7, y: b.y }, { x: b.x + b.w / 2, y: b.y - 27 }, { x: b.x + b.w + 7, y: b.y }], '#b3b5a5');
      for (let y = b.y + 23; y < b.y + b.h - 10; y += 33) for (let x = b.x + 14; x < b.x + b.w - 8; x += 27) {
        c.fillStyle = '#f5edd4'; c.fillRect(x, y, 12, 19); c.fillStyle = '#8fa89b'; c.fillRect(x + 5, y, 2, 19);
      }
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 7; i++) {
      const x = i < 4 ? 16 + i * 50 : 749 + (i - 4) * 66;
      const y = 250 + (i % 3) * 23;
      this.line([{ x, y: y + 51 }, { x: x + 3, y: y - 6 }], '#a5ad94', 5);
      this.ellipse(x - 11, y - 9, 26, 27, '#bdcdb4');
      this.ellipse(x + 12, y - 19, 25, 32, '#cad7ba');
      this.ellipse(x + 3, y - 38, 23, 24, '#c4d1b7');
    }
    c.save(); c.shadowColor = '#5264533d'; c.shadowBlur = 35; c.shadowOffsetY = 18;
    this.ellipse(462, 498, 355, 107, '#6e816419'); c.restore();
    // Pavers around the floating room.
    this.polygon([this.project(-.6, -.5, -18), this.project(10.7, -.5, -18), this.project(10.7, 8.6, -18), this.project(-.6, 8.6, -18)], '#d8d0b9');
    for (let i = 0; i < 11; i++) {
      this.line([this.project(i, 8.05, -18), this.project(i, 8.6, -18)], '#c5bca8', .7);
      this.line([this.project(10.05, i * .78, -18), this.project(10.7, i * .78, -18)], '#c5bca8', .7);
    }
  }

  private architecture(restaurant?: Restaurant): void {
    const c = this.ctx;
    const decorated = restaurant?.decor ?? 'aconchegante';
    const green = /moderno|elegante|luxo|premium/i.test(decorated) ? '#3c5c65' : '#426451';
    this.box(0, 0, 10, 8, 15, '#c7b28b', '#a58563', '#b69a74', -15);
    // Back walls, with warm plaster and sage beadboard.
    this.polygon([this.project(0, 0), this.project(0, 8), this.project(0, 8, 133), this.project(0, 0, 133)], '#e5dec9');
    this.polygon([this.project(0, 0), this.project(10, 0), this.project(10, 0, 133), this.project(0, 0, 133)], '#f0e7cf');
    this.polygon([this.project(0, 0), this.project(0, 8), this.project(0, 8, 39), this.project(0, 0, 39)], green);
    this.polygon([this.project(0, 0), this.project(10, 0), this.project(10, 0, 38), this.project(0, 0, 38)], '#64806a');
    for (let y = .2; y < 8; y += .35) this.line([this.project(0, y, 2), this.project(0, y, 36)], '#79917a', .6);
    for (let x = .2; x < 10; x += .35) this.line([this.project(x, 0, 2), this.project(x, 0, 36)], '#8ea087', .6);
    this.line([this.project(0, 8, 41), this.project(0, 0, 41), this.project(10, 0, 41)], '#a1ad8d', 5);
    this.line([this.project(0, 8, 135), this.project(0, 0, 135), this.project(10, 0, 135)], '#f8f0d9', 7);
    this.line([this.project(0, 8, 129), this.project(0, 0, 129), this.project(10, 0, 129)], '#b1a585', 2);
    // Kitchen's checkerboard meets individually grained dining floorboards.
    for (let x = 0; x < 10; x++) for (let y = 0; y < 8; y++) {
      if (y < 3) this.floorQuad(x, y, .985, .985, (x + y) % 2 ? '#e0ddca' : '#99ada0');
      else {
        const tone = ['#c39b6b', '#cba675', '#d1ad7c', '#bf9567'][(x * 3 + y) % 4];
        this.floorQuad(x, y, .99, .99, tone);
        for (let g = 0; g < 3; g++) {
          this.line([this.project(x + .15, y + .18 + g * .29, .2), this.project(x + .86, y + .16 + g * .29, .2)], '#a77f4c31', .65);
        }
      }
    }
    this.line([this.project(0, 3, 1), this.project(10, 3, 1)], '#80694c', 2.6);
    this.window(1.35, 3.65);
    this.window(5.5, 1.4);
    // Back wall kitchen tiles.
    this.polygon([this.project(2.8, .012, 41), this.project(9.18, .012, 41), this.project(9.18, .012, 87), this.project(2.8, .012, 87)], '#e2e8d7');
    for (let x = 2.8; x < 9.2; x += .55) this.line([this.project(x, .02, 42), this.project(x, .02, 87)], '#bacbb7', .6);
    for (const z of [53, 65, 77, 87]) this.line([this.project(2.8, .02, z), this.project(9.18, .02, z)], '#bacbb7', .7);
    this.wallSign();
    if ((this.state?.stage ?? 1) >= 2) this.careerAwards();
    // Hanging utensil rail and the little herb shelf.
    this.line([this.project(3.2, .05, 79), this.project(4.3, .05, 79)], '#5a6556', 2);
    for (let i = 0; i < 4; i++) {
      const p = this.project(3.35 + i * .23, .06, 77);
      this.line([{ x: p.x, y: p.y }, { x: p.x, y: p.y + 13 }], '#657065', 1.5);
      this.ellipse(p.x, p.y + 15, i % 2 ? 2.4 : 3.8, 4.2, '#8b9b8f');
    }
    this.box(7.8, .03, 1.4, .2, 4, '#a47b4f', '#886345', '#8d6947', 91);
    for (let i = 0; i < 3; i++) this.herbPot(8.02 + i * .4, .13, 96, .45);
    // Soft sunlight across the boards is a floor layer, under all furniture.
    c.save(); c.globalAlpha = .13;
    this.polygon([this.project(.05, 1.5, 0), this.project(.05, 4.6, 0), this.project(5.1, 7.5, 0), this.project(6.2, 5.1, 0)], '#fff4b9');
    c.restore();
    if (restaurant && restaurant.cleanliness < 65) {
      for (let i = 0; i < Math.min(15, (80 - restaurant.cleanliness) / 4); i++) {
        const p = this.project(1.6 + (i * 1.83) % 7, 3.5 + (i * .91) % 3.4);
        this.ellipse(p.x, p.y, 3 + i % 4, 1.6, '#6a59494d');
      }
    }
  }

  private window(y: number, width: number): void {
    const c = this.ctx;
    const corners = [this.project(.005, y, 50), this.project(.005, y + width, 50), this.project(.005, y + width, 120), this.project(.005, y, 120)];
    this.polygon(corners, '#647c69', '#aa9874', 5);
    const inside = [this.project(.015, y + .08, 55), this.project(.015, y + width - .08, 55), this.project(.015, y + width - .08, 116), this.project(.015, y + .08, 116)];
    const sky = c.createLinearGradient(0, corners[2].y, 0, corners[0].y);
    sky.addColorStop(0, '#bed9cd'); sky.addColorStop(1, '#e5e7bc');
    this.polygon(inside, sky);
    c.save();
    c.beginPath(); inside.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.clip();
    for (let j = 0; j < 3; j++) {
      const p = this.project(.01, y + j * 1.15 + .25, 55);
      c.fillStyle = ['#c0baa0', '#b1bba2', '#d0bea0'][j];
      c.fillRect(p.x - 33, p.y - 36 - j * 8, 39, 70);
      this.polygon([{ x: p.x - 37, y: p.y - 36 - j * 8 }, { x: p.x - 11, y: p.y - 57 - j * 8 }, { x: p.x + 11, y: p.y - 36 - j * 8 }], '#a59e87');
      c.fillStyle = '#e9e4c0'; c.fillRect(p.x - 24, p.y - 28 - j * 8, 8, 16);
      c.fillRect(p.x - 9, p.y - 28 - j * 8, 8, 16);
    }
    c.restore();
    this.line([this.project(.02, y, 84), this.project(.02, y + width, 84)], '#f4ecd5', 3.5);
    for (let d = 0; d <= width; d += width / 3) this.line([this.project(.03, y + d, 52), this.project(.03, y + d, 118)], '#f3e9d0', 3.5);
    this.box(-.13, y - .1, .3, width + .2, 5, '#efe3bf', '#a28a68', '#c5ad85', 47);
    // Striped little canopy above the street window.
    const stripes = Math.round(width / .29);
    for (let i = 0; i < stripes; i++) {
      const ya = y - .08 + i * (width + .16) / stripes;
      const yb = y - .08 + (i + 1) * (width + .16) / stripes;
      const shade = i % 2 ? '#f1e3bb' : '#bd674d';
      this.polygon([this.project(-.015, ya, 125), this.project(-.015, yb, 125), this.project(-.58, yb, 116), this.project(-.58, ya, 116)], shade);
      this.polygon([this.project(-.58, ya, 116), this.project(-.58, yb, 116), this.project(-.58, yb, 110), this.project(-.58, ya, 110)], i % 2 ? '#d9cda8' : '#a65343');
    }
    this.line([this.project(.04, y + .08, 112), this.project(.04, y + width * .9, 100)], '#ffffff65', 1.2);
  }

  private wallSign(): void {
    const c = this.ctx;
    const p = this.project(5.95, 0, 112);
    c.save(); c.translate(p.x, p.y); c.transform(1, 22 / 43, 0, 1, 0, 0);
    c.fillStyle = '#b78a52'; c.fillRect(-85, -21, 170, 42);
    c.fillStyle = '#294c3e'; c.fillRect(-82, -18, 164, 36);
    c.strokeStyle = '#c7ad78'; c.lineWidth = .7; c.strokeRect(-77, -13, 154, 26);
    this.text('D O R V I M', 0, 3, 20, '#f7ebc9', 'Georgia,serif');
    this.text('C O Z I N H A   D E   B A I R R O', 0, 12, 5.5, '#d1c69b');
    this.ellipse(-69, -1, 2.2, 2.2, '#d8bc7e'); this.ellipse(69, -1, 2.2, 2.2, '#d8bc7e');
    c.restore();
    const clock = this.project(9.5, .01, 107);
    this.ellipse(clock.x, clock.y, 13, 15, '#695c46');
    this.ellipse(clock.x, clock.y - .5, 10.5, 12.5, '#faf0ce');
    this.line([{ x: clock.x, y: clock.y - 7 }, clock, { x: clock.x + 5, y: clock.y + 2 }], '#555f4a', 1.2);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      this.ellipse(clock.x + Math.sin(angle) * 8, clock.y + Math.cos(angle) * 10, .8, 1, '#7c7b5b');
    }
  }

  private careerAwards(): void {
    const c = this.ctx;
    const count = Math.min(3, (this.state?.stage ?? 1) - 1);
    for (let i = 0; i < count; i++) {
      const p = this.project(2.1 + i * .71, .025, 111);
      c.save(); c.translate(p.x, p.y); c.transform(1, 22 / 43, 0, 1, 0, 0);
      c.fillStyle = '#aa8656'; c.fillRect(-11, -15, 22, 30);
      c.fillStyle = '#f0e4c4'; c.fillRect(-8, -12, 16, 24);
      const star: Point[] = [];
      for (let j = 0; j < 10; j++) {
        const angle = -Math.PI / 2 + j * Math.PI / 5;
        const radius = j % 2 ? 2.8 : 6;
        star.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius - 3 });
      }
      this.polygon(star, '#c79a4d');
      this.line([{ x: -4, y: 6 }, { x: 4, y: 6 }], '#999b76', .8);
      this.line([{ x: -3, y: 8 }, { x: 3, y: 8 }], '#b0ac8a', .6);
      c.restore();
    }
  }

  private fridge(x: number, y: number, restaurant?: Restaurant): void {
    const upgraded = (restaurant?.equipment.geladeira ?? 0) > 1;
    this.box(x, y, 1.18, 1.05, 84, upgraded ? '#c2d4c7' : '#e6e8d9', '#c7d5c7', '#91ad9c');
    this.line([this.project(x + .04, y + 1.055, 57), this.project(x + 1.13, y + 1.055, 57)], '#82998a', 1.6);
    this.line([this.project(x + .93, y + 1.07, 48), this.project(x + .93, y + 1.07, 24)], '#6d8070', 2.6);
    this.line([this.project(x + .93, y + 1.07, 74), this.project(x + .93, y + 1.07, 65)], '#6d8070', 2.3);
    const p = this.project(x + .4, y + 1.1, 39);
    this.ctx.save(); this.ctx.translate(p.x, p.y); this.ctx.rotate(.47);
    this.ctx.fillStyle = '#f6edd2'; this.ctx.fillRect(-10, -8, 20, 16);
    this.ctx.fillStyle = '#d59468'; this.ctx.fillRect(-7, -5, 8, 2);
    this.line([{ x: -7, y: 0 }, { x: 5, y: 0 }], '#a3a58b', 1);
    this.line([{ x: -7, y: 4 }, { x: 2, y: 4 }], '#a3a58b', 1);
    this.ctx.restore();
    this.herbPot(x + .57, y + .4, 85, .6);
  }

  private pantry(x: number, y: number): void {
    this.box(x, y, 1, .75, 68, '#bd9a66', '#957249', '#8e714b');
    this.polygon([this.project(x + .07, y + .76, 8), this.project(x + .93, y + .76, 8), this.project(x + .93, y + .76, 61), this.project(x + .07, y + .76, 61)], '#534e36');
    for (const z of [9, 34, 59]) {
      this.box(x - .02, y + .1, 1.04, .78, 3, '#c5a577', '#ac895e', '#9b7a52', z);
      if (z < 50) for (let i = 0; i < 3; i++) {
        const p = this.project(x + .2 + i * .28, y + .65, z + 3);
        this.ctx.fillStyle = ['#b97d48', '#b4b777', '#bd654f'][i];
        this.ctx.fillRect(p.x - 4, p.y - 12, 8, 12);
        this.ellipse(p.x, p.y - 12, 4, 2, '#dfcba5');
        this.ctx.fillStyle = '#e8d8ac'; this.ctx.fillRect(p.x - 3, p.y - 7, 6, 3);
      }
    }
    this.basket(x + .35, y + .35, 72);
  }

  private counterBase(x: number, y: number, w: number, color = '#5e7f68'): void {
    this.box(x + .05, y + .05, w - .1, 1.04, 39, '#b5bba5', color, '#42614f');
    this.box(x - .035, y - .035, w + .07, 1.16, 5, '#e4dfc9', '#c6c5af', '#b8c4af', 39);
    this.line([this.project(x + w * .5, y + 1.1, 4), this.project(x + w * .5, y + 1.1, 37)], '#3c624f', 1);
    for (let i = 0; i < 2; i++) {
      const p = this.project(x + w * (.22 + i * .5), y + 1.115, 30);
      this.line([{ x: p.x - 4, y: p.y - 2 }, { x: p.x + 4, y: p.y + 2 }], '#e0c68e', 2);
    }
    this.line([this.project(x + .08, y + 1.1, 3), this.project(x + w - .08, y + 1.1, 3)], '#263d303b', 3);
  }

  private prep(x: number, y: number, restaurant?: Restaurant): void {
    this.counterBase(x, y, 1.65);
    this.box(x + .18, y + .18, .87, .6, 2, '#c99959', '#ad7c41', '#b18145', 45);
    for (let i = 0; i < 4; i++) {
      const p = this.project(x + .38 + i * .12, y + .47, 48);
      this.ellipse(p.x, p.y, 3, 2.6, '#d76e47');
      this.ellipse(p.x + .5, p.y - 1, 1, .7, '#b9c665');
    }
    const knife = this.project(x + .5, y + .71, 49);
    this.line([{ x: knife.x - 3, y: knife.y - 2 }, { x: knife.x + 9, y: knife.y + 4 }], '#d6e1d5', 3);
    this.line([{ x: knife.x + 9, y: knife.y + 4 }, { x: knife.x + 15, y: knife.y + 7 }], '#544632', 3.3);
    this.bowl(x + 1.27, y + .55, 47, '#e2d9b7', '#839649', 10);
    this.herbPot(x + .25, y + .14, 46, .35);
    if ((restaurant?.equipment.bancada ?? 0) > 1) {
      const p = this.project(x + 1.36, y + .15, 46);
      this.ctx.fillStyle = '#a7b9ad'; this.ctx.fillRect(p.x - 5, p.y - 13, 11, 13);
      this.ellipse(p.x, p.y - 13, 7, 3, '#d9ded1');
    }
  }

  private stove(x: number, y: number, restaurant?: Restaurant): void {
    const upgraded = (restaurant?.equipment.fogao ?? 1) > 1;
    this.box(x + .04, y + .04, 1.5, 1.06, 40, upgraded ? '#bac7bc' : '#9faea0', upgraded ? '#9fac9e' : '#57766b', '#426252');
    this.box(x - .025, y, 1.63, 1.1, 5, '#73877b', '#bac6b4', '#8b9b8c', 40);
    for (let i = 0; i < 4; i++) {
      const p = this.project(x + .42 + (i % 2) * .76, y + .28 + Math.floor(i / 2) * .51, 46);
      this.ellipse(p.x, p.y, 9.2, 4.8, '#37483f');
      this.ellipse(p.x, p.y, 6, 3.2, '#202c26');
      this.line([{ x: p.x - 9, y: p.y - 2 }, { x: p.x + 9, y: p.y + 2 }], '#a1aa94', 1);
      if (i === 1 || i === 2) {
        this.ellipse(p.x, p.y - 1, 7, 3.7, '#e88f40');
        this.ellipse(p.x, p.y - 2, 5.8, 2.8, '#587e9a');
      }
    }
    const pan = this.project(x + .43, y + .82, 50);
    this.line([{ x: pan.x + 5, y: pan.y + 1 }, { x: pan.x + 20, y: pan.y + 9 }], '#263c33', 4);
    this.ellipse(pan.x, pan.y, 13, 7, '#374f41');
    this.ellipse(pan.x, pan.y - 2, 11, 5.5, '#c39b51');
    this.ellipse(pan.x - 1, pan.y - 3, 6, 3.2, '#8b4d2d');
    this.ellipse(pan.x + 5, pan.y - 4, 2.8, 1.6, '#829e49');
    const pot = this.project(x + 1.2, y + .32, 46);
    this.ctx.fillStyle = '#cb8b5c'; this.ctx.fillRect(pot.x - 10, pot.y - 12, 20, 11);
    this.ellipse(pot.x, pot.y, 10, 4.6, '#9b6544');
    this.ellipse(pot.x, pot.y - 12, 10, 4.3, '#dba875');
    this.ellipse(pot.x, pot.y - 12.5, 8, 3.1, '#a35a36');
    this.line([{ x: pot.x - 10, y: pot.y - 7 }, { x: pot.x - 15, y: pot.y - 7 }], '#74543a', 2);
    this.line([{ x: pot.x + 10, y: pot.y - 7 }, { x: pot.x + 15, y: pot.y - 7 }], '#74543a', 2);
    for (let i = 0; i < 4; i++) {
      const p = this.project(x + .2 + i * .37, y + 1.11, 33);
      this.ellipse(p.x, p.y, 2.8, 3.2, '#dedac1');
      this.line([{ x: p.x, y: p.y - 1 }, { x: p.x + 1, y: p.y + 1 }], '#6c6c58', 1);
    }
    // A brass-and-enamel range hood.
    const hood = (restaurant?.equipment.exaustor ?? 0) > 0;
    this.box(x + .07, y - .02, 1.47, .9, 8, hood ? '#b1c2b2' : '#829a86', hood ? '#819c89' : '#4b6d59', '#3d5b4a', 94);
    this.polygon([this.project(x + .07, y - .02, 102), this.project(x + 1.54, y - .02, 102), this.project(x + 1.3, y + .38, 119), this.project(x + .3, y + .38, 119)], '#64806c');
    this.line([this.project(x + .08, y + .89, 94), this.project(x + 1.54, y + .89, 94)], '#d1b270', 2);
    if (this.state?.phase === 'service' || this.menuMode) this.steam(pot.x, pot.y - 15, 1);
    if ((restaurant?.condition ?? 100) < 40) {
      this.line([this.project(x + .9, y + 1.12, 9), this.project(x + 1.15, y + 1.12, 19)], '#45564b', 2);
    }
  }

  private oven(x: number, y: number, restaurant?: Restaurant): void {
    this.counterBase(x, y, 1.5, (restaurant?.equipment.forno ?? 0) > 0 ? '#9aada1' : '#7e8b76');
    const p = (a: number, z: number) => this.project(x + a, y + 1.12, z);
    this.polygon([p(.12, 7), p(1.37, 7), p(1.37, 30), p(.12, 30)], '#3a4a3c');
    this.polygon([p(.23, 10), p(1.24, 10), p(1.24, 25), p(.23, 25)], '#aa643b');
    this.polygon([p(.26, 12), p(1.22, 12), p(1.22, 23), p(.26, 23)], '#d29c56');
    this.line([p(.3, 27), p(1.2, 27)], '#c7c6aa', 2.8);
    for (let i = 0; i < 2; i++) {
      const knob = p(.3 + i * .85, 35);
      this.ellipse(knob.x, knob.y, 3, 3.4, '#d6d1af');
    }
    const top = this.project(x + .7, y + .5, 46);
    this.ellipse(top.x, top.y, 19, 10, '#bd9c6a');
    this.ellipse(top.x, top.y - 2, 17.8, 8.6, '#d4b678');
    for (let i = 0; i < 3; i++) {
      const px = top.x - 10 + i * 10;
      this.ellipse(px, top.y - 4 + i % 2 * 3, 7, 3.8, '#d4954e');
      this.line([{ x: px - 2, y: top.y - 6 + i % 2 * 3 }, { x: px + 1, y: top.y - 3 + i % 2 * 3 }], '#e5bd7a', 1.7);
    }
    if ((restaurant?.equipment.forno ?? 0) > 1) this.ellipse(top.x + 29, top.y + 10, 2.5, 2.5, '#aacf78');
  }

  private sink(x: number, y: number, restaurant?: Restaurant): void {
    this.counterBase(x, y, 1.55);
    this.floorQuad(x + .15, y + .18, .83, .65, '#819c90', 45.3);
    this.floorQuad(x + .23, y + .25, .67, .48, '#a6bfb3', 45.6);
    const p = this.project(x + .53, y + .33, 46);
    this.line([{ x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 18 }, { x: p.x - 8, y: p.y - 23 }, { x: p.x - 14, y: p.y - 18 }, { x: p.x - 14, y: p.y - 13 }], '#c1d1bf', 3);
    this.line([{ x: p.x + 5, y: p.y + 2 }, { x: p.x + 11, y: p.y - 2 }], '#c1d1bf', 2);
    const plates = this.project(x + 1.2, y + .66, 47);
    for (let i = 0; i < 4; i++) {
      this.ellipse(plates.x, plates.y - i * 2, 11, 5, '#e6e9d8', '#b3c0a8');
    }
    const soap = this.project(x + 1.28, y + .15, 46);
    this.ctx.fillStyle = '#b4b65d'; this.ctx.fillRect(soap.x - 3, soap.y - 10, 6, 10);
    this.line([{ x: soap.x, y: soap.y - 10 }, { x: soap.x, y: soap.y - 14 }, { x: soap.x + 4, y: soap.y - 14 }], '#c7d5bd', 2);
    if ((restaurant?.equipment.lava_loucas ?? 0) > 0) {
      this.polygon([this.project(x + .05, y + 1.12, 6), this.project(x + .76, y + 1.12, 6), this.project(x + .76, y + 1.12, 37), this.project(x + .05, y + 1.12, 37)], '#b9c5b5');
      this.line([this.project(x + .14, y + 1.13, 30), this.project(x + .64, y + 1.13, 30)], '#627d6b', 2.4);
      const light = this.project(x + .6, y + 1.13, 34);
      this.ellipse(light.x, light.y, 1.4, 1.4, '#a4c476');
    }
  }

  private serviceCounter(x: number, y: number, restaurant?: Restaurant): void {
    this.box(x + .08, y + .06, 3.15, .83, 35, '#496851', '#54725a', '#38553f');
    this.box(x - .06, y - .05, 3.43, 1.02, 6, '#b9915c', '#9e784a', '#8e7047', 35);
    // Warm vertical fluting on the service island.
    for (let i = 0; i < 16; i++) this.line([this.project(x + .17 + i * .19, y + .91, 3), this.project(x + .17 + i * .19, y + .91, 32)], '#9bac7f4a', 1.6);
    this.line([this.project(x + .13, y + .92, 5), this.project(x + 3.19, y + .92, 5)], '#bd9b64', 2);
    const register = this.project(x + 2.78, y + .37, 43);
    this.box(x + 2.5, y + .15, .5, .45, 5, '#566355', '#465442', '#344237', 42);
    this.polygon([{ x: register.x - 9, y: register.y - 7 }, { x: register.x + 8, y: register.y - 1 }, { x: register.x + 8, y: register.y - 16 }, { x: register.x - 9, y: register.y - 22 }], '#425a4d', '#b4b295', 1);
    this.polygon([{ x: register.x - 6, y: register.y - 9 }, { x: register.x + 5, y: register.y - 5 }, { x: register.x + 5, y: register.y - 13 }, { x: register.x - 6, y: register.y - 17 }], '#9bad7e');
    this.basket(x + .55, y + .45, 44);
    if ((restaurant?.equipment.liquidificador ?? 0) > 0) {
      const blender = this.project(x + .22, y + .05, 43);
      this.ellipse(blender.x, blender.y, 6, 3.5, '#597264');
      this.polygon([{ x: blender.x - 4, y: blender.y - 3 }, { x: blender.x + 4, y: blender.y - 3 }, { x: blender.x + 6, y: blender.y - 19 }, { x: blender.x - 6, y: blender.y - 19 }], '#bdd5b29e', '#7d9b85');
      this.ctx.fillStyle = '#cda35e'; this.ctx.fillRect(blender.x - 3.5, blender.y - 12, 7, 8);
      this.ellipse(blender.x, blender.y - 19, 7, 2.5, '#4d6655');
    }
    this.plate(x + 1.5, y + .52, 43, 1, true);
    const p = this.project(x + 2.13, y + .4, 43);
    this.ellipse(p.x, p.y - 1, 8, 4, '#d5b781');
    this.ellipse(p.x, p.y - 4, 5.2, 3.2, '#b59657');
    this.ellipse(p.x, p.y - 6, 2, 2.5, '#dac89a');
    const sign = this.project(x + 1.7, y + .94, 22);
    this.ctx.save(); this.ctx.translate(sign.x, sign.y); this.ctx.transform(1, 22 / 43, 0, 1, 0, 0);
    this.ctx.fillStyle = '#e8d8b4'; this.ctx.fillRect(-29, -8, 58, 16);
    this.text('FEITO COM AFETO', 0, 2.5, 5.3, '#536747'); this.ctx.restore();
    if (restaurant && restaurant.cleanliness < 40) {
      const dirt = this.project(x + .3, y + .72, 42);
      this.ellipse(dirt.x, dirt.y, 9, 3.5, '#79553e3b');
    }
  }

  private chair(x: number, y: number, facing: number): void {
    const p = this.project(x, y);
    this.ellipse(p.x, p.y + 2, 17, 7, '#40523720');
    const wood = '#806649';
    for (const [dx, dy] of [[-.2, -.22], [.2, -.22], [-.2, .22], [.2, .22]]) {
      this.line([this.project(x + dx, y + dy), this.project(x + dx, y + dy, 15)], wood, 2.6);
    }
    this.box(x - .31, y - .29, .62, .58, 3, '#a7af80', '#798659', '#7e895d', 14);
    if (facing === 0) {
      this.line([this.project(x - .29, y - .28, 16), this.project(x - .29, y - .28, 37), this.project(x + .29, y - .28, 37), this.project(x + .29, y - .28, 16)], wood, 3);
      this.line([this.project(x - .28, y - .28, 32), this.project(x + .28, y - .28, 32)], '#98a575', 6);
    } else {
      this.line([this.project(x + .29, y - .28, 16), this.project(x + .29, y - .28, 37), this.project(x + .29, y + .28, 37), this.project(x + .29, y + .28, 16)], wood, 3);
      this.line([this.project(x + .29, y - .28, 32), this.project(x + .29, y + .28, 32)], '#98a575', 6);
    }
  }

  private table(x: number, y: number, style: number, restaurant?: Restaurant): void {
    const p = this.project(x, y);
    this.ellipse(p.x, p.y + 4, 37, 15, '#46543722');
    const base = this.project(x, y, 2);
    this.ellipse(base.x, base.y, 15, 6, '#485e47');
    this.line([{ x: base.x, y: base.y }, { x: base.x, y: base.y - 28 }], '#5c7152', 6);
    const top = this.project(x, y, 29);
    this.ellipse(top.x, top.y + 3, 37, 19, '#a87e4f');
    this.ellipse(top.x, top.y, 37, 19, '#e6ce9e', '#b08d5c');
    this.ellipse(top.x, top.y - .5, 33, 16, '#edd9ae');
    // Small linen runner, two settings, vase and a folded napkin.
    this.floorQuad(x - .1, y - .58, .34, 1.16, restaurant?.decor === 'elegante' ? '#698a8b' : restaurant?.decor === 'jardim' ? '#829a5e' : '#c97859', 30);
    this.plate(x - .38, y + .12, 30.6, style, this.menuMode || (restaurant?.orders[style]?.status === 'ready'));
    this.plate(x + .38, y - .1, 30.6, style + 1, this.menuMode && style % 2 === 0);
    const vase = this.project(x + .02, y - .12, 31);
    this.ellipse(vase.x, vase.y - 3, 3, 4, '#f5e8c3');
    this.line([{ x: vase.x, y: vase.y - 5 }, { x: vase.x + 1, y: vase.y - 15 }], '#7b8c50', 1);
    this.ellipse(vase.x + 2, vase.y - 15, 4, 2.5, style % 2 ? '#d4a046' : '#e5c263');
    this.ellipse(vase.x + 2, vase.y - 16, 1.5, 1.5, '#a98336');
    for (let i = 0; i < 2; i++) {
      const glass = this.project(x + (i ? .39 : -.39), y + (i ? -.47 : .46), 31);
      this.ctx.fillStyle = '#f4e8ce80'; this.ctx.fillRect(glass.x - 3, glass.y - 7, 6, 7);
      this.ellipse(glass.x, glass.y - 7, 3.5, 1.8, '#f4efd5', '#c7bd9e');
      this.ellipse(glass.x, glass.y - 2, 2.5, 1.2, '#d2b266');
    }
  }

  private plate(x: number, y: number, z: number, kind: number, hasFood: boolean): void {
    const p = this.project(x, y, z);
    this.ellipse(p.x, p.y, 12.5, 6.2, '#c9c5a4');
    this.ellipse(p.x, p.y - 1, 12.5, 6.2, '#f5edd4');
    this.ellipse(p.x, p.y - 1.2, 9, 4.1, '#e4dfc5', '#cbd1b1');
    if (!hasFood) return;
    if (kind % 4 === 0) {
      this.ellipse(p.x, p.y - 2, 8, 4, '#d8aa5a');
      this.ellipse(p.x, p.y - 2.6, 6.4, 3.1, '#c7693c');
      for (let i = 0; i < 4; i++) this.ellipse(p.x - 4 + i * 2.7, p.y - 3 + i % 2 * 2, 1.6, 1.1, '#70914b');
    } else if (kind % 4 === 1) {
      this.ellipse(p.x - 2, p.y - 3, 7, 3.5, '#895235');
      this.ellipse(p.x - 2, p.y - 6, 8, 3, '#8d9e42');
      this.ellipse(p.x - 2, p.y - 7.5, 7, 2.6, '#d9a94e');
      this.ellipse(p.x - 2, p.y - 9.3, 7.5, 4, '#d79b4a');
      for (let i = 0; i < 4; i++) this.ellipse(p.x - 6 + i * 2.4, p.y - 11 + i % 2, .6, .4, '#f4dca4');
    } else if (kind % 4 === 2) {
      this.ellipse(p.x - 3, p.y - 3, 5.5, 3, '#a65c39');
      this.ellipse(p.x + 5, p.y - 3, 3, 2, '#f0dfad');
      this.ellipse(p.x + 3, p.y - 6, 3.5, 2.5, '#7f9d46');
    } else {
      this.ellipse(p.x, p.y - 2, 7, 4, '#77a44b');
      for (let i = 0; i < 3; i++) this.ellipse(p.x - 4 + i * 4, p.y - 3 + i % 2 * 2, 2.5, 1.6, '#d87b4a');
    }
  }

  private bowl(x: number, y: number, z: number, color: string, food: string, radius: number): void {
    const p = this.project(x, y, z);
    this.ellipse(p.x, p.y - 1, radius * .8, radius * .65, color);
    this.ellipse(p.x, p.y - radius * .45, radius, radius * .48, '#f0e6c5');
    this.ellipse(p.x, p.y - radius * .48, radius * .83, radius * .34, food);
    for (let i = 0; i < 5; i++) this.ellipse(p.x - radius * .6 + i * radius * .3, p.y - radius * .6 + i % 2 * 2, 2, 1.2, '#b6bd64');
  }

  private basket(x: number, y: number, z: number): void {
    const p = this.project(x, y, z);
    this.ellipse(p.x, p.y + 1, 15, 6, '#a17946');
    this.ctx.fillStyle = '#b9965f'; this.ctx.fillRect(p.x - 14, p.y - 7, 28, 8);
    this.ellipse(p.x, p.y - 6, 15, 6, '#ceb47e');
    this.ellipse(p.x, p.y - 7, 12, 4.5, '#a9844e');
    for (let i = 0; i < 3; i++) {
      this.ellipse(p.x - 8 + i * 8, p.y - 9 - i % 2 * 3, 6, 4, '#d9a454');
      this.line([{ x: p.x - 10 + i * 8, y: p.y - 11 - i % 2 * 3 }, { x: p.x - 7 + i * 8, y: p.y - 8 - i % 2 * 3 }], '#ecc383', 1);
    }
    for (let i = 0; i < 6; i++) this.line([{ x: p.x - 12 + i * 5, y: p.y - 2 }, { x: p.x - 12 + i * 5, y: p.y + 3 }], '#8f6d40', .6);
  }

  private plant(x: number, y: number, scale: number): void {
    const p = this.project(x, y);
    const c = this.ctx;
    c.save(); c.translate(p.x, p.y); c.scale(scale, scale);
    this.ellipse(0, 3, 16, 6, '#4656381f');
    this.polygon([{ x: -13, y: -16 }, { x: 13, y: -16 }, { x: 9, y: 0 }, { x: -9, y: 0 }], '#b77f59');
    this.ellipse(0, -16, 14, 6, '#d39d6c');
    this.ellipse(0, -17, 11, 4, '#6b6040');
    for (let i = 0; i < 8; i++) {
      const angle = i * 2.4;
      const px = Math.sin(angle) * (13 + i % 3 * 4);
      const py = -30 - i * 3;
      this.line([{ x: 0, y: -17 }, { x: px, y: py }], '#537743', 1.4);
      c.save(); c.translate(px, py); c.rotate(Math.sin(angle) * .7);
      this.ellipse(0, -3, 6 + i % 2 * 2, 11, i % 2 ? '#71955b' : '#3f704d');
      this.line([{ x: 0, y: 5 }, { x: 0, y: -10 }], '#91ac6a', .6); c.restore();
    }
    c.restore();
  }

  private herbPot(x: number, y: number, z: number, scale: number): void {
    const p = this.project(x, y, z);
    const c = this.ctx;
    c.save(); c.translate(p.x, p.y); c.scale(scale, scale);
    this.polygon([{ x: -9, y: -11 }, { x: 9, y: -11 }, { x: 6, y: 0 }, { x: -6, y: 0 }], '#b27e51');
    this.ellipse(0, -11, 10, 4, '#cda06e');
    for (let i = 0; i < 6; i++) {
      const px = Math.sin(i * 2.1) * 9;
      const py = -14 - i % 3 * 5;
      this.line([{ x: 0, y: -10 }, { x: px, y: py }], '#63824b', 1);
      this.ellipse(px, py, 5, 3, i % 2 ? '#779653' : '#497849');
    }
    c.restore();
  }

  private bench(x: number, y: number): void {
    this.box(x, y, .7, 1.3, 16, '#a5ad7c', '#7f8b5d', '#5f7953');
    this.box(x - .12, y, .18, 1.3, 31, '#5a7757', '#547051', '#456044');
    this.floorQuad(x + .05, y + .1, .55, .47, '#c47755', 16.5);
    this.floorQuad(x + .05, y + .74, .55, .47, '#d4b276', 16.5);
    const p = this.project(x + .45, y + .7, 18);
    this.ctx.save(); this.ctx.translate(p.x, p.y); this.ctx.rotate(.46);
    this.ctx.fillStyle = '#e8ddc1'; this.ctx.fillRect(-6, -4, 12, 8);
    this.line([{ x: -3, y: -1 }, { x: 4, y: -1 }], '#8c9977', .7); this.ctx.restore();
    const coat = this.project(.02, 7.15, 83);
    this.line([{ x: coat.x, y: coat.y }, { x: coat.x + 12, y: coat.y + 7 }], '#9b845c', 3);
    this.line([{ x: coat.x + 6, y: coat.y + 2 }, { x: coat.x + 6, y: coat.y + 11 }], '#826e4e', 2);
    this.polygon([{ x: coat.x, y: coat.y + 13 }, { x: coat.x + 10, y: coat.y + 16 }, { x: coat.x + 14, y: coat.y + 37 }, { x: coat.x - 4, y: coat.y + 29 }], '#c19a65');
    this.polygon([{ x: coat.x - 1, y: coat.y + 12 }, { x: coat.x + 5, y: coat.y + 15 }, { x: coat.x + 8, y: coat.y + 32 }, { x: coat.x + 2, y: coat.y + 28 }], '#a97e52');
  }

  private chalkboard(x: number, y: number): void {
    const p = this.project(x, y);
    const c = this.ctx;
    c.save(); c.translate(p.x, p.y); c.transform(1, -.19, .1, 1, 0, 0);
    this.line([{ x: -18, y: 1 }, { x: -13, y: -47 }, { x: 14, y: -47 }, { x: 20, y: 1 }], '#8b6e46', 4);
    c.fillStyle = '#a88a58'; c.fillRect(-19, -48, 38, 43);
    c.fillStyle = '#345343'; c.fillRect(-16, -45, 32, 36);
    this.text('HOJE', 0, -35, 7, '#f5e8c5', 'Georgia,serif');
    this.line([{ x: -11, y: -31 }, { x: 11, y: -31 }], '#c6cda4', .6);
    this.text('comida boa', 0, -23, 4.9, '#e1e5bf');
    this.text('café quentinho', 0, -16, 4.7, '#e1e5bf');
    this.ellipse(0, -11, 1, 1, '#dcb67b');
    c.restore();
  }

  private person(x: number, y: number, variant: number, chef: boolean, seated = false, walking = false): void {
    const p = this.project(x, y);
    const c = this.ctx;
    const t = this.time;
    const breath = Math.sin(t * 2.2 + variant * 3) * .65;
    const gait = walking ? Math.sin(t * 7 + variant) * 2.8 : .3;
    const skin = ['#d9ac84', '#a87453', '#e7bc93', '#ba8864', '#81533d', '#e9c4a1'][variant % 6];
    const shirt = chef ? '#f3ecda' : ['#b96e50', '#6d8583', '#6b7953', '#d2a359', '#6c7a92', '#bd8d80'][variant % 6];
    const hair = ['#493c2e', '#6b4733', '#bd9160', '#45433b', '#714c39'][variant % 5];
    c.save(); c.translate(p.x, p.y + breath);
    this.ellipse(0, 1 - breath, 13, 5, '#364b3328');
    const lift = seated ? 10 : 0;
    if (!seated) {
      this.line([{ x: -4, y: -17 }, { x: -5 - gait, y: -3 }], '#3a5148', 5.5);
      this.line([{ x: 4, y: -17 }, { x: 5 + gait, y: -2 }], '#32493f', 5.5);
      this.ellipse(-6 - gait, -1, 5.4, 2.4, '#3d3c30');
      this.ellipse(6 + gait, 0, 5.4, 2.5, '#3d3c30');
    } else {
      this.line([{ x: -5, y: -16 }, { x: -8, y: -8 }, { x: -6, y: -2 }], '#3d514a', 5);
      this.line([{ x: 4, y: -16 }, { x: 8, y: -10 }, { x: 9, y: -3 }], '#43574c', 5);
      this.ellipse(-5, -1, 5, 2.5, '#4d4935'); this.ellipse(10, -2, 5, 2.4, '#4d4935');
    }
    c.translate(0, lift);
    this.polygon([{ x: -9, y: -36 }, { x: 8, y: -35 }, { x: 10, y: -18 }, { x: 6, y: -15 }, { x: -8, y: -16 }, { x: -11, y: -20 }], shirt);
    this.polygon([{ x: 3, y: -34 }, { x: 8, y: -35 }, { x: 10, y: -18 }, { x: 5, y: -16 }], chef ? '#d9dccb' : '#273e2d20');
    if (chef) {
      this.polygon([{ x: -5, y: -32 }, { x: 5, y: -31 }, { x: 6, y: -17 }, { x: -6, y: -17 }], variant ? '#6e896c' : '#c07954');
      this.line([{ x: -5, y: -31 }, { x: -6, y: -36 }], '#c07954', 1.8);
      this.line([{ x: 5, y: -31 }, { x: 4, y: -35 }], '#c07954', 1.8);
      this.line([{ x: -3, y: -24 }, { x: 3, y: -23 }], '#f6e9ce', 1);
      for (let i = 0; i < 2; i++) this.ellipse(-7, -31 + i * 5, .9, .9, '#a9b5a0');
    }
    const arm = seated ? -6 : gait * .5;
    this.line([{ x: -10, y: -32 }, { x: -13, y: -24 + arm }, { x: -11, y: -20 + arm }], shirt, 5);
    this.line([{ x: 9, y: -31 }, { x: 13, y: -23 - arm }, { x: 12, y: -19 - arm }], shirt, 5);
    this.ellipse(-11, -19 + arm, 2.9, 3.3, skin);
    this.ellipse(12, -18 - arm, 2.9, 3.3, skin);
    this.ctx.fillStyle = skin; this.ctx.fillRect(-3, -41, 6, 6);
    this.ellipse(0, -44, 8.8, 10, hair);
    if (!chef && variant % 4 === 2) this.ellipse(-6, -39, 5, 8, hair);
    this.ellipse(1, -42.5, 7.5, 8.5, skin);
    this.ellipse(-6, -42.5, 2.2, 2.9, skin);
    this.ellipse(7.7, -41.5, 1.8, 2.7, skin);
    this.polygon([{ x: -7, y: -45 }, { x: -7, y: -50 }, { x: -2, y: -54 }, { x: 5, y: -51 }, { x: 8, y: -46 }, { x: 1, y: -47 }, { x: -2, y: -49 }], hair);
    this.ellipse(-1.1, -43, .85, 1.1, '#454233');
    this.ellipse(5, -42, .85, 1.1, '#454233');
    this.line([{ x: 2, y: -40.5 }, { x: 3, y: -38.5 }], '#92674a', .6);
    this.line([{ x: .4, y: -36.7 }, { x: 3.3, y: -36.3 }, { x: 5, y: -37.2 }], '#9b674a', .7);
    if (!chef && variant % 3 === 0) {
      this.ellipse(-.8, -43, 3.2, 2.8, '#00000000', '#605e47');
      this.ellipse(5.7, -42, 3.2, 2.8, '#00000000', '#605e47');
      this.line([{ x: 2, y: -43 }, { x: 3, y: -42.5 }], '#605e47', 1);
    }
    if (chef) {
      this.ctx.fillStyle = '#f9f3df'; this.ctx.fillRect(-8, -59, 16, 9);
      this.ellipse(-7, -59, 6, 5.6, '#faf5e8');
      this.ellipse(0, -62, 6.5, 6.6, '#fff9e9');
      this.ellipse(7, -59, 5.8, 5.6, '#f4efdc');
      this.line([{ x: -7, y: -51 }, { x: 7, y: -50 }], '#d9ddc9', 1.5);
      if (variant === 0) {
        this.ellipse(1, -37.4, 2.1, .8, '#604938'); this.ellipse(4, -37, 2.2, .8, '#604938');
      }
    } else if (variant % 5 === 4) {
      this.ellipse(0, -52, 11, 3.5, '#cdbb8e');
      this.ellipse(0, -55, 7, 5, '#dccca7');
    }
    c.restore();
  }

  private orderBubble(x: number, y: number, order: Order): void {
    const p = this.project(x, y, 71);
    p.y += Math.sin(this.time * 2 + order.id) * 1.5;
    const c = this.ctx;
    const ratio = order.patience / Math.max(1, order.maxPatience);
    const ready = order.status === 'ready';
    const hover = Math.hypot(p.x - this.mouse.x, p.y - this.mouse.y) < 26;
    c.save(); c.shadowColor = '#33452b28'; c.shadowBlur = 6; c.shadowOffsetY = 3;
    c.beginPath(); c.roundRect(p.x - 18, p.y - 18, 36, 33, 10);
    c.fillStyle = ready ? '#dfedc9' : '#fff4dc'; c.fill(); c.restore();
    this.polygon([{ x: p.x - 3, y: p.y + 12 }, { x: p.x + 5, y: p.y + 12 }, { x: p.x + 1, y: p.y + 19 }], ready ? '#dfedc9' : '#fff4dc');
    c.strokeStyle = hover ? '#ba8050' : '#e8d6b2'; c.lineWidth = hover ? 2 : 1;
    c.beginPath(); c.roundRect(p.x - 18, p.y - 18, 36, 33, 10); c.stroke();
    this.ellipse(p.x, p.y - 2, 11, 5, '#e0d3b3');
    this.ellipse(p.x, p.y - 3, 9.5, 4.2, '#f9f1dc');
    const food = order.recipeId.toLowerCase();
    if (/salad|salada/.test(food)) {
      for (let i = 0; i < 4; i++) this.ellipse(p.x - 5 + i * 3.3, p.y - 5 + i % 2 * 2, 3, 2.4, i % 2 ? '#85a451' : '#c8834a');
    } else if (/cafe|café|suco|drink/.test(food)) {
      c.fillStyle = '#d4ba85'; c.fillRect(p.x - 5, p.y - 11, 10, 11); this.ellipse(p.x, p.y - 11, 5, 2, '#8b6340');
    } else {
      this.ellipse(p.x, p.y - 5, 7, 3.4, '#bc7840');
      this.ellipse(p.x, p.y - 8, 7.5, 3.5, '#d6ac59');
      this.ellipse(p.x, p.y - 8, 5, 2, '#bf7950');
      this.ellipse(p.x + 3, p.y - 9, 2.3, 1.5, '#7a9c49');
    }
    c.fillStyle = '#e2d5b4'; c.beginPath(); c.roundRect(p.x - 11, p.y + 7, 22, 3, 2); c.fill();
    c.fillStyle = ready ? '#718d49' : ratio < .3 ? '#c86d47' : '#9ba664';
    c.beginPath(); c.roundRect(p.x - 11, p.y + 7, Math.max(2, 22 * ratio), 3, 2); c.fill();
    if (ready) {
      this.ellipse(p.x + 16, p.y - 15, 6.5, 6.5, '#60804b');
      this.line([{ x: p.x + 13, y: p.y - 15 }, { x: p.x + 15, y: p.y - 13 }, { x: p.x + 19, y: p.y - 17 }], '#f3edd5', 1.5);
    }
    this.customerHits.push({ point: p, order });
    this.customerHits.push({ point: this.project(x, y, 30), order });
  }

  private steam(x: number, y: number, scale: number): void {
    const c = this.ctx;
    c.save(); c.lineWidth = 1.7 * scale; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const cycle = ((this.time * .35 + i * .24) % 1);
      const rise = cycle * 31;
      const drift = Math.sin(this.time * 1.6 + i * 2) * 3;
      c.strokeStyle = `rgba(251,246,223,${(1 - cycle) * .65})`;
      c.beginPath(); c.moveTo(x + (i - 1.5) * 4 + drift, y - rise);
      c.bezierCurveTo(x + (i - 1.5) * 4 + drift - 5, y - rise - 5, x + (i - 1.5) * 4 + drift + 6, y - rise - 8, x + (i - 1.5) * 4 + drift + 1, y - rise - 13); c.stroke();
    }
    c.restore();
  }

  private lamps(): void {
    const c = this.ctx;
    for (const [x, y] of [[2.3, 4.1], [5.2, 4.8], [8.1, 4.2]]) {
      const p = this.project(x, y, 129);
      this.line([{ x: p.x, y: p.y - 32 }, { x: p.x, y: p.y - 5 }], '#71816b', 1.2);
      const glow = c.createRadialGradient(p.x, p.y + 17, 2, p.x, p.y + 17, 43);
      glow.addColorStop(0, '#fff0b330'); glow.addColorStop(1, '#fff0b300');
      this.ellipse(p.x, p.y + 17, 43, 37, glow);
      this.polygon([{ x: p.x - 6, y: p.y - 7 }, { x: p.x + 6, y: p.y - 7 }, { x: p.x + 18, y: p.y + 7 }, { x: p.x - 18, y: p.y + 7 }], '#63816a');
      this.ellipse(p.x, p.y + 7, 18, 6, '#c5b780');
      this.ellipse(p.x, p.y + 8, 15.5, 4, '#f4d68e');
      this.ellipse(p.x, p.y + 9, 6, 3, '#fff2b7');
      this.line([{ x: p.x - 4, y: p.y - 6 }, { x: p.x - 13, y: p.y + 4 }], '#7e9678', 1.3);
    }
  }

  private foreground(): void {
    // Exposed timber edge, brass corner caps, and a welcoming step.
    this.line([this.project(0, 8, 0), this.project(10, 8, 0), this.project(10, 0, 0)], '#efe0b9', 2.4);
    this.line([this.project(0, 8, -13), this.project(10, 8, -13), this.project(10, 0, -13)], '#886a4e', 1.4);
    this.box(7.9, 8.04, 1.8, .55, 6, '#b69e76', '#96825e', '#a68e69', -16);
    this.floorQuad(8.05, 7.13, 1.35, .7, '#6b7952', .5);
    const p = this.project(8.72, 7.48, 1);
    this.ctx.save(); this.ctx.translate(p.x, p.y); this.ctx.transform(1, .51, -.97, .5, 0, 0);
    this.text('BEM-VINDO', 0, 2, 5.8, '#e0d5ad'); this.ctx.restore();
    // Window box overflowing with herbs outside the cafe.
    this.box(-.75, 4.6, .5, 1.3, 15, '#ba9765', '#8d7950', '#a18759', -8);
    for (let i = 0; i < 5; i++) this.herbPot(-.55, 4.7 + i * .24, 7, .5);
    const p2 = this.project(-.53, 5.25, 20);
    for (let i = 0; i < 6; i++) this.ellipse(p2.x + Math.sin(i * 2) * 17, p2.y + Math.cos(i * 2) * 7, 2.5, 2, i % 2 ? '#d59d5d' : '#d58062');
  }

  private atmosphere(restaurant?: Restaurant): void {
    const c = this.ctx;
    const shine = c.createRadialGradient(204, 193, 15, 290, 284, 400);
    shine.addColorStop(0, '#fff7d01c'); shine.addColorStop(1, '#fff7d000');
    c.fillStyle = shine; c.fillRect(0, 0, WIDTH, HEIGHT);
    if (!this.options.reducedMotion && !this.state?.settings.reducedMotion) {
      for (let i = 0; i < 13; i++) {
        const phase = this.time * .1 + i * 2.13;
        const x = 166 + ((i * 46 + Math.sin(phase) * 13) % 350);
        const y = 213 + ((i * 33 + this.time * 3) % 240);
        this.ellipse(x, y, .9, .9, `rgba(255,250,210,${.17 + Math.sin(phase) * .12})`);
      }
    }
    // Tiny picture-book caption is part of the scene, not an application panel.
    const label = this.state?.stage && this.state.stage > 2 ? 'um pequeno sonho. uma grande cozinha.' : 'cada receita começa com um sonho.';
    this.text(label, 455, 633, 11, '#7e856c', 'Georgia,serif');
    if (restaurant?.decor && /flor|jardim|botan|natural/i.test(restaurant.decor)) {
      this.plant(9.5, 2.3, .85);
      this.plant(.6, 7.4, .9);
    }
  }

  private interactionHints(): void {
    const c = this.ctx;
    if (this.hover) {
      const station = stations.find(item => item.id === this.hover)!;
      const p = this.project(station.x, station.y, station.z);
      const t = this.time;
      c.save(); c.strokeStyle = '#f8d18c'; c.lineWidth = 1.7;
      c.beginPath(); c.ellipse(p.x, p.y + 7, 26 + Math.sin(t * 3), 12, 0, 0, Math.PI * 2); c.stroke();
      c.font = '600 13px sans-serif';
      const width = c.measureText(station.label).width + 28;
      c.shadowColor = '#243d3020'; c.shadowBlur = 8; c.shadowOffsetY = 3;
      c.fillStyle = '#294c3f'; c.beginPath(); c.roundRect(p.x - width / 2, p.y - 50, width, 30, 7); c.fill();
      c.shadowColor = 'transparent';
      this.text(station.label, p.x, p.y - 30, 13, '#fff3d4');
      this.polygon([{ x: p.x - 4, y: p.y - 21 }, { x: p.x + 4, y: p.y - 21 }, { x: p.x, y: p.y - 16 }], '#294c3f'); c.restore();
    }
    if (this.target) {
      const p = this.project(this.target.x, this.target.y, 1);
      c.save(); c.strokeStyle = '#f6edc3b0'; c.lineWidth = 1.5;
      c.setLineDash([2, 4]); c.beginPath(); c.ellipse(p.x, p.y, 13, 6, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    }
  }
}
