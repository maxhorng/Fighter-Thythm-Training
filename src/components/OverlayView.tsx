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
const CIRCLE_RADIUS = 44;

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
    return { earlyPerfect: 2.5, latePerfect: 2.5, earlyGood: 12.0, lateGood: 16.0, maxMiss: 24.0 };
  }
  if (effectiveType === 'juggle') {
    return { earlyPerfect: 2.0, latePerfect: 2.0, earlyGood: 7.0, lateGood: 13.0, maxMiss: 18.0 };
  }
  if (effectiveType === 'cancel') {
    return { earlyPerfect: 2.0, latePerfect: 2.0, earlyGood: 6.0, lateGood: 10.0, maxMiss: 14.0 };
  }
  // Default / 'link' (strict frame-accurate Perfect ±1.5f; Good covers SF6 4f buffer + tight late)
  return { earlyPerfect: 1.5, latePerfect: 1.5, earlyGood: 4.5, lateGood: 3.5, maxMiss: 10.0 };
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
      if (pressedBtn !== primaryBtn) return;

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

  const { activeButtons } = useInputEngine({
    mode,
    bindings,
    onActionPress: handleActionPress,
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

      // Subtle center divider line separating Left (Directions) and Right (Attacks)
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 10]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(w * 0.5, 76);
      ctx.lineTo(w * 0.5, h - 76);
      ctx.stroke();
      ctx.restore();

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

      // 1. Guide line connecting upcoming RIGHT-SIDE attack circles
      for (let i = 0; i < notes.length - 1; i++) {
        const a = notes[i];
        const b = notes[i + 1];
        if (judgedNotesRef.current.has(b.id)) continue;
        const framesUntilA = a.frame - currentFrame;
        if (phaseRef.current !== 'waiting-first' && framesUntilA > APPROACH_FRAMES + 18) continue;

        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.stroke();
        ctx.restore();
      }

      // 2. Render each active note on BOTH Left Half (Direction/Motion) & Right Half (Attack)
      for (let i = notes.length - 1; i >= 0; i--) {
        const note = notes[i];
        if (judgedNotesRef.current.has(note.id)) continue;

        const attackButtons = note.buttons.filter((b) => !DIRECTION_IDS.has(b));
        const dirButtons = note.buttons.filter((b) => DIRECTION_IDS.has(b)) as DirectionButtonId[];
        const primaryBtn = attackButtons[attackButtons.length - 1] ?? note.buttons[note.buttons.length - 1];
        const color = BUTTON_META[primaryBtn]?.color ?? '#38bdf8';

        let alpha = 1;
        let approachScale = 1;
        let progress = 1;

        if (phaseRef.current === 'waiting-first') {
          if (i === 0) {
            const pulse = (Math.sin(now / 220) + 1) / 2;
            approachScale = 1.15 + pulse * 0.45;
            progress = 0.5 + pulse * 0.5;
            alpha = 1;
          } else {
            approachScale = 0;
            progress = 0;
            alpha = 0.22;
          }
        } else {
          const framesUntilHit = note.frame - currentFrame;
          if (framesUntilHit > APPROACH_FRAMES) continue;
          progress = Math.max(0, Math.min(1, 1 - framesUntilHit / APPROACH_FRAMES));
          alpha = Math.min(1, progress * 2.2);
          approachScale = 1 + (1 - progress) * 1.9;
        }

        // === LEFT HALF: Direction Circle OR Osu! Motion Slider (236 / 214 / 623) ===
        const leftCenterX = w * 0.25;
        const leftCenterY = h * 0.52;

        if (note.motion) {
          ctx.save();
          ctx.globalAlpha = alpha;
          drawMotionSlider(ctx, note.motion, leftCenterX, leftCenterY, 96, progress, color, i + 1);
          ctx.restore();
        } else if (dirButtons.length > 0) {
          const hasUp = dirButtons.includes('UP');
          const hasDown = dirButtons.includes('DOWN');
          const hasLeft = dirButtons.includes('LEFT');
          const hasRight = dirButtons.includes('RIGHT');

          const offset = 52;
          const dx = hasLeft ? -offset : hasRight ? offset : 0;
          const dy = hasUp ? -offset : hasDown ? offset : 0;
          const lx = leftCenterX + dx;
          const ly = leftCenterY + dy;

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

          ctx.save();
          ctx.globalAlpha = alpha;

          if (approachScale > 0) {
            ctx.beginPath();
            ctx.arc(lx, ly, CIRCLE_RADIUS * approachScale, 0, Math.PI * 2);
            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          ctx.arc(lx, ly, CIRCLE_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = '900 28px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(dirArrow, lx, ly);

          ctx.restore();
        }

        // === RIGHT HALF: Attack / System Button Osu! Circle ===
        const rx = note.x * w;
        const ry = note.y * h;

        ctx.save();
        ctx.globalAlpha = alpha;

        if (approachScale > 0) {
          ctx.beginPath();
          ctx.arc(rx, ry, CIRCLE_RADIUS * approachScale, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(rx, ry, CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rx, ry, CIRCLE_RADIUS - 5, 0, Math.PI * 2);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        ctx.stroke();

        // Sequence number badge
        ctx.beginPath();
        ctx.arc(rx - CIRCLE_RADIUS * 0.72, ry - CIRCLE_RADIUS * 0.72, 13, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), rx - CIRCLE_RADIUS * 0.72, ry - CIRCLE_RADIUS * 0.72);

        // Attack button label inside right circle
        const atkLabel = attackButtons.map((b) => BUTTON_META[b].shortLabel).join('+');
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(atkLabel || note.notation, rx, ry - 4);

        ctx.fillStyle = color;
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.fillText(note.notation, rx, ry + 17);

        // Move name pill below right circle
        ctx.fillStyle = 'rgba(10, 14, 24, 0.8)';
        const textWidth = ctx.measureText(note.moveName).width + 22;
        ctx.beginPath();
        ctx.roundRect(rx - textWidth / 2, ry + CIRCLE_RADIUS + 8, textWidth, 22, 11);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillText(note.moveName, rx, ry + CIRCLE_RADIUS + 19);

        ctx.restore();
      }

      // 3. Draw Hit Judgment Popups & Ring Bursts
      hitEffectsRef.current = hitEffectsRef.current.filter((eff) => now - eff.timestamp < 650);
      for (const eff of hitEffectsRef.current) {
        const age = (now - eff.timestamp) / 650;
        const cx = eff.x * w;
        const cy = eff.y * h;
        const color = RANK_COLORS[eff.rank];

        ctx.save();
        ctx.globalAlpha = 1 - age;

        ctx.beginPath();
        ctx.arc(cx, cy, CIRCLE_RADIUS * (1 + age * 0.9), 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4 * (1 - age);
        ctx.stroke();

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
