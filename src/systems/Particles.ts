import Phaser from 'phaser';
import { perf } from './Performance';

interface Part {
  img: Phaser.GameObjects.Image;
  vx: number; vy: number; vz: number; z: number;
  life: number; max: number; grav: number; fade: boolean; spin: number; ground: number; alive: boolean;
}

export interface BurstOpts {
  speed?: number; up?: number; grav?: number; life?: number; spread?: number; dir?: number; fade?: boolean; spin?: number; depth?: number; scale?: number; tint?: number;
}

/**
 * Partículas com pool fixo (máx. 150/80/30 conforme a qualidade) e zero alocação por quadro.
 * Usa "altura" (z) separada para arcos com quique no chão.
 */
export class Particles {
  private parts: Part[] = [];
  private live = 0;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < 150; i++) {
      const img = scene.add.image(0, 0, 'atlas', 'px').setVisible(false).setActive(false);
      this.parts.push({ img, vx: 0, vy: 0, vz: 0, z: 0, life: 0, max: 0, grav: 0, fade: true, spin: 0, ground: 0, alive: false });
    }
  }

  burst(frame: string, x: number, y: number, n: number, o: BurstOpts = {}): void {
    const cap = perf.particleCap;
    const k = perf.level === 0 ? Math.ceil(n * 0.4) : perf.level === 1 ? Math.ceil(n * 0.7) : n;
    for (let i = 0; i < k; i++) {
      if (this.live >= cap) return;
      const p = this.parts.find((q) => !q.alive);
      if (!p) return;
      const sp = (o.speed ?? 30) * (0.5 + Math.random() * 0.7);
      const base = o.dir ?? Math.random() * Math.PI * 2;
      const a = o.dir !== undefined ? base + (Math.random() - 0.5) * (o.spread ?? 1.2) : base;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp * 0.5;
      p.vz = (o.up ?? 40) * (0.6 + Math.random() * 0.6);
      p.z = 2; p.grav = o.grav ?? 160;
      p.life = 0; p.max = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      p.fade = o.fade ?? true; p.spin = (o.spin ?? 0) * (Math.random() - 0.5);
      p.ground = y;
      p.alive = true;
      this.live++;
      p.img.setFrame(frame).setPosition(x, y).setVisible(true).setActive(true).setAlpha(1).setAngle(0).setScale(o.scale ?? 1).setDepth(o.depth ?? y + 2);
      if (o.tint !== undefined) p.img.setTint(o.tint); else p.img.clearTint();
    }
  }

  update(dt: number): void {
    if (this.live === 0) return;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) { p.alive = false; this.live--; p.img.setVisible(false).setActive(false); continue; }
      p.vz -= p.grav * dt;
      p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.35; p.vx *= 0.6; p.vy *= 0.6; }
      p.ground += p.vy * dt;
      const x = p.img.x + p.vx * dt;
      p.img.setPosition(x, p.ground - p.z);
      if (p.spin) p.img.angle += p.spin * dt * 360;
      if (p.fade) p.img.alpha = 1 - Math.max(0, (p.life / p.max - 0.6) / 0.4);
    }
  }
}
