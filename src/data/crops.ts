/** Culturas (tabela da seção 9). Todo o balanceamento fica aqui. */
export interface CropDef {
  id: string;            // id do produto colhido
  seed: string;          // id da semente
  name: string;
  seedName: string;
  seasons: number[];     // 0 primavera, 1 verão, 2 outono, 3 inverno
  days: number;          // dias até ficar pronta
  regrow: number;        // dias para rebrotar (0 = não rebrota)
  seedPrice: number;     // preço da semente na loja
  sell: number;          // preço de venda do produto
  harvest: number;       // quantidade por colheita
  /** estilo visual da planta */
  look: 'root' | 'bush' | 'vine' | 'tall' | 'ground' | 'flower';
  /** cores do produto: [sombra, base, luz] */
  color: [string, string, string];
  leaf?: [string, string, string];
  edible: number;        // energia ao comer
}

export const CROPS: CropDef[] = [
  { id: 'parsnip', seed: 'seed_parsnip', name: 'Pastinaca', seedName: 'Sementes de pastinaca', seasons: [0], days: 4, regrow: 0, seedPrice: 20, sell: 35, harvest: 1, look: 'root', color: ['#c8a060', '#f2e0a8', '#fff6d8'], edible: 25 },
  { id: 'potato', seed: 'seed_potato', name: 'Batata', seedName: 'Sementes de batata', seasons: [0], days: 6, regrow: 0, seedPrice: 50, sell: 80, harvest: 1, look: 'root', color: ['#8a5a2c', '#c08a50', '#e2b47a'], edible: 25 },
  { id: 'cauliflower', seed: 'seed_cauliflower', name: 'Couve-flor', seedName: 'Sementes de couve-flor', seasons: [0], days: 12, regrow: 0, seedPrice: 80, sell: 175, harvest: 1, look: 'ground', color: ['#c8c4a8', '#f2f0dc', '#ffffff'], edible: 75 },
  { id: 'strawberry', seed: 'seed_strawberry', name: 'Morango', seedName: 'Sementes de morango', seasons: [0], days: 8, regrow: 4, seedPrice: 100, sell: 120, harvest: 1, look: 'bush', color: ['#8a1424', '#e0303c', '#ff8a8a'], edible: 50 },
  { id: 'tomato', seed: 'seed_tomato', name: 'Tomate', seedName: 'Sementes de tomate', seasons: [1], days: 11, regrow: 4, seedPrice: 50, sell: 60, harvest: 1, look: 'tall', color: ['#9a1a12', '#e2402a', '#ff8a62'], edible: 20 },
  { id: 'blueberry', seed: 'seed_blueberry', name: 'Mirtilo', seedName: 'Sementes de mirtilo', seasons: [1], days: 13, regrow: 4, seedPrice: 80, sell: 50, harvest: 3, look: 'bush', color: ['#1e2a7a', '#3a4ec8', '#8a9cf2'], edible: 25 },
  { id: 'melon', seed: 'seed_melon', name: 'Melão', seedName: 'Sementes de melão', seasons: [1], days: 12, regrow: 0, seedPrice: 80, sell: 250, harvest: 1, look: 'ground', color: ['#3a7a2a', '#6ab84a', '#b8e88a'], edible: 113 },
  { id: 'corn', seed: 'seed_corn', name: 'Milho', seedName: 'Sementes de milho', seasons: [1, 2], days: 14, regrow: 4, seedPrice: 150, sell: 50, harvest: 1, look: 'tall', color: ['#c8900e', '#f2c83a', '#fff09a'], edible: 25 },
  { id: 'pumpkin', seed: 'seed_pumpkin', name: 'Abóbora', seedName: 'Sementes de abóbora', seasons: [2], days: 13, regrow: 0, seedPrice: 100, sell: 320, harvest: 1, look: 'ground', color: ['#a8480e', '#e8822a', '#ffb860'], edible: 0 },
  { id: 'eggplant', seed: 'seed_eggplant', name: 'Berinjela', seedName: 'Sementes de berinjela', seasons: [2], days: 5, regrow: 5, seedPrice: 20, sell: 60, harvest: 1, look: 'bush', color: ['#2e0e3a', '#5e2272', '#9a5ab2'], edible: 20 },
  { id: 'grape', seed: 'seed_grape', name: 'Uva', seedName: 'Sementes de uva', seasons: [2], days: 10, regrow: 3, seedPrice: 60, sell: 80, harvest: 1, look: 'vine', color: ['#3a0e4a', '#7a2a9a', '#b86ad8'], edible: 38 },
];

export const CROP_BY_SEED: Record<string, CropDef> = Object.fromEntries(CROPS.map((c) => [c.seed, c]));
export const CROP_BY_ID: Record<string, CropDef> = Object.fromEntries(CROPS.map((c) => [c.id, c]));

/** Número de estágios visuais (0 semente … STAGES-1 pronta). */
export const CROP_STAGES = 6;

/** Estágio visual a partir dos dias crescidos. */
export function cropStage(def: CropDef, age: number): number {
  if (age >= def.days) return CROP_STAGES - 1;
  const f = age / def.days;
  return Math.min(CROP_STAGES - 2, Math.floor(f * (CROP_STAGES - 1)));
}

/** Multiplicadores de qualidade (seção 10). */
export const QUALITY_MULT = [1, 1.25, 1.5];
export const QUALITY_NAMES = ['', 'prata', 'ouro'];
