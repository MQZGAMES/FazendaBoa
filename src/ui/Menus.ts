import Phaser from 'phaser';
import { display } from '../systems/Display';
import { Modal } from './Modal';
import { txt } from './widgets';
import { settings, saveSettings } from '../systems/Settings';
import { canVibrate } from '../systems/Haptics';
import { perf, type QualityLevel } from '../systems/Performance';
import { bus } from '../systems/EventBus';
import { saveGame, exportCode, exportJson, importSave, downloadFile } from '../systems/Save';
import { G } from '../state';

/** Menu principal do jogo (botão de engrenagem). */
export class GameMenu extends Modal {
  constructor(scene: Phaser.Scene, private onSettings: () => void, private onTitle: () => void, private onImported: () => void) { super(scene); }

  present(): void {
    this.clear();
    const W = Math.min(320, display.cssW - 24);
    const items: [string, () => void][] = [
      ['Voltar ao jogo', () => this.hide()],
      ['Salvar agora', async () => { const ok = await saveGame(); bus.emit('toast', ok ? 'Jogo salvo!' : 'Não foi possível salvar.', ok ? 'good' : 'warn'); this.hide(); }],
      ['Exportar save', () => { this.hide(); void openExport(); }],
      ['Importar save', () => { this.hide(); openImport(this.onImported); }],
      ['Configurações', () => { this.hide(); this.onSettings(); }],
      ['Tela de título', async () => { await saveGame(); this.hide(); this.onTitle(); }],
    ];
    const bh = 48, gap = 8;
    const h = 60 + items.length * (bh + gap) + 10;
    this.frame(W, h, 'parch', 80);
    this.c.add(txt(this.scene, this.px + W / 2, this.py + 18, `Fazenda ${G.player.farm}`, 'dark').setOrigin(0.5, 0));
    items.forEach(([l, a], i) => this.button(this.px + 20, this.py + 52 + i * (bh + gap), W - 40, bh, l, a));
    this.show();
  }
}

interface Row { label: string; value: () => string; next: () => void; }

/** Configurações (seção 25): toque no valor para alternar. */
export class SettingsPanel extends Modal {
  constructor(scene: Phaser.Scene, private onChange: () => void) { super(scene); }

  present(): void {
    this.clear();
    const sizes = [0.8, 1, 1.25], sizeN = ['Pequeno', 'Médio', 'Grande'];
    const sens = [0.8, 1, 1.3], sensN = ['Baixa', 'Normal', 'Alta'];
    const ql: (QualityLevel | null)[] = [null, 2, 1, 0], qlN = ['Automático', 'Alto', 'Médio', 'Baixo'];
    const cyc = <T>(arr: T[], cur: T) => arr[(Math.max(0, arr.indexOf(cur)) + 1) % arr.length];
    const rows: Row[] = [
      { label: 'Joystick', value: () => sizeN[Math.max(0, sizes.indexOf(settings.joySize))], next: () => { settings.joySize = cyc(sizes, settings.joySize); } },
      { label: 'Sensibilidade', value: () => sensN[Math.max(0, sens.indexOf(settings.joySens))], next: () => { settings.joySens = cyc(sens, settings.joySens); } },
      { label: 'Botão de ação', value: () => (settings.leftHanded ? 'Esquerda' : 'Direita'), next: () => { settings.leftHanded = !settings.leftHanded; } },
      { label: 'Troca de ferramenta', value: () => (settings.autoTool ? 'Automática' : 'Manual'), next: () => { settings.autoTool = !settings.autoTool; } },
      { label: 'Gráficos', value: () => qlN[Math.max(0, ql.indexOf(settings.quality))], next: () => { settings.quality = cyc(ql, settings.quality); perf.setForced(settings.quality); } },
      { label: 'Mostrar FPS', value: () => (settings.showFps ? 'Sim' : 'Não'), next: () => { settings.showFps = !settings.showFps; } },
    ];
    if (canVibrate) rows.splice(3, 0, { label: 'Vibração', value: () => (settings.vibration ? 'Sim' : 'Não'), next: () => { settings.vibration = !settings.vibration; } });
    const W = Math.min(360, display.cssW - 16);
    const rh = 52;
    const h = 64 + rows.length * rh + 70;
    this.frame(W, h, 'parch', 70);
    this.c.add(txt(this.scene, this.px + W / 2, this.py + 18, 'Configurações', 'dark').setOrigin(0.5, 0));
    rows.forEach((r, i) => {
      const y = this.py + 54 + i * rh;
      this.c.add(txt(this.scene, this.px + 18, y + 14, r.label, 'dark', 1.5));
      const b = this.button(this.px + W - 18 - 150, y + 2, 150, 44, r.value(), () => {
        r.next(); saveSettings(); b.label!.setText(r.value()); this.onChange();
      });
    });
    this.button(this.px + W / 2 - 70, this.py + h - 62, 140, 48, 'Fechar', () => this.hide());
    this.show();
  }
}

