import type { JudgmentRank } from '../types/combo';

/**
 * Lightweight synthesized SFX via Web Audio API (no audio files).
 * AudioContext is created lazily and resumed on first user interaction.
 */

export type SfxPresetId = 'default' | 'woodblock' | 'drum' | 'bell' | 'custom';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.7;
let enabled = true;
let currentPreset: SfxPresetId = 'default';
let customBuffer: AudioBuffer | null = null;
let unlockHooked = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

function hookUnlock(): void {
  if (unlockHooked || typeof window === 'undefined') return;
  unlockHooked = true;
  const unlock = () => {
    getCtx();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}
hookUnlock();

interface ToneOpts {
  freq: number;
  endFreq?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  delay?: number;
}

function tone(c: AudioContext, o: ToneOpts): void {
  if (!master) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(o.endFreq, t0 + o.dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

export function setVolume(vol: number): void {
  volume = Math.min(1, Math.max(0, vol));
  if (master) master.gain.value = volume;
}

export function setSfxPreset(preset: SfxPresetId): void {
  currentPreset = preset;
}

export function clearCustomSfx(): void {
  customBuffer = null;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    const base64 = dataUrl.slice(commaIdx + 1);
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  } catch {
    return null;
  }
}

export async function loadCustomSfxFromDataUrl(
  dataUrl: string
): Promise<{ ok: true; durationSec: number } | { ok: false; reason: 'too_long' | 'invalid' }> {
  const c = getCtx();
  if (!c) return { ok: false, reason: 'invalid' };
  const buf = dataUrlToArrayBuffer(dataUrl);
  if (!buf || buf.byteLength === 0) return { ok: false, reason: 'invalid' };
  try {
    const decoded = await c.decodeAudioData(buf.slice(0));
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
      return { ok: false, reason: 'invalid' };
    }
    if (decoded.duration > 1.0) {
      return { ok: false, reason: 'too_long' };
    }
    customBuffer = decoded;
    return { ok: true, durationSec: decoded.duration };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export function setEnabled(value: boolean): void {
  enabled = value;
}

export function isEnabled(): boolean {
  return enabled;
}

export function playJudgment(rank: JudgmentRank): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  switch (rank) {
    case 'PERFECT':
      tone(c, { freq: 1318.5, dur: 0.16, gain: 0.28 });
      tone(c, { freq: 1975.5, dur: 0.22, gain: 0.2, delay: 0.045 });
      break;
    case 'GOOD':
      tone(c, { freq: 1000, endFreq: 800, dur: 0.06, gain: 0.25, type: 'triangle' });
      break;
    case 'EARLY':
    case 'LATE':
      tone(c, { freq: 420, endFreq: 300, dur: 0.05, gain: 0.2, type: 'triangle' });
      break;
    case 'MISS':
      tone(c, { freq: 140, endFreq: 70, dur: 0.18, gain: 0.35 });
      break;
  }
}

export function playBeatCue(forcePreview = false): void {
  if (!forcePreview && !enabled) return;
  const c = getCtx();
  if (!c || !master) return;

  if (currentPreset === 'custom' && customBuffer) {
    const src = c.createBufferSource();
    src.buffer = customBuffer;
    src.connect(master);
    src.start(c.currentTime);
    return;
  }

  switch (currentPreset) {
    case 'woodblock':
      tone(c, { freq: 920, endFreq: 620, dur: 0.045, gain: 0.32, type: 'sine' });
      tone(c, { freq: 1840, endFreq: 1320, dur: 0.022, gain: 0.14, type: 'triangle' });
      break;
    case 'drum':
      tone(c, { freq: 190, endFreq: 62, dur: 0.095, gain: 0.55, type: 'sine' });
      tone(c, { freq: 420, endFreq: 160, dur: 0.03, gain: 0.22, type: 'triangle' });
      break;
    case 'bell':
      tone(c, { freq: 1760, dur: 0.18, gain: 0.24, type: 'sine' });
      tone(c, { freq: 3520, dur: 0.12, gain: 0.11, type: 'sine' });
      break;
    case 'default':
    case 'custom':
    default:
      tone(c, { freq: 2200, dur: 0.03, gain: 0.08, type: 'square' });
      break;
  }
}
