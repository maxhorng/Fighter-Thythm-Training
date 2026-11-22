import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let isOverlayMode = false;
let isClickThrough = false;
let uiohookStarted = false;

// Map uiohook keycodes to standard KeyboardEvent.code strings
const UIOHOOK_TO_CODE: Record<number, string> = {
  1: 'Escape',
  2: 'Digit1', 3: 'Digit2', 4: 'Digit3', 5: 'Digit4', 6: 'Digit5',
  7: 'Digit6', 8: 'Digit7', 9: 'Digit8', 10: 'Digit9', 11: 'Digit0',
  16: 'KeyQ', 17: 'KeyW', 18: 'KeyE', 19: 'KeyR', 20: 'KeyT',
  21: 'KeyY', 22: 'KeyU', 23: 'KeyI', 24: 'KeyO', 25: 'KeyP',
  30: 'KeyA', 31: 'KeyS', 32: 'KeyD', 33: 'KeyF', 34: 'KeyG',
  35: 'KeyH', 36: 'KeyJ', 37: 'KeyK', 38: 'KeyL', 39: 'Semicolon',
  44: 'KeyZ', 45: 'KeyX', 46: 'KeyC', 47: 'KeyV', 48: 'KeyB',
  49: 'KeyN', 50: 'KeyM', 51: 'Comma', 52: 'Period', 53: 'Slash',
  57: 'Space',
  28: 'Enter',
  42: 'ShiftLeft', 54: 'ShiftRight',
  29: 'ControlLeft', 3613: 'ControlRight',
  56: 'AltLeft', 3640: 'AltRight',
  57416: 'ArrowUp', 57424: 'ArrowDown', 57419: 'ArrowLeft', 57421: 'ArrowRight',
  61000: 'ArrowUp', 61008: 'ArrowDown', 61003: 'ArrowLeft', 61005: 'ArrowRight',
};

function startGlobalKeyHook() {
  if (uiohookStarted) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { uIOhook } = require('uiohook-napi');
    uIOhook.on('keydown', (e: { keycode: number }) => {
      const code = UIOHOOK_TO_CODE[e.keycode];
      if (code && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('global-keydown', code);
      }
    });
    uIOhook.on('keyup', (e: { keycode: number }) => {
      const code = UIOHOOK_TO_CODE[e.keycode];
      if (code && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('global-keyup', code);
      }
    });
    uIOhook.start();
    uiohookStarted = true;
    console.log('[FighterMusicCombo] Global keyboard hook (uiohook-napi) active.');
  } catch (err) {
    console.warn('[FighterMusicCombo] uiohook-napi unavailable, falling back to window keyboard + gamepad:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:51766');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function applyOverlayMode(enabled: boolean) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isOverlayMode = enabled;

  if (enabled) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // Use height - 1 on Windows so DWM does not disable alpha transparency for exact fullscreen bounds
    mainWindow.setBounds({ x, y, width, height: height - 1 });
    isClickThrough = true;
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    isClickThrough = false;
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setBounds({ x: 0, y: 0, width: 1120, height: 760 });
    mainWindow.center();
  }

  mainWindow.webContents.send('overlay-state-changed', {
    isOverlayMode,
    isClickThrough,
  });
}

function codeToAccelerator(code: string): string | null {
  if (!code) return null;
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  if (/^Key([A-Z])$/.test(code)) return code.slice(3);
  if (/^Digit([0-9])$/.test(code)) return code.slice(5);
  if (/^Numpad([0-9])$/.test(code)) return `num${code.slice(6)}`;
  const map: Record<string, string> = {
    Space: 'Space',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Backquote: '`',
    Comma: ',',
    Period: '.',
    Slash: '/',
  };
  return map[code] ?? null;
}

let currentHotkeys = { clickThrough: 'F9', exitOverlay: 'F10', restart: 'F8' };

function registerOverlayHotkeys(next: { clickThrough?: string; exitOverlay?: string; restart?: string }) {
  currentHotkeys = {
    clickThrough: next.clickThrough || currentHotkeys.clickThrough,
    exitOverlay: next.exitOverlay || currentHotkeys.exitOverlay,
    restart: next.restart || currentHotkeys.restart,
  };
  globalShortcut.unregisterAll();

  const ctAcc = codeToAccelerator(currentHotkeys.clickThrough);
  if (ctAcc) {
    globalShortcut.register(ctAcc, () => {
      if (!mainWindow || mainWindow.isDestroyed() || !isOverlayMode) return;
      isClickThrough = !isClickThrough;
      mainWindow.setIgnoreMouseEvents(isClickThrough, { forward: true });
      mainWindow.webContents.send('overlay-state-changed', {
        isOverlayMode,
        isClickThrough,
      });
    });
  }

  const exitAcc = codeToAccelerator(currentHotkeys.exitOverlay);
  if (exitAcc && exitAcc !== ctAcc) {
    globalShortcut.register(exitAcc, () => {
      if (!mainWindow || mainWindow.isDestroyed() || !isOverlayMode) return;
      applyOverlayMode(false);
      mainWindow.webContents.send('hotkey', 'EXIT_OVERLAY');
    });
  }

  const restartAcc = codeToAccelerator(currentHotkeys.restart);
  if (restartAcc && restartAcc !== ctAcc && restartAcc !== exitAcc) {
    globalShortcut.register(restartAcc, () => {
      if (!mainWindow || mainWindow.isDestroyed() || !isOverlayMode) return;
      mainWindow.webContents.send('hotkey', 'RESTART_COMBO');
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  startGlobalKeyHook();
  registerOverlayHotkeys(currentHotkeys);
});

ipcMain.handle('set-hotkeys', (_event, hotkeys: { clickThrough?: string; exitOverlay?: string; restart?: string }) => {
  registerOverlayHotkeys(hotkeys);
  return currentHotkeys;
});

ipcMain.handle('set-overlay-mode', (_event, enabled: boolean) => {
  applyOverlayMode(enabled);
  return { isOverlayMode, isClickThrough };
});

ipcMain.handle('set-click-through', (_event, enabled: boolean) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  isClickThrough = enabled;
  mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
  mainWindow.webContents.send('overlay-state-changed', {
    isOverlayMode,
    isClickThrough,
  });
  return isClickThrough;
});

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-close', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (uiohookStarted) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { uIOhook } = require('uiohook-napi');
      uIOhook.stop();
    } catch {
      // ignore
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
