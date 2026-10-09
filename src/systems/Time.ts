import { G, DAY_START, DAY_END } from '../state';
import { bus } from './EventBus';

/** 10 minutos de jogo = 7 s reais. */
export const REAL_SEC_PER_GAME_MIN = 0.7;
export const WEEKDAYS = ['Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.', 'Dom.'];
export const WEEKDAYS_FULL = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

class TimeSystem {
  private acc = 0;
  paused = false;
  /** chamado quando passa das 2:00 */
  onLate: (() => void) | null = null;

  update(dt: number): void {
    if (this.paused) return;
    this.acc += dt;
    while (this.acc >= REAL_SEC_PER_GAME_MIN) {
      this.acc -= REAL_SEC_PER_GAME_MIN;
      G.time.min++;
      if (G.time.min % 10 === 0) bus.emit('time');
      if (G.time.min >= DAY_END) {
        G.time.min = DAY_END;
        this.paused = true;
        this.onLate?.();
        break;
      }
    }
  }

  reset(): void { this.acc = 0; }

  /** Avança para o dia seguinte (calendário). */
  nextDay(): void {
    const t = G.time;
    t.day++;
    if (t.day > 28) { t.day = 1; t.season++; if (t.season > 3) { t.season = 0; t.year++; } }
    t.min = DAY_START;
    this.acc = 0;
    this.paused = false;
  }
}

export const time = new TimeSystem();

export function weekday(day = G.time.day): number { return (day - 1) % 7; }

export function fmtTime(min = G.time.min): string {
  let m = Math.floor(min / 10) * 10;
  let h = Math.floor(m / 60) % 24;
  m = m % 60;
  return `${h}:${m < 10 ? '0' : ''}${m}`;
}

/** Fração do dia (0 às 6:00 → 1 às 2:00). */
export function dayFrac(min = G.time.min): number { return (min - DAY_START) / (DAY_END - DAY_START); }
