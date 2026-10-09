import { G, type Skill } from '../state';
import { bus } from './EventBus';

/** XP acumulado para cada nível 1..10 (seção 22). */
export const LEVEL_XP = [100, 380, 770, 1300, 2150, 3300, 4800, 6900, 10000, 15000];
export const SKILL_NAMES: Record<Skill, string> = { farming: 'Agricultura', mining: 'Mineração', foraging: 'Coleta', fishing: 'Pesca', ranching: 'Criação' };

export function skillLevel(s: Skill): number {
  const xp = G.player.xp[s] ?? 0;
  let lvl = 0;
  while (lvl < 10 && xp >= LEVEL_XP[lvl]) lvl++;
  return lvl;
}

export function addXp(s: Skill, amount: number): void {
  const before = skillLevel(s);
  G.player.xp[s] = (G.player.xp[s] ?? 0) + amount;
  const after = skillLevel(s);
  if (after > before) bus.emit('toast', `${SKILL_NAMES[s]} subiu para o nível ${after}!`, 'good');
}
