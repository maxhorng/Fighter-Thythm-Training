import React, { useEffect, useMemo, useState } from 'react';
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
  HelpCircle,
  Download,
} from 'lucide-react';
import {
  ComboData,
  ControlMode,
  KeyBindingMap,
  PlayerSide,
  StartTriggerMode,
} from '../types/combo';
import { CHARACTERS } from '../data/combos';
import { BUTTON_META, formatKeyCode } from '../data/bindings';
import { AppLang, getComboTitle, I18N, OverlayHotkeys } from '../data/i18n';
import { KeybindPanel } from './KeybindPanel';
import { ImportComboModal } from './ImportComboModal';
import { TutorialModal } from './TutorialModal';
import { useInputEngine } from '../hooks/useInputEngine';
import pkg from '../../package.json';

const STORAGE_KEY_SEEN_TUTORIAL = 'fmc_seen_tutorial_v1';
const CURRENT_VERSION_TAG = `v${pkg.version}`;
const RELEASES_LATEST_URL = 'https://github.com/maxhorng/Rhythm-Combo-Trainer/releases/latest';

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
  lang: AppLang;
  onChangeLang: (next: AppLang) => void;
  overlayHotkeys: OverlayHotkeys;
  onChangeOverlayHotkeys: (next: OverlayHotkeys) => void;
  triggerMode: StartTriggerMode;
  onChangeTriggerMode: (m: StartTriggerMode) => void;
  playerSide: PlayerSide;
  onChangePlayerSide: (side: PlayerSide) => void;
  showRecordedInputs: boolean;
  onChangeShowRecordedInputs: (v: boolean) => void;
  lowPerfMode: boolean;
  onChangeLowPerfMode: (v: boolean) => void;
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
  lang,
  onChangeLang,
  overlayHotkeys,
  onChangeOverlayHotkeys,
  triggerMode,
  onChangeTriggerMode,
  playerSide,
  onChangePlayerSide,
  showRecordedInputs,
  onChangeShowRecordedInputs,
  lowPerfMode,
  onChangeLowPerfMode,
  onStartOverlay,
  onStartRecording,
}) => {
  const t = I18N[lang];
  const [selectedCharId, setSelectedCharId] = useState<string>(selectedCombo.characterId);
  const [showKeybinds, setShowKeybinds] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_SEEN_TUTORIAL) !== '1';
    } catch {
      return true;
    }
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [latestReleaseTag, setLatestReleaseTag] = useState<string | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('https://api.github.com/repos/maxhorng/Rhythm-Combo-Trainer/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.tag_name === 'string' && data.tag_name !== CURRENT_VERSION_TAG) {
          setLatestReleaseTag(data.tag_name);
        }
      })
      .catch(() => {
        // Offline or rate-limited — fail silently
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopyJson = (e: React.MouseEvent, combo: ComboData) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(combo, null, 2)).then(() => {
      setCopiedId(combo.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const handleExportJson = (e: React.MouseEvent, combo: ComboData) => {
    e.stopPropagation();
    const safeTitle = combo.title.replace(/[\\/:*?"<>|]/g, '_');
    const filename = `${combo.characterId}-${combo.mode}-${safeTitle}.json`;
    const blob = new Blob([JSON.stringify(combo, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
          <img
            src="./icon.png"
            alt="RhythmCombo Trainer"
            style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }}
          />
          <span className="brand-title">RHYTHMCOMBO TRAINER</span>
          <span className="brand-badge">{t.betaBadge}</span>
          <span style={{ fontSize: 11.5, color: '#94a3b8', marginLeft: 4 }}>
            by maxhorng / 92anini
          </span>
        </div>

        <div className="titlebar-controls">
          <div className={`device-pill ${gamepadName ? 'connected' : ''}`}>
            {gamepadName ? <Gamepad2 size={14} /> : <Keyboard size={14} />}
            <span>
              {gamepadName
                ? lang === 'en'
                  ? 'Controller Connected'
                  : '控制器已連線'
                : lang === 'en'
                ? 'Keyboard / Waiting Pad'
                : '鍵盤 / 待偵測手把'}
            </span>
          </div>
          <button
            className="btn-secondary"
            onClick={() => setShowTutorial(true)}
          >
            <HelpCircle size={15} />
            {lang === 'en' ? 'Guide' : '使用教學'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowKeybinds(true)}
          >
            <Settings size={15} />
            {t.keybindBtn}
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

      {latestReleaseTag && !updateDismissed && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '7px 16px',
            background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.22), rgba(168, 85, 247, 0.22))',
            borderBottom: '1px solid rgba(56, 189, 248, 0.45)',
            fontSize: 12.5,
            color: '#e0f2fe',
          }}
        >
          <span>
            {lang === 'en'
              ? `New version ${latestReleaseTag} is available! (Current: ${CURRENT_VERSION_TAG})`
              : `發現新版本 ${latestReleaseTag}！（目前版本：${CURRENT_VERSION_TAG}）`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn-secondary"
              style={{
                padding: '3px 10px',
                fontSize: 11.5,
                background: 'rgba(56, 189, 248, 0.28)',
                borderColor: '#38bdf8',
                color: '#ffffff',
                fontWeight: 800,
              }}
              onClick={() => window.open(RELEASES_LATEST_URL, '_blank')}
            >
              <Download size={12} />
              {lang === 'en' ? 'Download Update' : '前往下載新版'}
            </button>
            <button
              className="btn-icon"
              style={{ width: 22, height: 22 }}
              onClick={() => setUpdateDismissed(true)}
              title={lang === 'en' ? 'Dismiss' : '關閉提示'}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

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

          <div className="section-label" style={{ marginTop: 14 }}>
            {t.step2Title} ({CHARACTERS.length})
          </div>
          <div
            className="char-grid"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              paddingRight: 4,
              alignContent: 'start',
              gridAutoRows: 'minmax(54px, auto)',
              gap: 8,
            }}
          >
            {CHARACTERS.map((char) => {
              const isSelected = selectedCharId === char.id;
              const comboCount = combos.filter(
                (c) => c.mode === mode && c.characterId === char.id
              ).length;
              const initials = char.name
                .replace(/[^A-Za-z0-9 ]/g, ' ')
                .trim()
                .split(/\s+/)
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || char.name.slice(0, 2).toUpperCase();

              return (
                <button
                  key={char.id}
                  className={`char-card ${isSelected ? 'selected' : ''}`}
                  style={{
                    '--accent': char.accent,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 10px',
                    minHeight: 54,
                    position: 'relative',
                    overflow: 'hidden',
                    background: isSelected
                      ? `linear-gradient(135deg, ${char.accent}42 0%, rgba(15, 23, 42, 0.94) 72%)`
                      : `linear-gradient(135deg, ${char.accent}1c 0%, rgba(15, 23, 42, 0.88) 72%)`,
                    borderLeft: `3px solid ${char.accent}`,
                    boxShadow: isSelected ? `0 0 14px ${char.accent}55` : undefined,
                  } as React.CSSProperties}
                  onClick={() => handleCharSelect(char.id)}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontStyle: 'italic',
                      fontSize: 13,
                      letterSpacing: '0.03em',
                      color: '#fff',
                      background: `linear-gradient(135deg, ${char.accent}dd, ${char.accent}55)`,
                      border: `1.5px solid ${isSelected ? '#fff' : `${char.accent}aa`}`,
                      boxShadow: `0 2px 8px ${char.accent}44`,
                      textShadow: '0 1px 3px rgba(0,0,0,0.65)',
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <div
                      className="char-name"
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: 13,
                      }}
                    >
                      {char.name}
                    </div>
                    <div
                      className="char-title"
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: 10.5,
                      }}
                    >
                      {char.title}
                    </div>
                  </div>
                  {comboCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 5,
                        right: 6,
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: 999,
                        background: isSelected ? char.accent : `${char.accent}33`,
                        color: isSelected ? '#090d16' : '#f8fafc',
                        border: `1px solid ${char.accent}88`,
                      }}
                    >
                      {comboCount}
                    </span>
                  )}
                </button>
              );
            })}
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
            <div className="section-label" style={{ marginBottom: 0 }}>{t.step3Title}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn-secondary"
                style={{ borderColor: 'rgba(244, 63, 94, 0.5)', color: '#fda4af' }}
                onClick={() => onStartRecording(selectedCharId)}
              >
                {t.recordBtn}
              </button>
              <button className="btn-secondary" onClick={() => setShowImport(true)}>
                <Plus size={14} /> {t.importBtn}
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
              filteredCombos.map((combo) => {
                const isLocked = Boolean(combo.locked && !unlockedIds.has(combo.id));
                return (
              <div
                key={combo.id}
                className={`combo-card ${selectedCombo.id === combo.id ? 'selected' : ''}`}
                style={isLocked ? { opacity: 0.62, borderStyle: 'dashed', borderColor: 'rgba(250, 204, 21, 0.45)' } : undefined}
                onClick={() => {
                  if (!isLocked) onSelectCombo(combo);
                }}
              >
                <div className="combo-card-top">
                  <div className="combo-title">{getComboTitle(combo, lang)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isLocked ? (
                      <button
                        className="btn-secondary"
                        style={{
                          padding: '2px 9px',
                          fontSize: 11,
                          borderColor: 'rgba(250, 204, 21, 0.6)',
                          color: '#fde047',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setUnlockedIds((prev) => new Set(prev).add(combo.id));
                          onSelectCombo(combo);
                        }}
                      >
                        🔒 解鎖（後果自負）
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn-secondary"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={(e) => handleCopyJson(e, combo)}
                        >
                          {copiedId === combo.id ? t.copiedJson : t.copyJson}
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '2px 8px', fontSize: 11, borderColor: 'rgba(56, 189, 248, 0.45)', color: '#bae6fd' }}
                          title={lang === 'en' ? 'Export as .json file' : '匯出成 .json 檔案'}
                          onClick={(e) => handleExportJson(e, combo)}
                        >
                          <Download size={12} />
                          {lang === 'en' ? 'Export' : '匯出'}
                        </button>
                      </>
                    )}
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
                    <span
                      className={`diff-badge ${combo.difficulty === 'Ultra Hard' ? 'ultra' : combo.difficulty.toLowerCase()}`}
                      style={
                        combo.difficulty === 'Ultra Hard'
                          ? {
                              background: 'rgba(168, 85, 247, 0.24)',
                              color: '#e9d5ff',
                              border: '1px solid rgba(192, 132, 252, 0.75)',
                              boxShadow: '0 0 10px rgba(168, 85, 247, 0.35)',
                            }
                          : undefined
                      }
                    >
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
                );
              })
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

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                color: '#cbd5e1',
                cursor: 'pointer',
                marginBottom: 4,
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={showRecordedInputs}
                onChange={(e) => onChangeShowRecordedInputs(e.target.checked)}
                style={{ accentColor: '#38bdf8', width: 15, height: 15 }}
              />
              <span>{t.showRecordedInputs}</span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                color: lowPerfMode ? '#4ade80' : '#cbd5e1',
                cursor: 'pointer',
                marginBottom: 8,
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={lowPerfMode}
                onChange={(e) => onChangeLowPerfMode(e.target.checked)}
                style={{ accentColor: '#4ade80', width: 15, height: 15 }}
              />
              <span>{t.lowPerfMode}</span>
            </label>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginRight: 2 }}>
                {lang === 'en' ? 'Side:' : '站位方向：'}
              </span>
              <button
                type="button"
                className={`trigger-btn ${playerSide === 'left' ? 'active' : ''}`}
                style={{ flex: 1, padding: '6px 10px', justifyContent: 'center' }}
                onClick={() => onChangePlayerSide('left')}
              >
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>
                  {lang === 'en' ? '◀ 1P Left (Default)' : '◀ 1P 左側（預設）'}
                </span>
              </button>
              <button
                type="button"
                className={`trigger-btn ${playerSide === 'right' ? 'active' : ''}`}
                style={{ flex: 1, padding: '6px 10px', justifyContent: 'center' }}
                onClick={() => onChangePlayerSide('right')}
              >
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>
                  {lang === 'en' ? '2P Right (Mirrored) ▶' : '2P 右側（鏡像） ▶'}
                </span>
              </button>
            </div>

            <button className="btn-start-overlay" onClick={onStartOverlay}>
              <Play size={20} fill="currentColor" />
              <span>{t.startOverlayBtn}</span>
            </button>
            <div className="hotkey-hint">
              {t.hotkeyHintPrefix}
              <code>{formatKeyCode(bindings.RESET?.keyboardCode || 'F8')}</code> {t.hotkeyHintRestart} ·{' '}
              <code>{formatKeyCode(overlayHotkeys.clickThrough)}</code> {t.hotkeyHintClickThrough} ·{' '}
              <code>{formatKeyCode(overlayHotkeys.exitOverlay)}</code> {t.hotkeyHintExit}
            </div>
          </div>
        </section>
      </main>

      {showKeybinds && (
        <KeybindPanel
          mode={mode}
          bindings={bindings}
          onChangeBindings={onChangeBindings}
          lang={lang}
          onChangeLang={onChangeLang}
          overlayHotkeys={overlayHotkeys}
          onChangeOverlayHotkeys={onChangeOverlayHotkeys}
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

      {showTutorial && (
        <TutorialModal
          lang={lang}
          onChangeLang={onChangeLang}
          overlayHotkeys={overlayHotkeys}
          resetKeyCode={bindings.RESET?.keyboardCode || 'F8'}
          onClose={(dontShowAgain) => {
            if (dontShowAgain) {
              try {
                localStorage.setItem(STORAGE_KEY_SEEN_TUTORIAL, '1');
              } catch {
                // ignore
              }
            }
            setShowTutorial(false);
          }}
        />
      )}
    </div>
  );
};
