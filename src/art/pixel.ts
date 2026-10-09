/**
 * Mini biblioteca de pixel art em buffers Uint32 (ABGR little-endian).
 * Roda sem DOM (também pode ser usada em scripts Node).
 */
export type Color = number;

export function rgb(hex: string, a = 255): Color {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
export function rgba(r: number, g: number, b: number, a = 255): Color {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
export const CLEAR: Color = 0;
export function alphaOf(c: Color): number { return (c >>> 24) & 255; }
export function rOf(c: Color): number { return c & 255; }
export function gOf(c: Color): number { return (c >>> 8) & 255; }
export function bOf(c: Color): number { return (c >>> 16) & 255; }
export function withAlpha(c: Color, a: number): Color { return ((c & 0x00ffffff) | ((a & 255) << 24)) >>> 0; }
/** Converte para número 0xRRGGBB (tint/fill do Phaser). */
export function toHex(c: Color): number { return (rOf(c) << 16) | (gOf(c) << 8) | bOf(c); }

/** Mistura duas cores (t=0 → a, t=1 → b). */
export function mix(a: Color, b: Color, t: number): Color {
  const r = rOf(a) + (rOf(b) - rOf(a)) * t;
  const g = gOf(a) + (gOf(b) - gOf(a)) * t;
  const bl = bOf(a) + (bOf(b) - bOf(a)) * t;
  const al = alphaOf(a) + (alphaOf(b) - alphaOf(a)) * t;
  return rgba(Math.round(r), Math.round(g), Math.round(bl), Math.round(al));
}
/** Clareia (amt>0) ou escurece (amt<0) com leve desvio de matiz (luz quente, sombra fria). */
export function shade(c: Color, amt: number): Color {
  if (amt >= 0) return mix(c, rgba(255, 248, 225, alphaOf(c)), amt);
  return mix(c, rgba(28, 14, 44, alphaOf(c)), -amt);
}
/** Cor de contorno colorida (escura, com matiz do material), estilo Stardew. */
export function outlineOf(c: Color): Color {
  const r = rOf(c), g = gOf(c), b = bOf(c);
  return rgba(Math.round(r * 0.3 + 14), Math.round(g * 0.24 + 8), Math.round(b * 0.28 + 16), 255);
}

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;
  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.data = new Uint32Array(w * h);
  }
  inb(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x: number, y: number): Color { return this.inb(x, y) ? this.data[y * this.w + x] : 0; }
  set(x: number, y: number, c: Color): void {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
  }
  /** Desenha só onde já houver pixel (pintar "dentro"). */
  paint(x: number, y: number, c: Color): void {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h && this.data[y * this.w + x] !== 0) this.data[y * this.w + x] = c;
  }
  /** Mistura sobre o pixel atual mantendo seu alfa. */
  blend(x: number, y: number, c: Color, t: number): void {
    x |= 0; y |= 0;
    if (!this.inb(x, y)) return;
    const i = y * this.w + x, cur = this.data[i];
    if (cur === 0) return;
    this.data[i] = withAlpha(mix(cur, c, t), alphaOf(cur));
  }
  filled(x: number, y: number): boolean { return this.inb(x, y) && this.data[y * this.w + x] !== 0; }
  clear(): void { this.data.fill(0); }
  fill(c: Color): void { this.data.fill(c); }
  rect(x: number, y: number, w: number, h: number, c: Color): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }
  hline(x0: number, x1: number, y: number, c: Color): void { for (let i = x0; i <= x1; i++) this.set(i, y, c); }
  vline(x: number, y0: number, y1: number, c: Color): void { for (let j = y0; j <= y1; j++) this.set(x, j, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: Color): void {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Elipse preenchida centrada em (cx,cy) com raios rx, ry. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color): void {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.set(x, y, c);
    }
  }
  circle(cx: number, cy: number, r: number, c: Color): void { this.ellipse(cx, cy, r, r, c); }
  /** Copia outro canvas (pixels transparentes ignorados). */
  blit(src: PixelCanvas, dx: number, dy: number, flipX = false, sx = 0, sy = 0, sw = src.w, sh = src.h): void {
    for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
      const c = src.data[(sy + j) * src.w + (sx + i)];
      if (c === 0) continue;
      const tx = flipX ? dx + (sw - 1 - i) : dx + i;
      this.set(tx, dy + j, c);
    }
  }
  /** Contorno automático: pixels vazios vizinhos a pixels cheios recebem a cor de contorno. */
  outline(colorFor: (neighbor: Color) => Color = outlineOf, diagonal = false): void {
    const w = this.w, h = this.h, d = this.data;
    const out = new Uint32Array(d.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[y * w + x] !== 0) continue;
      let n = 0;
      if (y < h - 1 && d[(y + 1) * w + x]) n = d[(y + 1) * w + x];
      else if (x > 0 && d[y * w + x - 1]) n = d[y * w + x - 1];
      else if (x < w - 1 && d[y * w + x + 1]) n = d[y * w + x + 1];
      else if (y > 0 && d[(y - 1) * w + x]) n = d[(y - 1) * w + x];
      else if (diagonal) {
        if (x > 0 && y > 0 && d[(y - 1) * w + x - 1]) n = d[(y - 1) * w + x - 1];
        else if (x < w - 1 && y > 0 && d[(y - 1) * w + x + 1]) n = d[(y - 1) * w + x + 1];
        else if (x > 0 && y < h - 1 && d[(y + 1) * w + x - 1]) n = d[(y + 1) * w + x - 1];
        else if (x < w - 1 && y < h - 1 && d[(y + 1) * w + x + 1]) n = d[(y + 1) * w + x + 1];
      }
      if (n) out[y * w + x] = colorFor(n);
    }
    for (let i = 0; i < d.length; i++) if (out[i]) d[i] = out[i];
  }
  /** Desenha um molde ASCII: cada caractere mapeia para uma cor (ausente = ignorado). */
  stamp(rows: readonly string[], x: number, y: number, pal: Record<string, Color>, flipX = false): void {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const c = pal[row[i]];
        if (c === undefined) continue;
        const tx = flipX ? x + (row.length - 1 - i) : x + i;
        this.set(tx, y + j, c);
      }
    }
  }
  /** Sombreia o interior: pixels perto da borda inferior-direita escurecem, superior-esquerda clareiam. */
  rimLight(light: (c: Color) => Color, dark: (c: Color) => Color): void {
    const w = this.w, h = this.h, src = this.data.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = src[y * w + x];
      if (!c) continue;
      const up = y > 0 ? src[(y - 1) * w + x] : 0;
      const left = x > 0 ? src[y * w + x - 1] : 0;
      const down = y < h - 1 ? src[(y + 1) * w + x] : 0;
      const right = x < w - 1 ? src[y * w + x + 1] : 0;
      if (!up || !left) this.data[y * w + x] = light(c);
      else if (!down || !right) this.data[y * w + x] = dark(c);
    }
  }
  clone(): PixelCanvas {
    const p = new PixelCanvas(this.w, this.h);
    p.data.set(this.data);
    return p;
  }
}
