import type { JudgmentRank } from '../types/combo';

/**
 * Lightweight synthesized SFX via Web Audio API (no audio files).
 * AudioContext is created lazily and resumed on first user interaction.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.5;
let enabled = true;
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

export function playBeatCue(): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  tone(c, { freq: 2200, dur: 0.03, gain: 0.08, type: 'square' });
}
