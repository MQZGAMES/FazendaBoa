import { Location } from './Location';
import { generateFarm } from './genFarm';
import { generateHouse } from './genHouse';
import { generateTown } from './genTown';
import { G } from '../state';

/** Registro de mapas: como criar cada um do zero e dados estáticos (saídas, interior). */
interface LocDef {
  create: (seed: number) => Location;
  /** mapas "de cenário" (vila…) com versão: se o layout mudar, o save antigo é descartado e o mapa refeito */
  version?: number;
}

export const LOCATIONS: Record<string, LocDef> = {
  farm: { create: (seed) => generateFarm(seed) },
  house: { create: () => generateHouse() },
  town: { create: (seed) => generateTown(seed), version: 2 },
};

/** Retorna o mapa do estado atual, criando-o se ainda não existir. */
export function getLocation(id: string): Location {
  let L = G.locs.get(id);
  if (!L) {
    const def = LOCATIONS[id] ?? LOCATIONS.farm;
    L = def.create(G.seed);
    if (def.version) L.extra.ver = def.version;
    G.locs.set(id, L);
  }
  return L;
}

/** Dados estáticos (saídas etc.) vêm de uma geração nova; o resto vem do save. */
export function staticTemplate(id: string, seed: number): Location {
  const def = LOCATIONS[id] ?? LOCATIONS.farm;
  return def.create(seed);
}
