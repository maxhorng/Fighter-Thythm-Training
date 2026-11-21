import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, RotateCcw, Save } from 'lucide-react';
import {
  ActionButtonId,
  ComboData,
  ComboNote,
  ControlMode,
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
  const recordedRef = useRef<ComboNote[]>([]);
  recordedRef.current = recordedNotes;
  const dirHistoryRef = useRef<{ dir: string; t: number }[]>([]);

  const charMeta = SF6_CHARACTER_FRAME_DATA[characterId] ?? SF6_CHARACTER_FRAME_DATA.ryu;

  const clearRecording = useCallback(() => {
    startTimeRef.current = null;
    dirHistoryRef.current = [];
    setRecordedNotes([]);
  }, []);

  const buildCombo = useCallback((): ComboData | null => {
    const notes = recordedRef.current;
    if (notes.length === 0) return null;
    return {
      id: `rec-${Date.now()}`,
      characterId: charMeta.id,
      characterName: charMeta.name,
      mode,
      title: `${charMeta.name} 實錄連段 (${notes.length} 擊 · ${notes[notes.length - 1].frame}f)`,
      difficulty: notes.length >= 6 ? 'Advanced' : 'Intermediate',
      description: `實機 60fps 錄製：${notes.map((n) => `${n.notation}(${n.frame}f)`).join(' → ')}`,
      tags: ['實機錄製', '60fps原味'],
      notes,
    };
  }, [charMeta.id, charMeta.name, mode]);

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
      const now = performance.now();

      // Synchronously record every direction press into dirHistoryRef so fast 1-frame
      // 236 / 214 / 623 / 66 inputs are never lost to React state batching!
      if (DIRECTION_IDS.has(pressedBtn)) {
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

        // Detect Forward Dash (66) during an active recording!
        if (pressedBtn === 'RIGHT' && d === '6' && startTimeRef.current !== null) {
          const recentDash = hist.filter((h) => now - h.t <= 240).map((h) => h.dir).join('');
          if (/65+6$/.test(recentDash)) {
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

      const dirPrefix =
        heldDirs.includes('DOWN') && heldDirs.includes('RIGHT')
          ? '3'
          : heldDirs.includes('DOWN') && heldDirs.includes('LEFT')
          ? '1'
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

      // Detect recent special motion (236 / 214 / 22) within the last 400ms.
      // Append current dirPrefix synchronously since React's useEffect runs after handleActionPress!
      const recentDirs = dirHistoryRef.current
        .filter((d) => now - d.t <= 400)
        .map((d) => d.dir);
      if (dirPrefix && recentDirs[recentDirs.length - 1] !== dirPrefix) {
        recentDirs.push(dirPrefix);
      }
      const seq = recentDirs.join('');
      let detectedMotion: MotionType | undefined;
      if (pressedBtn !== 'PARRY' && pressedBtn !== 'DI') {
        if ((dirPrefix === '3' || dirPrefix === '6') && /6[35]*2[35]*[36]/.test(seq)) {
          detectedMotion = '623';
        } else if ((dirPrefix === '6' || dirPrefix === '3') && /[23][235]*6/.test(seq)) {
          detectedMotion = '236';
        } else if ((dirPrefix === '4' || dirPrefix === '1') && /[21][215]*4/.test(seq)) {
          detectedMotion = '214';
        } else if (dirPrefix === '2' && /2[^2]+2/.test(seq)) {
          detectedMotion = '22';
        }
      }

      const notation = detectedMotion
        ? `${detectedMotion}${modPrefix}${btnShort}`
        : `${dirPrefix}${modPrefix}${btnShort}`;

      setRecordedNotes((prev) => {
        // Merge simultaneous chord presses within <= 2 frames (e.g. SP+H for Super Arts!)
        const last = prev[prev.length - 1];
        if (last && Math.abs(frame - last.frame) <= 2 && !last.buttons.includes(pressedBtn)) {
          const mergedButtons = Array.from(new Set([...last.buttons, ...buttons]));
          const mergedNotation = `${last.notation}+${btnShort}`;
          const updated: ComboNote = {
            ...last,
            buttons: mergedButtons,
            notation: mergedNotation,
            moveName: `${mergedNotation} (${last.frame}f)`,
          };
          return [...prev.slice(0, -1), updated];
        }

        const idx = prev.length;
        const note: ComboNote = {
          id: `rec-${idx + 1}`,
          frame,
          buttons,
          ...(detectedMotion ? { motion: detectedMotion } : {}),
          notation,
          moveName: `${notation} (${frame}f)`,
          x: SLOTS_X[idx % SLOTS_X.length],
          y: 0.50,
        };
        return [...prev, note];
      });
    },
    []
  );

  const { activeButtons } = useInputEngine({
    mode,
    bindings,
    onActionPress: handleActionPress,
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
