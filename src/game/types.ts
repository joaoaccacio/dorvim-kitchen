export type CookingAction = 'cut' | 'mix' | 'grill' | 'bake' | 'plate' | 'season' | 'drink' | 'wash';
export type Role = 'auxiliar' | 'cozinheiro' | 'chef' | 'garcom' | 'faxineiro' | 'gerente' | 'estoquista';
export type Difficulty = 'casual' | 'normal' | 'especialista';
export interface Step { action: CookingAction; label: string; hint: string; target?: number; }
export interface Recipe {
  id: string; name: string; category: string; description: string; color: string;
  ingredients: Record<string, number>; steps: Step[]; price: number; cost: number;
  difficulty: number; unlock: number; equipment?: string; seconds: number; potential: number;
}
export interface Ingredient { id: string; name: string; color: string; price: number; shelfLife: number; }
export interface Equipment { id: string; name: string; description: string; price: number; unlock: number; max: number; }
export interface Candidate { id: string; name: string; role: Role; speed: number; skill: number; hygiene: number; organization: number; stress: number; wage: number; unlock: number; bio: string; }
export interface Employee extends Candidate { level: number; experience: number; fatigue: number; active: boolean; task: string; served: number; restaurantId?: number; }
export interface Stock { quantity: number; quality: number; expires: number; }
export interface Review { day: number; name: string; score: number; text: string; }
export interface Transaction { day: number; category: string; label: string; amount: number; }
export interface Order {
  id: number; recipeId: string; customer: string; profile: string; patience: number; maxPatience: number;
  status: 'waiting' | 'manual' | 'auto' | 'ready'; progress: number; quality: number;
  scores: number[]; stepIndex: number; ingredientQuality: number; assigned?: string;
}
export interface Restaurant {
  id: number; name: string; style: string; managerId?: string; equipment: Record<string, number>;
  decor: string; reputation: number; cleanliness: number; condition: number;
  stock: Record<string, Stock>; menu: string[]; prices: Record<string, number>; orders: Order[];
  revenue: number; served: number; lost: number; profit: number; closed?: boolean;
}
export interface DayReport { day: number; revenue: number; expenses: number; served: number; lost: number; quality: number; tips: number; inspection?: string; }
export interface Competition { round: number; scores: number[]; enteredDay: number; active: boolean; wins: number; recipeId?: string; }
export interface GameEvent { id: string; title: string; text: string; choices: { label: string; effect: string }[]; }
export interface Settings { music: number; effects: number; reducedMotion: boolean; showTips: boolean; }
export interface GameState {
  version: number; careerName: string; difficulty: Difficulty; day: number; cash: number; xp: number; stage: number;
  phase: 'planning' | 'service' | 'summary'; elapsed: number; duration: number; paused: boolean; speed: number;
  activeRestaurant: number; restaurants: Restaurant[]; employees: Employee[]; unlocked: string[];
  ledger: Transaction[]; reviews: Review[]; reports: DayReport[]; achievements: string[];
  settings: Settings; competition: Competition; event: GameEvent | null; tutorial: number;
  nextOrderId: number; spawnIn: number; servedTotal: number; qualityTotal: number;
  taxes: number; taxDue: number; inspectionDue: number; inspectionResult: string;
  daily: { revenue: number; expenses: number; served: number; lost: number; quality: number; tips: number };
  sales: Record<string, { count: number; revenue: number }>;
  rng: number; playTime: number; savedAt: number; notices: string[];
  eventEffects?: { demand: number; supply: number; critic: boolean; absentId?: string };
  reliefUsed?: boolean;
  debt?: number;
}
export type Command =
  | { type: 'open' | 'close' | 'nextDay' | 'clean' | 'repair' | 'payTax' | 'relief' | 'inspect' }
  | { type: 'prepare' | 'serve' | 'cancel'; orderId: number }
  | { type: 'step'; orderId: number; score: number; stepIndex?: number }
  | { type: 'buy'; ingredientId: string; quantity: number; supplier: 'economico' | 'horta' | 'expresso' }
  | { type: 'hire'; candidateId: string }
  | { type: 'fire' | 'train' | 'promote' | 'toggleEmployee'; employeeId: string }
  | { type: 'assign'; employeeId: string; role: Role }
  | { type: 'upgrade'; equipmentId: string }
  | { type: 'menu'; recipeId: string; enabled: boolean }
  | { type: 'price'; recipeId: string; price: number }
  | { type: 'expand'; name: string; style: string }
  | { type: 'switch'; restaurantId: number }
  | { type: 'decorate'; decor: string }
  | { type: 'competition'; action: 'enter' | 'withdraw' }
  | { type: 'competitionScore'; scores: number[] }
  | { type: 'event'; choice: number };
export interface Result { ok: boolean; message: string; }
