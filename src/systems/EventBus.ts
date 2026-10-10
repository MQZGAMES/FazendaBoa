import Phaser from 'phaser';
import type { QualityLevel } from './Performance';

/** Eventos tipados trocados entre sistemas e UI. */
export interface GameEvents {
  resize: [];
  money: [number];
  energy: [number, number];
  time: [];
  day: [];
  hotbar: [number];
  inventory: [];
  toast: [string, ToastKind?];
  quality: [QualityLevel];
  action: [];
  target: [];
  debug: [boolean];
  float: [number, number, string, number?];
  pickup: [string, number];
  dialog: [DialogReq];
  summary: [import('./DayCycle').DaySummary];
  menu: [string];
  animals: [];
}
export interface DialogReq { text: string; title?: string; buttons?: { label: string; act?: () => void }[]; icon?: string; }
export type ToastKind = 'info' | 'good' | 'warn';

class TypedBus {
  private ee = new Phaser.Events.EventEmitter();
  on<K extends keyof GameEvents>(k: K, fn: (...a: GameEvents[K]) => void, ctx?: unknown): this {
    this.ee.on(k, fn as (...a: unknown[]) => void, ctx);
    return this;
  }
  once<K extends keyof GameEvents>(k: K, fn: (...a: GameEvents[K]) => void, ctx?: unknown): this {
    this.ee.once(k, fn as (...a: unknown[]) => void, ctx);
    return this;
  }
  off<K extends keyof GameEvents>(k: K, fn?: (...a: GameEvents[K]) => void, ctx?: unknown): this {
    this.ee.off(k, fn as ((...a: unknown[]) => void) | undefined, ctx);
    return this;
  }
  emit<K extends keyof GameEvents>(k: K, ...a: GameEvents[K]): void {
    this.ee.emit(k, ...a);
  }
}

export const bus = new TypedBus();
