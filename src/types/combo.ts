export type ControlMode = 'classic' | 'modern';

export type DirectionButtonId = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type ClassicAttackId = 'LP' | 'MP' | 'HP' | 'LK' | 'MK' | 'HK' | 'PARRY' | 'DI';

export type ModernAttackId = 'L' | 'M' | 'H' | 'SP' | 'AUTO' | 'PARRY' | 'DI';

export type ActionButtonId = DirectionButtonId | ClassicAttackId | ModernAttackId;

export type MotionType = '236' | '214' | '623' | '6214' | '22' | '66' | '46' | '28';

export interface ButtonMeta {
  id: ActionButtonId;
  label: string;
  shortLabel: string;
  color: string;
  category: 'direction' | 'attack' | 'system';
}

export interface KeyBinding {
  keyboardCode: string; // e.g., 'KeyU', 'Space', 'ArrowDown'
  gamepadButton: number | null; // Standard Gamepad API button index (0..16)
}

export type KeyBindingMap = Record<ActionButtonId, KeyBinding>;

export type TimingWindowType = 'link' | 'cancel' | 'dr-cancel' | 'juggle';

export interface ComboNote {
  id: string;
  /** Time offset from combo start in 60fps frames (0 = first note) */
  frame: number;
  /** Required button(s) to press at this timing (e.g. ['HP'] or ['DOWN', 'MK'] or ['AUTO', 'H']) */
  buttons: ActionButtonId[];
  /** Optional motion input rendered as an osu!-style slider on the LEFT half (e.g. '236' quarter-circle-right) */
  motion?: MotionType;
  /** SF6 real input window category: link (tight), cancel (medium-wide), juggle (wide) */
  windowType?: TimingWindowType;
  /** Optional intentional hold duration in 60fps frames (e.g. Luke Flash Knuckle charge / JP feint hold) */
  holdFrames?: number;
  /** Optional display notation shown inside/below the osu! circle (e.g., "2MK", "236HP", "Auto+H") */
  notation: string;
  /** Optional move name (e.g., "蹲中腳", "波動拳", "OD 昇龍拳") */
  moveName: string;
  /** Normalized screen position X on the RIGHT half (0.56 to 0.88) for attack circle */
  x: number;
  /** Normalized screen position Y (0.25 to 0.75) */
  y: number;
}

export interface InputHistoryEntry {
  /** Start frame relative to combo start (0f), 1-decimal precision */
  startFrame: number;
  /** Duration in 60fps frames this exact direction+button state was held */
  durationFrames: number;
  /** Numpad direction ('1'..'9', '5' = neutral) */
  dir: string;
  /** Non-direction buttons held during this state */
  buttons: ActionButtonId[];
}

export interface ComboData {
  id: string;
  characterId: string;
  characterName: string;
  mode: ControlMode;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  tags: string[];
  notes: ComboNote[];
  /** Optional SF6-style frame-by-frame state-change input history captured during live recording */
  inputHistory?: InputHistoryEntry[];
}

export type StartTriggerMode = 'trigger-first' | 'countdown';

export type JudgmentRank = 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE' | 'MISS';

export interface HitResult {
  noteId: string;
  rank: JudgmentRank;
  deltaFrames: number; // negative = early, positive = late
  timestamp: number;
  x: number;
  y: number;
}

export interface ElectronAPI {
  setOverlayMode: (enabled: boolean) => Promise<{ isOverlayMode: boolean; isClickThrough: boolean }>;
  setClickThrough: (enabled: boolean) => Promise<boolean>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  onGlobalKeyDown: (cb: (code: string) => void) => () => void;
  onGlobalKeyUp: (cb: (code: string) => void) => () => void;
  onOverlayStateChanged: (cb: (state: { isOverlayMode: boolean; isClickThrough: boolean }) => void) => () => void;
  onHotkey: (cb: (action: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
