import Phaser from 'phaser';
import { PixelCanvas } from './pixel';

export interface FrameRect { n: string; x: number; y: number; w: number; h: number; }
export interface AtlasResult { key: string; w: number; h: number; frames: FrameRect[]; canvas: HTMLCanvasElement; }

interface Def { name: string; w: number; h: number; draw: (pc: PixelCanvas) => void; }

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Empacota sprites procedurais num atlas (prateleiras), gerando aos poucos
 * para não travar a tela de carregamento.
 */
export class AtlasBuilder {
  private defs: Def[] = [];
  private names = new Set<string>();
  constructor(readonly key: string, readonly width = 2048, readonly pad = 1) {}

  add(name: string, w: number, h: number, draw: (pc: PixelCanvas) => void): void {
    if (this.names.has(name)) throw new Error('frame duplicado: ' + name);
    this.names.add(name);
    this.defs.push({ name, w, h, draw });
  }
  get count(): number { return this.defs.length; }

  async build(onProgress: (f: number) => void, budgetMs = 12): Promise<AtlasResult> {
    // Empacotamento em prateleiras ordenado por altura.
    const order = this.defs.map((_d, i) => i).sort((a, b) => this.defs[b].h - this.defs[a].h || this.defs[b].w - this.defs[a].w);
    const pos = new Array<{ x: number; y: number }>(this.defs.length);
    let x = 0, y = 0, shelfH = 0;
    const W = this.width, pad = this.pad;
    for (const i of order) {
      const d = this.defs[i];
      if (x + d.w + pad > W) { x = 0; y += shelfH + pad; shelfH = 0; }
      pos[i] = { x, y };
      x += d.w + pad;
      shelfH = Math.max(shelfH, d.h);
    }
    let H = y + shelfH;
    H = Math.max(16, Math.ceil(H / 16) * 16);
    if (H > 4096) throw new Error('atlas grande demais: ' + this.key);
    const page = new Uint32Array(W * H);
    const frames: FrameRect[] = [];
    let t0 = performance.now();
    for (let k = 0; k < this.defs.length; k++) {
      const d = this.defs[k];
      const pc = new PixelCanvas(d.w, d.h);
      d.draw(pc);
      const p = pos[k];
      for (let j = 0; j < d.h; j++) page.set(pc.data.subarray(j * d.w, j * d.w + d.w), (p.y + j) * W + p.x);
      frames.push({ n: d.name, x: p.x, y: p.y, w: d.w, h: d.h });
      if (performance.now() - t0 > budgetMs) {
        onProgress(k / this.defs.length);
        const ty = performance.now();
        await nextFrame();
        // aba em segundo plano (timers limitados): trabalha em blocos maiores
        if (performance.now() - ty > 60) budgetMs = Math.max(budgetMs, 250);
        t0 = performance.now();
      }
    }
    onProgress(1);
    const canvas = bufferToCanvas(page, W, H);
    return { key: this.key, w: W, h: H, frames, canvas };
  }
}

export function bufferToCanvas(buf: Uint32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = new ImageData(new Uint8ClampedArray(buf.buffer as ArrayBuffer, buf.byteOffset, w * h * 4), w, h);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function pixelCanvasToCanvas(pc: PixelCanvas): HTMLCanvasElement {
  return bufferToCanvas(pc.data, pc.w, pc.h);
}

/** Registra um atlas (imagem ou canvas) com frames nomeados no Phaser. */
export function registerAtlas(textures: Phaser.Textures.TextureManager, key: string, source: HTMLImageElement | HTMLCanvasElement, frames: FrameRect[]): void {
  if (textures.exists(key)) textures.remove(key);
  const tex = source instanceof HTMLCanvasElement ? textures.addCanvas(key, source)! : textures.addImage(key, source)!;
  for (const f of frames) tex.add(f.n, 0, f.x, f.y, f.w, f.h);
}

/** Libera memória de canvas (limite rígido no iOS Safari). */
export function freeCanvas(c: HTMLCanvasElement): void {
  c.width = 0; c.height = 0;
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try { c.toBlob((b) => resolve(b), 'image/png'); } catch { resolve(null); }
  });
}

export function blobToImage(b: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(b);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
