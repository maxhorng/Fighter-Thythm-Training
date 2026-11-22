import React, { useState } from 'react';
import { Keyboard, Gamepad2, RotateCcw, X, Globe, Shield } from 'lucide-react';
import { ActionButtonId, ControlMode, KeyBindingMap } from '../types/combo';
import {
  BUTTON_META,
  DEFAULT_BINDINGS,
  formatGamepadButton,
  formatKeyCode,
  getButtonsForMode,
} from '../data/bindings';
import { AppLang, DEFAULT_OVERLAY_HOTKEYS, I18N, OverlayHotkeys } from '../data/i18n';
import { useInputEngine } from '../hooks/useInputEngine';

interface KeybindPanelProps {
  mode: ControlMode;
  bindings: KeyBindingMap;
  onChangeBindings: (next: KeyBindingMap) => void;
  lang: AppLang;
  onChangeLang: (next: AppLang) => void;
  overlayHotkeys: OverlayHotkeys;
  onChangeOverlayHotkeys: (next: OverlayHotkeys) => void;
  onClose: () => void;
}

type CaptureTarget =
  | { kind: 'action'; buttonId: ActionButtonId; device: 'keyboard' | 'gamepad' }
  | { kind: 'hotkey'; field: keyof OverlayHotkeys };

export const KeybindPanel: React.FC<KeybindPanelProps> = ({
  mode,
  bindings,
  onChangeBindings,
  lang,
  onChangeLang,
  overlayHotkeys,
  onChangeOverlayHotkeys,
  onClose,
}) => {
  const t = I18N[lang];
  const [capturing, setCapturing] = useState<CaptureTarget | null>(null);

  const buttons = getButtonsForMode(mode);

  const { activeButtons, gamepadName } = useInputEngine({
    mode,
    bindings,
    onRawKeyCapture:
      capturing && (capturing.kind === 'hotkey' || capturing.device === 'keyboard')
        ? (code) => {
            if (code !== 'Escape') {
              if (capturing.kind === 'hotkey') {
                onChangeOverlayHotkeys({
                  ...overlayHotkeys,
                  [capturing.field]: code,
                });
              } else {
                onChangeBindings({
                  ...bindings,
                  [capturing.buttonId]: {
                    ...bindings[capturing.buttonId],
                    keyboardCode: code,
                  },
                });
              }
            }
            setCapturing(null);
          }
        : undefined,
    onRawGamepadCapture:
      capturing?.kind === 'action' && capturing.device === 'gamepad'
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
            <h2>
              {t.settingsTitle} ({mode === 'classic' ? t.classicLabel : t.modernLabel})
            </h2>
            <p className="muted">
              {t.settingsSub} ·{' '}
              {gamepadName
                ? `${t.gamepadDetected}: ${gamepadName.slice(0, 36)}`
                : t.gamepadNotDetected}
            </p>
          </div>
          <div className="modal-header-actions">
            <button
              className="btn-secondary"
              onClick={() => {
                onChangeBindings({ ...DEFAULT_BINDINGS });
                onChangeOverlayHotkeys({ ...DEFAULT_OVERLAY_HOTKEYS });
              }}
              title={t.resetDefault}
            >
              <RotateCcw size={15} />
              {t.resetDefault}
            </button>
            <button className="btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Language & Global Overlay Hotkeys */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
              <Globe size={15} color="#38bdf8" />
              <span>{t.languageLabel}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn-secondary"
                style={
                  lang === 'zh-TW'
                    ? { background: 'rgba(56, 189, 248, 0.22)', borderColor: '#38bdf8', color: '#e0f2fe' }
                    : undefined
                }
                onClick={() => onChangeLang('zh-TW')}
              >
                繁體中文
              </button>
              <button
                className="btn-secondary"
                style={
                  lang === 'en'
                    ? { background: 'rgba(56, 189, 248, 0.22)', borderColor: '#38bdf8', color: '#e0f2fe' }
                    : undefined
                }
                onClick={() => onChangeLang('en')}
              >
                English
              </button>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(148, 163, 184, 0.16)',
              paddingTop: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>
              <Shield size={13} color="#a855f7" />
              <span>{t.globalHotkeysTitle}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="keybind-row" style={{ margin: 0 }}>
                <div className="keybind-label" style={{ fontSize: 12.5 }}>
                  <span>{t.clickThroughLabel}</span>
                </div>
                <button
                  className={`bind-chip ${capturing?.kind === 'hotkey' && capturing.field === 'clickThrough' ? 'capturing' : ''}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setCapturing({ kind: 'hotkey', field: 'clickThrough' });
                  }}
                >
                  <Keyboard size={13} />
                  {capturing?.kind === 'hotkey' && capturing.field === 'clickThrough'
                    ? t.pressAnyKey
                    : formatKeyCode(overlayHotkeys.clickThrough)}
                </button>
              </div>
              <div className="keybind-row" style={{ margin: 0 }}>
                <div className="keybind-label" style={{ fontSize: 12.5 }}>
                  <span>{t.exitOverlayLabel}</span>
                </div>
                <button
                  className={`bind-chip ${capturing?.kind === 'hotkey' && capturing.field === 'exitOverlay' ? 'capturing' : ''}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setCapturing({ kind: 'hotkey', field: 'exitOverlay' });
                  }}
                >
                  <Keyboard size={13} />
                  {capturing?.kind === 'hotkey' && capturing.field === 'exitOverlay'
                    ? t.pressAnyKey
                    : formatKeyCode(overlayHotkeys.exitOverlay)}
                </button>
              </div>
              <div className="keybind-row" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <div className="keybind-label" style={{ fontSize: 12.5 }}>
                  <span>{t.toggleReviewLabel}</span>
                </div>
                <button
                  className={`bind-chip ${capturing?.kind === 'hotkey' && capturing.field === 'toggleReview' ? 'capturing' : ''}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setCapturing({ kind: 'hotkey', field: 'toggleReview' });
                  }}
                >
                  <Keyboard size={13} />
                  {capturing?.kind === 'hotkey' && capturing.field === 'toggleReview'
                    ? t.pressAnyKey
                    : formatKeyCode(overlayHotkeys.toggleReview || 'F7')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="keybind-grid">
          {buttons.map((btnId) => {
            const meta = BUTTON_META[btnId];
            const bind = bindings[btnId];
            const isPressed = activeButtons.has(btnId);
            const isCapKb =
              capturing?.kind === 'action' && capturing.buttonId === btnId && capturing.device === 'keyboard';
            const isCapGp =
              capturing?.kind === 'action' && capturing.buttonId === btnId && capturing.device === 'gamepad';

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
                      setCapturing({ kind: 'action', buttonId: btnId, device: 'keyboard' });
                    }}
                  >
                    <Keyboard size={13} />
                    {isCapKb ? t.pressAnyKey : formatKeyCode(bind.keyboardCode)}
                  </button>

                  <button
                    className={`bind-chip ${isCapGp ? 'capturing' : ''}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setCapturing({ kind: 'action', buttonId: btnId, device: 'gamepad' });
                    }}
                  >
                    <Gamepad2 size={13} />
                    {isCapGp ? t.pressGamepad : formatGamepadButton(bind.gamepadButton)}
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
