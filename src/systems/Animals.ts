import { G, type AnimalState } from '../state';
import { ANIMALS, BUILDINGS, OUT_TIME, IN_TIME, PET_GAIN, FED_GAIN, NOT_PETTED_LOSS, HUNGRY_LOSS, MAX_AFFECTION, BIG_PRODUCT_AT, CHICKEN_NAMES, COW_NAMES, type AnimalKind, type BuildingKind } from '../data/animals';
import { getLocation } from '../world/locations';
import { ensureTroughs } from '../world/genAnimalHouse';
import { T, type Location } from '../world/Location';
import { OBJ } from '../data/objects';
import { bus } from './EventBus';
import { addXp } from './Skills';

/** Construções prontas de um tipo: [âncora, nível]. */
export function buildings(kind: BuildingKind): { anchor: number; level: number }[] {
  const farm = getLocation('farm');
  const out: { anchor: number; level: number }[] = [];
  for (const [i, o] of farm.objs) if (o.k === kind && !(o.g ?? 0)) out.push({ anchor: i, level: o.v ?? 0 });
  return out;
}

export function capacity(kind: BuildingKind, level: number): number { return BUILDINGS[kind].capacity[level ? 1 : 0]; }
export function animalsOf(anchor: number): AnimalState[] { return G.animals.filter((a) => a.home === anchor); }

function randomFloor(L: Location): [number, number] {
  for (let k = 0; k < 60; k++) {
    const x = 1 + Math.floor(Math.random() * (L.w - 2)), y = 3 + Math.floor(Math.random() * (L.h - 4));
    if (!L.isSolid(x, y) && !L.objAt(x, y)) return [x * 16 + 8, y * 16 + 12];
  }
  return [Math.floor(L.w / 2) * 16 + 8, (L.h - 2) * 16 + 12];
}

/** Compra: o animal aparece dentro da construção com espaço. Retorna o nome ou um erro. */
export function buyAnimal(kind: AnimalKind): { ok: boolean; msg: string } {
  const def = ANIMALS[kind];
  const homes = buildings(def.home).filter((b) => animalsOf(b.anchor).length < capacity(def.home, b.level));
  if (!homes.length) {
    return { ok: false, msg: buildings(def.home).length ? `${BUILDINGS[def.home].name} cheio!` : `Construa um ${BUILDINGS[def.home].name.toLowerCase()} antes.` };
  }
  const home = homes[0].anchor;
  const L = getLocation(`${def.home}:${home}`);
  const names = kind === 'chicken' ? CHICKEN_NAMES : COW_NAMES;
  const used = new Set(G.animals.map((a) => a.name));
  const name = names.find((n) => !used.has(n)) ?? `${names[0]} ${G.animals.length + 1}`;
  const [x, y] = randomFloor(L);
  G.animals.push({ id: Date.now() % 1e9 + G.animals.length, kind, name, v: Math.random() < 0.5 ? 0 : 1, home, loc: L.id, x, y, aff: 100, petted: 0, outside: 0, milk: 0 });
  bus.emit('animals');
  return { ok: true, msg: `${def.name} ${name} chegou ao ${BUILDINGS[def.home].name.toLowerCase()}!` };
}

/** Bom tempo para pastar. */
function grazingWeather(): boolean {
  const w = G.weather.today;
  return G.time.season !== 3 && (w === 'sun' || w === 'cloud');
}

/** Posição livre no pasto em frente à construção. */
function pastureSpot(home: number): [number, number] {
  const farm = getLocation('farm');
  const o = farm.objs.get(home);
  const kind = (o?.k ?? 'coop') as BuildingKind;
  const ax = home % farm.w, ay = Math.floor(home / farm.w);
  const [w, h] = OBJ[kind].size;
  for (let k = 0; k < 80; k++) {
    const x = ax - 2 + Math.floor(Math.random() * (w + 4)), y = ay + h + Math.floor(Math.random() * 5);
    if (farm.inb(x, y) && !farm.isSolid(x, y) && farm.terrainAt(x, y) !== T.Water && !farm.crops.has(farm.idx(x, y))) return [x * 16 + 8, y * 16 + 12];
  }
  return [(ax + 2) * 16 + 8, (ay + h) * 16 + 12];
}

