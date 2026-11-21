import { ActionButtonId, ButtonMeta, ControlMode, KeyBindingMap } from '../types/combo';

export const BUTTON_META: Record<ActionButtonId, ButtonMeta> = {
  // Directions
  UP: { id: 'UP', label: '上 (Up)', shortLabel: '↑', color: '#94a3b8', category: 'direction' },
  DOWN: { id: 'DOWN', label: '下 (Down)', shortLabel: '↓', color: '#94a3b8', category: 'direction' },
  LEFT: { id: 'LEFT', label: '左 (Left)', shortLabel: '←', color: '#94a3b8', category: 'direction' },
  RIGHT: { id: 'RIGHT', label: '右 (Right)', shortLabel: '→', color: '#94a3b8', category: 'direction' },

  // Classic 6-button
  LP: { id: 'LP', label: '輕拳 (LP)', shortLabel: 'LP', color: '#38bdf8', category: 'attack' },
  MP: { id: 'MP', label: '中拳 (MP)', shortLabel: 'MP', color: '#facc15', category: 'attack' },
  HP: { id: 'HP', label: '重拳 (HP)', shortLabel: 'HP', color: '#f43f5e', category: 'attack' },
  LK: { id: 'LK', label: '輕腳 (LK)', shortLabel: 'LK', color: '#22d3ee', category: 'attack' },
  MK: { id: 'MK', label: '中腳 (MK)', shortLabel: 'MK', color: '#fb923c', category: 'attack' },
  HK: { id: 'HK', label: '重腳 (HK)', shortLabel: 'HK', color: '#e11d48', category: 'attack' },

  // Modern buttons
  L: { id: 'L', label: '輕攻擊 (L)', shortLabel: 'L', color: '#38bdf8', category: 'attack' },
  M: { id: 'M', label: '中攻擊 (M)', shortLabel: 'M', color: '#facc15', category: 'attack' },
  H: { id: 'H', label: '重攻擊 (H)', shortLabel: 'H', color: '#f43f5e', category: 'attack' },
  SP: { id: 'SP', label: '必殺技 (SP)', shortLabel: 'SP', color: '#c084fc', category: 'attack' },
  AUTO: { id: 'AUTO', label: '輔助鍵 (AUTO)', shortLabel: 'AUTO', color: '#a855f7', category: 'system' },

  // Shared SF6 System
  PARRY: { id: 'PARRY', label: '精防 (Parry)', shortLabel: 'PARRY', color: '#34d399', category: 'system' },
  DI: { id: 'DI', label: '迸發 (DI)', shortLabel: 'DI', color: '#fb7185', category: 'system' },
};

export const CLASSIC_BUTTONS: ActionButtonId[] = [
  'UP', 'DOWN', 'LEFT', 'RIGHT',
  'LP', 'MP', 'HP', 'LK', 'MK', 'HK',
  'PARRY', 'DI',
];

export const MODERN_BUTTONS: ActionButtonId[] = [
  'UP', 'DOWN', 'LEFT', 'RIGHT',
  'L', 'M', 'H', 'SP', 'AUTO',
  'PARRY', 'DI',
];

export function getButtonsForMode(mode: ControlMode): ActionButtonId[] {
  return mode === 'classic' ? CLASSIC_BUTTONS : MODERN_BUTTONS;
}

export const DEFAULT_BINDINGS: KeyBindingMap = {
  // WASD directions + Standard D-Pad (12..15)
  UP: { keyboardCode: 'KeyW', gamepadButton: 12 },
  DOWN: { keyboardCode: 'KeyS', gamepadButton: 13 },
  LEFT: { keyboardCode: 'KeyA', gamepadButton: 14 },
  RIGHT: { keyboardCode: 'KeyD', gamepadButton: 15 },

  // Classic 6-button (UIO / JKL) + Xbox/PS standard layout
  LP: { keyboardCode: 'KeyU', gamepadButton: 2 },   // X / Square
  MP: { keyboardCode: 'KeyI', gamepadButton: 3 },   // Y / Triangle
  HP: { keyboardCode: 'KeyO', gamepadButton: 5 },   // RB / R1
  LK: { keyboardCode: 'KeyJ', gamepadButton: 0 },   // A / Cross
  MK: { keyboardCode: 'KeyK', gamepadButton: 1 },   // B / Circle
  HK: { keyboardCode: 'KeyL', gamepadButton: 7 },   // RT / R2

  // Modern (J=L, K=M, L=H, I=SP, Space/U=AUTO)
  L: { keyboardCode: 'KeyJ', gamepadButton: 2 },    // X / Square
  M: { keyboardCode: 'KeyK', gamepadButton: 3 },    // Y / Triangle
  H: { keyboardCode: 'KeyL', gamepadButton: 1 },    // B / Circle
  SP: { keyboardCode: 'KeyI', gamepadButton: 0 },   // A / Cross
  AUTO: { keyboardCode: 'KeyU', gamepadButton: 7 }, // RT / R2

  // System (Shared)
  PARRY: { keyboardCode: 'KeyH', gamepadButton: 6 }, // LT / L2
  DI: { keyboardCode: 'KeyP', gamepadButton: 4 },    // LB / L1
};

export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'SPACE';
  if (code.startsWith('Arrow')) return code.replace('Arrow', '↑↓←→'[['Up', 'Down', 'Left', 'Right'].indexOf(code.slice(5))] || '');
  return code;
}

export function formatGamepadButton(index: number | null): string {
  if (index === null) return '未綁定';
  const names: Record<number, string> = {
    0: 'A / ✕',
    1: 'B / ○',
    2: 'X / □',
    3: 'Y / △',
    4: 'LB / L1',
    5: 'RB / R1',
    6: 'LT / L2',
    7: 'RT / R2',
    8: 'Back',
    9: 'Start',
    10: 'L3',
    11: 'R3',
    12: 'D-Up',
    13: 'D-Down',
    14: 'D-Left',
    15: 'D-Right',
  };
  return names[index] ?? `Btn ${index}`;
}
