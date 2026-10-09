import { settings } from './Settings';

/** Vibração só onde existe (não funciona no iOS Safari; todo feedback também é visual). */
export const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function vibrate(pattern: number | number[]): void {
  if (!canVibrate || !settings.vibration) return;
  try { navigator.vibrate(pattern); } catch { /* ignora */ }
}

export const haptic = {
  harvest: () => vibrate(12),
  rare: () => vibrate([20, 40, 20]),
  bite: () => vibrate([30, 30, 60]),
  upgrade: () => vibrate([15, 30, 15, 30, 40]),
  heart: () => vibrate(25),
  tap: () => vibrate(6),
};
