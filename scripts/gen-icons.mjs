// Gera os ícones PNG do PWA (pixel art 32x32 ampliada sem suavização).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const S = 32;
const px = new Uint8Array(S * S * 4);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const set = (x, y, c) => { if (x < 0 || y < 0 || x >= S || y >= S) return; const i = (y * S + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3]; };
const rect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); };

// céu e grama
for (let y = 0; y < S; y++) rect(0, y, S, 1, hex(y < 8 ? '#7ec4ec' : y < 14 ? '#9ad2ee' : '#b4e0f0'));
rect(0, 21, S, 11, hex('#5aa846'));
rect(0, 21, S, 1, hex('#7cc35a'));
for (const [x, y] of [[3, 25], [8, 28], [25, 24], [28, 29], [14, 30], [20, 27]]) { set(x, y, hex('#36723a')); set(x + 1, y - 1, hex('#94cf5e')); }
// sol
rect(25, 3, 4, 4, hex('#ffcf40')); set(25, 3, hex('#b4e0f0')); set(28, 3, hex('#b4e0f0')); set(25, 6, hex('#b4e0f0')); set(28, 6, hex('#b4e0f0'));
// casa: paredes
rect(8, 15, 16, 9, hex('#b8854f'));
for (let y = 16; y < 24; y += 2) rect(8, y, 16, 1, hex('#8b5e37'));
// telhado
for (let j = 0; j < 7; j++) rect(6 + Math.max(0, 6 - j) - 0, 8 + j, 20 - 2 * Math.max(0, 6 - j) + 0, 1, hex(j % 2 ? '#a53f2f' : '#cc5e3c'));
rect(6, 14, 20, 2, hex('#7a2b26'));
// porta e janelas
rect(14, 18, 4, 6, hex('#6a3a1c')); set(17, 21, hex('#ffcf40'));
rect(10, 17, 3, 3, hex('#a8d8f0')); rect(19, 17, 3, 3, hex('#a8d8f0'));
// chaminé
rect(20, 7, 3, 4, hex('#837d86'));
// contorno escuro ao redor da casa
const out = hex('#2b160a');
const copy = px.slice();
const filledHouse = (x, y) => x >= 6 && x < 26 && y >= 7 && y < 24 && (() => { const i = (y * S + x) * 4; return !(copy[i] === 0x7e || copy[i] === 0x9a || copy[i] === 0xb4); })();
for (let y = 6; y < 25; y++) for (let x = 5; x < 27; x++) {
  if (filledHouse(x, y)) continue;
  if (filledHouse(x + 1, y) || filledHouse(x - 1, y) || filledHouse(x, y + 1) || filledHouse(x, y - 1)) { if (y < 21) set(x, y, out); }
}

function png(scale) {
  const W = S * scale;
  const raw = Buffer.alloc((W * 4 + 1) * W);
  for (let y = 0; y < W; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const si = (Math.floor(y / scale) * S + Math.floor(x / scale)) * 4;
      const di = y * (W * 4 + 1) + 1 + x * 4;
      raw[di] = px[si]; raw[di + 1] = px[si + 1]; raw[di + 2] = px[si + 2]; raw[di + 3] = px[si + 3];
    }
  }
  const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public/icons', { recursive: true });
// tamanhos múltiplos de 32 (pixel perfeito) — o navegador reamostra os demais
writeFileSync('public/icons/icon-192.png', png(6));
writeFileSync('public/icons/icon-512.png', png(16));
writeFileSync('public/icons/icon-180.png', png(6));
console.log('ícones gerados');
