import Phaser from 'phaser';
import { UI } from '../config';
import { uiTex } from './widgets';
import type { ToastKind } from '../systems/EventBus';

interface Msg { text: string; kind: ToastKind; }

/** Mensagens curtas no topo, uma por vez, com fila. */
export class Toast {
  private c: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Image;
  private t: Phaser.GameObjects.BitmapText;
  private queue: Msg[] = [];
  private showing = false;
  private y = 100;
  private cx = 180;
  private maxW = 300;

  constructor(private scene: Phaser.Scene) {
    this.bg = scene.add.image(0, 0, 'atlas', 'px').setOrigin(0.5, 0).setScale(UI);
    this.t = scene.add.bitmapText(0, 0, 'dark', '').setOrigin(0.5, 0).setScale(UI).setCenterAlign();
    this.c = scene.add.container(0, 0, [this.bg, this.t]).setDepth(40).setVisible(false);
  }

  layout(cx: number, y: number, maxW: number): void { this.cx = cx; this.y = y; this.maxW = maxW; }

  push(text: string, kind: ToastKind = 'info'): void {
    if (this.queue.length > 3) this.queue.shift();
    if (this.queue.some((m) => m.text === text)) return;
    this.queue.push({ text, kind });
    if (!this.showing) this.next();
  }

  private next(): void {
    const m = this.queue.shift();
    if (!m) { this.showing = false; this.c.setVisible(false); return; }
    this.showing = true;
    this.t.setMaxWidth((this.maxW - 24) / UI).setText(m.text);
    const w = Math.ceil(this.t.width + 28), h = Math.ceil(this.t.height + 22);
    const kind = m.kind === 'warn' ? 'wood' : 'parch';
    this.bg.setTexture(uiTex(this.scene, kind, Math.ceil(w / UI), Math.ceil(h / UI)));
    this.t.setFont(m.kind === 'warn' ? 'light' : 'dark');
    this.t.setPosition(0, 11);
    this.c.setPosition(Math.round(this.cx), Math.round(this.y - 10)).setVisible(true).setAlpha(0);
    this.scene.tweens.add({
      targets: this.c, alpha: 1, y: this.y, duration: 160, ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(Math.min(4200, 1600 + m.text.length * 35), () => {
          this.scene.tweens.add({ targets: this.c, alpha: 0, duration: 220, onComplete: () => this.next() });
        });
      },
    });
  }
}
