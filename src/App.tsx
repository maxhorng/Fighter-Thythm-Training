import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ComboData, ControlMode, KeyBindingMap, PlayerSide, StartTriggerMode } from './types/combo';
import { BUILTIN_COMBOS } from './data/combos';
import { DEFAULT_BINDINGS } from './data/bindings';
import { AppLang, DEFAULT_OVERLAY_HOTKEYS, OverlayHotkeys } from './data/i18n';
import { MenuView } from './components/MenuView';
import { GameHubView } from './components/GameHubView';
import { setEnabled as setSoundEnabled } from './utils/soundEngine';
import { OverlayView } from './components/OverlayView';
import { RecordOverlayView } from './components/RecordOverlayView';

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

function loadLowPerfMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_LOW_PERF) === '1';
  } catch {
    return false;
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
  const [mode, setMode] = useState<ControlMode>('classic');
  const [customCombos, setCustomCombos] = useState<ComboData[]>(loadCustomCombos);
  const allCombos = [...BUILTIN_COMBOS, ...customCombos];
  const [selectedCombo, setSelectedCombo] = useState<ComboData>(BUILTIN_COMBOS[0]);
  const [bindings, setBindings] = useState<KeyBindingMap>(loadBindings);
  const [lang, setLang] = useState<AppLang>(loadLang);
  const [overlayHotkeys, setOverlayHotkeys] = useState<OverlayHotkeys>(loadHotkeys);
  const [triggerMode, setTriggerMode] = useState<StartTriggerMode>('trigger-first');
  const [playerSide, setPlayerSide] = useState<PlayerSide>('left');
  const [showRecordedInputs, setShowRecordedInputs] = useState(true);
  const [lowPerfMode, setLowPerfMode] = useState<boolean>(loadLowPerfMode);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => {
    const v = loadSfxEnabled();
    setSoundEnabled(v);
    return v;
  });
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
      const next = [...prev, combo];
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
    setSelectedCombo((curr) => (curr.id === comboId ? BUILTIN_COMBOS[0] : curr));
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

  const handleChangeDynamicResync = (next: boolean) => {
    setDynamicResync(next);
    try {
      localStorage.setItem(STORAGE_KEY_DYNAMIC_RESYNC, next ? '1' : '0');
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
      showRecordedInputs={showRecordedInputs}
      onChangeShowRecordedInputs={setShowRecordedInputs}
      lowPerfMode={lowPerfMode}
      onChangeLowPerfMode={handleChangeLowPerfMode}
      sfxEnabled={sfxEnabled}
      onChangeSfxEnabled={handleChangeSfxEnabled}
      dynamicResync={dynamicResync}
      onChangeDynamicResync={handleChangeDynamicResync}
      onStartOverlay={handleStartOverlay}
      onStartRecording={handleStartRecording}
    />
  );
};

export default App;
