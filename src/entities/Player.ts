import Phaser from 'phaser';
import { playerFrame, PLAYER_ANIMS, SWING_HANDS, WATER_HANDS, HARVEST_HANDS, type Dir, type PlayerAnim } from '../art/character';
import { input } from '../systems/Input';
import type { Location } from '../world/Location';
import type { Dir4 } from '../state';
import { TILE } from '../config';

const DIRS: Dir[] = ['d', 'u', 's', 's'];
/** Hitbox dos pés (px de arte). */
const HW = 4.5, HH = 4;
export const RUN_SPEED = 80;
export const WALK_SPEED = 46;

/** Tabelas de nomes de frames pré-calculadas (zero alocação por quadro). */
const FRAMES = {} as Record<PlayerAnim, string[][]>;
for (const a of Object.keys(PLAYER_ANIMS) as PlayerAnim[]) {
  FRAMES[a] = [0, 1, 2].map((d) => Array.from({ length: PLAYER_ANIMS[a] }, (_, i) => playerFrame((['d', 'u', 's'] as Dir[])[d], a, i)));
}

export type ActKind = 'swing' | 'water' | 'harvest';
/** Direção (graus) para onde a cabeça da ferramenta aponta em cada quadro do golpe. */
const SWING_ANG: Record<Dir, number[]> = { d: [-100, -15, 80, 85], u: [100, -100, -85, -85], s: [-150, -60, 15, 20] };
const WATER_ROT: Record<Dir, number[]> = { d: [0, 22], u: [0, 0], s: [8, 38] };
const DUR: Record<ActKind, number[]> = { swing: [0.1, 0.05, 0.11, 0.08], water: [0.14, 0.26], harvest: [0.1, 0.16] };
const IMPACT: Record<ActKind, number> = { swing: 2, water: 1, harvest: 1 };

