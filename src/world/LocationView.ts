import Phaser from 'phaser';
import { Location, T } from './Location';
import { OBJ, TREE_NAMES, type WObj } from '../data/objects';
import { TERRAIN } from '../art';
import { MASK_TO_AUTO, AN, ANE, AE, ASE, AS, ASW, AW, ANW, GRASS_VARIANTS, GRASS_WEIGHTS } from '../art/terrain';
import { ROCK_KINDS } from '../art/nature';
import { hash2 } from '../art/rng';
import { TILE } from '../config';

interface ObjSprite {
  spr: Phaser.GameObjects.Image;
  sh: Phaser.GameObjects.Image | null;
  anchor: number;
  gen: number;
  sway: boolean;
  phase: number;
  tree: boolean;
  baseY: number;
  key: string;
}

const GRASS_TOTAL = GRASS_WEIGHTS.reduce((a, b) => a + b, 0);
function grassVariant(x: number, y: number): number {
  let r = hash2(x, y, 99) * GRASS_TOTAL;
  for (let i = 0; i < GRASS_VARIANTS; i++) { r -= GRASS_WEIGHTS[i]; if (r < 0) return i; }
  return 0;
}

export function objFrame(o: WObj, season: number): string {
  switch (o.k) {
    case 'weed': return `weed_${season}_${o.v}`;
    case 'stone': return `rock_stone_${o.v}`;
    case 'twig': return `twig_${o.v}`;
    case 'stump': return 'stump_big';
    case 'tree': return o.s ? 'stump_tree' : `tree_${TREE_NAMES[o.t ?? 0]}_${season}`;
    case 'sapling': return `sapling${o.g ?? 0}_${season}`;
    case 'boulder': return 'boulder';
    case 'tallgrass': return `tallgrass_${season}_${o.v}`;
    case 'flowers': return `flowers_${o.v}`;
    case 'bush': return `bush_${season}`;
    case 'house': return 'house';
    case 'bin': return 'bin';
    case 'fence': return `fence_${o.v}`;
    case 'mailbox': return 'mailbox';
    case 'ore': return `rock_${ROCK_KINDS[o.t ?? 0]}_${o.v}`;
  }
}

/** Ajuste vertical (px) do sprite em relação à base do tile. */
const DY: Partial<Record<string, number>> = { tree: 2, stump: 1, boulder: 1, house: 0, sapling: 1 };

/**
 * Renderização de um mapa: tilemap com autotiling, água animada e objetos
 * com culling (só existem sprites dentro da câmera + margem).
 */
export class LocationView {
  readonly scene: Phaser.Scene;
  readonly loc: Location;
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly ground: Phaser.Tilemaps.TilemapLayer;
  readonly soilLayer: Phaser.Tilemaps.TilemapLayer;
  water: Phaser.GameObjects.TileSprite | null = null;
  waterHi: Phaser.GameObjects.TileSprite | null = null;
  private hasWater = false;
  season = 0;
  private active = new Map<number, ObjSprite>();
  private pool: Phaser.GameObjects.Image[] = [];
  private shPool: Phaser.GameObjects.Image[] = [];
  private gen = 0;
  private lastRect = { x0: -1, y0: -1, x1: -1, y1: -1, rev: -1 };
  private wb = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private swayList: ObjSprite[] = [];
  private treeList: ObjSprite[] = [];
  time = 0;

