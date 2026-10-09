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

export interface ShipLine { id: string; q: number; ql: number; total: number; }
export interface DaySummary {
  passedOut: boolean;
  penalty: number;
  shipped: ShipLine[];
  total: number;
  died: number;
  late: boolean;
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
export function endDay(passOut: boolean): DaySummary {
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
  if (passOut) {
    penalty = Math.min(1000, Math.floor(G.player.money * 0.1));
    G.player.money -= penalty;
  }

  time.nextDay();
  const season = G.time.season;
  G.weather.today = G.weather.tomorrow;
  G.weather.tomorrow = rollWeather(season, Math.min(28, G.time.day + 1));
  if (season === 3 && G.weather.today === 'rain') G.weather.today = 'snow';
  if (season !== 3 && G.weather.today === 'snow') G.weather.today = 'rain';

  let died = 0;
  for (const L of G.locs.values()) {
    const r = growDay(L, season);
    died += r.died;
    if (G.weather.today === 'rain' || G.weather.today === 'storm') rainWater(L);
    // mudas crescem
    for (const [i, o] of L.objs) {
      if (o.k !== 'sapling') continue;
      o.a = (o.a ?? 0) + 1;
      if (o.a >= SAPLING_DAYS) { L.objs.set(i, { k: 'tree', v: 0, t: o.t ?? 0, hp: 10 }); L.rev++; }
      else { o.g = o.a < 3 ? 0 : o.a < 7 ? 1 : 2; L.rev++; }
    }
  }
  spawnDebris();

  // energia
  const p = G.player;
  p.energy = passOut ? Math.round(p.maxEnergy * 0.5) : late ? Math.round(p.maxEnergy * 0.85) : p.maxEnergy;
  G.time.min = DAY_START;
  G.flags.daysPlayed = (G.flags.daysPlayed ?? 0) + 1;
  bus.emit('day');
  bus.emit('money', G.player.money);
  return { passedOut: passOut, penalty, shipped, total, died, late };
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
    else if (r < 0.8) L.place(x, y, { k: 'stone', v: rng.int(0, 1), hp: 1 });
    else L.place(x, y, { k: 'twig', v: rng.int(0, 1), hp: 1 });
  }
}
