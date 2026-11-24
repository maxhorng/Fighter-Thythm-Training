import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, MousePointerClick, RotateCcw } from 'lucide-react';
import {
  ActionButtonId,
  ChartLayoutMode,
  ComboData,
  ComboNote,
  ControlMode,
  DirectionButtonId,
  HitResult,
  JudgmentRank,
  KeyBindingMap,
  MotionType,
  PlayerSide,
  StartTriggerMode,
} from '../types/combo';
import { BUTTON_META } from '../data/bindings';
import { useInputEngine } from '../hooks/useInputEngine';

import { playBeatCue } from '../utils/soundEngine';
import { AppLang, getComboTitle, I18N } from '../data/i18n';

interface OverlayViewProps {
  mode: ControlMode;
  combo: ComboData;
  bindings: KeyBindingMap;
  lang: AppLang;
  triggerMode: StartTriggerMode;
  playerSide: PlayerSide;
  showRecordedInputs: boolean;
  lowPerfMode: boolean;
  chartLayout?: ChartLayoutMode;
  sfxEnabled?: boolean;
  /** When true, late presses on cancel/juggle notes shift the playback clock (adaptive tempo).
   *  When false (default), playback strictly reproduces the recorded rhythm. */
  dynamicResync?: boolean;
  isClickThrough: boolean;
  onExitOverlay: () => void;
}

const FPS = 60;
const FRAME_MS = 1000 / FPS;
const APPROACH_FRAMES = 36; // 600ms approach circle shrink time
const CIRCLE_RADIUS = 64; // 1.5x larger centered osu! button

/**
 * Real SF6 per-move tolerance windows (in 60fps frames):
 * - PERFECT is always crisp & frame-accurate (±1.5f ~ ±2.5f) so you know you hit the exact frame.
 * - GOOD covers the real SF6 playable window where the combo still connects!
 * - EARLY / LATE is the danger zone where the combo may drop.
 */
function getNoteWindows(
  windowType?: 'link' | 'cancel' | 'dr-cancel' | 'juggle',
  buttons?: ActionButtonId[]
) {
  const effectiveType =
    windowType ?? (buttons?.includes('PARRY') ? 'dr-cancel' : undefined);

  if (effectiveType === 'dr-cancel') {
    return { earlyPerfect: 0.35, latePerfect: 0.35, earlyGood: 12.0, lateGood: 16.0, maxMiss: 24.0 };
  }
  if (effectiveType === 'juggle') {
    return { earlyPerfect: 0.35, latePerfect: 0.35, earlyGood: 7.0, lateGood: 13.0, maxMiss: 18.0 };
  }
  if (effectiveType === 'cancel') {
    return { earlyPerfect: 0.35, latePerfect: 0.35, earlyGood: 6.0, lateGood: 10.0, maxMiss: 14.0 };
  }
  // Default / 'link' (exact sub-frame Perfect ±0.35f; Good covers SF6 4f buffer + tight late)
  return { earlyPerfect: 0.35, latePerfect: 0.35, earlyGood: 4.5, lateGood: 3.5, maxMiss: 10.0 };
}

const DIRECTION_IDS = new Set<ActionButtonId>(['UP', 'DOWN', 'LEFT', 'RIGHT']);

const RANK_COLORS: Record<JudgmentRank, string> = {
  PERFECT: '#38bdf8',
  GOOD: '#4ade80',
  EARLY: '#a78bfa',
  LATE: '#fb923c',
  MISS: '#f43f5e',
};

function mirrorBtn(btn: ActionButtonId, isRight: boolean): ActionButtonId {
  if (!isRight) return btn;
  if (btn === 'LEFT') return 'RIGHT';
  if (btn === 'RIGHT') return 'LEFT';
  return btn;
}

function mirrorSet(set: Set<ActionButtonId>, isRight: boolean): Set<ActionButtonId> {
  if (!isRight) return set;
  const next = new Set<ActionButtonId>();
  set.forEach((b) => next.add(mirrorBtn(b, true)));
  return next;
}

/**
 * Fixed Layout (arcade / hitbox) board:
 * - Right side: fixed attack button grid (gray when idle, lit + shrinking osu! approach ring + sequence badge + follow lines).
 * - Left side: original osu! drawMotionSlider for motions, original direction circle for simple directions, or subtle gray idle circle.
 */
