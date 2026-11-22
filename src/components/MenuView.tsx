import React, { useMemo, useState } from 'react';
import {
  Play,
  Settings,
  Gamepad2,
  Keyboard,
  Minus,
  X,
  Sparkles,
  Zap,
  Timer,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  ComboData,
  ControlMode,
  KeyBindingMap,
  StartTriggerMode,
} from '../types/combo';
import { CHARACTERS } from '../data/combos';
import { BUTTON_META } from '../data/bindings';
import { KeybindPanel } from './KeybindPanel';
import { ImportComboModal } from './ImportComboModal';
import { useInputEngine } from '../hooks/useInputEngine';

interface MenuViewProps {
  mode: ControlMode;
  onChangeMode: (mode: ControlMode) => void;
  combos: ComboData[];
  customComboIds: Set<string>;
  selectedCombo: ComboData;
  onSelectCombo: (combo: ComboData) => void;
  onAddCombo: (combo: ComboData) => void;
  onDeleteCombo: (comboId: string) => void;
  bindings: KeyBindingMap;
  onChangeBindings: (next: KeyBindingMap) => void;
  triggerMode: StartTriggerMode;
  onChangeTriggerMode: (m: StartTriggerMode) => void;
  onStartOverlay: () => void;
  onStartRecording: (charId: string) => void;
}

