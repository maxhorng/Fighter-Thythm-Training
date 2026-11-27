import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChartLayoutMode, ComboData, ControlMode, KeyBindingMap, PlayerSide, StartTriggerMode } from './types/combo';
import { BUILTIN_COMBOS } from './data/combos';
import { DEFAULT_BINDINGS } from './data/bindings';
import { AppLang, DEFAULT_OVERLAY_HOTKEYS, OverlayHotkeys } from './data/i18n';
import { MenuView } from './components/MenuView';
import { GameHubView } from './components/GameHubView';
import {
  clearCustomSfx,
  loadCustomSfxFromDataUrl,
  setEnabled as setSoundEnabled,
  setSfxPreset as setSoundPreset,
  setVolume as setSoundVolume,
  SfxPresetId,
} from './utils/soundEngine';
import { OverlayView } from './components/OverlayView';
import { RecordOverlayView } from './components/RecordOverlayView';
import { getOnlineApiBase } from './config/online';
import { downloadOnlineCombo, OnlineComboItem } from './utils/onlineApi';

const STORAGE_KEY_BINDINGS = 'fmc_bindings_v1';
const STORAGE_KEY_CUSTOM_COMBOS = 'fmc_custom_combos_v1';
const STORAGE_KEY_LANG = 'fmc_lang_v1';
const STORAGE_KEY_HOTKEYS = 'fmc_hotkeys_v1';
const STORAGE_KEY_LOW_PERF = 'fmc_low_perf_v1';
const STORAGE_KEY_SFX = 'fmc_sfx_enabled_v1';
const STORAGE_KEY_DYNAMIC_RESYNC = 'fmc_dynamic_resync_v1';

function loadDynamicResync(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_DYNAMIC_RESYNC) === '1';
  } catch {
    return false;
  }
}

function loadSfxEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_SFX) !== '0';
  } catch {
    return true;
  }
}

const STORAGE_KEY_APPROACH_FRAMES = 'fbt_approach_frames_v1';
const STORAGE_KEY_OVERLAY_OPACITY = 'fbt_overlay_opacity_v1';
const STORAGE_KEY_BUTTON_SCALE = 'fbt_button_scale_v1';
const STORAGE_KEY_SFX_VOLUME = 'fbt_sfx_volume_v1';
const STORAGE_KEY_SFX_PRESET = 'fbt_sfx_preset_v1';
const STORAGE_KEY_CUSTOM_SFX_NAME = 'fbt_custom_sfx_name_v1';
const STORAGE_KEY_CUSTOM_SFX_DATA = 'fbt_custom_sfx_data_v1';
const STORAGE_KEY_LAST_COMBO = 'fbt_last_combo_id_v1';

function loadSfxVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SFX_VOLUME);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 1) return Math.round(n * 20) / 20;
    }
  } catch {
    // ignore
  }
  return 0.7;
}

function loadSfxPreset(): SfxPresetId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SFX_PRESET);
    if (raw === 'default' || raw === 'woodblock' || raw === 'drum' || raw === 'bell' || raw === 'custom') {
      return raw;
    }
  } catch {
    // ignore
  }
  return 'default';
}

function loadCustomSfxName(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_CUSTOM_SFX_NAME);
  } catch {
    return null;
  }
}

function loadOverlayOpacity(): number {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY_OVERLAY_OPACITY));
    if (Number.isFinite(raw) && raw >= 0.3 && raw <= 1.0) return Math.round(raw * 20) / 20;
  } catch {
    // ignore
  }
  return 0.85;
}

function loadButtonScale(): number {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY_BUTTON_SCALE));
    if (Number.isFinite(raw) && raw >= 0.7 && raw <= 1.4) return Math.round(raw * 20) / 20;
  } catch {
    // ignore
  }
  return 1.0;
}

function getDefaultCombo(): ComboData {
  return (
    BUILTIN_COMBOS.find((c) => c.characterId === 'ryu' && c.mode === 'classic') ??
    BUILTIN_COMBOS[0]
  );
}