/* ---------- Exportar / importar (DOM: precisa de caixa de texto e arquivo) ---------- */
function overlay(): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:30;background:rgba(20,10,4,.7);display:flex;align-items:center;justify-content:center;padding:16px;touch-action:auto';
  return d;
}
function box(title: string): { root: HTMLDivElement; body: HTMLDivElement; close: () => void } {
  const root = overlay();
  const b = document.createElement('div');
  b.style.cssText = 'background:#f6dea5;border:4px solid #8e4f22;outline:3px solid #2b160a;border-radius:6px;max-width:420px;width:100%;padding:16px;color:#3b2312;font:15px system-ui,sans-serif;box-shadow:0 8px 30px #000';
  b.innerHTML = `<div style="font-weight:700;font-size:18px;margin-bottom:10px">${title}</div>`;
  const body = document.createElement('div');
  b.appendChild(body);
  root.appendChild(b);
  document.body.appendChild(root);
  const close = () => root.remove();
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
  return { root, body, close };
}
function btn(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = `margin:8px 8px 0 0;padding:10px 14px;font:600 15px system-ui;border-radius:6px;border:2px solid #2b160a;background:${primary ? '#5cbf45' : '#e8a85a'};color:#2b160a;min-height:44px`;
  b.onclick = onClick;
  return b;
}
function area(readonly: boolean, value = ''): HTMLTextAreaElement {
  const t = document.createElement('textarea');
  t.readOnly = readonly; t.value = value;
  t.style.cssText = 'width:100%;height:120px;box-sizing:border-box;font:12px monospace;border:2px solid #8e4f22;border-radius:4px;background:#fff8e6;color:#2b160a;user-select:text;-webkit-user-select:text';
  return t;
}

export async function openExport(): Promise<void> {
  await saveGame();
  const code = await exportCode();
  const { body, close } = box('Exportar save');
  body.insertAdjacentHTML('beforeend', '<p style="margin:0 0 8px">Copie o código (guarde no bloco de notas) ou baixe o arquivo .json.</p>');
  const t = area(true, code);
  body.appendChild(t);
  body.appendChild(btn('Copiar código', async () => {
    try { await navigator.clipboard.writeText(code); bus.emit('toast', 'Código copiado!', 'good'); } catch { t.select(); document.execCommand('copy'); }
  }, true));
  body.appendChild(btn('Baixar .json', () => {
    const d = new Date();
    downloadFile(`fazendaboa-${G.player.farm}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`, exportJson());
  }));
  body.appendChild(btn('Fechar', close));
  G.flags.lastExport = G.flags.daysPlayed ?? 0;
}

export function openImport(onDone: () => void): void {
  const { body, close } = box('Importar save');
  body.insertAdjacentHTML('beforeend', '<p style="margin:0 0 8px">Cole o código ou escolha um arquivo .json. O save atual vira backup.</p>');
  const t = area(false);
  t.placeholder = 'FB1:...';
  body.appendChild(t);
  const file = document.createElement('input');
  file.type = 'file'; file.accept = '.json,application/json,text/plain'; file.style.display = 'none';
  file.onchange = async () => { const f = file.files?.[0]; if (f) t.value = await f.text(); };
  body.appendChild(file);
  const msg = document.createElement('div');
  msg.style.cssText = 'margin-top:8px;color:#8a2020;min-height:18px';
  body.appendChild(btn('Importar', async () => {
    const ok = await importSave(t.value);
    if (ok) { close(); bus.emit('toast', 'Save importado!', 'good'); onDone(); }
    else msg.textContent = 'Código ou arquivo inválido.';
  }, true));
  body.appendChild(btn('Escolher arquivo', () => file.click()));
  body.appendChild(btn('Cancelar', close));
  body.appendChild(msg);
}
