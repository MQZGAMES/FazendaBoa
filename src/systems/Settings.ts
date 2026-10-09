import type { QualityLevel } from './Performance';

export interface Settings {
  joySize: number;
  joySens: number;
  leftHanded: boolean;
  vibration: boolean;
  autoTool: boolean;
  quality: QualityLevel | null;
  showFps: boolean;
}

const KEY = 'fb:settings';

export const settings: Settings = {
  joySize: 1,
  joySens: 1,
  leftHanded: false,
  vibration: true,
  autoTool: true,
  quality: null,
  showFps: false,
};

export function loadSettings(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch { /* ignora */ }
}

export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignora */ }
}
