import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, MousePointerClick, RotateCcw } from 'lucide-react';
import {
  ActionButtonId,
  ComboData,
  ControlMode,
  DirectionButtonId,
  HitResult,
  JudgmentRank,
  KeyBindingMap,
  MotionType,
  StartTriggerMode,
} from '../types/combo';
import { BUTTON_META } from '../data/bindings';
import { useInputEngine } from '../hooks/useInputEngine';

interface OverlayViewProps {
  mode: ControlMode;
  combo: ComboData;
  bindings: KeyBindingMap;
  triggerMode: StartTriggerMode;
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
  seqNum: number
) {
  ctx.save();

  // Slider ball glides along the track during the last 55% of the approach window
  const slideT = Math.max(0, Math.min(1, (progress - 0.45) / 0.55));

  if (motion === '236' || motion === '214') {
    const isRight = motion === '236';
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
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
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
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
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
    // Z-shaped DP slider: Right (6) -> Down (2) -> Down-Right (3)
    const p1 = { x: centerX + radius * 0.6, y: centerY - radius * 0.4 };
    const p2 = { x: centerX - radius * 0.2, y: centerY + radius * 0.45 };
    const p3 = { x: centerX + radius * 0.65, y: centerY + radius * 0.45 };

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
    ctx.fillText('→', p1.x, p1.y);
    ctx.fillText('↓', p2.x, p2.y);
    ctx.fillText('↘', p3.x, p3.y);

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
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
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
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
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
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
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
    // Forward Dash (66): Left → followed by Right →
    const leftX = centerX - 48;
    const rightX = centerX + 48;

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
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
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
      ctx.fillText('→', cx, centerY);
    });

    const bx = leftX + (rightX - leftX) * slideT;
    ctx.beginPath();
    ctx.arc(bx, centerY, 14, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
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
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
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
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
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

    const bx = x1 + (x2 - x1) * slideT;
    const by = y1 + (y2 - y1) * slideT;
    ctx.beginPath();
    ctx.arc(bx, by, 16, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
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
  }

  ctx.restore();
}

