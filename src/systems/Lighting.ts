import Phaser from 'phaser';
import { perf } from './Performance';

/** Máximo de luzes simultâneas (seção 2.2). */
export const MAX_LIGHTS = 16;

interface Light { x: number; y: number; r: number; color: number; flicker: number; }

/** Gera a textura de luz radial (suave) uma única vez. */
function ensureLightTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('lightmask')) return;
  const S = 64;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = scene.textures.addCanvas('lightmask', c)!;
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/**
 * Escuridão numa render texture de baixa resolução (1/4 no Baixo, 1/2 nos demais),
 * com luzes "apagando" a escuridão e um brilho colorido aditivo.
 * Ampliada com suavização: barata e com luz macia de brinde.
 */
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture | null = null;
  private stamp: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image[] = [];
  private lights: Light[] = [];
  private n = 0;
  private div = 2;
  darkness = 0;
  color = 0x0a0814;
  private t = 0;

  constructor(private scene: Phaser.Scene) {
    ensureLightTexture(scene);
    this.stamp = scene.make.image({ key: 'lightmask', add: false });
    for (let i = 0; i < MAX_LIGHTS; i++) {
      this.glow.push(scene.add.image(0, 0, 'lightmask').setBlendMode(Phaser.BlendModes.ADD).setDepth(9790).setVisible(false));
    }
    for (let i = 0; i < MAX_LIGHTS; i++) this.lights.push({ x: 0, y: 0, r: 0, color: 0xffffff, flicker: 0 });
  }

  begin(): void { this.n = 0; }

  add(x: number, y: number, r: number, color = 0xffffff, flicker = 0): void {
    if (this.n >= MAX_LIGHTS) return;
    const l = this.lights[this.n++];
    l.x = x; l.y = y; l.r = r; l.color = color; l.flicker = flicker;
  }

  private ensureRt(w: number, h: number): void {
    const div = perf.level === 0 ? 4 : 2;
    const rw = Math.ceil(w / div) + 2, rh = Math.ceil(h / div) + 2;
    if (this.rt && this.div === div && this.rt.width === rw && this.rt.height === rh) return;
    this.rt?.destroy();
    this.div = div;
    this.rt = this.scene.add.renderTexture(0, 0, rw, rh).setOrigin(0, 0).setDepth(9795);
    this.rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.rt.setScale(div);
  }

  /** Desenha a escuridão do quadro. `view` = retângulo visível do mundo. */
  render(view: Phaser.Geom.Rectangle, dt: number): void {
    this.t += dt;
    if (this.darkness <= 0.01) {
      if (this.rt) this.rt.setVisible(false);
      for (const g of this.glow) g.setVisible(false);
      return;
    }
    this.ensureRt(view.width, view.height);
    const rt = this.rt!;
    const div = this.div;
    const ox = Math.floor(view.x / div) * div - div, oy = Math.floor(view.y / div) * div - div;
    rt.setVisible(true).setPosition(ox, oy);
    rt.clear();
    rt.fill(this.color, this.darkness);
    for (let i = 0; i < this.n; i++) {
      const l = this.lights[i];
      const f = l.flicker ? 1 + Math.sin(this.t * 9 + i * 1.7) * 0.05 * l.flicker + Math.sin(this.t * 23 + i) * 0.03 * l.flicker : 1;
      const r = l.r * f;
      this.stamp.setDisplaySize((r * 2) / div, (r * 2) / div);
      rt.erase(this.stamp, (l.x - ox) / div, (l.y - oy) / div);
      const g = this.glow[i];
      if (l.color !== 0xffffff && perf.level > 0) {
        g.setVisible(true).setPosition(l.x, l.y).setDisplaySize(r * 1.6, r * 1.6).setTint(l.color).setAlpha(0.22 * this.darkness * f);
      } else g.setVisible(false);
    }
    for (let i = this.n; i < this.glow.length; i++) this.glow[i].setVisible(false);
  }

  destroy(): void {
    this.rt?.destroy();
    this.stamp.destroy();
    for (const g of this.glow) g.destroy();
  }
}