function drawFixedBoard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  notes: ComboNote[],
  activeIdx: number,
  currentFrame: number,
  phase: string,
  now: number,
  mode: ControlMode,
  isRight: boolean,
  lowPerfMode: boolean
) {
  const R = Math.max(30, Math.min(42, w * 0.026));
  const gap = R * 2.35;
  // Left direction / motion cue center
  const padX = w * 0.22;
  const padY = h * 0.44;
  // Right fixed attack button grid
  const gx = w * 0.62;
  const gy = h * 0.34;
  const gapX = R * 2.5;
  const gapY = R * 2.5;
  const pos: Partial<Record<ActionButtonId, { x: number; y: number; r: number }>> = {};
  const top: ActionButtonId[] = mode === 'modern' ? ['L', 'M', 'H', 'DI'] : ['LP', 'MP', 'HP', 'DI'];
  const bottom: ActionButtonId[] = mode === 'modern' ? ['SP', 'AUTO', 'PARRY'] : ['LK', 'MK', 'HK', 'PARRY'];
  top.forEach((b, i) => { pos[b] = { x: gx + i * gapX, y: gy, r: R }; });
  bottom.forEach((b, i) => { pos[b] = { x: gx + i * gapX, y: gy + gapY, r: R }; });

  const lit = new Map<ActionButtonId, { color: string; scale: number; prog: number; gold: boolean; alpha: number; seq: number; isActive: boolean }[]>();
  const visible: number[] = [];
  for (let i = activeIdx; i < notes.length && visible.length < 8; i++) {
    const until = notes[i].frame - currentFrame;
    if (i === activeIdx || (phase !== 'waiting-first' && until <= APPROACH_FRAMES)) visible.push(i);
    else break;
  }

  // Resolve each visible note into right-side fixed attack buttons
  const attackTargets = (n: ComboNote): ActionButtonId[] =>
    n.buttons.filter((b) => !DIRECTION_IDS.has(b) && Boolean(pos[b]));

  visible.forEach((idx) => {
    const n = notes[idx];
    const isActive = idx === activeIdx;
    const until = n.frame - currentFrame;
    let prog: number;
    let scale: number;
    if (phase === 'waiting-first' && isActive) {
      const pulse = (Math.sin(now / 220) + 1) / 2;
      prog = 0.5 + pulse * 0.5;
      scale = 1.12 + pulse * 0.35;
    } else {
      const c = Math.max(0, Math.min(APPROACH_FRAMES, until));
      prog = 1 - c / APPROACH_FRAMES;
      scale = 1 + (1 - prog) * 1.6;
    }
    const gold = phase === 'playing' && until <= 9 && until >= -2;
    const attacks = n.buttons.filter((b) => !DIRECTION_IDS.has(b));
    const primary = attacks[attacks.length - 1] ?? n.buttons[n.buttons.length - 1];
    const color = BUTTON_META[primary]?.color ?? '#38bdf8';
    const alpha = isActive ? 1 : Math.min(0.9, prog * 2 + 0.2);
    attackTargets(n).forEach((b) => {
      const arr = lit.get(b) ?? [];
      arr.push({ color, scale, prog, gold, alpha, seq: idx + 1, isActive });
      lit.set(b, arr);
    });
  });

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Board panels (ultra-subtle transparent backdrop so SF6 remains clearly visible)
  const panel = (x: number, y: number, pw: number, ph: number) => {
    ctx.fillStyle = 'rgba(10, 14, 24, 0.12)';
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  panel(padX - gap - R - 22, padY - gap - R - 22, gap * 2 + R * 2 + 44, gap * 2 + R * 2 + 44);

  // Left side:
  // Always draw the 8 fixed directional buttons at exact drawMotionSlider coordinates
  // (ring radius = 72, button radius = 26, centered at (padX, padY)).
  // When active/imminent note has a motion, draw the exact original drawMotionSlider right on top
  // at centerY = padY + 72 * 0.15 so its arcCy === padY aligns dead-center on 2/3/6 (and 2/1/4, 6/2/4).
  const ringR = 72;
  const btnR = 26;
  const compass: { key: string; arrow: string; x: number; y: number }[] = [
    { key: '8', arrow: '↑', x: padX, y: padY - ringR },
    { key: '9', arrow: '↗', x: padX + ringR * Math.SQRT1_2, y: padY - ringR * Math.SQRT1_2 },
    { key: '6', arrow: '→', x: padX + ringR, y: padY },
    { key: '3', arrow: '↘', x: padX + ringR * Math.SQRT1_2, y: padY + ringR * Math.SQRT1_2 },
    { key: '2', arrow: '↓', x: padX, y: padY + ringR },
    { key: '1', arrow: '↙', x: padX - ringR * Math.SQRT1_2, y: padY + ringR * Math.SQRT1_2 },
    { key: '4', arrow: '←', x: padX - ringR, y: padY },
    { key: '7', arrow: '↖', x: padX - ringR * Math.SQRT1_2, y: padY - ringR * Math.SQRT1_2 },
  ];
  const compassMap = new Map(compass.map((c) => [c.key, c]));

  // Draw all 8 idle ghosted compass buttons
  compass.forEach((c) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, btnR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.20)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.38)';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillText(c.arrow, c.x, c.y);
  });

  // Subtle neutral center dot
  ctx.beginPath();
  ctx.arc(padX, padY, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.fill();

  // Light up required 8-way direction(s) for visible non-motion notes (later notes first)
  const dirEvents: {
    key: string;
    color: string;
    scale: number;
    gold: boolean;
    alpha: number;
    seq: number;
    isActive: boolean;
  }[] = [];

  visible.forEach((idx) => {
    const n = notes[idx];
    if (n.motion) return;
    const dirs = n.buttons
      .filter((b) => DIRECTION_IDS.has(b))
      .map((b) => mirrorBtn(b, isRight));
    if (dirs.length === 0) return;

    const hasUp = dirs.includes('UP');
    const hasDown = dirs.includes('DOWN');
    const hasLeft = dirs.includes('LEFT');
    const hasRight = dirs.includes('RIGHT');
    const key =
      hasDown && hasRight
        ? '3'
        : hasDown && hasLeft
        ? '1'
        : hasUp && hasRight
        ? '9'
        : hasUp && hasLeft
        ? '7'
        : hasDown
        ? '2'
        : hasUp
        ? '8'
        : hasLeft
        ? '4'
        : hasRight
        ? '6'
        : '';
    if (!key) return;

    const isActive = idx === activeIdx;
    const until = n.frame - currentFrame;
    let prog: number;
    let scale: number;
    if (phase === 'waiting-first' && isActive) {
      const pulse = (Math.sin(now / 220) + 1) / 2;
      prog = 0.5 + pulse * 0.5;
      scale = 1.15 + pulse * 0.35;
    } else {
      const c = Math.max(0, Math.min(APPROACH_FRAMES, until));
      prog = 1 - c / APPROACH_FRAMES;
      scale = 1 + (1 - prog) * 1.5;
    }
    const gold = phase === 'playing' && until <= 9 && until >= -2;
    const attacks = n.buttons.filter((b) => !DIRECTION_IDS.has(b));
    const primary = attacks[attacks.length - 1] ?? n.buttons[n.buttons.length - 1];
    const color = BUTTON_META[primary]?.color ?? '#38bdf8';
    const alpha = isActive ? 1 : Math.min(0.9, prog * 2 + 0.2);
    dirEvents.push({ key, color, scale, gold, alpha, seq: idx + 1, isActive });
  });

  dirEvents.sort((a, b) => b.seq - a.seq);
  dirEvents.forEach((e) => {
    const c = compassMap.get(e.key);
    if (!c) return;
    const ring = e.gold ? '#facc15' : e.color;
    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.beginPath();
    ctx.arc(c.x, c.y, btnR * e.scale, 0, Math.PI * 2);
    ctx.strokeStyle = ring;
    ctx.lineWidth = e.gold ? 4.5 : 3.5;
    if (!lowPerfMode) {
      ctx.shadowColor = ring;
      ctx.shadowBlur = e.gold ? 18 : 10;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(c.x, c.y, btnR, 0, Math.PI * 2);
    ctx.fillStyle = e.gold ? 'rgba(250, 204, 21, 0.42)' : e.color + '55';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = e.isActive ? '#ffffff' : ring;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillText(c.arrow, c.x, c.y);
    ctx.restore();
  });

  // Overlay the exact original drawMotionSlider right on top when active/imminent note has a motion
  const activeNote = activeIdx < notes.length ? notes[activeIdx] : undefined;
  const activeHasDir = Boolean(activeNote?.buttons.some((b) => DIRECTION_IDS.has(b)));
  const motionIdx = activeNote?.motion
    ? activeIdx
    : !activeHasDir
    ? visible.find((idx) => idx > activeIdx && Boolean(notes[idx].motion))
    : undefined;

  if (motionIdx !== undefined) {
    const lNote = notes[motionIdx];
    const lUntil = lNote.frame - currentFrame;
    const lProg =
      phase === 'waiting-first' && motionIdx === activeIdx
        ? 0.5 + ((Math.sin(now / 220) + 1) / 2) * 0.5
        : 1 - Math.max(0, Math.min(APPROACH_FRAMES, lUntil)) / APPROACH_FRAMES;
    const lGold = phase === 'playing' && lUntil <= 9 && lUntil >= -2;
    const lAttacks = lNote.buttons.filter((b) => !DIRECTION_IDS.has(b));
    const lPrimary = lAttacks[lAttacks.length - 1] ?? lNote.buttons[lNote.buttons.length - 1];
    const lRingColor = lGold ? '#facc15' : (BUTTON_META[lPrimary]?.color ?? '#38bdf8');
    const lAlpha = motionIdx === activeIdx ? 1 : Math.min(0.9, lProg * 2 + 0.2);

    ctx.save();
    ctx.globalAlpha = lAlpha;
    drawMotionSlider(
      ctx,
      lNote.motion!,
      padX,
      padY + ringR * 0.15,
      ringR,
      lProg,
      lRingColor,
      motionIdx + 1,
      lowPerfMode,
      isRight
    );
    ctx.restore();
  }

  // Right-side fixed base attack buttons (ghosted when idle)
  (Object.keys(pos) as ActionButtonId[]).forEach((b) => {
    const p = pos[b]!;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.20)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.38)';
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.fillText(BUTTON_META[b]?.shortLabel ?? b, p.x, p.y);
  });

  // Follow-point dashed lines: active note -> next notes (on their primary attack positions)
  const anchor = (n: ComboNote): { x: number; y: number } | null => {
    const attacks = attackTargets(n);
    const key = attacks[attacks.length - 1];
    const p = key ? pos[key] : undefined;
    return p ? { x: p.x, y: p.y } : null;
  };
  if (visible.length > 1) {
    ctx.save();
    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 3;
    for (let k = 0; k < visible.length - 1; k++) {
      const a = anchor(notes[visible[k]]);
      const b = anchor(notes[visible[k + 1]]);
      if (!a || !b || (a.x === b.x && a.y === b.y)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      ctx.beginPath();
      ctx.moveTo(a.x + ux * (R + 4), a.y + uy * (R + 4));
      ctx.lineTo(b.x - ux * (R + 4), b.y - uy * (R + 4));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Right-side lit attack notes (draw later notes first so earlier ones stay on top)
  const entries = Array.from(lit.entries());
  const all: { b: ActionButtonId; e: (typeof entries)[number][1][number] }[] = [];
  entries.forEach(([b, arr]) => arr.forEach((e) => all.push({ b, e })));
  all.sort((a, b) => b.e.seq - a.e.seq);
  all.forEach(({ b, e }) => {
    const p = pos[b]!;
    const ring = e.gold ? '#facc15' : e.color;
    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * e.scale, 0, Math.PI * 2);
    ctx.strokeStyle = ring;
    ctx.lineWidth = e.gold ? 5 : 3.5;
    if (!lowPerfMode) {
      ctx.shadowColor = ring;
      ctx.shadowBlur = e.gold ? 20 : 10;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = e.gold ? 'rgba(250, 204, 21, 0.4)' : e.color + '55';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = e.isActive ? '#ffffff' : ring;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.fillText(BUTTON_META[b]?.shortLabel ?? b, p.x, p.y);
    // sequence number badge
    const bx = p.x - p.r * 0.72;
    const by = p.y - p.r * 0.72;
    ctx.beginPath();
    ctx.arc(bx, by, 12, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.fillStyle = '#090d16';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillText(String(e.seq), bx, by);
    ctx.restore();
  });

  // Move name + motion/notation badge for the active note
  if (activeIdx < notes.length) {
    const n = notes[activeIdx];
    const arrows: Record<string, string> = isRight
      ? { '236': '↓↙← 236', '214': '↓↘→ 214', '623': '←↓↙ 623', '6214': '←↓→ 6214', '22': '↓↓ 22', '66': '←← 66' }
      : { '236': '↓↘→ 236', '214': '↓↙← 214', '623': '→↓↘ 623', '6214': '→↓← 6214', '22': '↓↓ 22', '66': '→→ 66' };
    const text = n.motion ? (arrows[n.motion] ?? n.motion) : '';
    const label = `${activeIdx + 1}. ${n.notation}${text ? '  ' + text : ''}`;
    ctx.font = '800 16px system-ui, sans-serif';
    const tw = ctx.measureText(label).width + 28;
    const by = padY + gap + R + 52;
    ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
    ctx.beginPath();
    ctx.roundRect(padX - tw / 2, by - 14, tw, 28, 14);
    ctx.fill();
    ctx.strokeStyle = n.motion ? '#facc15' : 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, padX, by);

    ctx.font = '700 14px system-ui, sans-serif';
    const mw = ctx.measureText(n.moveName).width + 26;
    const my = gy + gapY + R + 46;
    ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
    ctx.beginPath();
    ctx.roundRect(gx + gapX * 1.5 - mw / 2, my - 13, mw, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(n.moveName, gx + gapX * 1.5, my);
  }
  ctx.restore();
}
/**
 * Draws an osu!-style motion slider (236 QCF, 214 QCB, 623 DP) on the LEFT half of the screen.
 */
function drawMotionSlider(
  ctx: CanvasRenderingContext2D,
  motion: MotionType,
  centerX: number,
  centerY: number,
  radius: number,
  progress: number, // 0..1 (1 = hit time)
  color: string,
  seqNum: number,
  lowPerfMode: boolean,
  mirrored = false
) {
  ctx.save();

  // Realistic SF6 motion speed: glide briskly over the last ~11.5 frames (32% of 36f approach)
  const slideT = Math.max(0, Math.min(1, (progress - 0.68) / 0.32));

  if (motion === '236' || motion === '214') {
    const isRight = mirrored ? motion === '214' : motion === '236';
    // Arc centered at (centerX, centerY - radius * 0.2):
    // 236: starts at Bottom (PI/2) -> curves counter-clockwise to Right (0)
    // 214: starts at Bottom (PI/2) -> curves clockwise to Left (PI)
    const arcCx = centerX;
    const arcCy = centerY - radius * 0.15;
    const startAngle = Math.PI / 2;
    const endAngle = isRight ? 0 : Math.PI;
    const anticlockwise = isRight;

    const startX = arcCx + Math.cos(startAngle) * radius;
    const startY = arcCy + Math.sin(startAngle) * radius;
    const endX = arcCx + Math.cos(endAngle) * radius;
    const endY = arcCy + Math.sin(endAngle) * radius;

    // 1. Outer white border of osu! slider track
    ctx.beginPath();
    ctx.arc(arcCx, arcCy, radius, startAngle, endAngle, anticlockwise);
    ctx.lineCap = 'round';
    ctx.lineWidth = 54;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();

    // 2. Inner dark track body
    ctx.beginPath();
    ctx.arc(arcCx, arcCy, radius, startAngle, endAngle, anticlockwise);
    ctx.lineCap = 'round';
    ctx.lineWidth = 46;
    ctx.strokeStyle = 'rgba(10, 14, 24, 0.85)';
    ctx.stroke();

    // 3. Colored inner glow track
    ctx.beginPath();
    ctx.arc(arcCx, arcCy, radius, startAngle, endAngle, anticlockwise);
    ctx.lineCap = 'round';
    ctx.lineWidth = 38;
    ctx.strokeStyle = color + '33';
    ctx.stroke();

    // 4. Shrinking Approach Circle at start point (↓) before slide begins
    if (progress < 0.6) {
      const appScale = 1 + (1 - progress / 0.6) * 1.4;
      ctx.beginPath();
      ctx.arc(startX, startY, 26 * appScale, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      if (!lowPerfMode) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 5. Start label (↓) and End label (→ or ←)
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↓', startX, startY);
    ctx.fillText(isRight ? '→' : '←', endX, endY);

    // 6. Gliding Osu! Slider Ball along the quarter-circle arc
    const ballAngle = isRight
      ? startAngle - slideT * (Math.PI / 2)
      : startAngle + slideT * (Math.PI / 2);
    const ballX = arcCx + Math.cos(ballAngle) * radius;
    const ballY = arcCy + Math.sin(ballAngle) * radius;

    ctx.beginPath();
    ctx.arc(ballX, ballY, 22, 0, Math.PI * 2);
    ctx.fillStyle = color;
    if (!lowPerfMode) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Sequence number inside slider ball
    ctx.fillStyle = '#090d16';
    ctx.font = '900 14px system-ui, sans-serif';
    ctx.fillText(String(seqNum), ballX, ballY);

    // Motion text badge
    ctx.fillStyle = 'rgba(10, 14, 24, 0.8)';
    ctx.beginPath();
    ctx.roundRect(arcCx - 58, arcCy + radius + 34, 116, 24, 12);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText(isRight ? '236 往右四分之一圈' : '214 往左四分之一圈', arcCx, arcCy + radius + 46);
  } else if (motion === '623') {
    // Z-shaped DP slider: Right (6) -> Down (2) -> Down-Right (3) (mirrored on 2P side)
    const sign = mirrored ? -1 : 1;
    const p1 = { x: centerX + sign * radius * 0.6, y: centerY - radius * 0.4 };
    const p2 = { x: centerX - sign * radius * 0.2, y: centerY + radius * 0.45 };
    const p3 = { x: centerX + sign * radius * 0.65, y: centerY + radius * 0.45 };

    // Track border
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 48;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();

    // Track body
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineWidth = 40;
    ctx.strokeStyle = 'rgba(10, 14, 24, 0.85)';
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mirrored ? '←' : '→', p1.x, p1.y);
    ctx.fillText('↓', p2.x, p2.y);
    ctx.fillText(mirrored ? '↙' : '↘', p3.x, p3.y);

    // Slider ball interpolation across 2 segments
    let bx = p1.x;
    let by = p1.y;
    if (slideT < 0.5) {
      const t = slideT * 2;
      bx = p1.x + (p2.x - p1.x) * t;
      by = p1.y + (p2.y - p1.y) * t;
    } else {
      const t = (slideT - 0.5) * 2;
      bx = p2.x + (p3.x - p2.x) * t;
      by = p2.y + (p3.y - p2.y) * t;
    }

    ctx.beginPath();
    ctx.arc(bx, by, 20, 0, Math.PI * 2);
    ctx.fillStyle = color;
    if (!lowPerfMode) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#090d16';
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.fillText(String(seqNum), bx, by);
  } else if (motion === '22') {
    // Double-Down (22): Top ↓ stacked over Bottom ↓
    const topY = centerY - 46;
    const botY = centerY + 46;

    // Vertical connector track
    ctx.beginPath();
    ctx.moveTo(centerX, topY);
    ctx.lineTo(centerX, botY);
    ctx.lineCap = 'round';
    ctx.lineWidth = 44;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX, topY);
    ctx.lineTo(centerX, botY);
    ctx.lineWidth = 36;
    ctx.strokeStyle = 'rgba(10, 14, 24, 0.9)';
    ctx.stroke();

    // Shrinking approach circle on top ↓
    if (progress < 0.65) {
      const appScale = 1 + (1 - progress / 0.65) * 1.4;
      ctx.beginPath();
      ctx.arc(centerX, topY, 26 * appScale, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      if (!lowPerfMode) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Two stacked ↓ circles
    [topY, botY].forEach((cy) => {
      ctx.beginPath();
      ctx.arc(centerX, cy, 24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 14, 24, 0.92)';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↓', centerX, cy);
    });

    // Gliding ball from top ↓ to bottom ↓
    const by = topY + (botY - topY) * slideT;
    ctx.beginPath();
    ctx.arc(centerX, by, 14, 0, Math.PI * 2);
    ctx.fillStyle = color;
    if (!lowPerfMode) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#090d16';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillText(String(seqNum), centerX, by);

    // Motion text badge
    ctx.fillStyle = 'rgba(10, 14, 24, 0.8)';
    ctx.beginPath();
    ctx.roundRect(centerX - 54, botY + 34, 108, 24, 12);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText('22 連按兩次下', centerX, botY + 46);
  } else if (motion === '66') {
    // Forward Dash (66): Left → followed by Right → (mirrored to ← ← on 2P side)
    const startX = mirrored ? centerX + 48 : centerX - 48;
    const endX = mirrored ? centerX - 48 : centerX + 48;
    const leftX = startX;
    const rightX = endX;

    ctx.beginPath();
    ctx.moveTo(leftX, centerY);
    ctx.lineTo(rightX, centerY);
    ctx.lineCap = 'round';
    ctx.lineWidth = 44;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(leftX, centerY);
    ctx.lineTo(rightX, centerY);
    ctx.lineWidth = 36;
    ctx.strokeStyle = 'rgba(10, 14, 24, 0.9)';
    ctx.stroke();

    if (progress < 0.65) {
      const appScale = 1 + (1 - progress / 0.65) * 1.4;
      ctx.beginPath();
      ctx.arc(leftX, centerY, 26 * appScale, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      if (!lowPerfMode) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    [leftX, rightX].forEach((cx) => {
      ctx.beginPath();
      ctx.arc(cx, centerY, 24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 14, 24, 0.92)';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(mirrored ? '←' : '→', cx, centerY);
    });

    const bx = leftX + (rightX - leftX) * slideT;
    ctx.beginPath();
    ctx.arc(bx, centerY, 14, 0, Math.PI * 2);
    ctx.fillStyle = color;
    if (!lowPerfMode) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#090d16';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillText(String(seqNum), bx, centerY);

    ctx.fillStyle = 'rgba(10, 14, 24, 0.8)';
    ctx.beginPath();
    ctx.roundRect(centerX - 46, centerY + 38, 92, 24, 12);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText('66 前衝', centerX, centerY + 50);
  } else if (motion === '6214') {
    // Half-circle back (6214): Right (0) -> Down (PI/2) -> Left (PI) clockwise
    const arcCx = centerX;
    const arcCy = centerY - radius * 0.25;
    const startAngle = 0;
    const endAngle = Math.PI;

    const rightX = arcCx + radius;
    const rightY = arcCy;
    const downX = arcCx;
    const downY = arcCy + radius;
    const leftX = arcCx - radius;
    const leftY = arcCy;

    ctx.beginPath();
    ctx.arc(arcCx, arcCy, radius, startAngle, endAngle, false);
    ctx.lineCap = 'round';
    ctx.lineWidth = 52;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(arcCx, arcCy, radius, startAngle, endAngle, false);
    ctx.lineWidth = 44;
    ctx.strokeStyle = 'rgba(10, 14, 24, 0.85)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(arcCx, arcCy, radius, startAngle, endAngle, false);
    ctx.lineWidth = 36;
    ctx.strokeStyle = color + '33';
    ctx.stroke();

    if (progress < 0.6) {
      const appScale = 1 + (1 - progress / 0.6) * 1.4;
      ctx.beginPath();
      ctx.arc(rightX, rightY, 24 * appScale, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      if (!lowPerfMode) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('→', rightX, rightY);
    ctx.fillText('↓', downX, downY);
    ctx.fillText('←', leftX, leftY);

    const ballAngle = startAngle + slideT * Math.PI;
    const ballX = arcCx + Math.cos(ballAngle) * radius;
    const ballY = arcCy + Math.sin(ballAngle) * radius;

    ctx.beginPath();
    ctx.arc(ballX, ballY, 20, 0, Math.PI * 2);
    ctx.fillStyle = color;
    if (!lowPerfMode) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#090d16';
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.fillText(String(seqNum), ballX, ballY);

    ctx.fillStyle = 'rgba(10, 14, 24, 0.8)';
    ctx.beginPath();
    ctx.roundRect(arcCx - 58, arcCy + radius + 34, 116, 24, 12);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText('6214 半圈往左', arcCx, arcCy + radius + 46);
  } else if (motion === '46' || motion === '28') {
    const isHoriz = motion === '46';
    const x1 = isHoriz ? centerX - 54 : centerX;
    const y1 = isHoriz ? centerY : centerY + 46;
    const x2 = isHoriz ? centerX + 54 : centerX;
    const y2 = isHoriz ? centerY : centerY - 46;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineCap = 'round';
    ctx.lineWidth = 44;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 36;
    ctx.strokeStyle = 'rgba(10, 14, 24, 0.9)';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isHoriz ? '←' : '↓', x1, y1);
    ctx.fillText(isHoriz ? '→' : '↑', x2, y2);

    // Authentic SF6 charge snap: hold at ↓ / ← during charge, then SNAP to ↑ / → in the final ~5f!
    const snapT = progress < 0.85 ? 0 : Math.min(1, (progress - 0.85) / 0.15);
    const bx = x1 + (x2 - x1) * snapT;
    const by = y1 + (y2 - y1) * snapT;
    ctx.beginPath();
    ctx.arc(bx, by, 16, 0, Math.PI * 2);
    ctx.fillStyle = color;
    if (!lowPerfMode) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#090d16';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillText(String(seqNum), bx, by);

    ctx.fillStyle = 'rgba(10, 14, 24, 0.8)';
    ctx.beginPath();
    ctx.roundRect(centerX - 56, (isHoriz ? centerY + 38 : y1 + 34), 112, 24, 12);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText(isHoriz ? '[4]6 集氣前' : '[2]8 集氣上', centerX, (isHoriz ? centerY + 50 : y1 + 46));
  } else if (motion === '4646') {
    const x1 = centerX - 60;
    const x2 = centerX + 60;
    const y = centerY;

    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.lineCap = 'round';
    ctx.lineWidth = 44;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.lineWidth = 36;
    ctx.strokeStyle = 'rgba(10, 14, 24, 0.9)';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('←', x1, y);
    ctx.fillText('→', x2, y);

    // Authentic SF6 [4]646 timing: hold ← (charge), then sweep → (0.50..0.67), ← (0.67..0.83), → (0.83..1.00)
    let pos = 0;
    if (progress < 0.5) {
      pos = 0;
    } else if (progress < 0.67) {
      pos = (progress - 0.5) / 0.17;
    } else if (progress < 0.83) {
      pos = 1 - (progress - 0.67) / 0.16;
    } else {
      pos = Math.min(1, (progress - 0.83) / 0.17);
    }
    const bx = x1 + (x2 - x1) * pos;
    ctx.beginPath();
    ctx.arc(bx, y, 16, 0, Math.PI * 2);
    ctx.fillStyle = color;
    if (!lowPerfMode) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#090d16';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillText(String(seqNum), bx, y);

    ctx.fillStyle = 'rgba(10, 14, 24, 0.8)';
    ctx.beginPath();
    ctx.roundRect(centerX - 66, centerY + 38, 132, 24, 12);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText('[4]646 左右左右', centerX, centerY + 50);
  }

  ctx.restore();
}

function computeNumpadDir(active: Set<ActionButtonId>): string {
  const up = active.has('UP');
  const down = active.has('DOWN');
  const left = active.has('LEFT');
  const right = active.has('RIGHT');
  const v = up && !down ? 1 : down && !up ? -1 : 0;
  const h = right && !left ? 1 : left && !right ? -1 : 0;
  if (v === -1 && h === -1) return '1';
  if (v === -1 && h === 0) return '2';
  if (v === -1 && h === 1) return '3';
  if (v === 0 && h === -1) return '4';
  if (v === 0 && h === 1) return '6';
  if (v === 1 && h === -1) return '7';
  if (v === 1 && h === 0) return '8';
  if (v === 1 && h === 1) return '9';
  return '5';
}

function diagnoseExecution(
  note: ComboNote,
  activeSet: Set<ActionButtonId>,
  dirHistory: { dir: string; t: number }[],
  now: number,
  chargeMs: { back: number; down: number },
  lang: AppLang
): string | undefined {
  const t = I18N[lang];
  const windowMs =
    note.motion === '360' || note.motion === '720' || note.motion === '4646' ? 680 : 420;
  const cutoff = now - windowMs;
  const inWindow = dirHistory.filter((d) => d.t >= cutoff);
  // Include the direction state that was ALREADY being held when entering the window
  // (e.g., holding 2 during 2MP/2MK and rolling directly 3 -> 6 for 236P!)
  let carryIn: { dir: string; t: number } | undefined;
  for (let i = dirHistory.length - 1; i >= 0; i--) {
    if (dirHistory[i].t < cutoff) {
      carryIn = dirHistory[i];
      break;
    }
  }
  const recent = carryIn && carryIn.dir !== '5' ? [carryIn, ...inWindow] : inWindow;
  const rawSeq = recent.map((d) => d.dir).join('');
  const nonNeutral = recent.filter((d) => d.dir !== '5').map((d) => d.dir);
  let cleanSeq = '';
  for (const d of nonNeutral) {
    if (!cleanSeq.endsWith(d)) cleanSeq += d;
  }

  // 0. Drive Rush (PARRY) direction check: in SF6, holding Down or Back prevents DR cancel!
  const isDriveRushNote =
    note.buttons.includes('PARRY') ||
    note.windowType === 'dr-cancel' ||
    /^(DR|DRC|綠衝)/i.test(note.notation);
  if (isDriveRushNote) {
    const holdingDown = activeSet.has('DOWN');
    const holdingBack = activeSet.has('LEFT');
    if (holdingDown && holdingBack) return t.diagDrDownBack;
    if (holdingDown) return t.diagDrDown;
    if (holdingBack) return t.diagDrBack;
  }

  // 1. Motion command diagnostics
  if (note.motion) {
    const m = note.motion;
    if (m === '236') {
      const ok = /2.*3.*6/.test(cleanSeq) || /2.*6/.test(cleanSeq);
      if (!ok) {
        if (/2.*3/.test(cleanSeq)) return t.diag236Only23;
        if (cleanSeq.includes('2')) return t.diag236Only2;
        if (cleanSeq.includes('6')) return t.diag236No2;
        return t.diag236None;
      }
    } else if (m === '214') {
      const ok = /2.*1.*4/.test(cleanSeq) || /2.*4/.test(cleanSeq);
      if (!ok) {
        if (/2.*1/.test(cleanSeq)) return t.diag214Only21;
        if (cleanSeq.includes('2')) return t.diag214Only2;
        if (cleanSeq.includes('4')) return t.diag214No2;
        return t.diag214None;
      }
    } else if (m === '623') {
      const ok =
        /6.*2.*3/.test(cleanSeq) ||
        /6.*3/.test(cleanSeq) ||
        /3.*2.*3/.test(cleanSeq) ||
        /6.*2.*6/.test(cleanSeq) ||
        /3.*5.*3/.test(rawSeq);
      if (!ok) {
        if (/6.*2/.test(cleanSeq)) return t.diag623No3;
        if (/2.*3/.test(cleanSeq)) return t.diag623No6;
        return t.diag623Inc;
      }
    } else if (m === '6214') {
      const ok = /6.*2.*4/.test(cleanSeq) || /6.*1.*4/.test(cleanSeq) || /3.*2.*4/.test(cleanSeq);
      if (!ok) {
        if (/6.*2/.test(cleanSeq) || /3.*2/.test(cleanSeq)) return t.diag6214No4;
        return t.diag6214Inc;
      }
    } else if (m === '22') {
      const ok = /2.*5.*2/.test(rawSeq) || (rawSeq.match(/2/g)?.length ?? 0) >= 2;
      if (!ok) return t.diag22Inc;
    } else if (m === '66') {
      const ok = /6.*5.*6/.test(rawSeq) || (rawSeq.match(/6/g)?.length ?? 0) >= 2;
      if (!ok) return t.diag66Inc;
    } else if (m === '44') {
      const ok = /4.*5.*4/.test(rawSeq) || (rawSeq.match(/4/g)?.length ?? 0) >= 2;
      if (!ok) return t.diag44Inc;
    } else if (m === '46') {
      if (!cleanSeq.includes('6') && !cleanSeq.includes('3') && !cleanSeq.includes('9')) {
        return t.diag46No6;
      }
      if (chargeMs.back < 580) {
        const frames = Math.round(chargeMs.back / FRAME_MS);
        return `${t.diag46Charge} (~${frames}f)`;
      }
    } else if (m === '28') {
      if (!cleanSeq.includes('8') && !cleanSeq.includes('7') && !cleanSeq.includes('9')) {
        return t.diag28No8;
      }
      if (chargeMs.down < 580) {
        const frames = Math.round(chargeMs.down / FRAME_MS);
        return `${t.diag28Charge} (~${frames}f)`;
      }
    } else if (m === '4646') {
      if (chargeMs.back < 580) return t.diag4646Charge;
      if (!/4.*6.*4.*6/.test(cleanSeq)) return t.diag4646Inc;
    } else if (m === '360' || m === '720') {
      const cardinals = ['4', '2', '6', '8'].filter((c) => cleanSeq.includes(c));
      if (cardinals.length < 3) return `${m} ${t.diagSpinInc}`;
    }
  } else {
    // 2. Directional normal check (e.g. 2MK, 4HP, 6MP)
    const reqDirs = note.buttons.filter((b) => DIRECTION_IDS.has(b));
    if (reqDirs.length > 0) {
      const missingDir = reqDirs.find((d) => !activeSet.has(d));
      if (missingDir) {
        const dirLabelMap: Record<string, string> = {
          DOWN: '↓ (2)',
          LEFT: '← (4)',
          RIGHT: '→ (6)',
          UP: '↑ (8)',
        };
        const dLabel = dirLabelMap[missingDir] ?? missingDir;
        return `${t.diagMissingDir} ${dLabel}`;
      }
    }
  }

  // 3. Modern AUTO modifier check
  if (note.buttons.includes('AUTO') && !activeSet.has('AUTO')) {
    return t.diagMissingAuto;
  }

  return undefined;
}

export const OverlayView: React.FC<OverlayViewProps> = ({
  mode,
  combo,
  bindings,
  lang,
  triggerMode,
  playerSide,
  showRecordedInputs,
  lowPerfMode,
  chartLayout = 'focused',
  sfxEnabled = true,
  dynamicResync = false,
  isClickThrough,
  onExitOverlay,
}) => {
  const t = I18N[lang];
  const isRightSide = playerSide === 'right';
  const hasRecordedBar = Boolean(showRecordedInputs && combo.inputHistory && combo.inputHistory.length > 0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const phaseRef = useRef<'waiting-first' | 'countdown' | 'playing' | 'finished'>(
    triggerMode === 'trigger-first' ? 'waiting-first' : 'countdown'
  );
  const startTimeRef = useRef<number>(performance.now());
  const nextNoteIndexRef = useRef<number>(0);
  const judgedNotesRef = useRef<Set<string>>(new Set());
  const cuedNotesRef = useRef<Set<string>>(new Set());
  const hitEffectsRef = useRef<HitResult[]>([]);
  const activeHoldRef = useRef<{
    noteId: string;
    primaryBtn: ActionButtonId;
    pressTime: number;
    targetHoldFrames: number;
    x: number;
    y: number;
  } | null>(null);

  const [stats, setStats] = useState({
    perfect: 0,
    good: 0,
    early: 0,
    late: 0,
    miss: 0,
    streak: 0,
  });

  const [runLog, setRunLog] = useState<
    {
      noteId: string;
      step: number;
      notation: string;
      rank: HitResult['rank'];
      deltaFrames: number;
      diagHint?: string;
    }[]
  >([]);
  const [showReview, setShowReview] = useState(false);

  const dirHistoryRef = useRef<{ dir: string; t: number }[]>([]);
  const chargeRef = useRef<{
    backStart: number | null;
    lastBackMs: number;
    lastBackEnd: number;
    downStart: number | null;
    lastDownMs: number;
    lastDownEnd: number;
  }>({
    backStart: null,
    lastBackMs: 0,
    lastBackEnd: 0,
    downStart: null,
    lastDownMs: 0,
    lastDownEnd: 0,
  });

  const updateDirectionTracking = useCallback((activeSet: Set<ActionButtonId>) => {
    const now = performance.now();
    const dir = computeNumpadDir(activeSet);
    const hist = dirHistoryRef.current;
    if (hist.length === 0 || hist[hist.length - 1].dir !== dir) {
      hist.push({ dir, t: now });
      if (hist.length > 48) {
        dirHistoryRef.current = hist.slice(-36);
      }
    }

    const ch = chargeRef.current;
    const holdingBack = activeSet.has('LEFT');
    const holdingDown = activeSet.has('DOWN');

    if (holdingBack) {
      if (ch.backStart === null) ch.backStart = now;
    } else if (ch.backStart !== null) {
      const dur = now - ch.backStart;
      // Preserve valid >= 580ms charge within 450ms window (for 4646 double tap)
      if (dur >= 580 || now - ch.lastBackEnd > 450) {
        ch.lastBackMs = dur;
        ch.lastBackEnd = now;
      }
      ch.backStart = null;
    }

    if (holdingDown) {
      if (ch.downStart === null) ch.downStart = now;
    } else if (ch.downStart !== null) {
      const dur = now - ch.downStart;
      if (dur >= 580 || now - ch.lastDownEnd > 450) {
        ch.lastDownMs = dur;
        ch.lastDownEnd = now;
      }
      ch.downStart = null;
    }
  }, []);

  const getCurrentChargeMs = useCallback((now: number) => {
    const ch = chargeRef.current;
    const activeBack = ch.backStart !== null ? now - ch.backStart : 0;
    const recentBack = now - ch.lastBackEnd <= 450 ? ch.lastBackMs : 0;
    const activeDown = ch.downStart !== null ? now - ch.downStart : 0;
    const recentDown = now - ch.lastDownEnd <= 450 ? ch.lastDownMs : 0;
    return {
      back: Math.max(activeBack, recentBack),
      down: Math.max(activeDown, recentDown),
    };
  }, []);

  const resetRun = useCallback((clearReviewLog = true) => {
    phaseRef.current = triggerMode === 'trigger-first' ? 'waiting-first' : 'countdown';
    startTimeRef.current = performance.now();
    nextNoteIndexRef.current = 0;
    judgedNotesRef.current = new Set();
    cuedNotesRef.current = new Set();
    hitEffectsRef.current = [];
    activeHoldRef.current = null;
    dirHistoryRef.current = [];
    if (clearReviewLog) {
      setRunLog([]);
    }
  }, [triggerMode]);

  useEffect(() => {
    const unsub = window.electronAPI?.onHotkey((action) => {
      if (action === 'RESTART_COMBO') {
        resetRun();
      } else if (action === 'TOGGLE_REVIEW') {
        setShowReview((v) => !v);
      }
    });
    return () => unsub?.();
  }, [resetRun]);

  const recordHit = useCallback((result: HitResult, diagHint?: string) => {
    hitEffectsRef.current.push(result);
    const noteIdx = combo.notes.findIndex((n) => n.id === result.noteId);
    if (noteIdx !== -1) {
      const notation = combo.notes[noteIdx].notation;
      setRunLog((prev) => [
        ...prev.filter((item) => item.noteId !== result.noteId),
        {
          noteId: result.noteId,
          step: noteIdx + 1,
          notation,
          rank: result.rank,
          deltaFrames: result.deltaFrames,
          diagHint,
        },
      ]);
    }
    setStats((prev) => {
      if (result.rank === 'PERFECT') {
        return { ...prev, perfect: prev.perfect + 1, streak: prev.streak + 1 };
      }
      if (result.rank === 'GOOD') {
        return { ...prev, good: prev.good + 1, streak: prev.streak + 1 };
      }
      if (result.rank === 'EARLY') {
        return { ...prev, early: prev.early + 1, streak: prev.streak + 1 };
      }
      if (result.rank === 'LATE') {
        return { ...prev, late: prev.late + 1, streak: prev.streak + 1 };
      }
      return { ...prev, miss: prev.miss + 1, streak: 0 };
    });
  }, [combo.notes, sfxEnabled]);

  const handleActionPress = useCallback(
    (rawPressedBtn: ActionButtonId, rawActiveSet: Set<ActionButtonId>) => {
      const pressedBtn = mirrorBtn(rawPressedBtn, isRightSide);
      const activeSet = mirrorSet(rawActiveSet, isRightSide);
      if (DIRECTION_IDS.has(pressedBtn)) {
        updateDirectionTracking(activeSet);
      }
      if (pressedBtn === 'RESET') {
        resetRun();
        return;
      }
      const notes = combo.notes;
      const idx = nextNoteIndexRef.current;
      if (idx >= notes.length) return;

      const targetNote = notes[idx];
      const primaryBtn = targetNote.buttons[targetNote.buttons.length - 1];
      const isModernSaNote = mode === 'modern' && /^SA[123]/.test(targetNote.notation);
      const isModernSaShortcutPress =
        isModernSaNote &&
        (pressedBtn === 'SP' || pressedBtn === 'H') &&
        (activeSet.has('SP') || activeSet.has('H'));
      if (pressedBtn !== primaryBtn && !isModernSaShortcutPress) return;

      if (phaseRef.current === 'waiting-first' && idx === 0) {
        const now = performance.now();
        phaseRef.current = 'playing';
        startTimeRef.current = now;
        judgedNotesRef.current.add(targetNote.id);
        cuedNotesRef.current.add(targetNote.id);
        if (sfxEnabled) playBeatCue();
        nextNoteIndexRef.current = 1;
        const diagHint = diagnoseExecution(
          targetNote,
          activeSet,
          dirHistoryRef.current,
          now,
          getCurrentChargeMs(now),
          lang
        );
        recordHit(
          {
            noteId: targetNote.id,
            rank: 'PERFECT',
            deltaFrames: 0,
            timestamp: now,
            x: targetNote.x,
            y: targetNote.y,
          },
          diagHint
        );
        return;
      }

      if (phaseRef.current !== 'playing') return;

      const elapsedFrames = (performance.now() - startTimeRef.current) / FRAME_MS;
      const deltaFrames = elapsedFrames - targetNote.frame;
      const win = getNoteWindows(targetNote.windowType, targetNote.buttons);

      if (deltaFrames >= -win.maxMiss && deltaFrames <= win.maxMiss) {
        let rank: JudgmentRank = 'PERFECT';
        if (deltaFrames >= -win.earlyPerfect && deltaFrames <= win.latePerfect) {
          rank = 'PERFECT';
        } else if (deltaFrames >= -win.earlyGood && deltaFrames <= win.lateGood) {
          rank = 'GOOD';
        } else {
          rank = deltaFrames < 0 ? 'EARLY' : 'LATE';
        }

        const allHeld = targetNote.buttons.every((b) => activeSet.has(b));
        if (!allHeld && rank === 'PERFECT') {
          rank = 'GOOD';
        }

        // SF6-authentic Dynamic Re-sync:
        // - Pressing EARLY (deltaFrames < 0) or pressing inside a `link` (目押) 4f input buffer
        //   still executes on the EXACT same game frame in SF6, so we must NOT shift the clock!
        // - Only shift forward when pressing LATE (deltaFrames > 0) on a `cancel` / `dr-cancel` / `juggle`
        //   where delaying the button genuinely delays the move's startup & hitstop in SF6.
        const isAutoCancel =
          targetNote.buttons.includes('PARRY') ||
          /^(SA[123]|236236|214214|4646|2828)/.test(targetNote.notation);
        const effectiveType =
          targetNote.windowType ?? (targetNote.buttons.includes('PARRY') ? 'dr-cancel' : isAutoCancel ? 'cancel' : 'link');
        // Only active when the user enables "Adaptive Tempo"; otherwise keep the recorded rhythm intact.
        if (dynamicResync && deltaFrames > 0 && effectiveType !== 'link') {
          startTimeRef.current += deltaFrames * FRAME_MS;
        }

        judgedNotesRef.current.add(targetNote.id);
        nextNoteIndexRef.current = idx + 1;
        if (targetNote.holdFrames && targetNote.holdFrames >= 10) {
          // Anchor charge start to the player's ACTUAL press time so that even if the initial
          // press was slightly early/late (GOOD), the release PERFECT sweet spot shifts with it!
          activeHoldRef.current = {
            noteId: targetNote.id,
            primaryBtn,
            pressTime: performance.now(),
            targetHoldFrames: targetNote.holdFrames,
            x: targetNote.x,
            y: targetNote.y,
          };
        }
        const hitNow = performance.now();
        const diagHint = diagnoseExecution(
          targetNote,
          activeSet,
          dirHistoryRef.current,
          hitNow,
          getCurrentChargeMs(hitNow),
          lang
        );
        recordHit(
          {
            noteId: targetNote.id,
            rank,
            deltaFrames: Math.round(deltaFrames * 10) / 10,
            timestamp: hitNow,
            x: targetNote.x,
            y: targetNote.y,
          },
          diagHint
        );
      }
    },
    [combo.notes, dynamicResync, getCurrentChargeMs, isRightSide, lang, mode, recordHit, resetRun, updateDirectionTracking]
  );

  const handleActionRelease = useCallback(
    (rawReleasedBtn: ActionButtonId, rawActiveSet: Set<ActionButtonId>) => {
      const releasedBtn = mirrorBtn(rawReleasedBtn, isRightSide);
      const activeSet = mirrorSet(rawActiveSet, isRightSide);
      if (DIRECTION_IDS.has(releasedBtn)) {
        updateDirectionTracking(activeSet);
      }
      const hold = activeHoldRef.current;
      if (!hold || hold.primaryBtn !== releasedBtn) return;
      activeHoldRef.current = null;

      const actualHoldFrames = (performance.now() - hold.pressTime) / FRAME_MS;
      const releaseDelta = actualHoldFrames - hold.targetHoldFrames;
      let rank: JudgmentRank = 'PERFECT';
      if (Math.abs(releaseDelta) <= 0.35) {
        rank = 'PERFECT';
      } else if (Math.abs(releaseDelta) <= 4.5) {
        rank = 'GOOD';
      } else {
        rank = releaseDelta < 0 ? 'EARLY' : 'LATE';
      }

      recordHit({
        noteId: `${hold.noteId}-rel`,
        rank,
        deltaFrames: Math.round(releaseDelta * 10) / 10,
        timestamp: performance.now(),
        x: hold.x,
        y: hold.y - 0.08,
      });
    },
    [isRightSide, recordHit, updateDirectionTracking]
  );

  const { activeButtons, activeButtonsRef } = useInputEngine({
    mode,
    bindings,
    syncReactState: !lowPerfMode,
    onActionPress: handleActionPress,
    onActionRelease: handleActionRelease,
  });

  // Main 60fps Split-Screen Osu! Render Loop (Left = Directions/Motions, Right = Attacks)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = lowPerfMode ? 1 : (window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let rafId = 0;

    const render = () => {
      const now = performance.now();
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const notes = combo.notes;
      let currentFrame = 0;

      if (phaseRef.current === 'countdown') {
        const countdownElapsed = now - startTimeRef.current;
        const countdownDuration = 1800;
        if (countdownElapsed >= countdownDuration) {
          phaseRef.current = 'playing';
          startTimeRef.current = now;
          currentFrame = 0;
        } else {
          currentFrame = (countdownElapsed - countdownDuration) / FRAME_MS;
        }
      } else if (phaseRef.current === 'playing') {
        currentFrame = (now - startTimeRef.current) / FRAME_MS;

        // Play crisp beat cue sound at each note's exact target frame + 1f visual sync offset
        const AUDIO_SYNC_OFFSET_FRAMES = 1.0;
        if (sfxEnabled) {
          for (let i = 0; i < notes.length; i++) {
            const n = notes[i];
            if (currentFrame >= n.frame + AUDIO_SYNC_OFFSET_FRAMES && !cuedNotesRef.current.has(n.id)) {
              cuedNotesRef.current.add(n.id);
              playBeatCue();
            }
          }
        }

        while (nextNoteIndexRef.current < notes.length) {
          const n = notes[nextNoteIndexRef.current];
          const win = getNoteWindows(n.windowType, n.buttons);
          if (currentFrame - n.frame > win.maxMiss) {
            judgedNotesRef.current.add(n.id);
            nextNoteIndexRef.current += 1;
            const missDiag = diagnoseExecution(
              n,
              mirrorSet(activeButtonsRef.current, isRightSide),
              dirHistoryRef.current,
              now,
              getCurrentChargeMs(now),
              lang
            );
            recordHit(
              {
                noteId: n.id,
                rank: 'MISS',
                deltaFrames: win.maxMiss,
                timestamp: now,
                x: n.x,
                y: n.y,
              },
              missDiag
            );
          } else {
            break;
          }
        }

        const lastNoteFrame = notes[notes.length - 1]?.frame ?? 0;
        if (currentFrame > lastNoteFrame + 150) {
          resetRun(false);
        }
      }

      // Centered Layout: Current Active Note in the middle, Motion directly below, Next Note preview on the right
      const centerX = w * 0.50;
      const centerY = h * 0.42;
      const activeIdx = nextNoteIndexRef.current;

      // 1. Render OSU!-STYLE CONNECTED CHAIN of upcoming notes on the right:
      //    - Always show the immediate next note (activeIdx + 1).
      //    - If consecutive notes are close (<= 30f apart), show up to 3 chained notes connected by dashed lines,
      //      each with its own shrinking osu! approach circle so fast bursts are 100% readable!
      const chainIndices: number[] = [];
      if (activeIdx + 1 < notes.length) {
        chainIndices.push(activeIdx + 1);
        for (let k = activeIdx + 2; k < Math.min(notes.length, activeIdx + 4); k++) {
          const isChargeNext = notes[k].motion === '46' || notes[k].motion === '28';
          const gapLimit = isChargeNext ? 60 : 30;
          if (notes[k].frame - notes[k - 1].frame <= gapLimit) {
            chainIndices.push(k);
          } else {
            break;
          }
        }
      }

      const isFixed = chartLayout === 'fixed';
      if (isFixed) {
        drawFixedBoard(ctx, w, h, notes, activeIdx, currentFrame, phaseRef.current, now, mode, isRightSide, lowPerfMode);
      }

      if (!isFixed && chainIndices.length > 0) {
        const nextRadius = 42;
        const firstNextX = centerX + CIRCLE_RADIUS + 115;
        const chainGapX = 128;

        // Draw osu!-style dashed follow-point connecting line from Center -> Chain 1 -> Chain 2 -> ...
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([7, 7]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
        ctx.lineWidth = 3;
        ctx.moveTo(centerX + CIRCLE_RADIUS + 6, centerY);
        chainIndices.forEach((_, idx) => {
          ctx.lineTo(firstNextX + idx * chainGapX, centerY);
        });
        ctx.stroke();
        ctx.restore();

        // Draw each chained upcoming note (back-to-front so earlier notes stay on top)
        for (let c = chainIndices.length - 1; c >= 0; c--) {
          const noteIdx = chainIndices[c];
          const nextNote = notes[noteIdx];
          const nextAttacks = nextNote.buttons.filter((b) => !DIRECTION_IDS.has(b));
          const nextPrimary =
            nextAttacks[nextAttacks.length - 1] ?? nextNote.buttons[nextNote.buttons.length - 1];
          const nextColor = BUTTON_META[nextPrimary]?.color ?? '#94a3b8';
          const nx = firstNextX + c * chainGapX;
          const ny = centerY;

          ctx.save();
          ctx.globalAlpha = c === 0 ? 0.85 : 0.65;

          // Shrinking osu! approach circle with identical APPROACH_FRAMES & scale as the center circle
          const nextFramesUntil = nextNote.frame - currentFrame;
          if (
            (phaseRef.current === 'playing' || phaseRef.current === 'countdown') &&
            nextFramesUntil <= APPROACH_FRAMES &&
            nextFramesUntil >= -4
          ) {
            const nextProg = Math.max(0, Math.min(1, 1 - nextFramesUntil / APPROACH_FRAMES));
            const nextAppScale = 1 + (1 - nextProg) * 1.6;
            const ringCol = nextFramesUntil <= 9 ? '#facc15' : nextColor;
            ctx.beginPath();
            ctx.arc(nx, ny, nextRadius * nextAppScale, 0, Math.PI * 2);
            ctx.strokeStyle = ringCol;
            ctx.lineWidth = 3.5;
            if (!lowPerfMode) {
              ctx.shadowColor = ringCol;
              ctx.shadowBlur = 12;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          // Circle body
          ctx.beginPath();
          ctx.arc(nx, ny, nextRadius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = nextColor;
          ctx.stroke();

          // Sequence number badge (like osu! combo numbers)
          ctx.beginPath();
          ctx.arc(nx - nextRadius * 0.72, ny - nextRadius * 0.72, 12, 0, Math.PI * 2);
          ctx.fillStyle = nextColor;
          ctx.fill();
          ctx.fillStyle = '#090d16';
          ctx.font = '900 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(noteIdx + 1), nx - nextRadius * 0.72, ny - nextRadius * 0.72);

          const nextLabel = nextAttacks.map((b) => BUTTON_META[b].shortLabel).join('+');
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 18px system-ui, sans-serif';
          ctx.fillText(nextLabel || nextNote.notation, nx, ny - 4);

          ctx.fillStyle = nextColor;
          ctx.font = '700 12px system-ui, sans-serif';
          ctx.fillText(nextNote.notation, nx, ny + 16);

          // Direction / Motion / Early Charge Cue below every upcoming preview circle
          const nextDirs = nextNote.buttons
            .filter((b) => DIRECTION_IDS.has(b))
            .map((b) => mirrorBtn(b, isRightSide));
          if (nextNote.motion === '46' || nextNote.motion === '28') {
            const chargeCue =
              nextNote.motion === '46'
                ? isRightSide
                  ? '→ 提前集氣 [4]6'
                  : '← 提前集氣 [4]6'
                : '↓ 提前集氣 [2]8';
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.beginPath();
            ctx.roundRect(nx - 54, ny + nextRadius + 10, 108, 22, 11);
            ctx.fill();
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#facc15';
            ctx.font = '800 11px system-ui, sans-serif';
            ctx.fillText(chargeCue, nx, ny + nextRadius + 21);
          } else if (nextNote.motion) {
            const motionArrowMap: Record<string, string> = isRightSide
              ? {
                  '236': '↓↙← 236',
                  '214': '↓↘→ 214',
                  '623': '←↓↙ 623',
                  '6214': '←↓→ 6214',
                  '22': '↓↓ 22',
                  '66': '←← 66',
                }
              : {
                  '236': '↓↘→ 236',
                  '214': '↓↙← 214',
                  '623': '→↓↘ 623',
                  '6214': '→↓← 6214',
                  '22': '↓↓ 22',
                  '66': '→→ 66',
                };
            const mText = motionArrowMap[nextNote.motion] ?? nextNote.motion;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.beginPath();
            ctx.roundRect(nx - 42, ny + nextRadius + 10, 84, 22, 11);
            ctx.fill();
            ctx.strokeStyle = nextColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#f8fafc';
            ctx.font = '800 11px system-ui, sans-serif';
            ctx.fillText(mText, nx, ny + nextRadius + 21);
          } else if (nextDirs.length > 0) {
            const nUp = nextDirs.includes('UP');
            const nDown = nextDirs.includes('DOWN');
            const nLeft = nextDirs.includes('LEFT');
            const nRight = nextDirs.includes('RIGHT');
            const nArrow =
              nDown && nRight
                ? '↘'
                : nDown && nLeft
                ? '↙'
                : nUp && nRight
                ? '↗'
                : nUp && nLeft
                ? '↖'
                : BUTTON_META[nextDirs[0]].shortLabel;
            ctx.beginPath();
            ctx.arc(nx, ny + nextRadius + 22, 16, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.fill();
            ctx.strokeStyle = nextColor;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 18px system-ui, sans-serif';
            ctx.fillText(nArrow, nx, ny + nextRadius + 22);
          }

          ctx.restore();
        }
      }

      // 2. Render CURRENT ACTIVE NOTE right in the CENTER (1.5x larger)
      if (!isFixed && activeIdx < notes.length) {
        const note = notes[activeIdx];
        const attackButtons = note.buttons.filter((b) => !DIRECTION_IDS.has(b));
        const dirButtons = note.buttons
          .filter((b) => DIRECTION_IDS.has(b))
          .map((b) => mirrorBtn(b, isRightSide)) as DirectionButtonId[];
        const primaryBtn = attackButtons[attackButtons.length - 1] ?? note.buttons[note.buttons.length - 1];
        const color = BUTTON_META[primaryBtn]?.color ?? '#38bdf8';

        let alpha = 1;
        let approachScale = 1;
        let progress = 1;
        const framesUntilHit = note.frame - currentFrame;

        if (phaseRef.current === 'waiting-first') {
          const pulse = (Math.sin(now / 220) + 1) / 2;
          approachScale = 1.12 + pulse * 0.35;
          progress = 0.5 + pulse * 0.5;
          alpha = 1;
        } else {
          const clampedUntil = Math.max(0, Math.min(APPROACH_FRAMES, framesUntilHit));
          progress = 1 - clampedUntil / APPROACH_FRAMES;
          alpha = framesUntilHit > APPROACH_FRAMES ? 0.45 : Math.min(1, progress * 2.2 + 0.25);
          approachScale = framesUntilHit > APPROACH_FRAMES ? 2.4 : 1 + (1 - progress) * 1.6;
        }

        const isHitWindowGold =
          phaseRef.current === 'playing' && framesUntilHit <= 9 && framesUntilHit >= -2;
        const ringColor = isHitWindowGold ? '#facc15' : color;

        // === MOTION SLIDER DIRECTLY BELOW THE ATTACK BUTTON ===
        if (note.motion) {
          ctx.save();
          ctx.globalAlpha = alpha;
          drawMotionSlider(
            ctx,
            note.motion,
            centerX,
            centerY + CIRCLE_RADIUS + 112,
            72,
            progress,
            ringColor,
            activeIdx + 1,
            lowPerfMode,
            isRightSide
          );
          ctx.restore();
        } else if (dirButtons.length > 0) {
          // Simple direction circle placed right next to the LEFT of the centered attack button
          const hasUp = dirButtons.includes('UP');
          const hasDown = dirButtons.includes('DOWN');
          const hasLeft = dirButtons.includes('LEFT');
          const hasRight = dirButtons.includes('RIGHT');

          const dirArrow =
            hasDown && hasRight
              ? '↘'
              : hasDown && hasLeft
              ? '↙'
              : hasUp && hasRight
              ? '↗'
              : hasUp && hasLeft
              ? '↖'
              : BUTTON_META[dirButtons[0]].shortLabel;

          const lx = centerX - CIRCLE_RADIUS - 62;
          const ly = centerY;
          const dirRadius = 42;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(lx, ly, dirRadius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(10, 14, 24, 0.9)';
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = ringColor;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = '900 32px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(dirArrow, lx, ly);
          ctx.restore();
        }

        // === CENTER BIG 1.5x ATTACK CIRCLE ===
        const rx = centerX;
        const ry = centerY;

        ctx.save();
        ctx.globalAlpha = alpha;

        if (approachScale > 0) {
          ctx.beginPath();
          ctx.arc(rx, ry, CIRCLE_RADIUS * approachScale, 0, Math.PI * 2);
          ctx.strokeStyle = ringColor;
          ctx.lineWidth = isHitWindowGold ? 6 : 4.5;
          if (!lowPerfMode) {
            ctx.shadowColor = ringColor;
            ctx.shadowBlur = isHitWindowGold ? 24 : 14;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(rx, ry, CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isHitWindowGold ? 'rgba(250, 204, 21, 0.28)' : 'rgba(10, 14, 24, 0.88)';
        ctx.fill();
        ctx.lineWidth = isHitWindowGold ? 6 : 4.5;
        ctx.strokeStyle = isHitWindowGold ? '#facc15' : '#ffffff';
        if (isHitWindowGold && !lowPerfMode) {
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 22;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(rx, ry, CIRCLE_RADIUS - 7, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = ringColor;
        ctx.stroke();

        // Sequence number badge
        ctx.beginPath();
        ctx.arc(rx - CIRCLE_RADIUS * 0.72, ry - CIRCLE_RADIUS * 0.72, 16, 0, Math.PI * 2);
        ctx.fillStyle = ringColor;
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.font = '900 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(activeIdx + 1), rx - CIRCLE_RADIUS * 0.72, ry - CIRCLE_RADIUS * 0.72);

        // Attack button label inside big circle
        const atkLabel = attackButtons.map((b) => BUTTON_META[b].shortLabel).join('+');
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 28px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(atkLabel || note.notation, rx, ry - 6);

        ctx.fillStyle = ringColor;
        ctx.font = '800 15px system-ui, sans-serif';
        ctx.fillText(note.notation, rx, ry + 24);

        // Move name pill above the big circle (so it never overlaps the motion slider below!)
        ctx.font = '700 14px system-ui, sans-serif';
        const textWidth = ctx.measureText(note.moveName).width + 26;
        ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
        ctx.beginPath();
        ctx.roundRect(rx - textWidth / 2, ry - CIRCLE_RADIUS - 36, textWidth, 26, 13);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(note.moveName, rx, ry - CIRCLE_RADIUS - 23);

        ctx.restore();
      }

      // 2.5. Draw Active Hold / Charge Ring (e.g. Luke Flash Knuckle / JP Feint Hold)
      const hold = activeHoldRef.current;
      if (hold) {
        const heldFrames = Math.max(0, (now - hold.pressTime) / FRAME_MS);
        const ratio = Math.min(1.25, heldFrames / hold.targetHoldFrames);
        const hx = centerX;
        const hy = centerY;
        const isSweetSpot = Math.abs(heldFrames - hold.targetHoldFrames) <= 2.5;
        const ringColor = isSweetSpot ? '#facc15' : ratio > 1.05 ? '#f43f5e' : '#38bdf8';

        ctx.save();
        // Background track
        ctx.beginPath();
        ctx.arc(hx, hy, CIRCLE_RADIUS + 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 8;
        ctx.stroke();

        // Radial charge fill arc (-PI/2 clockwise)
        ctx.beginPath();
        ctx.arc(
          hx,
          hy,
          CIRCLE_RADIUS + 12,
          -Math.PI / 2,
          -Math.PI / 2 + Math.min(1, ratio) * Math.PI * 2
        );
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        if (!lowPerfMode) {
          ctx.shadowColor = ringColor;
          ctx.shadowBlur = isSweetSpot ? 22 : 10;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Release cue label
        ctx.fillStyle = ringColor;
        ctx.font = '900 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          isSweetSpot ? '放開!' : `蓄力 ${Math.round(heldFrames)}/${hold.targetHoldFrames}f`,
          hx,
          hy - CIRCLE_RADIUS - 26
        );
        ctx.restore();
      }

      // 3. Draw Hit Judgment Popups
      hitEffectsRef.current = hitEffectsRef.current.filter((eff) => now - eff.timestamp < 650);
      for (const eff of hitEffectsRef.current) {
        const age = (now - eff.timestamp) / 650;
        const cx = centerX;
        const cy = centerY - (eff.noteId.endsWith('-rel') ? 54 : 0);
        const color = RANK_COLORS[eff.rank];

        ctx.save();
        ctx.globalAlpha = 1 - age;

        ctx.fillStyle = color;
        ctx.font = '900 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        if (!lowPerfMode) {
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 8;
        }
        ctx.fillText(eff.rank, cx, cy - 12 - age * 28);

        if (eff.rank !== 'MISS') {
          const sign = eff.deltaFrames > 0 ? '+' : '';
          ctx.fillStyle = '#f8fafc';
          ctx.font = '700 12px monospace';
          ctx.fillText(`${sign}${eff.deltaFrames}f`, cx, cy + 8 - age * 28);
        }
        ctx.restore();
      }

      // 4. Bottom-Center Recorded Stick & Button Playback Bar (if enabled & combo has inputHistory)
      if (hasRecordedBar && combo.inputHistory) {
        const ih = combo.inputHistory;
        let activeEntry = ih[0];
        if (phaseRef.current === 'playing') {
          for (let j = ih.length - 1; j >= 0; j--) {
            if (currentFrame >= ih[j].startFrame) {
              activeEntry = ih[j];
              break;
            }
          }
        }

        const barW = 420;
        const barH = 74;
        const barX = w * 0.5 - barW / 2;
        const barY = h - barH - 22;

        ctx.save();
        ctx.fillStyle = 'rgba(10, 14, 24, 0.86)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Mini 8-way Arcade Stick on the left of the bar
        const stickCx = barX + 46;
        const stickCy = barY + barH / 2;
        ctx.beginPath();
        ctx.arc(stickCx, stickCy, 24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const dir = phaseRef.current === 'playing' ? activeEntry.dir : '5';
        const stickDx =
          dir === '1' || dir === '4' || dir === '7'
            ? -12
            : dir === '3' || dir === '6' || dir === '9'
            ? 12
            : 0;
        const stickDy =
          dir === '7' || dir === '8' || dir === '9'
            ? -12
            : dir === '1' || dir === '2' || dir === '3'
            ? 12
            : 0;

        // Stick shaft + ball top
        ctx.beginPath();
        ctx.moveTo(stickCx, stickCy);
        ctx.lineTo(stickCx + stickDx, stickCy + stickDy);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(stickCx + stickDx, stickCy + stickDy, 9, 0, Math.PI * 2);
        ctx.fillStyle = dir === '5' ? '#64748b' : '#38bdf8';
        if (!lowPerfMode && dir !== '5') {
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 10;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Direction arrow label next to stick
        const dirArrows: Record<string, string> = {
          '1': '↙', '2': '↓', '3': '↘', '4': '←', '5': '•', '6': '→', '7': '↖', '8': '↑', '9': '↗',
        };
        ctx.fillStyle = '#f8fafc';
        ctx.font = '900 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dirArrows[dir] ?? '•', barX + 94, stickCy - 6);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.fillText(`方向 ${dir}`, barX + 94, stickCy + 14);

        // Active Recorded Attack/System Buttons on the right
        const recBtns = phaseRef.current === 'playing' ? activeEntry.buttons : [];
        const allModeBtns: ActionButtonId[] =
          mode === 'modern'
            ? ['L', 'M', 'H', 'SP', 'AUTO', 'PARRY']
            : ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'];

        allModeBtns.forEach((bId, bIdx) => {
          const isLit = recBtns.includes(bId);
          const bx = barX + 146 + bIdx * 43;
          const by = stickCy;
          const bColor = BUTTON_META[bId]?.color ?? '#38bdf8';

          ctx.beginPath();
          ctx.arc(bx, by, 17, 0, Math.PI * 2);
          ctx.fillStyle = isLit ? bColor : 'rgba(30, 41, 59, 0.75)';
          if (isLit && !lowPerfMode) {
            ctx.shadowColor = bColor;
            ctx.shadowBlur = 14;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.lineWidth = isLit ? 2.5 : 1.5;
          ctx.strokeStyle = isLit ? '#ffffff' : 'rgba(148, 163, 184, 0.3)';
          ctx.stroke();

          ctx.fillStyle = isLit ? '#090d16' : '#64748b';
          ctx.font = '900 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(BUTTON_META[bId]?.shortLabel ?? bId, bx, by);
        });

        ctx.restore();
      }

      // 5. Low-Performance Mode: Draw Live Input Strip directly on Canvas (0 React re-renders!)
      if (lowPerfMode && activeButtonsRef.current.size > 0) {
        const activeList = Array.from(activeButtonsRef.current);
        ctx.save();
        ctx.font = '900 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const pillH = 30;
        const gap = 8;
        const widths = activeList.map(
          (btnId) => Math.max(38, ctx.measureText(BUTTON_META[btnId].shortLabel).width + 28)
        );
        const totalW = widths.reduce((sum, bw) => sum + bw, 0) + gap * (activeList.length - 1);
        let curX = w * 0.5 - totalW / 2;
        // Sit directly above the recorded stick bar (barY = h - 96) so the two never overlap
        const pillY = hasRecordedBar ? h - 96 - 12 - pillH : h - 24 - pillH;
        for (let i = 0; i < activeList.length; i++) {
          const btnId = activeList[i];
          const bw = widths[i];
          ctx.fillStyle = BUTTON_META[btnId].color;
          ctx.beginPath();
          ctx.roundRect(curX, pillY, bw, pillH, 8);
          ctx.fill();
          ctx.fillStyle = '#090d16';
          ctx.fillText(BUTTON_META[btnId].shortLabel, curX + bw / 2, pillY + pillH / 2);
          curX += bw + gap;
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [combo.notes, combo.inputHistory, mode, showRecordedInputs, lowPerfMode, chartLayout, sfxEnabled, recordHit, resetRun, activeButtonsRef, getCurrentChargeMs, isRightSide, lang]);

  const totalHits = stats.perfect + stats.good + stats.early + stats.late + stats.miss;
  const accuracy =
    totalHits === 0
      ? 100
      : Math.round((stats.perfect * 100 + stats.good * 70 + (stats.early + stats.late) * 40) / totalHits);

  const hasIssueInRun = runLog.some(
    (item) =>
      item.rank === 'EARLY' || item.rank === 'LATE' || item.rank === 'MISS' || Boolean(item.diagHint)
  );
  const firstIssue = runLog.find(
    (item) =>
      item.rank === 'EARLY' || item.rank === 'LATE' || item.rank === 'MISS' || Boolean(item.diagHint)
  );

  return (
    <div className="overlay-root">
      <canvas ref={canvasRef} className="overlay-canvas" />

      {/* Minimal Floating Top HUD */}
      <div className={`overlay-hud ${lowPerfMode ? 'low-perf' : ''}`}>
        <div className="hud-left">
          <span className="hud-mode-badge">{mode === 'classic' ? 'C' : 'M'}</span>
          {isRightSide && (
            <span
              className="hud-mode-badge"
              style={{ background: 'rgba(244, 63, 94, 0.28)', color: '#fda4af', borderColor: 'rgba(244, 63, 94, 0.6)' }}
            >
              2P
            </span>
          )}
          <span className="hud-combo-name">{combo.characterName} · {getComboTitle(combo, lang)}</span>
        </div>

        <div className="hud-stats">
          <span className="stat-item perfect">P {stats.perfect}</span>
          <span className="stat-item good">G {stats.good}</span>
          <span className="stat-item" style={{ color: '#fb923c', fontWeight: 800 }}>{t.earlyShort} {stats.early}</span>
          <span className="stat-item" style={{ color: '#f472b6', fontWeight: 800 }}>{t.lateShort} {stats.late}</span>
          <span className="stat-item miss">M {stats.miss}</span>
          <span className="stat-item acc">{accuracy}%</span>
        </div>

        <div className="hud-controls">
          {!isClickThrough && (
            <>
              <button
                className="hud-btn"
                onClick={() => setShowReview((v) => !v)}
                style={
                  hasIssueInRun
                    ? { borderColor: 'rgba(251, 146, 60, 0.7)', color: '#fed7aa' }
                    : undefined
                }
                title={t.reviewTitle}
              >
                {t.reviewBtn} {showReview ? '▲' : '▼'}
              </button>
              <button className="hud-btn" onClick={() => resetRun(true)} title={`${t.restartBtn} (F8)`}>
                <RotateCcw size={13} /> {t.restartBtn}
              </button>
              <button className="hud-btn exit" onClick={onExitOverlay} title={`${t.menuBtn} (F10)`}>
                <ArrowLeft size={13} /> {t.menuBtn}
              </button>
            </>
          )}
          <span className={`passthrough-badge ${isClickThrough ? 'on' : 'off'}`}>
            <MousePointerClick size={12} />
            {isClickThrough ? '穿透中 (F9 解除)' : '可點擊 (F9 穿透)'}
          </span>
          <span className="hud-hotkey">F8 重來 · F10 選單</span>
        </div>
      </div>

      {/* Collapsible Per-Run Combo Review Dropdown (auto-clears on RESET) */}
      {showReview && (
        <div
          style={{
            position: 'fixed',
            top: 58,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(760px, 92vw)',
            maxHeight: '45vh',
            overflowY: 'auto',
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(10, 14, 24, 0.92)',
            border: '1px solid rgba(148, 163, 184, 0.32)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
            zIndex: 25,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
              fontSize: 12.5,
              fontWeight: 800,
              color: '#e2e8f0',
            }}
          >
            <span>
              {t.reviewTitle} ({combo.notes.length} {t.hitsUnit})
              {firstIssue
                ? ` · ${t.firstIssuePrefix}${firstIssue.step} ${firstIssue.notation} (${
                    firstIssue.diagHint
                      ? firstIssue.diagHint
                      : firstIssue.rank === 'EARLY'
                      ? `${t.earlyWord} ${firstIssue.deltaFrames.toFixed(1)}f`
                      : firstIssue.rank === 'LATE'
                      ? `${t.lateWord} +${firstIssue.deltaFrames.toFixed(1)}f`
                      : 'MISS'
                  })`
                : runLog.length > 0
                ? ` · ${t.allGoodText}`
                : ` · ${t.notStartedText}`}
            </span>
            {!isClickThrough && (
              <button
                className="hud-btn"
                style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => setShowReview(false)}
              >
                {t.collapseBtn}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {combo.notes.map((note, idx) => {
              const res = runLog.find((r) => r.noteId === note.id);
              const isProblem =
                res &&
                (res.rank === 'EARLY' ||
                  res.rank === 'LATE' ||
                  res.rank === 'MISS' ||
                  Boolean(res.diagHint));
              const primaryBtn = note.buttons[note.buttons.length - 1];
              const normalColor = BUTTON_META[primaryBtn]?.color ?? '#38bdf8';

              const statusText = !res
                ? `${note.frame}f`
                : res.rank === 'PERFECT'
                ? 'PERFECT'
                : res.rank === 'GOOD'
                ? `GOOD ${res.deltaFrames >= 0 ? '+' : ''}${res.deltaFrames.toFixed(1)}f`
                : res.rank === 'EARLY'
                ? `${t.earlyWord} ${res.deltaFrames.toFixed(1)}f`
                : res.rank === 'LATE'
                ? `${t.lateWord} +${res.deltaFrames.toFixed(1)}f`
                : 'MISS';

              const statusColor = !res
                ? '#cbd5e1'
                : res.rank === 'PERFECT'
                ? '#facc15'
                : res.rank === 'GOOD'
                ? '#38bdf8'
                : res.rank === 'EARLY'
                ? '#fb923c'
                : res.rank === 'LATE'
                ? '#f472b6'
                : '#f43f5e';

              return (
                <div
                  key={note.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    padding: '6px 10px',
                    borderRadius: 8,
                    minWidth: 86,
                    background: isProblem
                      ? 'rgba(100, 116, 139, 0.22)'
                      : `${normalColor}22`,
                    border: isProblem
                      ? '1px solid rgba(148, 163, 184, 0.45)'
                      : `1px solid ${normalColor}99`,
                    opacity: isProblem ? 0.72 : 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: isProblem ? '#94a3b8' : '#f8fafc',
                    }}
                  >
                    #{idx + 1} {note.notation}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>
                    {statusText}
                  </div>
                  {res?.diagHint && (
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#fbbf24',
                        marginTop: 2,
                        lineHeight: 1.3,
                      }}
                    >
                      ⚠ {res.diagHint}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Input Strip at Bottom Center (DOM only in standard mode; Canvas in low-perf mode) */}
      {!lowPerfMode && (
        <div className="overlay-input-strip" style={hasRecordedBar ? { bottom: 108 } : undefined}>
          {Array.from(activeButtons).map((btnId) => (
            <span
              key={btnId}
              className="overlay-input-pill"
              style={{ backgroundColor: BUTTON_META[btnId].color }}
            >
              {BUTTON_META[btnId].shortLabel}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
