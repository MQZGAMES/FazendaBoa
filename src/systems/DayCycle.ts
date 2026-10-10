import { G, type Weather, DAY_START } from '../state';
import { time } from './Time';
import { growDay, rainWater } from './Farming';
import { getLocation } from '../world/locations';
import { T } from '../world/Location';
import { SAPLING_DAYS } from '../data/objects';
import { Rng } from '../art/rng';
import { bus } from './EventBus';
import { ITEMS } from '../data/items';
import { QUALITY_MULT } from '../data/crops';
import { SPRINKLER_AREA, SCARECROW_RADIUS, CROW_CHANCE } from '../data/objects';
import { animalsEndDay } from './Animals';

export interface ShipLine { id: string; q: number; ql: number; total: number; }
export interface DaySummary {
  passedOut: boolean;
  penalty: number;
  shipped: ShipLine[];
  total: number;
  died: number;
  late: boolean;
  crow: boolean;
  notes: string[];
}

/** Previsão para amanhã conforme a estação. */
export function rollWeather(season: number, day: number, rng = Math.random): Weather {
  if (day === 1) return 'sun';
  const r = rng();
  switch (season) {
    case 0: return r < 0.2 ? 'rain' : r < 0.35 ? 'cloud' : 'sun';
    case 1: return r < 0.05 ? 'storm' : r < 0.17 ? 'rain' : r < 0.27 ? 'cloud' : 'sun';
    case 2: return r < 0.18 ? 'rain' : r < 0.38 ? 'cloud' : 'sun';
    default: return r < 0.35 ? 'snow' : r < 0.55 ? 'cloud' : 'sun';
  }
}

export const WEATHER_NAMES: Record<Weather, string> = { sun: 'Sol', cloud: 'Nublado', rain: 'Chuva', storm: 'Tempestade', snow: 'Neve' };

/** Itens na caixa de envio (pagos ao amanhecer). */
export function shippingBin(): { id: string; q: number; ql?: number }[] {
  const L = getLocation('farm');
  if (!Array.isArray(L.extra.ship)) L.extra.ship = [];
  return L.extra.ship as { id: string; q: number; ql?: number }[];
}

export function itemValue(id: string, ql = 0): number {
  const d = ITEMS[id];
  return d ? Math.floor(d.price * (QUALITY_MULT[ql] ?? 1)) : 0;
}

/** Encerra o dia: vendas, crescimento, clima, mudas, entulho, energia. */
export function endDay(passOut: boolean, penalize = true): DaySummary {
  const late = G.time.min >= 24 * 60;
  // vendas da caixa de envio
  const bin = shippingBin();
  const shipped: ShipLine[] = [];
  let total = 0;
  for (const s of bin) {
    const ql = s.ql ?? 0;
    const line = shipped.find((l) => l.id === s.id && l.ql === ql);
    const v = itemValue(s.id, ql) * s.q;
    if (line) { line.q += s.q; line.total += v; } else shipped.push({ id: s.id, q: s.q, ql, total: v });
    total += v;
  }
  bin.length = 0;
  G.player.money += total;

  // multa por desmaio: 10% (máx. 1000g)
  let penalty = 0;
  delete G.flags.exhaust;
  if (passOut && penalize) {
    penalty = Math.min(1000, Math.floor(G.player.money * 0.1));
    G.player.money -= penalty;
  }

  time.nextDay();
  const season = G.time.season;
  G.weather.today = G.weather.tomorrow;
  G.weather.tomorrow = rollWeather(season, Math.min(28, G.time.day + 1));
  if (season === 3 && G.weather.today === 'rain') G.weather.today = 'snow';
  if (season !== 3 && G.weather.today === 'snow') G.weather.today = 'rain';

  // andares da mina são refeitos a cada dia
  for (const k of [...G.locs.keys()]) if (k.startsWith('mine:')) G.locs.delete(k);
  let died = 0;
  for (const L of G.locs.values()) {
    const r = growDay(L, season);
    died += r.died;
    if (G.weather.today === 'rain' || G.weather.today === 'storm') rainWater(L);
    runSprinklers(L);
    // mudas crescem
    for (const [i, o] of L.objs) {
      if (o.k !== 'sapling') continue;
      o.a = (o.a ?? 0) + 1;
      if (o.a >= SAPLING_DAYS) { L.objs.set(i, { k: 'tree', v: 0, t: o.t ?? 0, hp: 10 }); L.rev++; }
      else { o.g = o.a < 3 ? 0 : o.a < 7 ? 1 : 2; L.rev++; }
    }
  }
  spawnDebris();
  const crow = crowAttack();
  const notes = animalsEndDay();

  // energia
  const p = G.player;
  p.energy = passOut ? Math.round(p.maxEnergy * 0.5) : late ? Math.round(p.maxEnergy * 0.85) : p.maxEnergy;
  G.time.min = DAY_START;
  G.flags.daysPlayed = (G.flags.daysPlayed ?? 0) + 1;
  bus.emit('day');
  bus.emit('money', G.player.money);
  return { passedOut: passOut, penalty, shipped, total, died, late, crow, notes };
}

