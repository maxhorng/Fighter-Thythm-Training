import React, { useState } from 'react';
import { Keyboard, Gamepad2, RotateCcw, X } from 'lucide-react';
import { ActionButtonId, ControlMode, KeyBindingMap } from '../types/combo';
import {
  BUTTON_META,
  DEFAULT_BINDINGS,
  formatGamepadButton,
  formatKeyCode,
  getButtonsForMode,
} from '../data/bindings';
import { useInputEngine } from '../hooks/useInputEngine';

interface KeybindPanelProps {
  mode: ControlMode;
  bindings: KeyBindingMap;
  onChangeBindings: (next: KeyBindingMap) => void;
  onClose: () => void;
}

export const KeybindPanel: React.FC<KeybindPanelProps> = ({
  mode,
  bindings,
  onChangeBindings,
  onClose,
}) => {
  const [capturing, setCapturing] = useState<{
    buttonId: ActionButtonId;
    device: 'keyboard' | 'gamepad';
  } | null>(null);

  const buttons = getButtonsForMode(mode);

  const { activeButtons, gamepadName } = useInputEngine({
    mode,
    bindings,
    onRawKeyCapture:
      capturing?.device === 'keyboard'
        ? (code) => {
            if (code !== 'Escape') {
              onChangeBindings({
                ...bindings,
                [capturing.buttonId]: {
                  ...bindings[capturing.buttonId],
                  keyboardCode: code,
                },
              });
            }
            setCapturing(null);
          }
        : undefined,
    onRawGamepadCapture:
      capturing?.device === 'gamepad'
        ? (btnIdx) => {
            onChangeBindings({
              ...bindings,
              [capturing.buttonId]: {
                ...bindings[capturing.buttonId],
                gamepadButton: btnIdx,
              },
            });
            setCapturing(null);
          }
        : undefined,
  });

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2>按鍵與控制器設定 ({mode === 'classic' ? '經典模式 Classic' : '現代模式 Modern'})</h2>
            <p className="muted">
              點擊右側欄位後按下任意鍵盤或手把按鈕即可綁定 ·{' '}
              {gamepadName ? `已偵測控制器: ${gamepadName.slice(0, 36)}` : '未偵測到控制器（可插上手把後按任意鍵喚醒）'}
            </p>
          </div>
          <div className="modal-header-actions">
            <button
              className="btn-secondary"
              onClick={() => onChangeBindings({ ...DEFAULT_BINDINGS })}
              title="還原預設按鍵"
            >
              <RotateCcw size={15} />
              還原預設
            </button>
            <button className="btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="keybind-grid">
          {buttons.map((btnId) => {
            const meta = BUTTON_META[btnId];
            const bind = bindings[btnId];
            const isPressed = activeButtons.has(btnId);
            const isCapKb = capturing?.buttonId === btnId && capturing.device === 'keyboard';
            const isCapGp = capturing?.buttonId === btnId && capturing.device === 'gamepad';

            return (
              <div
                key={btnId}
                className={`keybind-row ${isPressed ? 'pressed' : ''}`}
              >
                <div className="keybind-label">
                  <span
                    className="btn-dot"
                    style={{ backgroundColor: meta.color }}
                  >
                    {meta.shortLabel}
                  </span>
                  <span>{meta.label}</span>
                </div>

                <div className="keybind-inputs">
                  <button
                    className={`bind-chip ${isCapKb ? 'capturing' : ''}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setCapturing({ buttonId: btnId, device: 'keyboard' });
                    }}
                  >
                    <Keyboard size={13} />
                    {isCapKb ? '請按鍵盤...' : formatKeyCode(bind.keyboardCode)}
                  </button>

                  <button
                    className={`bind-chip ${isCapGp ? 'capturing' : ''}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setCapturing({ buttonId: btnId, device: 'gamepad' });
                    }}
                  >
                    <Gamepad2 size={13} />
                    {isCapGp ? '請按手把...' : formatGamepadButton(bind.gamepadButton)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