function loadInitialCombo(custom: ComboData[]): ComboData {
  try {
    const savedId = localStorage.getItem(STORAGE_KEY_LAST_COMBO);
    if (savedId) {
      const found = [...BUILTIN_COMBOS, ...custom].find((c) => c.id === savedId);
      if (found) return found;
    }
  } catch {
    // ignore
  }
  return getDefaultCombo();
}

function loadApproachFrames(): number {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY_APPROACH_FRAMES));
    if (Number.isFinite(raw) && raw >= 18 && raw <= 72) return Math.round(raw);
  } catch {
    // ignore
  }
  return 36;
}

function loadChartLayout(): ChartLayoutMode {
  try {
    const raw = localStorage.getItem('fbt_chart_layout_v1');
    if (raw === 'fixed' || raw === 'osu' || raw === 'focused') return raw;
  } catch {
    // ignore
  }
  return 'osu';
}

function loadLowPerfMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_LOW_PERF) !== '0';
  } catch {
    return true;
  }
}

function loadLang(): AppLang {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LANG);
    if (raw === 'zh-TW' || raw === 'zh-CN' || raw === 'en' || raw === 'ja' || raw === 'ko') {
      return raw;
    }
  } catch {
    // ignore
  }
  return 'zh-TW';
}

function loadHotkeys(): OverlayHotkeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HOTKEYS);
    if (raw) return { ...DEFAULT_OVERLAY_HOTKEYS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_OVERLAY_HOTKEYS };
}

function loadBindings(): KeyBindingMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BINDINGS);
    if (raw) {
      return { ...DEFAULT_BINDINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_BINDINGS };
}

function loadCustomCombos(): ComboData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_COMBOS);
    if (raw) return JSON.parse(raw) as ComboData[];
  } catch {
    // ignore
  }
  return [];
}