/** Irrigadores regam automaticamente às 6:00. */
function runSprinklers(L: import('../world/Location').Location): void {
  for (const [i, o] of L.objs) {
    if (o.k !== 'sprinkler') continue;
    const area = SPRINKLER_AREA[o.t ?? 0];
    const x = i % L.w, y = Math.floor(i / L.w);
    for (let dy = -area.r; dy <= area.r; dy++) for (let dx = -area.r; dx <= area.r; dx++) {
      if (!dx && !dy) continue;
      if (!area.diag && dx && dy) continue;
      const xx = x + dx, yy = y + dy;
      if (L.inb(xx, yy)) { const k = L.idx(xx, yy); if (L.soil[k] & 1) L.soil[k] |= 2; }
    }
  }
}

/** Sem espantalho por perto, um corvo pode comer 1 planta por dia (no máximo). */
function crowAttack(): boolean {
  const L = G.locs.get('farm');
  if (!L || Math.random() > CROW_CHANCE) return false;
  const scare: [number, number][] = [];
  for (const [i, o] of L.objs) if (o.k === 'scarecrow') scare.push([i % L.w, Math.floor(i / L.w)]);
  const victims: number[] = [];
  for (const [i, c] of L.crops) {
    if (c.dead) continue;
    const x = i % L.w, y = Math.floor(i / L.w);
    if (scare.some(([sx, sy]) => (sx - x) ** 2 + (sy - y) ** 2 <= SCARECROW_RADIUS * SCARECROW_RADIUS)) continue;
    victims.push(i);
  }
  if (victims.length < 4) return false; // poupa quem tem poucas plantas
  L.crops.delete(victims[Math.floor(Math.random() * victims.length)]);
  return true;
}

/** Mato, pedras e galhos reaparecem aos poucos na fazenda. */
function spawnDebris(): void {
  const L = getLocation('farm');
  const rng = new Rng((G.seed + G.time.day * 7919 + G.time.season * 104729 + G.time.year * 13) | 0);
  const n = 6 + rng.int(0, 6);
  for (let k = 0; k < n; k++) {
    const x = rng.int(3, L.w - 4), y = rng.int(3, L.h - 4);
    const i = L.idx(x, y);
    if (L.terrain[i] !== T.Grass || L.occ[i] || L.soil[i] || L.crops.has(i)) continue;
    if (Math.abs(x - 39) < 9 && y < 22) continue; // arredores da casa
    const r = rng.next();
    if (r < 0.55 && G.time.season !== 3) L.place(x, y, { k: 'weed', v: rng.int(0, 2), hp: 1 });
    else if (r < 0.75) L.place(x, y, { k: 'stone', v: rng.int(0, 1), hp: 1 });
    else if (r < 0.82) L.place(x, y, { k: 'bigrock', v: 0, hp: 2 });
    else L.place(x, y, { k: 'twig', v: rng.int(0, 1), hp: 1 });
  }
}
