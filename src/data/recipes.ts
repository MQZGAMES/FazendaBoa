/** Receitas de fabricação (seção 14). A Fase 5 adiciona o restante. */
export interface Recipe {
  id: string;           // item produzido
  qty: number;
  ing: Record<string, number>;
  /** nível de habilidade necessário: [habilidade, nível] */
  req?: ['farming' | 'mining' | 'foraging' | 'fishing' | 'ranching', number];
}

export const RECIPES: Recipe[] = [
  { id: 'chest', qty: 1, ing: { wood: 50 } },
  { id: 'fertilizer', qty: 1, ing: { sap: 2 } },
  { id: 'torch', qty: 1, ing: { wood: 1, sap: 1 } },
  { id: 'furnace', qty: 1, ing: { copper_ore: 20, stone: 25 } },
];
