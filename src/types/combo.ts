export type ControlMode = 'classic' | 'modern';

export type PlayerSide = 'left' | 'right';

export type ChartLayoutMode = 'fixed' | 'osu' | 'focused';

export type DirectionButtonId = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type ClassicAttackId = 'LP' | 'MP' | 'HP' | 'LK' | 'MK' | 'HK' | 'PARRY' | 'DI' | 'RESET';

export type ModernAttackId = 'L' | 'M' | 'H' | 'SP' | 'AUTO' | 'PARRY' | 'DI' | 'RESET';

export type ActionButtonId = DirectionButtonId | ClassicAttackId | ModernAttackId;

export type MotionType = '236' | '214' | '623' | '6214' | '22' | '66' | '44' | '46' | '4646' | '28' | '360' | '720';

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
  /** Optional explicit English title shown when UI language is 'en' */
  titleEn?: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Ultra Hard';
  /** Whether this combo requires the corner or works midscreen */
  position?: 'midscreen' | 'corner';
  description: string;
  tags: string[];
  notes: ComboNote[];
  /** Optional SF6-style frame-by-frame state-change input history captured during live recording */
  inputHistory?: InputHistoryEntry[];
  /** Optional WIP lock flag (user can click to unlock at their own risk) */
  locked?: boolean;
  lockReason?: string;
  /** Optional: set when the combo was downloaded from the online combo library */
  source?: 'online';
  /** Optional: server-side ID of the downloaded online combo */
  onlineId?: string;
  /** Optional: display name of the online uploader */
  author?: string;
  /** Optional demo video link (YouTube or X.com) */
  videoUrl?: string;
}

export type StartTriggerMode = 'trigger-first' | 'countdown';

export type JudgmentRank = 'PERFECT' | 'GOOD' | 'OK' | 'EARLY' | 'LATE' | 'MISS';

export interface HitResult {
  noteId: string;
  rank: JudgmentRank;
  deltaFrames: number; // negative = early, positive = late
  timestamp: number;
  x: number;
  y: number;
}

export interface ElectronAPI {
  setOverlayMode: (enabled: boolean, compact?: boolean) => Promise<{ isOverlayMode: boolean; isClickThrough: boolean }>;
  setClickThrough: (enabled: boolean) => Promise<boolean>;
  setHotkeys?: (hotkeys: { clickThrough?: string; exitOverlay?: string; toggleReview?: string; restart?: string }) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  discordLogin?: (apiBase: string) => Promise<{ ok: boolean; token?: string; error?: string }>;
  cancelDiscordLogin?: () => Promise<void>;
  getOnlineToken?: () => Promise<string | null>;
  setOnlineToken?: (token: string) => Promise<boolean>;
  clearOnlineToken?: () => Promise<void>;
  getAppUpdateInfo?: () => Promise<{ canAutoUpdate: boolean; isPortable: boolean }>;
  checkForAppUpdate?: () => Promise<{ ok: boolean }>;
  downloadAppUpdate?: () => Promise<{ ok: boolean }>;
  installAppUpdate?: () => Promise<void>;
  onAppUpdateStatus?: (
    cb: (status: {
      status: 'available' | 'downloading' | 'downloaded' | 'error';
      version?: string;
      percent?: number;
      message?: string;
    }) => void
  ) => () => void;
  resizeWindow?: (width: number, height: number) => void;
  onGlobalKeyDown: (cb: (code: string) => void) => () => void;
  onGlobalKeyUp: (cb: (code: string) => void) => () => void;
  onGlobalGamepadState?: (cb: (state: { connected: boolean; buttons: number[] }) => void) => () => void;
  onOverlayStateChanged: (cb: (state: { isOverlayMode: boolean; isClickThrough: boolean }) => void) => () => void;
  onHotkey: (cb: (action: string) => void) => () => void;
  consumeDeepLinkCombo?: () => Promise<string | null>;
  onDeepLinkCombo?: (cb: (comboId: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