export const OverlayView: React.FC<OverlayViewProps> = ({
  mode,
  combo,
  bindings,
  triggerMode,
  isClickThrough,
  onExitOverlay,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const phaseRef = useRef<'waiting-first' | 'countdown' | 'playing' | 'finished'>(
    triggerMode === 'trigger-first' ? 'waiting-first' : 'countdown'
  );
  const startTimeRef = useRef<number>(performance.now());
  const nextNoteIndexRef = useRef<number>(0);
  const judgedNotesRef = useRef<Set<string>>(new Set());
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
    earlyLate: 0,
    miss: 0,
    streak: 0,
  });

  const resetRun = useCallback(() => {
    phaseRef.current = triggerMode === 'trigger-first' ? 'waiting-first' : 'countdown';
    startTimeRef.current = performance.now();
    nextNoteIndexRef.current = 0;
    judgedNotesRef.current = new Set();
    hitEffectsRef.current = [];
    activeHoldRef.current = null;
  }, [triggerMode]);

  useEffect(() => {
    const unsub = window.electronAPI?.onHotkey((action) => {
      if (action === 'RESTART_COMBO') {
        resetRun();
      }
    });
    return () => unsub?.();
  }, [resetRun]);

  const recordHit = useCallback((result: HitResult) => {
    hitEffectsRef.current.push(result);
    setStats((prev) => {
      if (result.rank === 'PERFECT') {
        return { ...prev, perfect: prev.perfect + 1, streak: prev.streak + 1 };
      }
      if (result.rank === 'GOOD') {
        return { ...prev, good: prev.good + 1, streak: prev.streak + 1 };
      }
      if (result.rank === 'EARLY' || result.rank === 'LATE') {
        return { ...prev, earlyLate: prev.earlyLate + 1, streak: prev.streak + 1 };
      }
      return { ...prev, miss: prev.miss + 1, streak: 0 };
    });
  }, []);

  const handleActionPress = useCallback(
    (pressedBtn: ActionButtonId, activeSet: Set<ActionButtonId>) => {
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
        phaseRef.current = 'playing';
        startTimeRef.current = performance.now();
        judgedNotesRef.current.add(targetNote.id);
        nextNoteIndexRef.current = 1;
        recordHit({
          noteId: targetNote.id,
          rank: 'PERFECT',
          deltaFrames: 0,
          timestamp: performance.now(),
          x: targetNote.x,
          y: targetNote.y,
        });
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
        const effectiveType =
          targetNote.windowType ?? (targetNote.buttons.includes('PARRY') ? 'dr-cancel' : 'link');
        if (deltaFrames > 0 && effectiveType !== 'link') {
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
        recordHit({
          noteId: targetNote.id,
          rank,
          deltaFrames: Math.round(deltaFrames * 10) / 10,
          timestamp: performance.now(),
          x: targetNote.x,
          y: targetNote.y,
        });
      }
    },
    [combo.notes, recordHit]
  );

  const handleActionRelease = useCallback(
    (releasedBtn: ActionButtonId) => {
      const hold = activeHoldRef.current;
      if (!hold || hold.primaryBtn !== releasedBtn) return;
      activeHoldRef.current = null;

      const actualHoldFrames = (performance.now() - hold.pressTime) / FRAME_MS;
      const releaseDelta = actualHoldFrames - hold.targetHoldFrames;
      let rank: JudgmentRank = 'PERFECT';
      if (Math.abs(releaseDelta) <= 2.0) {
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
    [recordHit]
  );

  const { activeButtons } = useInputEngine({
    mode,
    bindings,
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
      const dpr = window.devicePixelRatio || 1;
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

        while (nextNoteIndexRef.current < notes.length) {
          const n = notes[nextNoteIndexRef.current];
          const win = getNoteWindows(n.windowType, n.buttons);
          if (currentFrame - n.frame > win.maxMiss) {
            judgedNotesRef.current.add(n.id);
            nextNoteIndexRef.current += 1;
            recordHit({
              noteId: n.id,
              rank: 'MISS',
              deltaFrames: win.maxMiss,
              timestamp: now,
              x: n.x,
              y: n.y,
            });
          } else {
            break;
          }
        }

        const lastNoteFrame = notes[notes.length - 1]?.frame ?? 0;
        if (currentFrame > lastNoteFrame + 150) {
          resetRun();
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
          if (notes[k].frame - notes[k - 1].frame <= 30) {
            chainIndices.push(k);
          } else {
            break;
          }
        }
      }

      if (chainIndices.length > 0) {
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
            ctx.shadowColor = ringCol;
            ctx.shadowBlur = 12;
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

          ctx.restore();
        }
      }

      // 2. Render CURRENT ACTIVE NOTE right in the CENTER (1.5x larger)
      if (activeIdx < notes.length) {
        const note = notes[activeIdx];
        const attackButtons = note.buttons.filter((b) => !DIRECTION_IDS.has(b));
        const dirButtons = note.buttons.filter((b) => DIRECTION_IDS.has(b)) as DirectionButtonId[];
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
            activeIdx + 1
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
          ctx.shadowColor = ringColor;
          ctx.shadowBlur = isHitWindowGold ? 24 : 14;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(rx, ry, CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isHitWindowGold ? 'rgba(250, 204, 21, 0.28)' : 'rgba(10, 14, 24, 0.88)';
        ctx.fill();
        ctx.lineWidth = isHitWindowGold ? 6 : 4.5;
        ctx.strokeStyle = isHitWindowGold ? '#facc15' : '#ffffff';
        if (isHitWindowGold) {
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
        ctx.shadowColor = ringColor;
        ctx.shadowBlur = isSweetSpot ? 22 : 10;
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

      // 3. Draw Hit Judgment Popups & Ring Bursts
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
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 8;
        ctx.fillText(eff.rank, cx, cy - 12 - age * 28);

        if (eff.rank !== 'MISS') {
          const sign = eff.deltaFrames > 0 ? '+' : '';
          ctx.fillStyle = '#f8fafc';
          ctx.font = '700 12px monospace';
          ctx.fillText(`${sign}${eff.deltaFrames}f`, cx, cy + 8 - age * 28);
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
  }, [combo.notes, recordHit, resetRun]);

  const totalHits = stats.perfect + stats.good + stats.earlyLate + stats.miss;
  const accuracy =
    totalHits === 0
      ? 100
      : Math.round((stats.perfect * 100 + stats.good * 70 + stats.earlyLate * 40) / totalHits);

  return (
    <div className="overlay-root">
      <canvas ref={canvasRef} className="overlay-canvas" />

      {/* Minimal Floating Top HUD */}
      <div className="overlay-hud">
        <div className="hud-left">
          <span className="hud-mode-badge">{mode === 'classic' ? 'C' : 'M'}</span>
          <span className="hud-combo-name">{combo.characterName} · {combo.title}</span>
        </div>

        <div className="hud-stats">
          <span className="stat-item perfect">P {stats.perfect}</span>
          <span className="stat-item good">G {stats.good}</span>
          <span className="stat-item miss">M {stats.miss}</span>
          <span className="stat-item acc">{accuracy}%</span>
        </div>

        <div className="hud-controls">
          {!isClickThrough && (
            <>
              <button className="hud-btn" onClick={resetRun} title="重來 (F8)">
                <RotateCcw size={13} /> 重來
              </button>
              <button className="hud-btn exit" onClick={onExitOverlay} title="返回選單 (F10)">
                <ArrowLeft size={13} /> 選單
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

      {/* Live Input Strip at Bottom Center */}
      <div className="overlay-input-strip">
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
    </div>
  );
};