export const App: React.FC = () => {
  const [selectedGame, setSelectedGame] = useState<'sf6' | null>(null);
  const [customCombos, setCustomCombos] = useState<ComboData[]>(loadCustomCombos);
  const allCombos = [...BUILTIN_COMBOS, ...customCombos];
  const [selectedCombo, setSelectedCombo] = useState<ComboData>(() => loadInitialCombo(customCombos));
  const [mode, setMode] = useState<ControlMode>(() => selectedCombo.mode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_COMBO, selectedCombo.id);
    } catch {
      // ignore
    }
  }, [selectedCombo.id]);
  const [bindings, setBindings] = useState<KeyBindingMap>(loadBindings);
  const [lang, setLang] = useState<AppLang>(loadLang);
  const [overlayHotkeys, setOverlayHotkeys] = useState<OverlayHotkeys>(loadHotkeys);
  const [triggerMode, setTriggerMode] = useState<StartTriggerMode>('trigger-first');
  const [playerSide, setPlayerSide] = useState<PlayerSide>('left');
  const [showRecordedInputs, setShowRecordedInputs] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fbt_show_recorded_inputs_v1') !== '0';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('fbt_show_recorded_inputs_v1', showRecordedInputs ? '1' : '0');
    } catch {
      // ignore
    }
  }, [showRecordedInputs]);
  const [chartLayout, setChartLayout] = useState<ChartLayoutMode>(loadChartLayout);
  const [approachFrames, setApproachFrames] = useState<number>(loadApproachFrames);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(loadOverlayOpacity);
  const [buttonScale, setButtonScale] = useState<number>(loadButtonScale);
  const [lowPerfMode, setLowPerfMode] = useState<boolean>(loadLowPerfMode);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => {
    const v = loadSfxEnabled();
    setSoundEnabled(v);
    return v;
  });
  const [sfxVolume, setSfxVolume] = useState<number>(() => {
    const v = loadSfxVolume();
    setSoundVolume(v);
    return v;
  });
  const [sfxPreset, setSfxPreset] = useState<SfxPresetId>(() => {
    const p = loadSfxPreset();
    setSoundPreset(p);
    return p;
  });
  const [customSfxName, setCustomSfxName] = useState<string | null>(loadCustomSfxName);

  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY_CUSTOM_SFX_DATA);
      if (savedData) {
        loadCustomSfxFromDataUrl(savedData).catch(() => undefined);
      }
    } catch {
      // ignore
    }
  }, []);

  const [dynamicResync, setDynamicResync] = useState<boolean>(loadDynamicResync);
  const [isOverlayMode, setIsOverlayMode] = useState(false);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [recordingCharId, setRecordingCharId] = useState<string>('ryu');
  const [isClickThrough, setIsClickThrough] = useState(false);
  const recordedDraftRef = useRef<ComboData | null>(null);
  const isRecordingModeRef = useRef(false);
  isRecordingModeRef.current = isRecordingMode;

  const handleAddCombo = useCallback((combo: ComboData) => {
    setCustomCombos((prev) => {
      const idx = prev.findIndex((c) => c.id === combo.id);
      const next = idx >= 0 ? prev.map((c, i) => (i === idx ? combo : c)) : [...prev, combo];
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM_COMBOS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setSelectedCombo(combo);
  }, []);

  const handleDeleteCombo = useCallback((comboId: string) => {
    setCustomCombos((prev) => {
      const next = prev.filter((c) => c.id !== comboId);
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM_COMBOS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setSelectedCombo((curr) => (curr.id === comboId ? getDefaultCombo() : curr));
  }, []);

  const handleUpdateCombo = useCallback((updated: ComboData) => {
    setCustomCombos((prev) => {
      const next = prev.map((c) => (c.id === updated.id ? updated : c));
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM_COMBOS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setSelectedCombo((curr) => (curr.id === updated.id ? updated : curr));
  }, []);

  const commitRecordedDraftIfAny = useCallback(() => {
    if (isRecordingModeRef.current && recordedDraftRef.current) {
      const combo = recordedDraftRef.current;
      recordedDraftRef.current = null;
      handleAddCombo(combo);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(combo, null, 2)).catch(() => {});
      }
    }
    setIsRecordingMode(false);
  }, [handleAddCombo]);

  const handleChangeBindings = (next: KeyBindingMap) => {
    setBindings(next);
    try {
      localStorage.setItem(STORAGE_KEY_BINDINGS, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleChangeLang = (next: AppLang) => {
    setLang(next);
    try {
      localStorage.setItem(STORAGE_KEY_LANG, next);
    } catch {
      // ignore
    }
  };

  const handleChangeOverlayHotkeys = (next: OverlayHotkeys) => {
    setOverlayHotkeys(next);
    try {
      localStorage.setItem(STORAGE_KEY_HOTKEYS, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleChangeSfxEnabled = (next: boolean) => {
    setSfxEnabled(next);
    setSoundEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY_SFX, next ? '1' : '0');
    } catch {
      // ignore
    }
  };

  const handleChangeSfxVolume = (next: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(next * 20) / 20));
    setSfxVolume(clamped);
    setSoundVolume(clamped);
    try {
      localStorage.setItem(STORAGE_KEY_SFX_VOLUME, String(clamped));
    } catch {
      // ignore
    }
  };

  const handleChangeSfxPreset = (next: SfxPresetId) => {
    setSfxPreset(next);
    setSoundPreset(next);
    try {
      localStorage.setItem(STORAGE_KEY_SFX_PRESET, next);
    } catch {
      // ignore
    }
  };

  const handleSetCustomSfx = (name: string | null, dataUrl: string | null) => {
    setCustomSfxName(name);
    try {
      if (name && dataUrl) {
        localStorage.setItem(STORAGE_KEY_CUSTOM_SFX_NAME, name);
        localStorage.setItem(STORAGE_KEY_CUSTOM_SFX_DATA, dataUrl);
      } else {
        localStorage.removeItem(STORAGE_KEY_CUSTOM_SFX_NAME);
        localStorage.removeItem(STORAGE_KEY_CUSTOM_SFX_DATA);
        clearCustomSfx();
      }
    } catch {
      // ignore
    }
  };

  const handleChangeDynamicResync = (next: boolean) => {
    setDynamicResync(next);
    try {
      localStorage.setItem(STORAGE_KEY_DYNAMIC_RESYNC, next ? '1' : '0');
    } catch {
      // ignore
    }
  };

  const handleChangeChartLayout = (next: ChartLayoutMode) => {
    setChartLayout(next);
    try {
      localStorage.setItem('fbt_chart_layout_v1', next);
    } catch {
      // ignore
    }
  };

  const handleChangeApproachFrames = (next: number) => {
    setApproachFrames(next);
    try {
      localStorage.setItem(STORAGE_KEY_APPROACH_FRAMES, String(next));
    } catch {
      // ignore
    }
  };

  const handleChangeOverlayOpacity = (next: number) => {
    const clamped = Math.max(0.3, Math.min(1.0, Math.round(next * 20) / 20));
    setOverlayOpacity(clamped);
    try {
      localStorage.setItem(STORAGE_KEY_OVERLAY_OPACITY, String(clamped));
    } catch {
      // ignore
    }
  };

  const handleChangeButtonScale = (next: number) => {
    const clamped = Math.max(0.7, Math.min(1.4, Math.round(next * 20) / 20));
    setButtonScale(clamped);
    try {
      localStorage.setItem(STORAGE_KEY_BUTTON_SCALE, String(clamped));
    } catch {
      // ignore
    }
  };

  const handleChangeLowPerfMode = (next: boolean) => {
    setLowPerfMode(next);
    try {
      localStorage.setItem(STORAGE_KEY_LOW_PERF, next ? '1' : '0');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    window.electronAPI?.setHotkeys?.({
      clickThrough: overlayHotkeys.clickThrough,
      exitOverlay: overlayHotkeys.exitOverlay,
      toggleReview: overlayHotkeys.toggleReview,
      restart: bindings.RESET?.keyboardCode || 'F8',
    });
  }, [overlayHotkeys, bindings.RESET?.keyboardCode]);

  useEffect(() => {
    const unsubState = window.electronAPI?.onOverlayStateChanged((state) => {
      if (!state.isOverlayMode) {
        commitRecordedDraftIfAny();
      }
      setIsOverlayMode(state.isOverlayMode);
      setIsClickThrough(state.isClickThrough);
    });
    const unsubHotkey = window.electronAPI?.onHotkey((action) => {
      if (action === 'EXIT_OVERLAY') {
        commitRecordedDraftIfAny();
        setIsOverlayMode(false);
        setIsClickThrough(false);
      }
    });
    return () => {
      unsubState?.();
      unsubHotkey?.();
    };
  }, [commitRecordedDraftIfAny]);

  const handleStartOverlay = async () => {
    setIsRecordingMode(false);
    if (window.electronAPI) {
      const state = await window.electronAPI.setOverlayMode(true, lowPerfMode);
      setIsOverlayMode(state.isOverlayMode);
      setIsClickThrough(state.isClickThrough);
    } else {
      setIsOverlayMode(true);
      setIsClickThrough(false);
    }
  };

  const handleStartRecording = async (charId: string) => {
    setRecordingCharId(charId);
    setIsRecordingMode(true);
    if (window.electronAPI) {
      const state = await window.electronAPI.setOverlayMode(true, lowPerfMode);
      setIsOverlayMode(state.isOverlayMode);
      setIsClickThrough(state.isClickThrough);
    } else {
      setIsOverlayMode(true);
      setIsClickThrough(false);
    }
  };

  const handleExitOverlay = async () => {
    setIsRecordingMode(false);
    if (window.electronAPI) {
      const state = await window.electronAPI.setOverlayMode(false);
      setIsOverlayMode(state.isOverlayMode);
      setIsClickThrough(state.isClickThrough);
    } else {
      setIsOverlayMode(false);
      setIsClickThrough(false);
    }
  };

  const handleSyncDraft = useCallback((combo: ComboData | null) => {
    recordedDraftRef.current = combo;
  }, []);

  const handleFinishRecord = async (combo: ComboData | null) => {
    recordedDraftRef.current = combo;
    commitRecordedDraftIfAny();
    await handleExitOverlay();
  };

  const [deepLinkPrompt, setDeepLinkPrompt] = useState<{
    id: string;
    loading: boolean;
    downloading: boolean;
    error: string | null;
    item: OnlineComboItem | null;
  } | null>(null);

  const openDeepLinkCombo = useCallback(async (comboId: string) => {
    setSelectedGame('sf6');
    setDeepLinkPrompt({ id: comboId, loading: true, downloading: false, error: null, item: null });
    try {
      const base = getOnlineApiBase();
      const res = await fetch(`${base}/api/combos/${encodeURIComponent(comboId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw = data?.combo ?? data;
      if (!raw || !raw.id) throw new Error('Combo not found');
      const item: OnlineComboItem = {
        id: String(raw.id),
        characterId: String(raw.characterId ?? raw.character_id ?? 'ryu'),
        characterName: String(raw.characterName ?? raw.character_name ?? raw.character ?? 'SF6'),
        mode: raw.mode === 'modern' ? 'modern' : 'classic',
        difficulty: raw.difficulty ?? 'Intermediate',
        position: raw.position,
        title: String(raw.title ?? raw.id),
        titleEn: raw.titleEn ?? raw.title_en,
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        noteCount: Number(raw.noteCount ?? raw.note_count ?? 0),
        totalFrames: Number(raw.totalFrames ?? raw.total_frames ?? 0),
        likes: Number(raw.likes ?? 0),
        downloads: Number(raw.downloads ?? 0),
        author: String(raw.author ?? raw.author_name ?? 'Community'),
        authorId: raw.authorId ?? raw.author_id,
        createdAt: Number(raw.createdAt ?? raw.created_at ?? Date.now()),
        status: raw.status ?? 'approved',
      };
      setDeepLinkPrompt({ id: comboId, loading: false, downloading: false, error: null, item });
    } catch (err) {
      setDeepLinkPrompt({
        id: comboId,
        loading: false,
        downloading: false,
        error: err instanceof Error ? err.message : '無法讀取連段資訊',
        item: null,
      });
    }
  }, []);

  useEffect(() => {
    window.electronAPI?.consumeDeepLinkCombo?.().then((id) => {
      if (id) openDeepLinkCombo(id);
    });
    const unsub = window.electronAPI?.onDeepLinkCombo?.((id) => {
      if (id) openDeepLinkCombo(id);
    });
    return () => unsub?.();
  }, [openDeepLinkCombo]);

  const handleConfirmDeepLinkDownload = async () => {
    if (!deepLinkPrompt?.item || deepLinkPrompt.downloading) return;
    setDeepLinkPrompt((prev) => (prev ? { ...prev, downloading: true, error: null } : null));
    try {
      const combo = await downloadOnlineCombo(deepLinkPrompt.item);
      handleAddCombo(combo);
      setSelectedCombo(combo);
      setDeepLinkPrompt(null);
    } catch (err) {
      setDeepLinkPrompt((prev) =>
        prev
          ? {
              ...prev,
              downloading: false,
              error: err instanceof Error ? err.message : '下載失敗，請稍後再試',
            }
          : null
      );
    }
  };

  if (isOverlayMode && isRecordingMode) {
    return (
      <RecordOverlayView
        mode={mode}
        characterId={recordingCharId}
        bindings={bindings}
        isClickThrough={isClickThrough}
        onSyncDraft={handleSyncDraft}
        onFinishRecord={handleFinishRecord}
      />
    );
  }

  if (isOverlayMode) {
    return (
      <OverlayView
        mode={mode}
        combo={selectedCombo}
        bindings={bindings}
        lang={lang}
        triggerMode={triggerMode}
        playerSide={playerSide}
        showRecordedInputs={showRecordedInputs}
        lowPerfMode={lowPerfMode}
        chartLayout={chartLayout}
        approachFrames={approachFrames}
        overlayOpacity={overlayOpacity}
        buttonScale={buttonScale}
        sfxEnabled={sfxEnabled}
        dynamicResync={dynamicResync}
        isClickThrough={isClickThrough}
        onExitOverlay={handleExitOverlay}
      />
    );
  }

  if (selectedGame === null) {
    return (
      <GameHubView
        lang={lang}
        onChangeLang={handleChangeLang}
        sf6ComboCount={allCombos.length}
        onSelectGame={(g) => setSelectedGame(g)}
      />
    );
  }

  return (
    <>
    <MenuView
      mode={mode}
      onChangeMode={setMode}
      onBackToGames={() => setSelectedGame(null)}
      combos={allCombos}
      customComboIds={new Set(customCombos.map((c) => c.id))}
      selectedCombo={selectedCombo}
      onSelectCombo={setSelectedCombo}
      onAddCombo={handleAddCombo}
      onDeleteCombo={handleDeleteCombo}
      onUpdateCombo={handleUpdateCombo}
      bindings={bindings}
      onChangeBindings={handleChangeBindings}
      lang={lang}
      onChangeLang={handleChangeLang}
      overlayHotkeys={overlayHotkeys}
      onChangeOverlayHotkeys={handleChangeOverlayHotkeys}
      triggerMode={triggerMode}
      onChangeTriggerMode={setTriggerMode}
      playerSide={playerSide}
      onChangePlayerSide={setPlayerSide}
      chartLayout={chartLayout}
      onChangeChartLayout={handleChangeChartLayout}
      approachFrames={approachFrames}
      onChangeApproachFrames={handleChangeApproachFrames}
      overlayOpacity={overlayOpacity}
      onChangeOverlayOpacity={handleChangeOverlayOpacity}
      buttonScale={buttonScale}
      onChangeButtonScale={handleChangeButtonScale}
      showRecordedInputs={showRecordedInputs}
      onChangeShowRecordedInputs={setShowRecordedInputs}
      lowPerfMode={lowPerfMode}
      onChangeLowPerfMode={handleChangeLowPerfMode}
      sfxEnabled={sfxEnabled}
      onChangeSfxEnabled={handleChangeSfxEnabled}
      sfxVolume={sfxVolume}
      onChangeSfxVolume={handleChangeSfxVolume}
      sfxPreset={sfxPreset}
      onChangeSfxPreset={handleChangeSfxPreset}
      customSfxName={customSfxName}
      onSetCustomSfx={handleSetCustomSfx}
      dynamicResync={dynamicResync}
      onChangeDynamicResync={handleChangeDynamicResync}
      onStartOverlay={handleStartOverlay}
      onStartRecording={handleStartRecording}
    />
    {deepLinkPrompt && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 10, 20, 0.78)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            background: '#0f172a',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            borderRadius: 14,
            padding: '22px 24px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
            color: '#f8fafc',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', marginBottom: 6 }}>
            {lang === 'en' ? 'Shared Online Combo' : '收到分享連段'} ({deepLinkPrompt.id})
          </div>
          {deepLinkPrompt.loading ? (
            <div style={{ fontSize: 14, color: '#cbd5e1', padding: '14px 0' }}>
              {lang === 'en' ? 'Loading combo details...' : '正在讀取連段資訊...'}
            </div>
          ) : deepLinkPrompt.item ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>
                {deepLinkPrompt.item.title}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
                {deepLinkPrompt.item.characterName} · {deepLinkPrompt.item.mode.toUpperCase()} ·{' '}
                {deepLinkPrompt.item.difficulty} · {lang === 'en' ? 'By' : '作者'} {deepLinkPrompt.item.author}
              </div>
              <div style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 16 }}>
                {lang === 'en'
                  ? 'Do you want to download and import this combo?'
                  : '請問要下載並匯入這條連段嗎？'}
              </div>
            </>
          ) : null}
          {deepLinkPrompt.error && (
            <div style={{ fontSize: 12.5, color: '#fda4af', marginBottom: 14 }}>
              {deepLinkPrompt.error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="hud-btn"
              onClick={() => setDeepLinkPrompt(null)}
              disabled={deepLinkPrompt.downloading}
            >
              {lang === 'en' ? 'Cancel' : '取消'}
            </button>
            {deepLinkPrompt.item && (
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: 13.5 }}
                onClick={handleConfirmDeepLinkDownload}
                disabled={deepLinkPrompt.downloading}
              >
                {deepLinkPrompt.downloading
                  ? lang === 'en'
                    ? 'Downloading...'
                    : '下載中...'
                  : lang === 'en'
                  ? 'Download & Import'
                  : '立即下載並匯入'}
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default App;
