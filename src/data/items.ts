import type { ToolKind, ObjKind } from './objects';
import { CROPS } from './crops';
import { MINERALS } from './mine';

export type ItemCat = 'tool' | 'seed' | 'crop' | 'resource' | 'food' | 'artisan' | 'fish' | 'mineral' | 'craft' | 'animal';

export interface ItemDef {
  id: string;
  name: string;
  cat: ItemCat;
  /** preço de venda base (g) */
  price: number;
  /** frame do ícone no atlas */
  icon: string;
  /** energia recuperada ao comer */
  edible?: number;
  tool?: ToolKind;
  desc?: string;
  /** objeto colocado no mundo ao usar */
  place?: ObjKind;
}

export const MAX_STACK = 999;

const tool = (id: ToolKind, name: string, desc: string): ItemDef => ({ id, name, cat: 'tool', price: 0, icon: `tool_${id}_0`, tool: id, desc });

export const ITEMS: Record<string, ItemDef> = {
  hoe: tool('hoe', 'Enxada', 'Ara a terra para plantar.'),
  can: tool('can', 'Regador', 'Rega as plantações. Encha na água.'),
  axe: tool('axe', 'Machado', 'Corta galhos, árvores e tocos.'),
  pickaxe: tool('pickaxe', 'Picareta', 'Quebra pedras e minérios.'),
  scythe: tool('scythe', 'Foice', 'Corta mato e grama alta; colhe.'),
  rod: tool('rod', 'Vara de pesca', 'Segure para lançar.'),
  bucket: tool('bucket', 'Balde', 'Para tirar leite das vacas.'),
  wood: { id: 'wood', name: 'Madeira', cat: 'resource', price: 2, icon: 'item_wood', desc: 'Material de construção.' },
  stone: { id: 'stone', name: 'Pedra', cat: 'resource', price: 2, icon: 'item_stone', desc: 'Material de construção.' },
  fiber: { id: 'fiber', name: 'Fibra', cat: 'resource', price: 1, icon: 'item_fiber', desc: 'Fibras vegetais.' },
  sap: { id: 'sap', name: 'Seiva', cat: 'resource', price: 2, icon: 'item_sap', desc: 'Líquido pegajoso das árvores.' },
  acorn: { id: 'acorn', name: 'Bolota', cat: 'seed', price: 20, icon: 'item_acorn', desc: 'Plante na grama: vira um carvalho em 10 dias.' },
  maple_seed: { id: 'maple_seed', name: 'Semente de bordo', cat: 'seed', price: 5, icon: 'item_maple_seed', desc: 'Plante na grama: vira um bordo em 10 dias.' },
  pinecone: { id: 'pinecone', name: 'Pinha', cat: 'seed', price: 5, icon: 'item_pinecone', desc: 'Plante na grama: vira um pinheiro em 10 dias.' },
  fertilizer: { id: 'fertilizer', name: 'Fertilizante básico', cat: 'craft', price: 2, icon: 'item_fertilizer', desc: 'Use no solo arado antes de plantar: melhora a qualidade da colheita.' },
  chest: { id: 'chest', name: 'Baú', cat: 'craft', price: 0, icon: 'item_chest', place: 'chest', desc: 'Coloque no chão para guardar 36 itens.' },
  backpack: { id: 'backpack', name: 'Mochila', cat: 'craft', price: 0, icon: 'item_backpack' },
  torch: { id: 'torch', name: 'Tocha', cat: 'craft', price: 5, icon: 'item_torch', place: 'torch', desc: 'Ilumina à noite e na mina.' },
  sprinkler_0: { id: 'sprinkler_0', name: 'Irrigador', cat: 'craft', price: 0, icon: 'item_sprinkler_0', place: 'sprinkler', desc: 'Rega os 4 tiles vizinhos todo dia às 6:00.' },
  sprinkler_1: { id: 'sprinkler_1', name: 'Irrigador de qualidade', cat: 'craft', price: 0, icon: 'item_sprinkler_1', place: 'sprinkler', desc: 'Rega uma área 3x3 todo dia às 6:00.' },
  sprinkler_2: { id: 'sprinkler_2', name: 'Irrigador avançado', cat: 'craft', price: 0, icon: 'item_sprinkler_2', place: 'sprinkler', desc: 'Rega uma área 5x5 todo dia às 6:00.' },
  scarecrow: { id: 'scarecrow', name: 'Espantalho', cat: 'craft', price: 0, icon: 'item_scarecrow', place: 'scarecrow', desc: 'Protege as plantações dos corvos num raio de 8.' },
  fence: { id: 'fence', name: 'Cerca de madeira', cat: 'craft', price: 1, icon: 'item_fence', place: 'fence', desc: 'Limita animais e decora. Conecta-se às vizinhas.' },
  path: { id: 'path', name: 'Caminho de pedra', cat: 'craft', price: 1, icon: 'item_path', desc: 'Coloque na grama: anda 10% mais rápido sobre ele.' },
  lantern: { id: 'lantern', name: 'Lampião', cat: 'craft', price: 0, icon: 'item_lantern', place: 'lantern', desc: 'Luz forte à noite.' },
  wheelbarrow: { id: 'wheelbarrow', name: 'Carrinho de mão', cat: 'craft', price: 0, icon: 'item_wheelbarrow', place: 'wheelbarrow', desc: 'Guarda até 10 pedras grandes. Toque para esvaziar em pedras.' },
  hay: { id: 'hay', name: 'Ração', cat: 'animal', price: 0, icon: 'item_hay', desc: 'Coloque no cocho para alimentar os animais.' },
  egg: { id: 'egg', name: 'Ovo', cat: 'animal', price: 50, icon: 'item_egg', edible: 25, desc: 'Um ovo fresquinho.' },
  big_egg: { id: 'big_egg', name: 'Ovo grande', cat: 'animal', price: 95, icon: 'item_big_egg', edible: 40, desc: 'Um ovo enorme! Galinha feliz.' },
  milk: { id: 'milk', name: 'Leite', cat: 'animal', price: 125, icon: 'item_milk', edible: 38, desc: 'Leite fresco de vaca.' },
  big_milk: { id: 'big_milk', name: 'Leite grande', cat: 'animal', price: 190, icon: 'item_big_milk', edible: 50, desc: 'Uma jarra cheia de leite cremoso.' },
  bait: { id: 'bait', name: 'Isca', cat: 'craft', price: 1, icon: 'item_bait', desc: 'Faz o peixe morder mais rápido.' },
  furnace: { id: 'furnace', name: 'Fornalha', cat: 'craft', price: 0, icon: 'item_furnace', place: 'furnace', desc: '5 minérios + 1 carvão = 1 barra (30 min).' },
};
for (const [id, m] of Object.entries(MINERALS)) {
  const bar = id.endsWith('_bar');
  ITEMS[id] = { id, name: m.name, cat: bar ? 'resource' : 'mineral', price: m.price, icon: `item_${id}`, desc: bar ? 'Usada em fabricação e melhorias de ferramentas.' : id.endsWith('_ore') ? 'Funda 5 na fornalha (com 1 carvão).' : id === 'coal' ? 'Combustível da fornalha.' : 'Uma pedra preciosa.' };
}

/** Sementes de árvore → tipo de árvore. */
export const TREE_SEEDS: Record<string, number> = { acorn: 0, maple_seed: 1, pinecone: 2 };
export const TREE_SEED_OF = ['acorn', 'maple_seed', 'pinecone'];

const SEASON_TXT = ['Primavera', 'Verão', 'Outono', 'Inverno'];
for (const c of CROPS) {
  const seasons = c.seasons.map((x) => SEASON_TXT[x]).join('/');
  ITEMS[c.seed] = { id: c.seed, name: c.seedName, cat: 'seed', price: Math.floor(c.seedPrice / 2), icon: `item_${c.seed}`, desc: `${seasons}. Cresce em ${c.days} dias${c.regrow ? `, rebrota a cada ${c.regrow}` : ''}.` };
  ITEMS[c.id] = { id: c.id, name: c.name, cat: 'crop', price: c.sell, icon: `item_${c.id}`, edible: c.edible || undefined, desc: `Colheita de ${seasons.toLowerCase()}.` };
}

export function itemIcon(id: string, toolTier = 0): string {
  const d = ITEMS[id];
  if (!d) return 'icon_box';
  if (d.cat === 'tool') return `tool_${d.tool}_${toolTier}`;
  return d.icon;
}