interface Act {
  kind: ActKind; frame: number; t: number; impactDone: boolean;
  onImpact: () => void; toolFrame: string | null;
}

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly tool: Phaser.GameObjects.Image;
  readonly sweat: Phaser.GameObjects.Image;
  x: number;
  y: number;
  dir: Dir4 = 0;
  moving = false;
  speed = 0;
  carrying = false;
  /** multiplicador externo (energia baixa, caminho) */
  speedMul = 1;
  tired = false;
  private animT = 0;
  private frame = 0;
  private anim: PlayerAnim = 'idle';
  /** congelado (menus, transição) */
  frozen = false;
  act: Act | null = null;
  private sweatT = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, dir: Dir4) {
    this.x = x; this.y = y; this.dir = dir;
    this.shadow = scene.add.image(x, y, 'atlas', 'shadow_s').setOrigin(0.5, 0.5).setDepth(-5);
    this.sprite = scene.add.sprite(x, y, 'player', FRAMES.idle[0][0]).setOrigin(0.5, 31 / 32);
    this.tool = scene.add.image(0, 0, 'atlas', 'tool_hoe_0').setVisible(false);
    this.sweat = scene.add.image(0, 0, 'atlas', 'sweat').setVisible(false);
    this.applyFrame();
  }

  /** Tile em que os pés estão. */
  get tx(): number { return Math.floor(this.x / TILE); }
  get ty(): number { return Math.floor((this.y - 2) / TILE); }
  get busy(): boolean { return this.act !== null; }

  /** Tile à frente (direção que olha). */
  facingTile(out: { x: number; y: number }): { x: number; y: number } {
    let fx = this.tx, fy = this.ty;
    if (this.dir === 0) fy++; else if (this.dir === 1) fy--; else if (this.dir === 2) fx--; else fx++;
    out.x = fx; out.y = fy;
    return out;
  }

  private blocked(loc: Location, px: number, py: number): boolean {
    const x0 = Math.floor((px - HW) / TILE), x1 = Math.floor((px + HW - 0.001) / TILE);
    const y0 = Math.floor((py - HH) / TILE), y1 = Math.floor((py - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (loc.isSolid(tx, ty)) return true;
    return false;
  }

  /** Inicia uma ação animada (golpe, rega, colheita). O efeito acontece no quadro de impacto. */
  startAct(kind: ActKind, toolFrame: string | null, onImpact: () => void): void {
    this.act = { kind, frame: 0, t: 0, impactDone: false, onImpact, toolFrame };
    this.anim = kind; this.frame = 0; this.animT = 0;
    this.moving = false;
    if (toolFrame) this.tool.setFrame(toolFrame).setVisible(true);
    this.applyFrame();
  }

  update(dt: number, loc: Location): void {
    if (this.act) { this.updateAct(dt); this.updateSweat(dt); return; }
    let mx = input.locked || this.frozen ? 0 : input.mx;
    let my = input.locked || this.frozen ? 0 : input.my;
    const mag = Math.sqrt(mx * mx + my * my);
    this.moving = mag > 0.01;
    if (this.moving) {
      const runZone = input.mag >= 0.6;
      const base = runZone ? RUN_SPEED : WALK_SPEED * Math.min(1, 0.55 + (input.mag / 0.6) * 0.45);
      this.speed = base * this.speedMul * (this.carrying ? 0.7 : 1) * (this.tired ? 0.75 : 1);
      if (mag > 1) { mx /= mag; my /= mag; }
      const nmx = mx / Math.max(mag, 0.0001), nmy = my / Math.max(mag, 0.0001);
      // direção com histerese para diagonais
      const ax = Math.abs(nmx), ay = Math.abs(nmy);
      const curHoriz = this.dir >= 2;
      if (ax > ay * (curHoriz ? 0.8 : 1.25)) this.dir = nmx < 0 ? 2 : 3;
      else this.dir = nmy < 0 ? 1 : 0;
      // sub-passos de no máx. 3px contra atravessar paredes
      const total = this.speed * dt;
      const steps = Math.max(1, Math.ceil(total / 3));
      const sx = (nmx * total) / steps, sy = (nmy * total) / steps;
      for (let s = 0; s < steps; s++) this.step(loc, sx, sy, nmx, nmy);
    } else {
      this.speed = 0;
    }
    this.animate(dt);
    this.updateSweat(dt);
  }

  private updateAct(dt: number): void {
    const a = this.act!;
    a.t += dt;
    const durs = DUR[a.kind];
    if (a.t >= durs[a.frame]) {
      a.t = 0;
      a.frame++;
      if (a.frame >= durs.length) {
        this.act = null;
        this.tool.setVisible(false);
        this.anim = 'idle'; this.frame = 0; this.animT = 0;
        this.applyFrame();
        return;
      }
    }
    if (!a.impactDone && a.frame >= IMPACT[a.kind]) { a.impactDone = true; a.onImpact(); }
    this.frame = a.frame;
    this.applyFrame();
  }

  /** Movimento por eixo com deslizamento em quinas (nunca gruda nas paredes). */
  private step(loc: Location, sx: number, sy: number, nmx: number, nmy: number): void {
    if (sx !== 0) {
      const nx = this.x + sx;
      if (!this.blocked(loc, nx, this.y)) this.x = nx;
      else if (Math.abs(nmy) < 0.45) {
        for (let k = 1; k <= 7; k++) {
          if (!this.blocked(loc, nx, this.y - k) && !this.blocked(loc, this.x, this.y - k)) { this.y -= Math.min(k, Math.abs(sx)); break; }
          if (!this.blocked(loc, nx, this.y + k) && !this.blocked(loc, this.x, this.y + k)) { this.y += Math.min(k, Math.abs(sx)); break; }
        }
      }
    }
    if (sy !== 0) {
      const ny = this.y + sy;
      if (!this.blocked(loc, this.x, ny)) this.y = ny;
      else if (Math.abs(nmx) < 0.45) {
        for (let k = 1; k <= 7; k++) {
          if (!this.blocked(loc, this.x - k, ny) && !this.blocked(loc, this.x - k, this.y)) { this.x -= Math.min(k, Math.abs(sy)); break; }
          if (!this.blocked(loc, this.x + k, ny) && !this.blocked(loc, this.x + k, this.y)) { this.x += Math.min(k, Math.abs(sy)); break; }
        }
      }
    }
  }

  private animate(dt: number): void {
    const want: PlayerAnim = this.carrying ? 'carry' : this.moving ? 'walk' : 'idle';
    if (want !== this.anim) { this.anim = want; this.frame = 0; this.animT = 0; }
    this.animT += dt;
    if (this.anim === 'idle') {
      const dur = this.frame === 0 ? 1.1 : 0.45;
      if (this.animT >= dur) { this.animT = 0; this.frame = (this.frame + 1) % 2; }
    } else if (this.moving) {
      const fps = 7 + (this.speed / RUN_SPEED) * 6;
      if (this.animT >= 1 / fps) { this.animT = 0; this.frame = (this.frame + 1) % 6; }
    } else {
      this.frame = 0;
    }
    this.applyFrame();
  }

  private updateSweat(dt: number): void {
    if (!this.tired) { if (this.sweat.visible) this.sweat.setVisible(false); return; }
    this.sweatT += dt;
    const ph = this.sweatT % 1.4;
    const vis = ph < 0.6;
    this.sweat.setVisible(vis);
    if (vis) this.sweat.setPosition(this.x + (this.dir === 2 ? -6 : 6), this.y - 26 + ph * 10).setDepth(this.y + 1).setAlpha(1 - ph / 0.6);
  }

  /** Força uma direção (ex.: virar para o alvo tocado). */
  face(d: Dir4): void { this.dir = d; this.applyFrame(); }

  applyFrame(): void {
    const d = this.dir === 0 ? 0 : this.dir === 1 ? 1 : 2;
    const anim = this.anim;
    const fr = FRAMES[anim][d];
    this.sprite.setFrame(fr[Math.min(this.frame, fr.length - 1)]);
    const flip = this.dir === 2;
    this.sprite.flipX = flip;
    this.sprite.setPosition(this.x, this.y + 1);
    this.sprite.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y);
    if (this.act && this.act.toolFrame) this.placeTool(DIRS[this.dir], flip);
  }

  /** Posiciona a ferramenta na mão conforme o quadro da ação. */
  private placeTool(d: Dir, flip: boolean): void {
    const a = this.act!;
    const i = Math.min(a.frame, 3);
    const hands = a.kind === 'water' ? WATER_HANDS[d] : a.kind === 'harvest' ? HARVEST_HANDS[d] : SWING_HANDS[d];
    const [hx0, hy] = hands[Math.min(i, hands.length - 1)];
    const hx = flip ? 15 - hx0 : hx0;
    const wx = this.x - 8 + hx + 0.5, wy = this.y - 30 + hy + 0.5;
    const t = this.tool;
    if (a.kind === 'water') {
      const rot = WATER_ROT[d][Math.min(i, 1)];
      t.setOrigin(0.5, 0.6).setPosition(wx + (flip ? -3 : 3) * (d === 's' ? 1 : 0), wy).setFlipX(flip).setAngle(flip ? -rot : rot);
    } else {
      const th = SWING_ANG[d][i];
      t.setOrigin(flip ? 1 - 2.5 / 16 : 2.5 / 16, 13.5 / 16).setPosition(wx, wy).setFlipX(flip).setAngle(flip ? -(th + 45) : th + 45);
    }
    t.setDepth(d === 'u' ? this.y - 0.5 : this.y + 0.5);
  }

  setVisible(v: boolean): void { this.sprite.setVisible(v); this.shadow.setVisible(v); }
  get dirName(): Dir { return DIRS[this.dir]; }
}