export const MenuView: React.FC<MenuViewProps> = ({
  mode,
  onChangeMode,
  combos,
  customComboIds,
  selectedCombo,
  onSelectCombo,
  onAddCombo,
  onDeleteCombo,
  bindings,
  onChangeBindings,
  triggerMode,
  onChangeTriggerMode,
  onStartOverlay,
  onStartRecording,
}) => {
  const [selectedCharId, setSelectedCharId] = useState<string>(selectedCombo.characterId);
  const [showKeybinds, setShowKeybinds] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyJson = (e: React.MouseEvent, combo: ComboData) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(combo, null, 2)).then(() => {
      setCopiedId(combo.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const { activeButtons, gamepadName } = useInputEngine({
    mode,
    bindings,
  });

  const filteredCombos = useMemo(
    () => combos.filter((c) => c.mode === mode && c.characterId === selectedCharId),
    [combos, mode, selectedCharId]
  );

  const handleModeSwitch = (nextMode: ControlMode) => {
    onChangeMode(nextMode);
    const firstMatch =
      combos.find((c) => c.mode === nextMode && c.characterId === selectedCharId) ||
      combos.find((c) => c.mode === nextMode);
    if (firstMatch) {
      setSelectedCharId(firstMatch.characterId);
      onSelectCombo(firstMatch);
    }
  };

  const handleCharSelect = (charId: string) => {
    setSelectedCharId(charId);
    const firstMatch = combos.find((c) => c.mode === mode && c.characterId === charId);
    if (firstMatch) {
      onSelectCombo(firstMatch);
    }
  };

  return (
    <div className="menu-shell">
      {/* Custom Titlebar */}
      <header className="titlebar">
        <div className="titlebar-brand">
          <Sparkles size={18} className="brand-icon" />
          <span className="brand-title">FIGHTER MUSIC COMBO</span>
          <span className="brand-badge">SF6 OVERLAY PROTOTYPE</span>
        </div>

        <div className="titlebar-controls">
          <div className={`device-pill ${gamepadName ? 'connected' : ''}`}>
            {gamepadName ? <Gamepad2 size={14} /> : <Keyboard size={14} />}
            <span>{gamepadName ? '控制器已連線' : '鍵盤 / 待偵測手把'}</span>
          </div>
          <button
            className="btn-secondary"
            onClick={() => setShowKeybinds(true)}
          >
            <Settings size={15} />
            按鍵設定
          </button>
          <button
            className="win-btn"
            onClick={() => window.electronAPI?.minimizeWindow()}
            title="最小化"
          >
            <Minus size={15} />
          </button>
          <button
            className="win-btn close"
            onClick={() => window.electronAPI?.closeWindow()}
            title="關閉"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      <main className="menu-body">
        {/* Left Column: Control Mode + Character */}
        <section className="panel left-panel">
          <div className="section-label">1. 選擇操作模式</div>
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === 'classic' ? 'active classic' : ''}`}
              onClick={() => handleModeSwitch('classic')}
            >
              <span className="mode-tag">C</span>
              <div>
                <div className="mode-name">經典模式 Classic</div>
                <div className="mode-desc">方向 + 攻擊六鍵 (LP/MP/HP/LK/MK/HK)</div>
              </div>
            </button>
            <button
              className={`mode-btn ${mode === 'modern' ? 'active modern' : ''}`}
              onClick={() => handleModeSwitch('modern')}
            >
              <span className="mode-tag">M</span>
              <div>
                <div className="mode-name">現代模式 Modern</div>
                <div className="mode-desc">方向 + 輕/中/重 + SP + AUTO + Parry + DI</div>
              </div>
            </button>
          </div>

          <div className="section-label" style={{ marginTop: 20 }}>
            2. 選擇訓練角色（全 {CHARACTERS.length} 角色）
          </div>
          <div className="char-grid" style={{ maxHeight: 230, overflowY: 'auto', paddingRight: 4 }}>
            {CHARACTERS.map((char) => (
              <button
                key={char.id}
                className={`char-card ${selectedCharId === char.id ? 'selected' : ''}`}
                style={{ '--accent': char.accent } as React.CSSProperties}
                onClick={() => handleCharSelect(char.id)}
              >
                <div className="char-name">{char.name}</div>
                <div className="char-title">{char.title}</div>
              </button>
            ))}
          </div>

          {/* Live Input Tester */}
          <div className="live-input-box">
            <div className="section-label" style={{ marginBottom: 8 }}>
              即時輸入測試
            </div>
            <div className="live-pills">
              {activeButtons.size === 0 ? (
                <span className="muted">按下鍵盤或搖桿測試按鍵...</span>
              ) : (
                Array.from(activeButtons).map((btnId) => (
                  <span
                    key={btnId}
                    className="live-pill"
                    style={{ backgroundColor: BUTTON_META[btnId].color }}
                  >
                    {BUTTON_META[btnId].shortLabel}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Combo List + Preview + Start */}
        <section className="panel right-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>3. 選擇連段譜面</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn-secondary"
                style={{ borderColor: 'rgba(244, 63, 94, 0.5)', color: '#fda4af' }}
                onClick={() => onStartRecording(selectedCharId)}
              >
                ● 錄製我的連段
              </button>
              <button className="btn-secondary" onClick={() => setShowImport(true)}>
                <Plus size={14} /> 匯入 / 指令轉譜面
              </button>
            </div>
          </div>
          <div className="combo-list">
            {filteredCombos.length === 0 ? (
              <div
                style={{
                  padding: '28px 16px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  border: '1px dashed rgba(148, 163, 184, 0.25)',
                  borderRadius: 12,
                  fontSize: 13,
                }}
              >
                此角色目前尚未有連段，點上方「● 錄製我的連段」或「+ 匯入 / 指令轉譜面」即可新增。
              </div>
            ) : (
              filteredCombos.map((combo) => (
              <div
                key={combo.id}
                className={`combo-card ${selectedCombo.id === combo.id ? 'selected' : ''}`}
                onClick={() => onSelectCombo(combo)}
              >
                <div className="combo-card-top">
                  <div className="combo-title">{combo.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={(e) => handleCopyJson(e, combo)}
                    >
                      {copiedId === combo.id ? '已複製!' : '複製 JSON'}
                    </button>
                    {customComboIds.has(combo.id) && (
                      <button
                        className="btn-secondary"
                        style={{
                          padding: '2px 7px',
                          fontSize: 11,
                          borderColor: 'rgba(244, 63, 94, 0.45)',
                          color: '#fda4af',
                        }}
                        title="刪除此自訂/實錄連段"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCombo(combo.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    <span className={`diff-badge ${combo.difficulty.toLowerCase()}`}>
                      {combo.difficulty}
                    </span>
                  </div>
                </div>
                <p className="combo-desc">{combo.description}</p>
                <div className="combo-steps">
                  {combo.notes.map((n, idx) => (
                    <React.Fragment key={n.id}>
                      <span className="step-chip">
                        <strong>{n.notation}</strong>
                        <small>{n.frame}f</small>
                      </span>
                      {idx < combo.notes.length - 1 && <span className="step-arrow">→</span>}
                    </React.Fragment>
                  ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Trigger Mode & Launch */}
          <div className="launch-footer">
            <div className="trigger-row">
              <button
                className={`trigger-btn ${triggerMode === 'trigger-first' ? 'active' : ''}`}
                onClick={() => onChangeTriggerMode('trigger-first')}
              >
                <Zap size={15} />
                <div>
                  <div className="t-title">第一擊觸發啟動（推薦）</div>
                  <div className="t-sub">按下第一招瞬間開始後續 Osu 節拍</div>
                </div>
              </button>
              <button
                className={`trigger-btn ${triggerMode === 'countdown' ? 'active' : ''}`}
                onClick={() => onChangeTriggerMode('countdown')}
              >
                <Timer size={15} />
                <div>
                  <div className="t-title">倒數循環模式</div>
                  <div className="t-sub">自動倒數並循環播放節奏圓圈</div>
                </div>
              </button>
            </div>

            <button className="btn-start-overlay" onClick={onStartOverlay}>
              <Play size={20} fill="currentColor" />
              <span>開始透明覆蓋訓練模式 (Overlay)</span>
            </button>
            <div className="hotkey-hint">
              進入透明模式後：<code>F8</code> 重來 · <code>F9</code> 切換滑鼠穿透 · <code>F10</code> 返回選單
            </div>
          </div>
        </section>
      </main>

      {showKeybinds && (
        <KeybindPanel
          mode={mode}
          bindings={bindings}
          onChangeBindings={onChangeBindings}
          onClose={() => setShowKeybinds(false)}
        />
      )}

      {showImport && (
        <ImportComboModal
          mode={mode}
          characterId={selectedCharId}
          onImport={onAddCombo}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
};
