import Phaser from 'phaser';
import { input } from '../systems/Input';
import { settings } from '../systems/Settings';

/**
 * Joystick invisível: nasce sob o dedo, base translúcida, flutua se o dedo
 * passar do raio, some com fade de 120 ms ao soltar.
 */
export class Joystick {
  private base: Phaser.GameObjects.Image;
  private knob: Phaser.GameObjects.Image;
  pointerId = -1;
  private bx = 0;
  private by = 0;
  private fade: Phaser.Tweens.Tween | null = null;

  constructor(private scene: Phaser.Scene) {
    this.base = scene.add.image(0, 0, 'atlas', 'joy_base').setAlpha(0).setDepth(50);
    this.knob = scene.add.image(0, 0, 'atlas', 'joy_knob').setAlpha(0).setDepth(51);
    this.applySize();
  }

  get radius(): number { return 60 * settings.joySize; }
  get active(): boolean { return this.pointerId >= 0; }

  applySize(): void {
    const s = (this.radius * 2) / 60;
    this.base.setScale(s);
    this.knob.setScale(2 * settings.joySize);
  }

  start(id: number, x: number, y: number): void {
    this.pointerId = id;
    this.bx = x; this.by = y;
    this.fade?.stop();
    this.base.setPosition(x, y).setAlpha(0.3);
    this.knob.setPosition(x, y).setAlpha(0.75);
    this.move(x, y);
  }

  move(x: number, y: number): void {
    const R = this.radius;
    let dx = x - this.bx, dy = y - this.by;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (d > R) {
      // base flutuante acompanha o dedo
      const k = (d - R) / d;
      this.bx += dx * k; this.by += dy * k;
      dx = x - this.bx; dy = y - this.by;
      d = R;
      this.base.setPosition(this.bx, this.by);
    }
    this.knob.setPosition(this.bx + dx, this.by + dy);
    const sens = settings.joySens;
    let m = Math.min(1, (d / R) * sens);
    const dead = 0.12;
    if (m < dead || d < 0.0001) { input.mx = 0; input.my = 0; input.mag = 0; return; }
    m = (m - dead) / (1 - dead);
    input.mag = m;
    input.mx = (dx / d) * m;
    input.my = (dy / d) * m;
    input.lastActive = performance.now();
  }

  end(): void {
    this.pointerId = -1;
    input.mx = 0; input.my = 0; input.mag = 0;
    this.fade = this.scene.tweens.add({ targets: [this.base, this.knob], alpha: 0, duration: 120 });
  }
}
