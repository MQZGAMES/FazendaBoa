import type Phaser from 'phaser';
import { bus } from './EventBus';

export type QualityLevel = 0 | 1 | 2; // baixo, médio, alto
export const QUALITY_NAMES = ['Baixo', 'Médio', 'Alto'];
const PARTICLE_CAP = [30, 80, 150];

interface LoopInternals { _limitRate: number; }

/**
 * Mede o fps continuamente e ajusta a qualidade gráfica.
 * Também limita a 30 fps com menu aberto ou jogador parado (bateria).
 */
class PerformanceSystem {
  level: QualityLevel = 2;
  /** null = automático; senão nível fixado pelo jogador */
  forced: QualityLevel | null = null;
  fps = 60;
  private game: Phaser.Game | null = null;
  private lowT = 0;
  private highT = 0;
  private throttled = false;
  private menuOpen = false;
  private idle = false;
  private warmup = 2;
  drawCalls = 0;

  attach(game: Phaser.Game): void {
    this.game = game;
    this.applyRate();
  }

  get particleCap(): number { return PARTICLE_CAP[this.level]; }
  get high(): boolean { return this.level === 2; }

  setLevel(l: QualityLevel): void {
    if (l === this.level) return;
    this.level = l;
    bus.emit('quality', l);
  }

  setForced(l: QualityLevel | null): void {
    this.forced = l;
    if (l !== null) this.setLevel(l);
  }

  setMenuOpen(v: boolean): void { this.menuOpen = v; this.applyRate(); }
  setIdle(v: boolean): void { if (v !== this.idle) { this.idle = v; this.applyRate(); } }

  private applyRate(): void {
    const t = this.menuOpen || this.idle;
    this.throttled = t;
    const loop = this.game?.loop as unknown as LoopInternals | undefined;
    // pequena folga para não perder quadros por variação do rAF
    if (loop) loop._limitRate = t ? 1000 / 30 - 3 : 1000 / 60 - 3;
    this.lowT = 0; this.highT = 0; this.warmup = 1.5;
  }

  /** Chamado a cada quadro com o delta em ms. */
  frame(deltaMs: number): void {
    if (deltaMs <= 0) return;
    const inst = 1000 / deltaMs;
    this.fps += (inst - this.fps) * 0.08;
    const dt = Math.min(deltaMs, 250) / 1000;
    if (this.warmup > 0) { this.warmup -= dt; return; }
    if (this.throttled || this.forced !== null) return;
    if (this.fps < 50) { this.lowT += dt; this.highT = 0; } else { this.lowT = 0; }
    if (this.fps > 58) this.highT += dt; else this.highT = 0;
    if (this.lowT > 3 && this.level > 0) { this.setLevel((this.level - 1) as QualityLevel); this.lowT = 0; this.warmup = 2; }
    if (this.highT > 20 && this.level < 2) { this.setLevel((this.level + 1) as QualityLevel); this.highT = 0; }
  }

  /** Benchmark simples na tela de título: decide o nível inicial. */
  initialFromBenchmark(avgFps: number): void {
    if (this.forced !== null) return;
    this.setLevel(avgFps >= 55 ? 2 : avgFps >= 40 ? 1 : 0);
  }
}

export const perf = new PerformanceSystem();
