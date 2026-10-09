import { Location, T, type Crop } from '../world/Location';
import { CROP_BY_SEED, CROP_BY_ID, cropStage, CROP_STAGES, type CropDef } from '../data/crops';
import { G } from '../state';
import { skillLevel } from './Skills';

/* Bits do solo: bit0 arado, bit1 molhado, bits2-3 fertilizante, bits4-7 dias sem planta */
export const SOIL_TILLED = 1, SOIL_WET = 2;

export function isTilled(L: Location, i: number): boolean { return (L.soil[i] & SOIL_TILLED) !== 0; }
export function isWet(L: Location, i: number): boolean { return (L.soil[i] & SOIL_WET) !== 0; }
export function fertilizer(L: Location, i: number): number { return (L.soil[i] >> 2) & 3; }

/** Pode arar: terreno natural, sem objeto, ainda não arado. Só na fazenda/estufa. */
export function canTill(L: Location, x: number, y: number): boolean {
  if (!L.inb(x, y) || !(L.id === 'farm' || L.id === 'greenhouse')) return false;
  const i = L.idx(x, y);
  const t = L.terrain[i];
  if (t !== T.Grass && t !== T.Dirt && !(L.id === 'greenhouse' && t === T.Floor)) return false;
  return !L.occ[i] && !isTilled(L, i);
}

export function till(L: Location, x: number, y: number): void {
  const i = L.idx(x, y);
  L.soil[i] = SOIL_TILLED | (L.soil[i] & 0b1100);
}

export function water(L: Location, x: number, y: number): boolean {
  const i = L.idx(x, y);
  if (!isTilled(L, i) || isWet(L, i)) return false;
  L.soil[i] |= SOIL_WET;
  return true;
}

/** A semente cresce aqui agora? (estufa ignora estação) */
export function seedFits(L: Location, def: CropDef): boolean {
  return !L.outdoor || L.id === 'greenhouse' || def.seasons.includes(G.time.season);
}

export function plant(L: Location, x: number, y: number, seedId: string): boolean {
  const def = CROP_BY_SEED[seedId];
  const i = L.idx(x, y);
  if (!def || !isTilled(L, i) || L.crops.has(i)) return false;
  L.crops.set(i, { id: def.id, age: 0, stage: 0 });
  L.soil[i] &= 0x0f; // zera contador de dias sem planta
  return true;
}

export function cropReady(c: Crop): boolean { return !c.dead && c.stage >= CROP_STAGES - 1; }

/** Sorteia a qualidade da colheita (nível de Agricultura e fertilizante). */
export function rollQuality(fert: number): number {
  const lvl = skillLevel('farming');
  const gold = 0.2 * (lvl / 10) + 0.2 * fert * ((lvl + 2) / 12) + 0.01;
  const silver = Math.min(0.75, gold * 2);
  const r = Math.random();
  if (r < gold) return 2;
  if (r < silver) return 1;
  return 0;
}

/** Colhe; retorna produto e quantidade (null se não estiver pronta). */
export function harvest(L: Location, x: number, y: number): { id: string; q: number; ql: number } | null {
  const i = L.idx(x, y);
  const c = L.crops.get(i);
  if (!c || !cropReady(c)) return null;
  const def = CROP_BY_ID[c.id];
  const ql = rollQuality(fertilizer(L, i));
  if (def.regrow > 0) {
    c.age = def.days - def.regrow;
    c.stage = cropStage(def, c.age);
    c.regrow = 1;
  } else {
    L.crops.delete(i);
  }
  return { id: def.id, q: def.harvest, ql };
}

/**
 * Avanço diário de um mapa: plantas regadas crescem; fora da estação morrem;
 * solo seca; solo sem planta por 3 dias volta a ser grama.
 */
export function growDay(L: Location, newSeason: number): { died: number; reverted: number[] } {
  let died = 0;
  const reverted: number[] = [];
  const greenhouse = L.id === 'greenhouse';
  for (const [i, c] of L.crops) {
    if (c.dead) continue;
    const def = CROP_BY_ID[c.id];
    if (!def) { L.crops.delete(i); continue; }
    if (L.outdoor && !greenhouse && !def.seasons.includes(newSeason)) { c.dead = 1; died++; continue; }
    if (isWet(L, i)) {
      c.age++;
      c.stage = cropStage(def, c.age);
    }
  }
  for (let i = 0; i < L.soil.length; i++) {
    const s = L.soil[i];
    if (!(s & SOIL_TILLED)) continue;
    let ns = s & ~SOIL_WET;
    if (!L.crops.has(i)) {
      const days = ((ns >> 4) & 15) + 1;
      ns = (ns & 0x0f) | (Math.min(15, days) << 4);
      if (days >= 3 && !greenhouse) { ns = 0; reverted.push(i); }
    }
    L.soil[i] = ns;
  }
  return { died, reverted };
}

/** Chuva rega todo o solo arado ao ar livre. */
export function rainWater(L: Location): void {
  if (!L.outdoor) return;
  for (let i = 0; i < L.soil.length; i++) if (L.soil[i] & SOIL_TILLED) L.soil[i] |= SOIL_WET;
}