/** Rotina: saem às 9:00 com bom tempo e voltam às 18:00. Chamado a cada 10 min de jogo. */
export function animalSchedule(): void {
  let moved = false;
  const m = G.time.min;
  for (const a of G.animals) {
    const inside = a.loc !== 'farm';
    const home = `${ANIMALS[a.kind].home}:${a.home}`;
    if (inside && m >= OUT_TIME && m < IN_TIME && grazingWeather() && !a.outside) {
      [a.x, a.y] = pastureSpot(a.home); a.loc = 'farm'; a.outside = 1; moved = true;
    } else if (!inside && (m >= IN_TIME || !grazingWeather())) {
      const L = getLocation(home);
      [a.x, a.y] = randomFloor(L); a.loc = home; moved = true;
    }
  }
  if (moved) bus.emit('animals');
}

export function pet(a: AnimalState): void {
  if (a.petted) return;
  a.petted = 1;
  a.aff = Math.min(MAX_AFFECTION, a.aff + PET_GAIN);
  addXp('ranching', 5);
}

/** Qualidade do produto pela afeição. */
function productQuality(aff: number): number {
  const r = Math.random();
  if (aff >= 900 && r < 0.35) return 2;
  if (aff >= 600 && r < 0.5) return 1;
  return 0;
}

/** Fim do dia: alimentação (grama ou ração do cocho), produtos e afeição. Retorna avisos. */
export function animalsEndDay(): string[] {
  const notes: string[] = [];
  // obras progridem
  const farm = getLocation('farm');
  for (const [i, o] of farm.objs) {
    if ((o.k === 'coop' || o.k === 'barn') && (o.g ?? 0) > 0) {
      o.g = (o.g ?? 1) - 1;
      farm.rev++;
      if (!o.g) {
        notes.push(`${BUILDINGS[o.k].name}${o.v ? ' grande' : ''} pronto!`);
        const inner = G.locs.get(`${o.k}:${i}`);
        if (inner) ensureTroughs(inner, o.k, o.v ?? 0);
      }
    }
  }
  let hungry = 0;
  for (const a of G.animals) {
    const kind = ANIMALS[a.kind].home;
    const L = getLocation(`${kind}:${a.home}`);
    let fed = !!a.outside;
    if (!fed) {
      for (const o of L.objs.values()) if (o.k === 'trough' && o.g) { o.g = 0; fed = true; L.rev++; break; }
    }
    if (fed) {
      a.aff = Math.min(MAX_AFFECTION, a.aff + FED_GAIN);
      const big = a.aff >= BIG_PRODUCT_AT && Math.random() < (a.aff - 500) / 1000;
      if (a.kind === 'chicken') {
        const [px, py] = randomFloor(L);
        const tx = Math.floor(px / 16), ty = Math.floor(py / 16);
        L.place(tx, ty, { k: 'product', v: 0, it: big ? 'big_egg' : 'egg', g: productQuality(a.aff) });
      } else a.milk = big ? 2 : 1;
    } else { a.aff = Math.max(0, a.aff - HUNGRY_LOSS); hungry++; }
    if (!a.petted) a.aff = Math.max(0, a.aff - NOT_PETTED_LOSS);
    a.petted = 0; a.outside = 0;
    a.loc = L.id;
    [a.x, a.y] = randomFloor(L);
  }
  if (hungry) notes.push(`${hungry} ${hungry > 1 ? 'animais ficaram' : 'animal ficou'} sem comer. Ponha ração no cocho!`);
  return notes;
}

export function hearts(a: AnimalState): number { return Math.floor(a.aff / 200); }
