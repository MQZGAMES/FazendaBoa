import Phaser from 'phaser';
import { PixelCanvas } from '../art/pixel';
import { panel, slot, smallButton } from '../art/icons';
import { P } from '../art/palette';
import { pixelCanvasToCanvas } from '../art/atlas';
import { UI } from '../config';

export type FontKey = 'light' | 'dark' | 'gold';
export type PanelKind = 'parch' | 'wood' | 'slot' | 'slotSel' | 'btn' | 'btnP';

/** Textura de painel no tamanho exato (px de arte), criada sob demanda e reaproveitada. */
export function uiTex(scene: Phaser.Scene, kind: PanelKind, w: number, h: number): string {
  w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h));
  const key = `ui_${kind}_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const pc = new PixelCanvas(w, h);
  switch (kind) {
    case 'parch': panel(pc, P.parch2, P.parch3); break;
    case 'wood': panel(pc, P.uiWood1, P.uiWood2); break;
    case 'slot': slot(pc, false); break;
    case 'slotSel': slot(pc, true); break;
    case 'btn': smallButton(pc, false); break;
    case 'btnP': smallButton(pc, true); break;
  }
  scene.textures.addCanvas(key, pixelCanvasToCanvas(pc));
  return key;
}

/** Imagem de painel com tamanho em px CSS (múltiplo de UI). */
export function panelImg(scene: Phaser.Scene, x: number, y: number, wCss: number, hCss: number, kind: PanelKind = 'parch'): Phaser.GameObjects.Image {
  const k = uiTex(scene, kind, Math.round(wCss / UI), Math.round(hCss / UI));
  return scene.add.image(Math.round(x), Math.round(y), k).setOrigin(0, 0).setScale(UI);
}

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, font: FontKey = 'light', scale = UI): Phaser.GameObjects.BitmapText {
  return scene.add.bitmapText(Math.round(x), Math.round(y), font, s).setScale(scale);
}

/** Largura de um texto em px CSS. */
export function textWidth(scene: Phaser.Scene, s: string, font: FontKey = 'light', scale = UI): number {
  const t = scene.make.bitmapText({ x: 0, y: 0, font, text: s }, false);
  const w = t.width * scale;
  t.destroy();
  return w;
}

export function icon(scene: Phaser.Scene, x: number, y: number, frame: string, scale = UI): Phaser.GameObjects.Image {
  return scene.add.image(Math.round(x), Math.round(y), 'atlas', frame).setScale(scale);
}

/** Retângulo de acerto simples em px CSS. */
export interface Hit { x: number; y: number; w: number; h: number; }
export function inRect(r: Hit, x: number, y: number, pad = 0): boolean {
  return x >= r.x - pad && y >= r.y - pad && x < r.x + r.w + pad && y < r.y + r.h + pad;
}
