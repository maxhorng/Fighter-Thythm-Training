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
  Wrench,
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
import { AppLang, getCharacterSubName, getComboTitle, I18N, OverlayHotkeys, translateTag } from '../data/i18n';
import { KeybindPanel } from './KeybindPanel';
import { ImportComboModal } from './ImportComboModal';
import { TutorialModal } from './TutorialModal';
import { useInputEngine } from '../hooks/useInputEngine';
import pkg from '../../package.json';

const STORAGE_KEY_SEEN_TUTORIAL = 'fmc_seen_tutorial_v1';
const STORAGE_KEY_PINNED_CHARS = 'fmc_pinned_chars_v1';
const CURRENT_VERSION_TAG = `v${pkg.version}`;
const RELEASES_LATEST_URL = 'https://github.com/maxhorng/Frame-Beat-Trainer/releases/latest';

interface MenuViewProps {
  mode: ControlMode;
  onChangeMode: (mode: ControlMode) => void;
  onBackToGames?: () => void;
  combos: ComboData[];
  customComboIds: Set<string>;
  selectedCombo: ComboData;
  onSelectCombo: (combo: ComboData) => void;
  onAddCombo: (combo: ComboData) => void;
  onDeleteCombo: (comboId: string) => void;
  onUpdateCombo: (combo: ComboData) => void;
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
  onBackToGames,
  combos,
  customComboIds,
  selectedCombo,
  onSelectCombo,
  onAddCombo,
  onDeleteCombo,
  onUpdateCombo,
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
  const [charSearch, setCharSearch] = useState('');
  const [pinnedChars, setPinnedChars] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PINNED_CHARS);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // ignore
    }
    return new Set();
  });
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | ComboData['difficulty']>('ALL');
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'midscreen' | 'corner'>('ALL');
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
  const [editingCombo, setEditingCombo] = useState<ComboData | null>(null);
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState<'midscreen' | 'corner'>('midscreen');
  const [editTags, setEditTags] = useState('');
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [latestReleaseTag, setLatestReleaseTag] = useState<string | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('https://api.github.com/repos/maxhorng/Frame-Beat-Trainer/releases/latest', {
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

  const togglePinChar = (e: React.MouseEvent, charId: string) => {
    e.stopPropagation();
    setPinnedChars((prev) => {
      const next = new Set(prev);
      if (next.has(charId)) {
        next.delete(charId);
      } else {
        next.add(charId);
      }
      try {
        localStorage.setItem(STORAGE_KEY_PINNED_CHARS, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const filteredCharacters = useMemo(() => {
    const q = charSearch.trim().toLowerCase();
    const list = !q
      ? CHARACTERS
      : CHARACTERS.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q) ||
            getCharacterSubName(c.id, c.title, lang).toLowerCase().includes(q)
        );
    return [...list].sort((a, b) => {
      const pa = pinnedChars.has(a.id) ? 0 : 1;
      const pb = pinnedChars.has(b.id) ? 0 : 1;
      return pa - pb;
    });
  }, [charSearch, pinnedChars]);

  const isCornerCombo = (c: ComboData): boolean => {
    if (c.position === 'corner') return true;
    if (c.position === 'midscreen') return false;
    return /角落|corner|版邊/i.test(c.title) || c.tags.some((tg) => /角落|corner/i.test(tg));
  };

  const filteredCombos = useMemo(
    () =>
      combos.filter((c) => {
        if (c.mode !== mode || c.characterId !== selectedCharId) return false;
        if (difficultyFilter !== 'ALL' && c.difficulty !== difficultyFilter) return false;
        if (positionFilter === 'corner' && !isCornerCombo(c)) return false;
        if (positionFilter === 'midscreen' && isCornerCombo(c)) return false;
        return true;
      }),
    [combos, mode, selectedCharId, difficultyFilter, positionFilter]
  );

  const openEditModal = (e: React.MouseEvent, combo: ComboData) => {
    e.stopPropagation();
    const pos: 'midscreen' | 'corner' = isCornerCombo(combo) ? 'corner' : 'midscreen';
    // Strip leading [角落] and characterName, and trailing (N 擊 · Xf) so user only edits the middle name
    let middle = combo.title
      .replace(/^\[角落\]\s*/, '')
      .replace(new RegExp(`^${combo.characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '')
      .replace(/\s*\(\d+\s*擊\s*·\s*\d+f\)\s*$/, '')
      .trim();
    if (!middle) middle = '實錄連段';
    setEditName(middle);
    setEditPosition(pos);
    setEditTags(
      combo.tags
        .filter((tg) => !/^(角落|角落限定|非角落|實機錄製|60fps原味)$/i.test(tg))
        .join(', ')
    );
    setEditingCombo(combo);
  };

  const saveEditModal = () => {
    if (!editingCombo) return;
    const cleanName = editName.trim() || '實錄連段';
    const hits = editingCombo.notes.length;
    const lastFrame = editingCombo.notes[hits - 1]?.frame ?? 0;
    const newTitle = `${editPosition === 'corner' ? '[角落] ' : ''}${editingCombo.characterName} ${cleanName} (${hits} 擊 · ${lastFrame}f)`;
    const parsedTags = editTags
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const posTag = editPosition === 'corner' ? '角落' : '非角落';
    const nextTags = Array.from(new Set([posTag, ...parsedTags]));
    onUpdateCombo({
      ...editingCombo,
      title: newTitle,
      position: editPosition,
      tags: nextTags,
    });
    setEditingCombo(null);
  };

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
          {onBackToGames && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onBackToGames}
              style={{
                padding: '3px 9px',
                fontSize: 11.5,
                fontWeight: 700,
                marginRight: 4,
                WebkitAppRegion: 'no-drag',
              } as React.CSSProperties}
              title={
                lang === 'en'
                  ? 'Back to Game List'
                  : lang === 'ja'
                  ? 'ゲーム一覧へ戻る'
                  : lang === 'ko'
                  ? '게임 목록으로'
                  : lang === 'zh-CN'
                  ? '返回游戏列表'
                  : '返回遊戲列表'
              }
            >
              {lang === 'en'
                ? '← Games'
                : lang === 'ja'
                ? '← ゲーム選択'
                : lang === 'ko'
                ? '← 게임 목록'
                : lang === 'zh-CN'
                ? '← 切换游戏'
                : '← 切換遊戲'}
            </button>
          )}
          <img
            src="./icon.png"
            alt="Frame Beat Trainer (FBT)"
            style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }}
          />
          <span className="brand-title">FRAME BEAT TRAINER (FBT)</span>
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
            {t.guideBtn}
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
              {t.downloadUpdateBtn}
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
                <div className="mode-name">{t.classicLabel}</div>
                <div className="mode-desc">{t.classicSub}</div>
              </div>
            </button>
            <button
              className={`mode-btn ${mode === 'modern' ? 'active modern' : ''}`}
              onClick={() => handleModeSwitch('modern')}
            >
              <span className="mode-tag">M</span>
              <div>
                <div className="mode-name">{t.modernLabel}</div>
                <div className="mode-desc">{t.modernSub}</div>
              </div>
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 14,
              marginBottom: 8,
            }}
          >
            <div className="section-label" style={{ marginBottom: 0 }}>
              {t.step2Title} ({filteredCharacters.length}/{CHARACTERS.length})
            </div>
            <div style={{ position: 'relative', width: 148 }}>
              <input
                type="text"
                value={charSearch}
                onChange={(e) => setCharSearch(e.target.value)}
                placeholder={t.searchFighterPlaceholder}
                style={{
                  width: '100%',
                  padding: '4px 22px 4px 8px',
                  fontSize: 12,
                  borderRadius: 7,
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  color: '#f8fafc',
                  outline: 'none',
                }}
              />
              {charSearch && (
                <button
                  type="button"
                  onClick={() => setCharSearch('')}
                  style={{
                    position: 'absolute',
                    right: 4,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 13,
                    lineHeight: 1,
                    padding: '0 3px',
                  }}
                  title="清除"
                >
                  ×
                </button>
              )}
            </div>
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
            {filteredCharacters.map((char) => {
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
                    {getCharacterSubName(char.id, char.title, lang) && (
                      <div
                        className="char-title"
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontSize: 10.5,
                        }}
                      >
                        {getCharacterSubName(char.id, char.title, lang)}
                      </div>
                    )}
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
                  <span
                    role="button"
                    tabIndex={0}
                    title={
                      pinnedChars.has(char.id)
                        ? lang === 'en'
                          ? 'Unpin character'
                          : '取消釘選角色'
                        : lang === 'en'
                        ? 'Pin favorite character'
                        : '釘選最愛角色'
                    }
                    onClick={(e) => togglePinChar(e, char.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        togglePinChar(e as unknown as React.MouseEvent, char.id);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      bottom: 3,
                      right: 5,
                      fontSize: 13,
                      lineHeight: 1,
                      padding: '2px',
                      cursor: 'pointer',
                      color: pinnedChars.has(char.id) ? '#facc15' : 'rgba(148, 163, 184, 0.45)',
                      textShadow: pinnedChars.has(char.id) ? '0 0 8px rgba(250, 204, 21, 0.65)' : undefined,
                      transition: 'color 0.12s ease',
                    }}
                  >
                    {pinnedChars.has(char.id) ? '★' : '☆'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Live Input Tester */}
          <div className="live-input-box">
            <div className="section-label" style={{ marginBottom: 8 }}>
              {t.liveInputTitle}
            </div>
            <div className="live-pills">
              {activeButtons.size === 0 ? (
                <span className="muted">{t.liveInputIdle}</span>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginBottom: 8 }}>
            {(
              [
                { id: 'ALL', label: t.filterAll, color: '#38bdf8' },
                { id: 'Beginner', label: t.filterEasy, color: '#4ade80' },
                { id: 'Intermediate', label: t.filterMedium, color: '#facc15' },
                { id: 'Advanced', label: t.filterHard, color: '#fb7185' },
                { id: 'Ultra Hard', label: 'Ultra Hard', color: '#c084fc' },
              ] as const
            ).map((opt) => {
              const active = difficultyFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDifficultyFilter(opt.id)}
                  style={{
                    padding: '3px 9px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    borderRadius: 999,
                    cursor: 'pointer',
                    border: active
                      ? `1px solid ${opt.color}`
                      : '1px solid rgba(148, 163, 184, 0.28)',
                    background: active ? `${opt.color}28` : 'rgba(15, 23, 42, 0.65)',
                    color: active ? opt.color : '#cbd5e1',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
            <span style={{ color: 'rgba(148, 163, 184, 0.35)', margin: '0 2px' }}>|</span>
            {(
              [
                { id: 'ALL', label: lang === 'en' ? 'Any Pos' : lang === 'ja' ? '位置すべて' : lang === 'ko' ? '전체 위치' : '全部位置', color: '#94a3b8' },
                { id: 'midscreen', label: lang === 'en' ? 'Midscreen' : lang === 'ja' ? '中央' : lang === 'ko' ? '중앙' : '非角落', color: '#2dd4bf' },
                { id: 'corner', label: lang === 'en' ? 'Corner' : lang === 'ja' ? '画面端' : lang === 'ko' ? '구석' : '角落', color: '#fb923c' },
              ] as const
            ).map((opt) => {
              const active = positionFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPositionFilter(opt.id)}
                  style={{
                    padding: '3px 9px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    borderRadius: 999,
                    cursor: 'pointer',
                    border: active
                      ? `1px solid ${opt.color}`
                      : '1px solid rgba(148, 163, 184, 0.28)',
                    background: active ? `${opt.color}28` : 'rgba(15, 23, 42, 0.65)',
                    color: active ? opt.color : '#cbd5e1',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
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
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: isCornerCombo(combo) ? 'rgba(251, 146, 60, 0.2)' : 'rgba(45, 212, 191, 0.16)',
                        color: isCornerCombo(combo) ? '#fdba74' : '#5eead4',
                        border: isCornerCombo(combo)
                          ? '1px solid rgba(251, 146, 60, 0.55)'
                          : '1px solid rgba(45, 212, 191, 0.45)',
                      }}
                    >
                      {isCornerCombo(combo)
                        ? lang === 'en'
                          ? 'Corner'
                          : lang === 'ja'
                          ? '画面端'
                          : lang === 'ko'
                          ? '구석'
                          : '角落'
                        : lang === 'en'
                        ? 'Mid'
                        : lang === 'ja'
                        ? '中央'
                        : lang === 'ko'
                        ? '중앙'
                        : '非角落'}
                    </span>
                    <div className="combo-title">{getComboTitle(combo, lang)}</div>
                    {combo.tags
                      .filter((tg) => !/^(角落|角落限定|非角落|實機錄製|60fps原味)$/i.test(tg))
                      .slice(0, 3)
                      .map((tg) => (
                        <span
                          key={tg}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 999,
                            background: 'rgba(148, 163, 184, 0.16)',
                            color: '#cbd5e1',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                          }}
                        >
                          #{translateTag(tg, lang)}
                        </span>
                      ))}
                  </div>
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
                          {t.exportBtn}
                        </button>
                      </>
                    )}
                    {customComboIds.has(combo.id) && (
                      <>
                        <button
                          className="btn-secondary"
                          style={{
                            padding: '2px 7px',
                            fontSize: 11,
                            borderColor: 'rgba(56, 189, 248, 0.45)',
                            color: '#7dd3fc',
                          }}
                          title={lang === 'en' ? 'Edit combo name & tags' : '編輯連段名稱與標籤'}
                          onClick={(e) => openEditModal(e, combo)}
                        >
                          <Wrench size={12} />
                        </button>
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
                      </>
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
                  <div className="t-title">{t.triggerFirstTitle}</div>
                  <div className="t-sub">{t.triggerFirstSub}</div>
                </div>
              </button>
              <button
                className={`trigger-btn ${triggerMode === 'countdown' ? 'active' : ''}`}
                onClick={() => onChangeTriggerMode('countdown')}
              >
                <Timer size={15} />
                <div>
                  <div className="t-title">{t.triggerCountdownTitle}</div>
                  <div className="t-sub">{t.triggerCountdownSub}</div>
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
                {t.sideLabel}
              </span>
              <button
                type="button"
                className={`trigger-btn ${playerSide === 'left' ? 'active' : ''}`}
                style={{ flex: 1, padding: '6px 10px', justifyContent: 'center' }}
                onClick={() => onChangePlayerSide('left')}
              >
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>
                  {t.sideLeft}
                </span>
              </button>
              <button
                type="button"
                className={`trigger-btn ${playerSide === 'right' ? 'active' : ''}`}
                style={{ flex: 1, padding: '6px 10px', justifyContent: 'center' }}
                onClick={() => onChangePlayerSide('right')}
              >
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>
                  {t.sideRight}
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

      {editingCombo && (
        <div
          className="modal-backdrop"
          onClick={() => setEditingCombo(null)}
          style={{ zIndex: 60 }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(420px, 92vw)', padding: '18px 20px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                <Wrench size={16} color="#38bdf8" />
                <span>{lang === 'en' ? 'Edit Custom Combo' : '編輯自訂連段'}</span>
              </div>
              <button className="btn-icon" onClick={() => setEditingCombo(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>
                  {lang === 'en' ? 'Combo Name (Character prefix preserved)' : '連段名稱（前面自動保留角色名）'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 800,
                      background: 'rgba(56, 189, 248, 0.16)',
                      color: '#7dd3fc',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {editingCombo.characterName}
                  </span>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={lang === 'en' ? 'e.g. Corner DR Punish' : '例如：確反綠衝'}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 8,
                      fontSize: 13,
                      border: '1px solid rgba(148, 163, 184, 0.35)',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#f8fafc',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>
                  {lang === 'en' ? 'Position' : '角落分類'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className={`trigger-btn ${editPosition === 'midscreen' ? 'active' : ''}`}
                    style={{ flex: 1, padding: '7px 10px', justifyContent: 'center' }}
                    onClick={() => setEditPosition('midscreen')}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 800 }}>
                      {lang === 'en' ? 'Midscreen' : '非角落'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`trigger-btn ${editPosition === 'corner' ? 'active' : ''}`}
                    style={{ flex: 1, padding: '7px 10px', justifyContent: 'center' }}
                    onClick={() => setEditPosition('corner')}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 800 }}>
                      {lang === 'en' ? 'Corner' : '角落'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>
                  {lang === 'en' ? 'Custom Tags (comma separated)' : '自訂標籤（逗號分隔，可留空）'}
                </div>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder={lang === 'en' ? 'e.g. Punish, Safe Jump' : '例如：確反, 安全跳, 高傷害'}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 8,
                    fontSize: 13,
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#f8fafc',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn-secondary" onClick={() => setEditingCombo(null)}>
                  {lang === 'en' ? 'Cancel' : '取消'}
                </button>
                <button
                  className="btn-secondary"
                  style={{
                    background: 'rgba(56, 189, 248, 0.24)',
                    borderColor: '#38bdf8',
                    color: '#e0f2fe',
                    fontWeight: 800,
                  }}
                  onClick={saveEditModal}
                >
                  {lang === 'en' ? 'Save' : '儲存'}
                </button>
              </div>
            </div>
          </div>
        </div>
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
      {/* Bottom-right visible resize grip triangle */}
      <div
        title={lang === 'en' ? 'Drag to resize window' : '拖曳調整視窗大小'}
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.screenX;
          const startY = e.screenY;
          const startW = window.outerWidth;
          const startH = window.outerHeight;
          const onMove = (ev: MouseEvent) => {
            window.electronAPI?.resizeWindow?.(
              startW + (ev.screenX - startX),
              startH + (ev.screenY - startY)
            );
          };
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
        style={{
          position: 'fixed',
          right: 4,
          bottom: 4,
          width: 20,
          height: 20,
          cursor: 'nwse-resize',
          zIndex: 50,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          padding: 2,
          userSelect: 'none',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M13 3L3 13" stroke="rgba(148, 163, 184, 0.7)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M13 7.5L7.5 13" stroke="rgba(56, 189, 248, 0.85)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M13 11.5L11.5 13" stroke="rgba(56, 189, 248, 0.95)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};
