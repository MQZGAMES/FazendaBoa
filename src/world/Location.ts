import { OBJ, type WObj } from '../data/objects';

/** Tipos de terreno base. */
export enum T { Grass = 0, Dirt = 1, Water = 2, Floor = 3, Wall = 4, Void = 5 }

/** Plantação num tile arado. */
export interface Crop { id: string; age: number; stage: number; regrow?: number; dead?: 1; ql?: number; }

export interface Exit { x: number; y: number; w: number; h: number; to: string; tx: number; ty: number; label: string; }

/** Dados (serializáveis) de um mapa. A renderização fica em LocationView. */
export class Location {
  readonly id: string;
  readonly w: number;
  readonly h: number;
  terrain: Uint8Array;
  /** bit0 arado, bit1 molhado, bits2-3 fertilizante, bits4-7 dias sem planta */
  soil: Uint8Array;
  objs = new Map<number, WObj>();
  /** ocupação: índice da âncora + 1 (0 = livre) */
  occ: Int32Array;
  /** colisão final (terreno + objetos) */
  solid: Uint8Array;
  crops = new Map<number, Crop>();
  exits: Exit[] = [];
  outdoor = true;
  /** dados extras por mapa (salvos) */
  extra: Record<string, unknown> = {};
  /** versão incrementada a cada mudança visual de objetos (para a view) */
  rev = 0;

  constructor(id: string, w: number, h: number) {
    this.id = id; this.w = w; this.h = h;
    const n = w * h;
    this.terrain = new Uint8Array(n);
    this.soil = new Uint8Array(n);
    this.occ = new Int32Array(n);
    this.solid = new Uint8Array(n);
  }

  idx(x: number, y: number): number { return y * this.w + x; }
  inb(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  terrainAt(x: number, y: number): number { return this.inb(x, y) ? this.terrain[y * this.w + x] : T.Void; }

  /** Recalcula colisão de um tile. */
  refreshSolid(i: number): void {
    const t = this.terrain[i];
    let s = t === T.Water || t === T.Wall || t === T.Void ? 1 : 0;
    const o = this.occ[i];
    if (o) {
      const obj = this.objs.get(o - 1);
      if (obj && OBJ[obj.k].solid) s = 1;
    }
    this.solid[i] = s;
  }
  /** Reconstrói a ocupação a partir dos objetos (após carregar). */
  rebuildOcc(): void {
    this.occ.fill(0);
    for (const [a, o] of this.objs) {
      const [w, h] = OBJ[o.k].size;
      const x = a % this.w, y = Math.floor(a / this.w);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        if (this.inb(x + i, y + j)) this.occ[this.idx(x + i, y + j)] = a + 1;
      }
    }
    this.refreshAllSolid();
  }
  refreshAllSolid(): void { for (let i = 0; i < this.solid.length; i++) this.refreshSolid(i); }

  isSolid(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    return this.solid[y * this.w + x] === 1;
  }

  /** Objeto que ocupa o tile (qualquer parte da base). */
  objAt(x: number, y: number): { i: number; o: WObj } | null {
    if (!this.inb(x, y)) return null;
    const a = this.occ[y * this.w + x];
    if (!a) return null;
    const o = this.objs.get(a - 1);
    return o ? { i: a - 1, o } : null;
  }

  canPlace(x: number, y: number, w: number, h: number): boolean {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const xx = x + i, yy = y + j;
      if (!this.inb(xx, yy) || this.occ[yy * this.w + xx]) return false;
      const t = this.terrain[yy * this.w + xx];
      if (t === T.Water || t === T.Wall || t === T.Void) return false;
    }
    return true;
  }

  place(x: number, y: number, o: WObj): boolean {
    const [w, h] = OBJ[o.k].size;
    if (!this.canPlace(x, y, w, h)) return false;
    const a = this.idx(x, y);
    this.objs.set(a, o);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = this.idx(x + i, y + j);
      this.occ[k] = a + 1;
      this.refreshSolid(k);
    }
    this.rev++;
    return true;
  }

  remove(anchor: number): WObj | undefined {
    const o = this.objs.get(anchor);
    if (!o) return undefined;
    const [w, h] = OBJ[o.k].size;
    const x = anchor % this.w, y = Math.floor(anchor / this.w);
    this.objs.delete(anchor);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = this.idx(x + i, y + j);
      if (this.occ[k] === anchor + 1) this.occ[k] = 0;
      this.refreshSolid(k);
    }
    this.rev++;
    return o;
  }

  exitAt(x: number, y: number): Exit | null {
    for (const e of this.exits) if (x >= e.x && y >= e.y && x < e.x + e.w && y < e.y + e.h) return e;
    return null;
  }
}
