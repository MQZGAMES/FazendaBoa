import Phaser from 'phaser';
import { addItem } from '../systems/Inventory';
import { itemIcon } from '../data/items';
import { bus } from '../systems/EventBus';
import { haptic } from '../systems/Haptics';
import type { Location } from './Location';

interface Drop {
  img: Phaser.GameObjects.Image; sh: Phaser.GameObjects.Image;
  id: string; q: number; ql: number;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  t: number; alive: boolean; resting: boolean; cool: number;
}

/**
 * Itens que saltam em arco e voam até o jogador (pool de objetos).
 * Se a mochila estiver cheia, ficam no chão e são salvos no mapa.
 */
export class Drops {
  private list: Drop[] = [];
  private fullWarn = 0;

  constructor(private scene: Phaser.Scene) {}

  private alloc(): Drop {
    let d = this.list.find((x) => !x.alive);
    if (!d) {
      const img = this.scene.add.image(0, 0, 'atlas', 'px').setOrigin(0.5, 1);
      const sh = this.scene.add.image(0, 0, 'atlas', 'shadow_s').setDepth(-5).setScale(0.6);
      d = { img, sh, id: '', q: 0, ql: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, alive: false, resting: false, cool: 0 };
      this.list.push(d);
    }
    return d;
  }

  spawn(id: string, q: number, ql: number, x: number, y: number, spread = 14): void {
    // agrupa em até 3 sprites para não poluir
    const parts = Math.min(3, q);
    for (let k = 0; k < parts; k++) {
      const d = this.alloc();
      const qq = k === parts - 1 ? q - Math.floor(q / parts) * (parts - 1) : Math.floor(q / parts);
      d.id = id; d.q = qq; d.ql = ql;
      d.x = x; d.y = y; d.z = 4;
      const a = Math.random() * Math.PI * 2;
      const sp = spread * (0.4 + Math.random() * 0.6);
      d.vx = Math.cos(a) * sp; d.vy = Math.sin(a) * sp * 0.6; d.vz = 55 + Math.random() * 20;
      d.t = 0; d.alive = true; d.resting = false; d.cool = 0;
      d.img.setFrame(itemIcon(id)).setVisible(true).setScale(1);
      d.sh.setVisible(true);
    }
  }

  update(dt: number, px: number, py: number): void {
    for (const d of this.list) {
      if (!d.alive) continue;
      d.t += dt;
      if (d.cool > 0) d.cool -= dt;
      const dx = px - d.x, dy = (py - 8) - d.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (d.t > 0.45 && dist < 44 && d.cool <= 0) {
        // ímã até o jogador
        const sp = 160 + (44 - dist) * 6;
        d.x += (dx / Math.max(dist, 0.001)) * sp * dt;
        d.y += (dy / Math.max(dist, 0.001)) * sp * dt;
        d.z += (6 - d.z) * Math.min(1, dt * 10);
        if (dist < 7) {
          const left = addItem(d.id, d.q, d.ql);
          if (left < d.q) { bus.emit('pickup', d.id, d.q - left); haptic.tap(); }
          if (left > 0) {
            d.q = left; d.cool = 2; d.vx = -dx * 2; d.vy = -dy * 2; d.vz = 40; d.t = 0.2;
            if (performance.now() - this.fullWarn > 4000) { this.fullWarn = performance.now(); bus.emit('toast', 'Mochila cheia!', 'warn'); }
          } else { d.alive = false; d.img.setVisible(false); d.sh.setVisible(false); continue; }
        }
      } else if (!d.resting) {
        d.vz -= 220 * dt;
        d.z += d.vz * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.z <= 0) {
          d.z = 0;
          if (Math.abs(d.vz) < 30) { d.resting = true; d.vz = 0; }
          else { d.vz = -d.vz * 0.4; d.vx *= 0.5; d.vy *= 0.5; }
        }
      } else {
        d.z = 1 + Math.sin(d.t * 4) * 1;
      }
      d.img.setPosition(d.x, d.y - d.z).setDepth(d.y);
      d.sh.setPosition(d.x, d.y);
    }
  }

  /** Salva itens que ficaram no chão no mapa. */
  persist(L: Location): void {
    const rest: [string, number, number, number, number][] = [];
    for (const d of this.list) if (d.alive) rest.push([d.id, d.q, d.ql, Math.round(d.x), Math.round(d.y)]);
    L.extra.items = rest;
  }

  restore(L: Location): void {
    const arr = L.extra.items as [string, number, number, number, number][] | undefined;
    if (!arr) return;
    for (const [id, q, ql, x, y] of arr) {
      const d = this.alloc();
      d.id = id; d.q = q; d.ql = ql; d.x = x; d.y = y; d.z = 0; d.vx = 0; d.vy = 0; d.vz = 0;
      d.t = 1; d.alive = true; d.resting = true; d.cool = 1;
      d.img.setFrame(itemIcon(id)).setVisible(true);
      d.sh.setVisible(true);
    }
    L.extra.items = [];
  }
}
