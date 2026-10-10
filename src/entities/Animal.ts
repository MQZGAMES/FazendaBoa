import Phaser from 'phaser';
import type { AnimalState } from '../state';
import type { Location } from '../world/Location';
import { ANIMALS } from '../data/animals';
import { ANIMAL_POSES } from '../art/animals';
import { G } from '../state';
import { TILE } from '../config';

type State = 'idle' | 'walk' | 'eat' | 'sleep';

/** Animal visível no mapa: passeia, come, dorme e mostra corações. */
export class AnimalEnt {
  readonly spr: Phaser.GameObjects.Sprite;
  readonly sh: Phaser.GameObjects.Image;
  private frames: Record<string, string>;
  private framesL: Record<string, string>;
  private state: State = 'idle';
  private t = 0;
  private dur = 1;
  private fi = 0;
  private ft = 0;
  private dir = 1;
  private vx = 0;
  private vy = 0;
  private size: number;
  private hearts: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene, readonly st: AnimalState) {
    const key = `${st.kind}${st.v}`;
    this.frames = {}; this.framesL = {};
    for (const p of ANIMAL_POSES) { this.frames[p] = `${key}_s_${p}`; this.framesL[p] = `${key}_l_${p}`; }
    this.size = ANIMALS[st.kind].size;
    this.sh = scene.add.image(st.x, st.y, 'atlas', this.size > 16 ? 'shadow_m' : 'shadow_s').setDepth(-5);
    this.spr = scene.add.sprite(st.x, st.y, 'atlas', this.frames.idle0).setOrigin(0.5, 1);
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.apply();
  }

  get tx(): number { return Math.floor(this.st.x / TILE); }
  get ty(): number { return Math.floor((this.st.y - 2) / TILE); }

  private blocked(loc: Location, x: number, y: number): boolean {
    const hw = this.size > 16 ? 9 : 4;
    const x0 = Math.floor((x - hw) / TILE), x1 = Math.floor((x + hw) / TILE), ty = Math.floor((y - 2) / TILE);
    return loc.isSolid(x0, ty) || loc.isSolid(x1, ty);
  }

  private pick(): void {
    const night = G.time.min >= 20 * 60 || G.time.min < 6 * 60 + 30;
    if (night) { this.state = 'sleep'; this.dur = 5; return; }
    const r = Math.random();
    if (r < 0.4) { this.state = 'idle'; this.dur = 1 + Math.random() * 2.5; }
    else if (r < 0.65) { this.state = 'eat'; this.dur = 1.5 + Math.random() * 2; }
    else {
      this.state = 'walk'; this.dur = 0.8 + Math.random() * 2;
      const a = Math.random() * Math.PI * 2;
      const sp = this.size > 16 ? 9 : 14;
      this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.7;
      if (Math.abs(this.vx) > 1) this.dir = this.vx < 0 ? -1 : 1;
    }
    this.t = 0;
  }

  update(dt: number, loc: Location): void {
    this.t += dt; this.ft += dt;
    if (this.t >= this.dur) this.pick();
    if (this.state === 'walk') {
      const nx = this.st.x + this.vx * dt, ny = this.st.y + this.vy * dt;
      if (!this.blocked(loc, nx, this.st.y)) this.st.x = nx; else { this.vx = -this.vx; this.dir = -this.dir; }
      if (!this.blocked(loc, this.st.x, ny)) this.st.y = ny; else this.vy = -this.vy;
    }
    const rate = this.state === 'walk' ? 0.16 : this.state === 'eat' ? 0.3 : 0.6;
    if (this.ft >= rate) { this.ft = 0; this.fi++; }
    this.apply();
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.y -= dt * 14; h.alpha -= dt * 0.8;
      if (h.alpha <= 0) { h.destroy(); this.hearts.splice(i, 1); }
    }
  }

  private apply(): void {
    let pose: string;
    switch (this.state) {
      case 'walk': pose = `walk${this.fi % 4}`; break;
      case 'eat': pose = `eat${this.fi % 2}`; break;
      case 'sleep': pose = 'sleep'; break;
      default: pose = `idle${this.fi % 2}`;
    }
    this.spr.setFrame(this.dir < 0 ? this.framesL[pose] : this.frames[pose]);
    this.spr.setPosition(this.st.x, this.st.y + 1).setDepth(this.st.y);
    this.sh.setPosition(this.st.x, this.st.y - 1);
  }

  /** Corações flutuando (carinho). */
  showHearts(n = 1): void {
    for (let i = 0; i < n; i++) {
      const h = this.scene.add.image(this.st.x + (i - (n - 1) / 2) * 8, this.st.y - this.size - 2, 'atlas', 'heart_full').setDepth(this.st.y + 300);
      this.hearts.push(h);
    }
    this.scene.tweens.add({ targets: this.spr, scaleY: 1.12, scaleX: 0.92, duration: 90, yoyo: true });
    this.state = 'idle'; this.t = 0; this.dur = 1.2;
  }

  destroy(): void { this.spr.destroy(); this.sh.destroy(); for (const h of this.hearts) h.destroy(); }
}
