import type { Appearance } from './art/character';
import { DEFAULT_LOOK } from './art/character';
import type { ToolKind } from './data/objects';
import type { Location } from './world/Location';

export interface ItemStack { id: string; q: number; ql?: number; }
export type Dir4 = 0 | 1 | 2 | 3; // baixo, cima, esquerda, direita
export type Skill = 'farming' | 'mining' | 'foraging' | 'fishing' | 'ranching';

export interface PlayerState {
  name: string;
  farm: string;
  look: Appearance;
  pet: 'dog' | 'cat';
  money: number;
  energy: number;
  maxEnergy: number;
  loc: string;
  x: number;
  y: number;
  dir: Dir4;
  sel: number;
  inv: (ItemStack | null)[];
  tools: Record<ToolKind, number>;
  water: number;
  xp: Record<Skill, number>;
}

export interface TimeState { day: number; season: number; year: number; min: number; }

export interface GameState {
  seed: number;
  player: PlayerState;
  time: TimeState;
  weather: { today: Weather; tomorrow: Weather };
  locs: Map<string, Location>;
  flags: Record<string, number>;
}
export type Weather = 'sun' | 'cloud' | 'rain' | 'storm' | 'snow';

export const DAY_START = 6 * 60;
export const DAY_END = 26 * 60; // 2:00 do dia seguinte

export function newGameState(seed = (Math.random() * 1e9) | 0): GameState {
  const inv: (ItemStack | null)[] = new Array(12).fill(null);
  inv[0] = { id: 'hoe', q: 1 };
  inv[1] = { id: 'can', q: 1 };
  inv[2] = { id: 'axe', q: 1 };
  inv[3] = { id: 'pickaxe', q: 1 };
  inv[4] = { id: 'scythe', q: 1 };
  inv[5] = { id: 'seed_parsnip', q: 15 };
  return {
    seed,
    player: {
      name: 'Fazendeiro', farm: 'Boa', look: { ...DEFAULT_LOOK }, pet: 'dog',
      money: 500, energy: 270, maxEnergy: 270,
      loc: 'farm', x: 0, y: 0, dir: 0, sel: 0, inv,
      tools: { hoe: 0, can: 0, axe: 0, pickaxe: 0, scythe: 0, rod: 0, bucket: 0 },
      water: 40,
      xp: { farming: 0, mining: 0, foraging: 0, fishing: 0, ranching: 0 },
    },
    time: { day: 1, season: 0, year: 1, min: DAY_START },
    weather: { today: 'sun', tomorrow: 'sun' },
    locs: new Map(),
    flags: {},
  };
}

/** Estado global do jogo em memória. */
export let G: GameState = newGameState();
export function setGame(s: GameState): void { G = s; }
