import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, RotateCcw, Save } from 'lucide-react';
import {
  ActionButtonId,
  ComboData,
  ComboNote,
  ControlMode,
  InputHistoryEntry,
  KeyBindingMap,
  MotionType,
} from '../types/combo';
import { BUTTON_META } from '../data/bindings';
import { SF6_CHARACTER_FRAME_DATA } from '../data/frameData';
import { useInputEngine } from '../hooks/useInputEngine';

interface RecordOverlayViewProps {
  mode: ControlMode;
  characterId: string;
  bindings: KeyBindingMap;
  isClickThrough: boolean;
  onSyncDraft: (combo: ComboData | null) => void;
  onFinishRecord: (combo: ComboData | null) => void;
}

const FRAME_MS = 1000 / 60;
const DIRECTION_IDS = new Set<ActionButtonId>(['UP', 'DOWN', 'LEFT', 'RIGHT']);
const SLOTS_X = [0.54, 0.62, 0.70, 0.78, 0.86];

export const RecordOverlayView: React.FC<RecordOverlayViewProps> = ({
  mode,
  characterId,
  bindings,
  isClickThrough,
  onSyncDraft,
  onFinishRecord,
}) => {
  const startTimeRef = useRef<number | null>(null);
  const [recordedNotes, setRecordedNotes] = useState<ComboNote[]>([]);
  const [position, setPosition] = useState<'midscreen' | 'corner'>('midscreen');
  const [customTitleInput, setCustomTitleInput] = useState('');
  const [customTagsInput, setCustomTagsInput] = useState('');
  const recordedRef = useRef<ComboNote[]>([]);
  recordedRef.current = recordedNotes;
  const dirHistoryRef = useRef<{ dir: string; t: number }[]>([]);
  const holdStartRef = useRef<Map<ActionButtonId, { noteId: string; pressTime: number }>>(new Map());
  const inputHistoryRef = useRef<InputHistoryEntry[]>([]);
  const lastStateKeyRef = useRef<string>('');
  const lastStateStartTimeRef = useRef<number | null>(null);
  // Charge tracking for SF6 charge characters ([4]6, [2]8, [4]646, [2]828)
  const chargeRef = useRef<{
    backStart: number | null;
    lastBackChargeMs: number;
    lastBackReleaseTime: number;
    downStart: number | null;
    lastDownChargeMs: number;
    lastDownReleaseTime: number;
  }>({
    backStart: null,
    lastBackChargeMs: 0,
    lastBackReleaseTime: 0,
    downStart: null,
    lastDownChargeMs: 0,
    lastDownReleaseTime: 0,
  });

  const charMeta = SF6_CHARACTER_FRAME_DATA[characterId] ?? SF6_CHARACTER_FRAME_DATA.ryu;

  const clearRecording = useCallback(() => {
    startTimeRef.current = null;
    dirHistoryRef.current = [];
    holdStartRef.current.clear();
    inputHistoryRef.current = [];
    lastStateKeyRef.current = '';
    lastStateStartTimeRef.current = null;
    chargeRef.current = {
      backStart: null,
      lastBackChargeMs: 0,
      lastBackReleaseTime: 0,
      downStart: null,
      lastDownChargeMs: 0,
      lastDownReleaseTime: 0,
    };
    setRecordedNotes([]);
  }, []);

  const buildCombo = useCallback((): ComboData | null => {
    const notes = recordedRef.current;
    if (notes.length === 0) return null;

    // Finalize duration of the last inputHistory entry if active
    const history = inputHistoryRef.current.map((e) => ({ ...e }));
    if (history.length > 0 && lastStateStartTimeRef.current !== null) {
      const last = history[history.length - 1];
      if (last.durationFrames === 0) {
        last.durationFrames = Math.max(
          0.1,
          Math.round(((performance.now() - lastStateStartTimeRef.current) / FRAME_MS) * 10) / 10
        );
      }
    }

    const parsedCustomTags = customTagsInput
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const posTag = position === 'corner' ? '角落' : '非角落';
    const finalTags = Array.from(new Set([posTag, ...parsedCustomTags]));

    const cleanCustomName = customTitleInput.trim() || '實錄連段';

    return {
      id: `rec-${Date.now()}`,
      characterId: charMeta.id,
      characterName: charMeta.name,
      mode,
      title: `${position === 'corner' ? '[角落] ' : ''}${charMeta.name} ${cleanCustomName} (${notes.length} 擊 · ${notes[notes.length - 1].frame}f)`,
      difficulty: notes.length >= 6 ? 'Advanced' : 'Intermediate',
      position,
      description: `${notes.map((n) => `${n.notation}(${n.frame}f)`).join(' → ')}`,
      tags: finalTags,
      notes,
      inputHistory: history,
    };
  }, [charMeta.id, charMeta.name, customTagsInput, customTitleInput, mode, position]);

  const finishAndSave = useCallback(() => {
    const combo = buildCombo();
    if (combo && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(combo, null, 2)).catch(() => {});
    }
    onFinishRecord(combo);
  }, [buildCombo, onFinishRecord]);

  // Keep App.tsx synced with the latest recorded combo so F10 always saves it!
  useEffect(() => {
    onSyncDraft(buildCombo());
  }, [recordedNotes, buildCombo, onSyncDraft]);

  useEffect(() => {
    const unsub = window.electronAPI?.onHotkey((action) => {
      if (action === 'RESTART_COMBO') {
        clearRecording();
      }
    });
    return () => unsub?.();
  }, [clearRecording]);

  const handleActionPress = useCallback(
    (pressedBtn: ActionButtonId, activeSet: Set<ActionButtonId>) => {
      if (pressedBtn === 'RESET') {
        clearRecording();
        return;
      }
      const now = performance.now();

      // Synchronously record every direction press into dirHistoryRef so fast 1-frame
      // 236 / 214 / 623 / 66 / [4]6 / [2]8 inputs are never lost to React state batching!
      if (DIRECTION_IDS.has(pressedBtn)) {
        const ch = chargeRef.current;
        if (pressedBtn === 'LEFT' && ch.backStart === null) ch.backStart = now;
        if (pressedBtn === 'DOWN' && ch.downStart === null) ch.downStart = now;

        const up = activeSet.has('UP');
        const down = activeSet.has('DOWN');
        const left = activeSet.has('LEFT');
        const right = activeSet.has('RIGHT');
        const d =
          down && right ? '3' : down && left ? '1' : up && right ? '9' : up && left ? '7' : down ? '2' : up ? '8' : left ? '4' : right ? '6' : '5';
        const hist = dirHistoryRef.current;
        if (hist.length === 0 || hist[hist.length - 1].dir !== d) {
          hist.push({ dir: d, t: now });
          if (hist.length > 32) hist.shift();
        }

        // Retroactive [2]8 / [4]6 charge upgrade: in SF6, pressing the attack button 1~2f BEFORE
        // hitting UP (8) or RIGHT (6) still triggers Flash Kick / Sonic Boom!
        if (startTimeRef.current !== null && (pressedBtn === 'UP' || pressedBtn === 'RIGHT')) {
          const ch = chargeRef.current;
          const frame = Math.round((now - startTimeRef.current) / FRAME_MS);
          const isUpCharge =
            pressedBtn === 'UP' && ch.lastDownChargeMs >= 630 && now - ch.lastDownReleaseTime <= 180;
          const isFwdCharge =
            pressedBtn === 'RIGHT' && ch.lastBackChargeMs >= 630 && now - ch.lastBackReleaseTime <= 180;

          if (isUpCharge || isFwdCharge) {
            const chargeMotion: MotionType = isUpCharge ? '28' : '46';
            const chargeDirBtn: ActionButtonId = isUpCharge ? 'UP' : 'RIGHT';
            const chargePrefix = isUpCharge ? '[2]8' : '[4]6';
            setRecordedNotes((prev) => {
              const last = prev[prev.length - 1];
              if (!last || last.motion || frame - last.frame > 3) return prev;
              const atkBtns = last.buttons.filter((b) => !DIRECTION_IDS.has(b));
              if (atkBtns.length === 0) return prev;
              const btnLabel = atkBtns.map((b) => BUTTON_META[b].shortLabel).join('+');
              const upgraded: ComboNote = {
                ...last,
                buttons: [chargeDirBtn, ...atkBtns],
                motion: chargeMotion,
                notation: `${chargePrefix}${btnLabel}`,
                moveName: `${chargePrefix}${btnLabel} (${last.frame}f)`,
              };
              return [...prev.slice(0, -1), upgraded];
            });
          } else if (pressedBtn === 'UP') {
            // Record explicit Jump (9 前跳 / 8 垂直跳 / 7 後跳) for Safe Jump (安全跳) combos!
            const jumpDirBtns: ActionButtonId[] = activeSet.has('RIGHT')
              ? ['UP', 'RIGHT']
              : activeSet.has('LEFT')
              ? ['UP', 'LEFT']
              : ['UP'];
            const jumpNotation = activeSet.has('RIGHT') ? '9' : activeSet.has('LEFT') ? '7' : '8';
            const jumpLabel =
              jumpNotation === '9' ? '9 前跳' : jumpNotation === '7' ? '7 後跳' : '8 跳躍';
            setRecordedNotes((prev) => {
              const last = prev[prev.length - 1];
              if (last && (last.notation === '9' || last.notation === '8' || last.notation === '7') && frame - last.frame <= 15) {
                return prev;
              }
              const idx = prev.length;
              return [
                ...prev,
                {
                  id: `rec-${idx + 1}`,
                  frame,
                  buttons: jumpDirBtns,
                  notation: jumpNotation,
                  moveName: `${jumpLabel} (${frame}f)`,
                  x: SLOTS_X[idx % SLOTS_X.length],
                  y: 0.50,
                },
              ];
            });
          }
        }

        // Detect Forward Dash (66) during an active recording!
        if (pressedBtn === 'RIGHT' && d === '6') {
          const recentDash = hist.filter((h) => now - h.t <= 240).map((h) => h.dir).join('');
          if (/65+6$/.test(recentDash)) {
            if (startTimeRef.current === null) {
              startTimeRef.current = now;
            }
            const frame = Math.round((now - startTimeRef.current) / FRAME_MS);
            setRecordedNotes((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.motion === '66' && frame - last.frame <= 12) return prev;
              const idx = prev.length;
              return [
                ...prev,
                {
                  id: `rec-${idx + 1}`,
                  frame,
                  buttons: ['RIGHT'],
                  motion: '66',
                  notation: '66',
                  moveName: `66 前衝 (${frame}f)`,
                  x: SLOTS_X[idx % SLOTS_X.length],
                  y: 0.50,
                },
              ];
            });
          }
        }
        if (pressedBtn === 'LEFT' && d === '4') {
          const recentBackdash = hist.filter((h) => now - h.t <= 240).map((h) => h.dir).join('');
          if (/45+4$/.test(recentBackdash)) {
            if (startTimeRef.current === null) {
              startTimeRef.current = now;
            }
            const frame = Math.round((now - startTimeRef.current) / FRAME_MS);
            setRecordedNotes((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.motion === '44' && frame - last.frame <= 12) return prev;
              const idx = prev.length;
              return [
                ...prev,
                {
                  id: `rec-${idx + 1}`,
                  frame,
                  buttons: ['LEFT'],
                  motion: '44',
                  notation: '44',
                  moveName: `44 後衝 (${frame}f)`,
                  x: SLOTS_X[idx % SLOTS_X.length],
                  y: 0.50,
                },
              ];
            });
          }
        }
        return;
      }

      // Ignore standalone AUTO modifier presses
      if (pressedBtn === 'AUTO') return;

      if (startTimeRef.current === null) {
        startTimeRef.current = now;
      }

      const frame = Math.round((now - startTimeRef.current) / FRAME_MS);
      const heldDirs = Array.from(activeSet).filter((b) => DIRECTION_IDS.has(b));
      const heldMods = Array.from(activeSet).filter((b) => b === 'AUTO');
      const buttons: ActionButtonId[] = [...heldDirs, ...heldMods, pressedBtn];

      const dirPrefix: string =
        heldDirs.includes('DOWN') && heldDirs.includes('RIGHT')
          ? '3'
          : heldDirs.includes('DOWN') && heldDirs.includes('LEFT')
          ? '1'
          : heldDirs.includes('UP') && heldDirs.includes('RIGHT')
          ? '9'
          : heldDirs.includes('UP') && heldDirs.includes('LEFT')
          ? '7'
          : heldDirs.includes('DOWN')
          ? '2'
          : heldDirs.includes('LEFT')
          ? '4'
          : heldDirs.includes('RIGHT')
          ? '6'
          : heldDirs.includes('UP')
          ? '8'
          : '';
      const modPrefix = heldMods.includes('AUTO') ? 'AUTO+' : '';
      const btnShort = BUTTON_META[pressedBtn].shortLabel;

      // Detect recent special / Super Art / Charge motions
      const recentDirs550 = dirHistoryRef.current
        .filter((d) => now - d.t <= 550)
        .map((d) => d.dir);
      if (dirPrefix && recentDirs550[recentDirs550.length - 1] !== dirPrefix) {
        recentDirs550.push(dirPrefix);
      }
      const seqLong = recentDirs550.join('');

      const recentDirs = dirHistoryRef.current
        .filter((d) => now - d.t <= 400)
        .map((d) => d.dir);
      if (dirPrefix && recentDirs[recentDirs.length - 1] !== dirPrefix) {
        recentDirs.push(dirPrefix);
      }
      const seq = recentDirs.join('');

      // Check SF6 charge thresholds (~38f = 630ms minimum charge; button within ~120ms / 7f after release)
      // Also check active backStart/downStart in case release + press happened on the exact same frame (including 1st hit!)
      const ch = chargeRef.current;
      const hasBackCharge =
        (ch.lastBackChargeMs >= 630 && now - ch.lastBackReleaseTime <= 350) ||
        (ch.backStart !== null && now - ch.backStart >= 630);
      const hasDownCharge =
        (ch.lastDownChargeMs >= 630 && now - ch.lastDownReleaseTime <= 350) ||
        (ch.downStart !== null && now - ch.downStart >= 630);
      const hasBackChargeRecent =
        (ch.lastBackChargeMs >= 630 && now - ch.lastBackReleaseTime <= 220) ||
        (ch.backStart !== null && now - ch.backStart >= 630);
      const hasDownChargeRecent =
        (ch.lastDownChargeMs >= 630 && now - ch.lastDownReleaseTime <= 220) ||
        (ch.downStart !== null && now - ch.downStart >= 630);

      const getModernSaLabel = (btn: ActionButtonId, motionStr: string): string => {
        if (btn === 'L') return `SA1(${motionStr}${btnShort} / 5or6SP+H)`;
        if (btn === 'M') return `SA2(${motionStr}${btnShort} / 4SP+H)`;
        if (btn === 'H') return `SA3(${motionStr}${btnShort} / 2SP+H)`;
        return `SA(${motionStr}${btnShort})`;
      };

      let detectedMotion: MotionType | undefined;
      let saLabel: string | null = null;

      // Count full 4-cardinal rotations (D, L, U, R) for 360 (SPD) and 720 (SA3)
      const countRotations = (dirs: string[]): number => {
        let rotations = 0;
        let mask = 0;
        for (const d of dirs) {
          if (d === '1' || d === '2' || d === '3') mask |= 1;
          if (d === '1' || d === '4' || d === '7') mask |= 2;
          if (d === '7' || d === '8' || d === '9') mask |= 4;
          if (d === '3' || d === '6' || d === '9') mask |= 8;
          if (mask === 15) {
            rotations++;
            mask = 0;
          }
        }
        return rotations;
      };
      const recentDirs800 = dirHistoryRef.current
        .filter((d) => now - d.t <= 800)
        .map((d) => d.dir);
      if (dirPrefix && recentDirs800[recentDirs800.length - 1] !== dirPrefix) {
        recentDirs800.push(dirPrefix);
      }

      if (pressedBtn !== 'PARRY' && pressedBtn !== 'DI') {
        // 0. Full-circle 720 (轉兩圈 SA3) & 360 (轉一圈 SPD) — e.g. Zangief
        if (countRotations(recentDirs800) >= 2) {
          detectedMotion = '720';
          saLabel = mode === 'modern' ? getModernSaLabel(pressedBtn, '720') : `720${btnShort}`;
        } else if (countRotations(recentDirs550) >= 1) {
          detectedMotion = '360';
        }
        // 1. Double-QCF (236236) / Double-QCB (214214) Super Arts
        else if ((dirPrefix === '6' || dirPrefix === '3') && /[23][235]*6.*[23][235]*6/.test(seqLong)) {
          detectedMotion = '236';
          saLabel = mode === 'modern' ? getModernSaLabel(pressedBtn, '236236') : `236236${btnShort}`;
        } else if ((dirPrefix === '4' || dirPrefix === '1') && /[21][215]*4.*[21][215]*4/.test(seqLong)) {
          detectedMotion = '214';
          saLabel = mode === 'modern' ? getModernSaLabel(pressedBtn, '214214') : `214214${btnShort}`;
        }
        // 2. Charge Super Arts: [4]646 (Honda / Guile) & [2]828 (Guile / Chun)
        else if (
          hasBackCharge &&
          (dirPrefix === '6' || dirPrefix === '3' || dirPrefix === '9' || dirPrefix === '') &&
          /[417].*6.*[417].*65?$/.test(seqLong)
        ) {
          detectedMotion = '4646';
          saLabel = mode === 'modern' ? getModernSaLabel(pressedBtn, '4646') : `4646${btnShort}`;
        } else if (
          hasDownCharge &&
          (dirPrefix === '8' || dirPrefix === '7' || dirPrefix === '9' || dirPrefix === '') &&
          /[213].*8.*[213].*85?$/.test(seqLong)
        ) {
          detectedMotion = '28';
          saLabel = mode === 'modern' ? getModernSaLabel(pressedBtn, '2828') : `2828${btnShort}`;
        }
        // 3. Standard Charge Specials: [4]6 and [2]8 (SF6 keeps charge buffered for ~12f / 220ms after release!)
        else if (hasBackChargeRecent && (dirPrefix === '6' || dirPrefix === '3' || dirPrefix === '9')) {
          detectedMotion = '46';
        } else if (hasDownChargeRecent && (dirPrefix === '8' || dirPrefix === '7' || dirPrefix === '9')) {
          detectedMotion = '28';
        }
        // 4. Standard Motion Specials: 623 (incl. SF6 323 / 33 / 633(6363) / 636 DP shortcuts & TK 62369) / 236 (incl. TK 2369) / 214 (incl. TK 2147) / 22
        else if (
          (dirPrefix === '3' || dirPrefix === '6') &&
          /(?:6[35]*2[35]*[36]|3[256]+3|32[5]*6|6[5]*3[56]*3|6[5]*3[5]*6)/.test(seq)
        ) {
          detectedMotion = '623';
        } else if (dirPrefix === '9' && /6[35]*2[35]*6[65]*9/.test(seq)) {
          detectedMotion = '623';
          saLabel = `62369${modPrefix}${btnShort}`;
        } else if (dirPrefix === '9' && /[23][235]*6[65]*9/.test(seq)) {
          detectedMotion = '236';
          saLabel = `2369${modPrefix}${btnShort}`;
        } else if (dirPrefix === '7' && /[21][215]*4[45]*7/.test(seq)) {
          detectedMotion = '214';
          saLabel = `2147${modPrefix}${btnShort}`;
        } else if ((dirPrefix === '6' || dirPrefix === '3') && /[23][235]*6/.test(seq)) {
          detectedMotion = '236';
        } else if (
          (charMeta.id === 'manon' || charMeta.id === 'dhalsim' || charMeta.id === 'ehonda') &&
          (dirPrefix === '4' || dirPrefix === '1') &&
          /6[3215]*[21][15]*4/.test(seq)
        ) {
          detectedMotion = '6214';
          saLabel = `63214${modPrefix}${btnShort}`;
        } else if ((dirPrefix === '4' || dirPrefix === '1') && /[21][215]*4/.test(seq)) {
          detectedMotion = '214';
        } else if (dirPrefix === '2' && /2[^2]+2/.test(seq)) {
          detectedMotion = '22';
        }
      }

      const notation = saLabel
        ? saLabel
        : detectedMotion === '46'
        ? `[4]6${modPrefix}${btnShort}`
        : detectedMotion === '28'
        ? `[2]8${modPrefix}${btnShort}`
        : detectedMotion
        ? `${detectedMotion}${modPrefix}${btnShort}`
        : `${dirPrefix}${modPrefix}${btnShort}`;

      const isTkMotion =
        (dirPrefix === '9' || dirPrefix === '7') &&
        (detectedMotion === '236' || detectedMotion === '214' || detectedMotion === '623');

      setRecordedNotes((prev) => {
        // Absorb immediately preceding standalone jump note (7 / 8 / 9 within <= 10f) when a TK special
        // (e.g. 2147LK+HP, 2369MK, 62369MP) is recorded, so TK moves are recorded as ONE clean note.
        // Real Safe Jumps (30+ frames between jump and aerial attack) are unaffected.
        let base = prev;
        const prevLast = prev[prev.length - 1];
        const absorbedTkJump = Boolean(
          isTkMotion &&
            prevLast &&
            !prevLast.motion &&
            (prevLast.notation === '9' || prevLast.notation === '7' || prevLast.notation === '8') &&
            frame - prevLast.frame >= 0 &&
            frame - prevLast.frame <= 10
        );
        if (absorbedTkJump) {
          base = prev.slice(0, -1);
        }

        // Merge simultaneous chord presses within <= 2 frames (e.g. SP+H for Super Arts, or 2147LK+HP!)
        const last = base[base.length - 1];
        if (!absorbedTkJump && last && Math.abs(frame - last.frame) <= 2 && !last.buttons.includes(pressedBtn)) {
          const mergedButtons = Array.from(new Set([...last.buttons, ...buttons]));
          const mergedNotation = `${last.notation}+${btnShort}`;
          const updated: ComboNote = {
            ...last,
            buttons: mergedButtons,
            notation: mergedNotation,
            moveName: `${mergedNotation} (${last.frame}f)`,
          };
          return [...base.slice(0, -1), updated];
        }

        const idx = base.length;
        const noteId = `rec-${idx + 1}`;
        holdStartRef.current.set(pressedBtn, { noteId, pressTime: now });
        const note: ComboNote = {
          id: noteId,
          frame,
          buttons,
          ...(detectedMotion ? { motion: detectedMotion } : {}),
          notation,
          moveName: `${notation} (${frame}f)`,
          x: SLOTS_X[idx % SLOTS_X.length],
          y: 0.50,
        };
        return [...base, note];
      });
    },
    [mode]
  );

  const handleActionRelease = useCallback((releasedBtn: ActionButtonId, activeSet: Set<ActionButtonId>) => {
    // Synchronously finalize charge timers & push updated direction into dirHistoryRef on direction release
    // (e.g., holding 6 and double-tapping 2 produces 6 -> 3 -> 6 -> 3 for 633 DP shortcut!).
    if (DIRECTION_IDS.has(releasedBtn)) {
      const now = performance.now();
      const up = activeSet.has('UP');
      const down = activeSet.has('DOWN');
      const left = activeSet.has('LEFT');
      const right = activeSet.has('RIGHT');
      const v = up && !down ? 1 : down && !up ? -1 : 0;
      const h = right && !left ? 1 : left && !right ? -1 : 0;
      const d =
        v === -1 && h === -1 ? '1' :
        v === -1 && h === 0 ? '2' :
        v === -1 && h === 1 ? '3' :
        v === 0 && h === -1 ? '4' :
        v === 0 && h === 1 ? '6' :
        v === 1 && h === -1 ? '7' :
        v === 1 && h === 0 ? '8' :
        v === 1 && h === 1 ? '9' : '5';
      const hist = dirHistoryRef.current;
      if (hist.length === 0 || hist[hist.length - 1].dir !== d) {
        hist.push({ dir: d, t: now });
        if (hist.length > 40) {
          dirHistoryRef.current = hist.slice(-30);
        }
      }

      const ch = chargeRef.current;
      if (releasedBtn === 'LEFT' && ch.backStart !== null) {
        const dur = now - ch.backStart;
        if (dur >= 630 || now - ch.lastBackReleaseTime > 450) {
          ch.lastBackChargeMs = dur;
          ch.lastBackReleaseTime = now;
        }
        ch.backStart = null;
      }
      if (releasedBtn === 'DOWN' && ch.downStart !== null) {
        const dur = now - ch.downStart;
        if (dur >= 630 || now - ch.lastDownReleaseTime > 450) {
          ch.lastDownChargeMs = dur;
          ch.lastDownReleaseTime = now;
        }
        ch.downStart = null;
      }
    }

    // If a direction (e.g. DOWN) is released within <= 1f (~16ms) of pressing an attack button
    // (like releasing DOWN to do 5LK out of crouch charge), strip that direction so 2LK -> 5LK!
    if (DIRECTION_IDS.has(releasedBtn) && startTimeRef.current !== null) {
      const nowFrame = (performance.now() - startTimeRef.current) / FRAME_MS;
      setRecordedNotes((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.motion || nowFrame - last.frame > 1.2 || !last.buttons.includes(releasedBtn)) {
          return prev;
        }
        const nextBtns = last.buttons.filter((b) => b !== releasedBtn);
        const remDirs = nextBtns.filter((b) => DIRECTION_IDS.has(b));
        const atkBtns = nextBtns.filter((b) => !DIRECTION_IDS.has(b));
        if (atkBtns.length === 0) return prev;
        const dirPfx =
          remDirs.includes('DOWN') && remDirs.includes('RIGHT')
            ? '3'
            : remDirs.includes('DOWN') && remDirs.includes('LEFT')
            ? '1'
            : remDirs.includes('DOWN')
            ? '2'
            : remDirs.includes('LEFT')
            ? '4'
            : remDirs.includes('RIGHT')
            ? '6'
            : remDirs.includes('UP')
            ? '8'
            : '5';
        const atkStr = atkBtns.map((b) => BUTTON_META[b].shortLabel).join('+');
        const nextNotation = `${dirPfx}${atkStr}`;
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            buttons: nextBtns,
            notation: nextNotation,
            moveName: `${nextNotation} (${last.frame}f)`,
          },
        ];
      });
      return;
    }

    const entry = holdStartRef.current.get(releasedBtn);
    if (!entry) return;
    holdStartRef.current.delete(releasedBtn);

    const heldFrames = Math.round((performance.now() - entry.pressTime) / FRAME_MS);
    // Intentional hold threshold: >= 10 frames (~167ms), e.g. Luke Flash Knuckle charge / JP feint hold
    if (heldFrames >= 10) {
      setRecordedNotes((prev) =>
        prev.map((n) =>
          n.id === entry.noteId
            ? {
                ...n,
                holdFrames: heldFrames,
                moveName: `${n.notation} [按住${heldFrames}f放開]`,
              }
            : n
        )
      );
    }
  }, []);

  const { activeButtons } = useInputEngine({
    mode,
    bindings,
    onActionPress: handleActionPress,
    onActionRelease: handleActionRelease,
  });

  // Track directional numpad history (1..9) for 236 / 214 / 22 motion auto-detection
  useEffect(() => {
    const up = activeButtons.has('UP');
    const down = activeButtons.has('DOWN');
    const left = activeButtons.has('LEFT');
    const right = activeButtons.has('RIGHT');
    const dir =
      down && right
        ? '3'
        : down && left
        ? '1'
        : up && right
        ? '9'
        : up && left
        ? '7'
        : down
        ? '2'
        : up
        ? '8'
        : left
        ? '4'
        : right
        ? '6'
        : '5';
    const now = performance.now();
    const hist = dirHistoryRef.current;
    if (hist.length === 0 || hist[hist.length - 1].dir !== dir) {
      hist.push({ dir, t: now });
      if (hist.length > 24) hist.shift();
    }

    // Update Back (4/1/7) and Down (2/1/3) charge timers
    const ch = chargeRef.current;
    if (left) {
      if (ch.backStart === null) ch.backStart = now;
    } else if (ch.backStart !== null) {
      const dur = now - ch.backStart;
      if (dur >= 630 || now - ch.lastBackReleaseTime > 450) {
        ch.lastBackChargeMs = dur;
        ch.lastBackReleaseTime = now;
      }
      ch.backStart = null;
    }
    if (down) {
      if (ch.downStart === null) ch.downStart = now;
    } else if (ch.downStart !== null) {
      const dur = now - ch.downStart;
      if (dur >= 630 || now - ch.lastDownReleaseTime > 450) {
        ch.lastDownChargeMs = dur;
        ch.lastDownReleaseTime = now;
      }
      ch.downStart = null;
    }

    // Record detailed SF6-style Run-Length Encoded Input History once recording has started
    if (startTimeRef.current !== null) {
      const nonDirBtns = Array.from(activeButtons)
        .filter((b) => !DIRECTION_IDS.has(b))
        .sort();
      const stateKey = `${dir}|${nonDirBtns.join(',')}`;
      if (stateKey !== lastStateKeyRef.current) {
        const ih = inputHistoryRef.current;
        if (ih.length > 0 && lastStateStartTimeRef.current !== null) {
          ih[ih.length - 1].durationFrames =
            Math.round(((now - lastStateStartTimeRef.current) / FRAME_MS) * 10) / 10;
        }
        const startFrame = Math.round(((now - startTimeRef.current) / FRAME_MS) * 10) / 10;
        ih.push({
          startFrame,
          durationFrames: 0,
          dir,
          buttons: nonDirBtns,
        });
        lastStateKeyRef.current = stateKey;
        lastStateStartTimeRef.current = now;
      }
    }
  }, [activeButtons]);

  return (
    <div className="overlay-root">
      {/* Top Recording HUD */}
      <div className="overlay-hud" style={{ borderColor: 'rgba(244, 63, 94, 0.65)' }}>
        <div className="hud-left">
          <Circle size={12} fill="#f43f5e" color="#f43f5e" />
          <span className="hud-combo-name" style={{ color: '#fda4af' }}>
            錄製連段中 · {charMeta.name} ({mode === 'classic' ? '經典' : '現代'})
          </span>
        </div>

        <div className="hud-stats">
          <span className="stat-item perfect">已錄 {recordedNotes.length} 招</span>
          {recordedNotes.length > 0 && (
            <span className="stat-item acc">
              總長 {recordedNotes[recordedNotes.length - 1].frame}f
            </span>
          )}
        </div>

        <div className="hud-controls">
          {!isClickThrough && (
            <>
              <button
                className="hud-btn"
                onClick={() => setPosition((p) => (p === 'midscreen' ? 'corner' : 'midscreen'))}
                style={
                  position === 'corner'
                    ? { borderColor: 'rgba(251, 146, 60, 0.8)', color: '#fdba74', background: 'rgba(251, 146, 60, 0.18)' }
                    : { borderColor: 'rgba(45, 212, 191, 0.6)', color: '#99f6e4' }
                }
                title="切換此連段為角落或非角落"
              >
                {position === 'corner' ? '角落' : '非角落'}
              </button>
              <input
                type="text"
                value={customTitleInput}
                onChange={(e) => setCustomTitleInput(e.target.value)}
                placeholder="自訂連段名(可留空)"
                style={{
                  width: 135,
                  padding: '4px 8px',
                  fontSize: 11.5,
                  borderRadius: 6,
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  background: 'rgba(15, 23, 42, 0.9)',
                  color: '#f8fafc',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                value={customTagsInput}
                onChange={(e) => setCustomTagsInput(e.target.value)}
                placeholder="自訂標籤(如:確反,安全跳)"
                style={{
                  width: 155,
                  padding: '4px 8px',
                  fontSize: 11.5,
                  borderRadius: 6,
                  border: '1px solid rgba(148, 163, 184, 0.35)',
                  background: 'rgba(15, 23, 42, 0.9)',
                  color: '#f8fafc',
                  outline: 'none',
                }}
              />
              <button className="hud-btn" onClick={clearRecording}>
                <RotateCcw size={13} /> 清空 (F8)
              </button>
              <button className="hud-btn exit" onClick={finishAndSave}>
                <Save size={13} /> 儲存並結束 (F10)
              </button>
            </>
          )}
          <span className="hud-hotkey">
            在 SF6 直接打一套連段 · F8 重錄 · F10 結束並儲存（自動複製 JSON）
          </span>
        </div>
      </div>

      {/* Live Recorded Timeline Strip */}
      <div
        style={{
          position: 'fixed',
          bottom: 74,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 6,
          maxWidth: '88vw',
          padding: '8px 14px',
          borderRadius: 12,
          background: 'rgba(9, 13, 22, 0.78)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          pointerEvents: 'none',
        }}
      >
        {recordedNotes.length === 0 ? (
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            等待第一擊輸入...（按下第一個攻擊鍵自動開始計時 0f）
          </span>
        ) : (
          recordedNotes.map((n, i) => (
            <React.Fragment key={n.id}>
              <span className="step-chip">
                <strong>{n.notation}</strong>
                <small>{n.frame}f</small>
              </span>
              {i < recordedNotes.length - 1 && <span className="step-arrow">→</span>}
            </React.Fragment>
          ))
        )}
      </div>

      {/* Live Input Strip */}
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
