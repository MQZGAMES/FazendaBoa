/** Mineração (seção 12). Todo o balanceamento fica aqui. */
export const MINE_FLOORS = 40;
export const ELEVATOR_EVERY = 5;
/** Andar com lago subterrâneo (pesca na Fase 7). */
export const LAKE_FLOOR = 20;

export interface MineralDef { name: string; price: number; }
export const MINERALS: Record<string, MineralDef> = {
  copper_ore: { name: 'Minério de bronze', price: 5 },
  iron_ore: { name: 'Minério de ferro', price: 10 },
  gold_ore: { name: 'Minério de ouro', price: 25 },
  coal: { name: 'Carvão', price: 15 },
  copper_bar: { name: 'Barra de bronze', price: 60 },
  iron_bar: { name: 'Barra de ferro', price: 120 },
  gold_bar: { name: 'Barra de ouro', price: 250 },
  quartz: { name: 'Quartzo', price: 25 },
  amethyst: { name: 'Ametista', price: 100 },
  topaz: { name: 'Topázio', price: 80 },
  emerald: { name: 'Esmeralda', price: 250 },
  ruby: { name: 'Rubi', price: 250 },
  diamond: { name: 'Diamante', price: 750 },
};

/**
 * Tipos de rocha na mina (índice = ROCK_KINDS em art/nature.ts):
 * golpes base (picareta básica), item, quantidade e faixa de andares/peso.
 */
export interface RockDef { kind: string; hp: number; drop: string; qty: [number, number]; floors: [number, number]; weight: number; }
export const MINE_ROCKS: RockDef[] = [
  { kind: 'stone', hp: 1, drop: 'stone', qty: [1, 2], floors: [1, 40], weight: 70 },
  { kind: 'copper', hp: 2, drop: 'copper_ore', qty: [1, 3], floors: [1, 15], weight: 14 },
  { kind: 'iron', hp: 3, drop: 'iron_ore', qty: [1, 3], floors: [10, 30], weight: 12 },
  { kind: 'gold', hp: 4, drop: 'gold_ore', qty: [1, 3], floors: [25, 40], weight: 10 },
  { kind: 'coal', hp: 2, drop: 'coal', qty: [1, 2], floors: [3, 40], weight: 5 },
  { kind: 'quartz', hp: 3, drop: 'quartz', qty: [1, 1], floors: [1, 40], weight: 3 },
  { kind: 'amethyst', hp: 3, drop: 'amethyst', qty: [1, 1], floors: [1, 20], weight: 1.5 },
  { kind: 'topaz', hp: 3, drop: 'topaz', qty: [1, 1], floors: [5, 25], weight: 1.5 },
  { kind: 'emerald', hp: 4, drop: 'emerald', qty: [1, 1], floors: [15, 40], weight: 1 },
  { kind: 'ruby', hp: 4, drop: 'ruby', qty: [1, 1], floors: [20, 40], weight: 1 },
  { kind: 'diamond', hp: 5, drop: 'diamond', qty: [1, 1], floors: [30, 40], weight: 0.4 },
];
/** Dano por golpe da picareta por nível (básico, bronze, ferro, ouro). */
export const PICK_POWER = [1, 1.5, 2.2, 3.5];

/** Chance de a escada aparecer ao quebrar uma pedra (sobe a cada pedra quebrada). */
export const LADDER_BASE = 0.02;
export const LADDER_STEP = 0.012;

/** Fornalha (seção 12): 5 minérios + 1 carvão = 1 barra em 30 min de jogo. */
export const SMELT = { ore: 5, coal: 1, minutes: 30 };
export const SMELT_RECIPES: Record<string, string> = { copper_ore: 'copper_bar', iron_ore: 'iron_bar', gold_ore: 'gold_bar' };

/** Pedras grandes que podem ser carregadas (seção 12.1). */
export const CARRY_SLOW = 0.7;
export const ROCKPILE_STONE = 2; // pedras por rocha na pilha
