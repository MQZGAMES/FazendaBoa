/** RNG determinístico (mulberry32) e ruído de valor 2D. */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  range(min: number, max: number): number { return min + this.next() * (max - min); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
}

/** Hash rápido de coordenadas inteiras → [0,1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Ruído de valor suave; period > 0 torna o padrão contínuo ao repetir. */
export function valueNoise(x: number, y: number, seed: number, period = 0, periodY = period): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const wx = (v: number) => (period > 0 ? ((v % period) + period) % period : v);
  const wy = (v: number) => (periodY > 0 ? ((v % periodY) + periodY) % periodY : v);
  const a = hash2(wx(xi), wy(yi), seed), b = hash2(wx(xi + 1), wy(yi), seed);
  const c = hash2(wx(xi), wy(yi + 1), seed), d = hash2(wx(xi + 1), wy(yi + 1), seed);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, seed: number, oct = 3, period = 0): number {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += valueNoise(x * f, y * f, seed + i * 17, period > 0 ? period * f : 0) * amp;
    norm += amp; amp *= 0.5; f *= 2;
  }
  return s / norm;
}