  constructor(scene: Phaser.Scene, loc: Location, season: number) {
    this.scene = scene;
    this.loc = loc;
    this.season = season;
    this.map = scene.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: loc.w, height: loc.h });
    const ts = this.map.addTilesetImage('tiles', 'tiles', TILE, TILE, 1, 2)!;
    this.ground = this.map.createBlankLayer('ground', ts)!.setDepth(-20);
    this.soilLayer = this.map.createBlankLayer('soil', ts)!.setDepth(-19);
    for (let i = 0; i < loc.terrain.length; i++) if (loc.terrain[i] === T.Water) { this.hasWater = true; break; }
    if (this.hasWater) {
      this.water = scene.add.tileSprite(0, 0, 16, 16, 'water').setOrigin(0, 0).setDepth(-30);
      this.waterHi = scene.add.tileSprite(0, 0, 16, 16, 'water_hi').setOrigin(0, 0).setDepth(-29);
    }
    this.buildGround();
    this.buildSoil();
  }

  private sameT(x: number, y: number, t: number): boolean {
    if (!this.loc.inb(x, y)) return true;
    return this.loc.terrain[y * this.loc.w + x] === t;
  }

  private mask(x: number, y: number, t: number): number {
    let m = 0;
    if (this.sameT(x, y - 1, t)) m |= AN;
    if (this.sameT(x + 1, y - 1, t)) m |= ANE;
    if (this.sameT(x + 1, y, t)) m |= AE;
    if (this.sameT(x + 1, y + 1, t)) m |= ASE;
    if (this.sameT(x, y + 1, t)) m |= AS;
    if (this.sameT(x - 1, y + 1, t)) m |= ASW;
    if (this.sameT(x - 1, y, t)) m |= AW;
    if (this.sameT(x - 1, y - 1, t)) m |= ANW;
    return m;
  }

  tileIndexAt(x: number, y: number): number {
    const t = this.loc.terrain[y * this.loc.w + x];
    const s = this.season;
    switch (t) {
      case T.Grass: return TERRAIN.grass[s][grassVariant(x, y)];
      case T.Dirt: return TERRAIN.dirt[s] + MASK_TO_AUTO[this.mask(x, y, T.Dirt)];
      case T.Water: {
        const m = this.mask(x, y, T.Water);
        return m === 255 ? -1 : TERRAIN.water[s] + MASK_TO_AUTO[m];
      }
      case T.Floor: return TERRAIN.floor[hash2(x, y, 3) < 0.5 ? 0 : 1];
      case T.Wall: {
        const below = this.loc.terrainAt(x, y + 1);
        const above = this.loc.terrainAt(x, y - 1);
        if (below !== T.Wall) return TERRAIN.wallBase;
        if (above !== T.Wall) return TERRAIN.wallTop;
        return TERRAIN.wallMid;
      }
      default: return TERRAIN.black;
    }
  }

  buildGround(): void {
    const L = this.loc;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const idx = this.tileIndexAt(x, y);
      if (idx < 0) this.ground.removeTileAt(x, y);
      else this.ground.putTileAt(idx, x, y);
    }
  }

  private soilMask(x: number, y: number): number {
    const L = this.loc;
    const on = (xx: number, yy: number) => L.inb(xx, yy) && (L.soil[yy * L.w + xx] & 1) === 1;
    let m = 0;
    if (on(x, y - 1)) m |= AN; if (on(x + 1, y - 1)) m |= ANE; if (on(x + 1, y)) m |= AE; if (on(x + 1, y + 1)) m |= ASE;
    if (on(x, y + 1)) m |= AS; if (on(x - 1, y + 1)) m |= ASW; if (on(x - 1, y)) m |= AW; if (on(x - 1, y - 1)) m |= ANW;
    return m;
  }

  /** Atualiza o tile de solo e vizinhos (autotile). */
  refreshSoil(x: number, y: number): void {
    const L = this.loc;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const xx = x + i, yy = y + j;
      if (!L.inb(xx, yy)) continue;
      const s = L.soil[yy * L.w + xx];
      if (!(s & 1)) { this.soilLayer.removeTileAt(xx, yy); continue; }
      const base = (s & 2) ? TERRAIN.soilWet : TERRAIN.soil;
      this.soilLayer.putTileAt(base + MASK_TO_AUTO[this.soilMask(xx, yy)], xx, yy);
    }
  }

  buildSoil(): void {
    const L = this.loc;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const s = L.soil[y * L.w + x];
      if (!(s & 1)) { this.soilLayer.removeTileAt(x, y); continue; }
      const base = (s & 2) ? TERRAIN.soilWet : TERRAIN.soil;
      this.soilLayer.putTileAt(base + MASK_TO_AUTO[this.soilMask(x, y)], x, y);
    }
  }

  setSeason(s: number): void {
    if (s === this.season) return;
    this.season = s;
    this.buildGround();
    for (const os of this.active.values()) this.applyObj(os, this.loc.objs.get(os.anchor)!);
  }

  /* ---------- Objetos (culling + pool) ---------- */
  private acquire(): Phaser.GameObjects.Image {
    const s = this.pool.pop();
    if (s) return s.setVisible(true).setAlpha(1).setAngle(0).setScale(1);
    return this.scene.add.image(0, 0, 'atlas', 'px');
  }
  private acquireShadow(): Phaser.GameObjects.Image {
    const s = this.shPool.pop();
    if (s) return s.setVisible(true);
    return this.scene.add.image(0, 0, 'atlas', 'shadow_s').setDepth(-5);
  }

  private applyObj(os: ObjSprite, o: WObj): void {
    const L = this.loc;
    const def = OBJ[o.k];
    const ax = os.anchor % L.w, ay = Math.floor(os.anchor / L.w);
    const [w, h] = def.size;
    const bx = (ax + w / 2) * TILE, by = (ay + h) * TILE + (DY[o.k] ?? 0);
    const frame = objFrame(o, this.season);
    os.key = frame;
    os.spr.setFrame(frame).setOrigin(0.5, 1).setPosition(bx, by);
    os.baseY = by;
    os.spr.setDepth(def.flat ? -4 : by - (DY[o.k] ?? 0));
    os.sway = !!def.sway && !(o.k === 'tree' && (o.s || this.season === 3));
    os.tree = o.k === 'tree' && !o.s;
    const shKey = o.k === 'tree' && o.s ? 'shadow_m' : def.shadow;
    if (shKey) {
      if (!os.sh) os.sh = this.acquireShadow();
      os.sh.setFrame(shKey).setPosition(bx, (ay + h) * TILE - 2);
    } else if (os.sh) { os.sh.setVisible(false); this.shPool.push(os.sh); os.sh = null; }
  }

  /** Recria o visual de um objeto (após dano, mudança de estágio, remoção). */
  refreshObj(anchor: number): void {
    const os = this.active.get(anchor);
    const o = this.loc.objs.get(anchor);
    if (os && !o) { this.release(os); this.active.delete(anchor); this.rebuildLists(); return; }
    if (os && o) { this.applyObj(os, o); this.rebuildLists(); }
    this.lastRect.rev = -1;
  }

  spriteOf(anchor: number): Phaser.GameObjects.Image | null { return this.active.get(anchor)?.spr ?? null; }

  private release(os: ObjSprite): void {
    os.spr.setVisible(false);
    this.pool.push(os.spr);
    if (os.sh) { os.sh.setVisible(false); this.shPool.push(os.sh); os.sh = null; }
  }

  private rebuildLists(): void {
    this.swayList.length = 0; this.treeList.length = 0;
    for (const os of this.active.values()) {
      if (os.sway) this.swayList.push(os);
      if (os.tree) this.treeList.push(os);
    }
  }

  /** Culling por retângulo de tiles visível (+ margem). */
  updateCulling(view: Phaser.Geom.Rectangle): void {
    const L = this.loc;
    const x0 = Math.max(0, Math.floor(view.x / TILE) - 3), x1 = Math.min(L.w - 1, Math.ceil(view.right / TILE) + 3);
    const y0 = Math.max(0, Math.floor(view.y / TILE) - 2), y1 = Math.min(L.h - 1, Math.ceil(view.bottom / TILE) + 6);
    const r = this.lastRect;
    if (r.x0 === x0 && r.y0 === y0 && r.x1 === x1 && r.y1 === y1 && r.rev === L.rev) return;
    r.x0 = x0; r.y0 = y0; r.x1 = x1; r.y1 = y1; r.rev = L.rev;
    const g = ++this.gen;
    const wb = this.wb;
    wb.x0 = 1e9; wb.y0 = 1e9; wb.x1 = -1; wb.y1 = -1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * L.w + x;
      if (L.terrain[i] === T.Water) {
        if (x < wb.x0) wb.x0 = x; if (x > wb.x1) wb.x1 = x; if (y < wb.y0) wb.y0 = y; if (y > wb.y1) wb.y1 = y;
      }
      const o = L.objs.get(i);
      if (!o) continue;
      let os = this.active.get(i);
      if (!os) {
        os = { spr: this.acquire(), sh: null, anchor: i, gen: g, sway: false, phase: hash2(x, y, 5) * 6.28, tree: false, baseY: 0, key: '' };
        this.active.set(i, os);
        this.applyObj(os, o);
      }
      os.gen = g;
    }
    for (const [k, os] of this.active) {
      if (os.gen !== g || !L.objs.has(k)) { this.release(os); this.active.delete(k); }
    }
    this.rebuildLists();
    if (this.water && this.waterHi) {
      if (wb.x1 < 0) { this.water.setVisible(false); this.waterHi.setVisible(false); }
      else {
        const x = wb.x0 * TILE, y = wb.y0 * TILE, w = (wb.x1 - wb.x0 + 1) * TILE, h = (wb.y1 - wb.y0 + 1) * TILE;
        this.water.setVisible(true).setPosition(x, y).setSize(w, h);
        this.waterHi.setVisible(true).setPosition(x, y).setSize(w, h);
      }
    }
  }

  /** Animações baratas: água, vento, transparência de copas. */
  update(dt: number, view: Phaser.Geom.Rectangle, px: number, py: number, wind: number): void {
    this.time += dt;
    this.updateCulling(view);
    if (this.water && this.waterHi && this.water.visible) {
      const x = this.water.x, y = this.water.y;
      this.water.setTilePosition(x + Math.sin(this.time * 0.6) * 3, y - this.time * 3);
      this.waterHi.setTilePosition(x - this.time * 5, y + Math.sin(this.time * 0.9) * 4);
    }
    // vento: balanço leve de mato, grama alta e copas
    for (let i = 0; i < this.swayList.length; i++) {
      const os = this.swayList[i];
      const a = Math.sin(this.time * 2.1 + os.phase) * wind;
      os.spr.angle = os.tree ? a * 0.6 : a * 4;
    }
    // copas transparentes quando o jogador está atrás
    for (let i = 0; i < this.treeList.length; i++) {
      const os = this.treeList[i];
      const behind = py < os.baseY - 6 && py > os.baseY - 76 && Math.abs(px - os.spr.x) < 22;
      const target = behind ? 0.45 : 1;
      if (os.spr.alpha !== target) os.spr.alpha += (target - os.spr.alpha) * Math.min(1, dt * 10);
    }
  }

  destroy(): void {
    for (const os of this.active.values()) { os.spr.destroy(); os.sh?.destroy(); }
    for (const s of this.pool) s.destroy();
    for (const s of this.shPool) s.destroy();
    this.active.clear();
    this.water?.destroy(); this.waterHi?.destroy();
    this.map.destroy();
  }
}
