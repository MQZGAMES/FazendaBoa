import Phaser from 'phaser';
import { UI } from '../config';
import { perf, QUALITY_NAMES, type QualityLevel } from '../systems/Performance';
import { G } from '../state';
import { bus } from '../systems/EventBus';
import { uiState } from './state';
import { uiTex, txt } from './widgets';

interface Btn { label: string; act: () => void; x: number; y: number; w: number; h: number; }

/** Menu de debug: fps, draw calls, memória e atalhos de teste. */
export class DebugPanel {
  private c: Phaser.GameObjects.Container;
  private info: Phaser.GameObjects.BitmapText;
  private btns: Btn[] = [];
  visible = false;
  private calls = 0;
  private callsShown = 0;
  private patched = false;
  private x = 0;
  private y = 0;
  private acc = 0;

  constructor(private scene: Phaser.Scene) {
    this.c = scene.add.container(0, 0).setDepth(70).setVisible(false);
    this.info = txt(scene, 0, 0, '', 'light', 1.5);
    this.c.add(this.info);
    const actions: [string, () => void][] = [
      ['+1000g', () => { G.player.money += 1000; }],
      ['Dia +1', () => bus.emit('debug', true)],
      ['Estação', () => { G.time.season = (G.time.season + 1) % 4; bus.emit('day'); }],
      ['Hora +2', () => { G.time.min = Math.min(G.time.min + 120, 25 * 60 + 50); bus.emit('time'); }],
      ['Energia', () => { G.player.energy = G.player.maxEnergy; }],
      ['Colisão', () => { uiState.showCollision = !uiState.showCollision; }],
      ['Qualid.', () => { const l = ((perf.level + 2) % 3) as QualityLevel; perf.setForced(l); }],
      ['Auto', () => perf.setForced(null)],
    ];
    actions.forEach(([label, act]) => this.btns.push({ label, act, x: 0, y: 0, w: 70, h: 30 }));
  }

  layout(x: number, y: number, W: number): void {
    this.x = x; this.y = y;
    this.c.removeAll(true);
    this.info = txt(this.scene, 0, 0, '', 'light', 1.5);
    this.c.add(this.info);
    const cols = Math.max(2, Math.floor((W - 16) / 78));
    this.btns.forEach((b, i) => {
      b.x = (i % cols) * 76; b.y = 64 + Math.floor(i / cols) * 34;
      const bg = this.scene.add.image(b.x, b.y, uiTex(this.scene, 'btn', 35, 15)).setOrigin(0, 0).setScale(UI);
      const t = txt(this.scene, b.x + b.w / 2, b.y + 6, b.label, 'dark', 1.5).setOrigin(0.5, 0);
      this.c.add([bg, t]);
    });
    this.c.setPosition(x, y);
  }

  toggle(): void {
    this.visible = !this.visible;
    uiState.debug = this.visible;
    this.c.setVisible(this.visible);
    if (this.visible) this.patchGl();
  }

  /** Conta draw calls envolvendo as funções de desenho do WebGL. */
  private patchGl(): void {
    if (this.patched) return;
    const r = this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const gl = (r as { gl?: WebGLRenderingContext }).gl;
    if (!gl) return;
    this.patched = true;
    const de = gl.drawElements.bind(gl), da = gl.drawArrays.bind(gl);
    gl.drawElements = (...a: Parameters<WebGLRenderingContext['drawElements']>) => { this.calls++; de(...a); };
    gl.drawArrays = (...a: Parameters<WebGLRenderingContext['drawArrays']>) => { this.calls++; da(...a); };
    this.scene.game.events.on('postrender', () => { this.callsShown = this.calls; this.calls = 0; });
  }

  handle(x: number, y: number): boolean {
    for (const b of this.btns) {
      if (x >= this.x + b.x && x <= this.x + b.x + b.w && y >= this.y + b.y && y <= this.y + b.y + b.h) { b.act(); return true; }
    }
    return false;
  }

  update(): void {
    this.acc++;
    if (this.acc % 10 !== 0) return;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const lines = [
      `FPS ${Math.round(perf.fps)}  draw calls ${this.callsShown}`,
      `Qualidade ${QUALITY_NAMES[perf.level]}${perf.forced !== null ? ' (fixa)' : ' (auto)'}  objs ${uiState.objCount}`,
      `Memória JS ${mem ? Math.round(mem.usedJSHeapSize / 1048576) + ' MB' : 'n/d'}  ${this.scene.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'}`,
    ];
    this.info.setText(lines.join('\n'));
  }
}
