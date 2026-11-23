import { app, BrowserWindow, globalShortcut, ipcMain, screen, shell } from 'electron';
import fs from 'fs';
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

const MIN_MENU_WIDTH = 1120;
const MIN_MENU_HEIGHT = 760;
let savedMenuSize = { width: MIN_MENU_WIDTH, height: MIN_MENU_HEIGHT };
let saveSizeTimer: NodeJS.Timeout | null = null;

function getWindowSizeConfigPath(): string {
  return path.join(app.getPath('userData'), 'window-size.json');
}

function loadSavedMenuSize() {
  try {
    const raw = fs.readFileSync(getWindowSizeConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.width === 'number' &&
      typeof parsed.height === 'number' &&
      parsed.width >= MIN_MENU_WIDTH &&
      parsed.height >= MIN_MENU_HEIGHT
    ) {
      savedMenuSize = {
        width: Math.round(parsed.width),
        height: Math.round(parsed.height),
      };
    }
  } catch {
    // First launch or missing file — use defaults
  }
}

function persistSavedMenuSize() {
  if (saveSizeTimer) clearTimeout(saveSizeTimer);
  saveSizeTimer = setTimeout(() => {
    try {
      fs.writeFileSync(getWindowSizeConfigPath(), JSON.stringify(savedMenuSize), 'utf-8');
    } catch {
      // ignore write errors
    }
  }, 200);
}

function createWindow() {
  loadSavedMenuSize();
  mainWindow = new BrowserWindow({
    width: savedMenuSize.width,
    height: savedMenuSize.height,
    minWidth: MIN_MENU_WIDTH,
    minHeight: MIN_MENU_HEIGHT,
    icon: path.join(__dirname, '../build/icon.png'),
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
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

  mainWindow.on('resize', () => {
    if (!mainWindow || mainWindow.isDestroyed() || isOverlayMode) return;
    const [w, h] = mainWindow.getSize();
    if (w >= MIN_MENU_WIDTH && h >= MIN_MENU_HEIGHT) {
      savedMenuSize = { width: w, height: h };
      persistSavedMenuSize();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://github.com/') || url.startsWith('https://ko-fi.com/')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

function applyOverlayMode(enabled: boolean) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isOverlayMode = enabled;

  if (enabled) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;
    mainWindow.setResizable(false);
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
    mainWindow.setResizable(true);
    mainWindow.setBounds({ x: 0, y: 0, width: savedMenuSize.width, height: savedMenuSize.height });
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

let currentHotkeys = { clickThrough: 'F9', exitOverlay: 'F10', toggleReview: 'F7' };

function registerOverlayHotkeys(next: { clickThrough?: string; exitOverlay?: string; toggleReview?: string }) {
  currentHotkeys = {
    clickThrough: next.clickThrough || currentHotkeys.clickThrough,
    exitOverlay: next.exitOverlay || currentHotkeys.exitOverlay,
    toggleReview: next.toggleReview || currentHotkeys.toggleReview,
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

  const reviewAcc = codeToAccelerator(currentHotkeys.toggleReview);
  if (reviewAcc && reviewAcc !== ctAcc && reviewAcc !== exitAcc) {
    globalShortcut.register(reviewAcc, () => {
      if (!mainWindow || mainWindow.isDestroyed() || !isOverlayMode) return;
      mainWindow.webContents.send('hotkey', 'TOGGLE_REVIEW');
    });
  }
  // Note: RESET / RESTART_COMBO is intentionally NOT registered via globalShortcut,
  // because globalShortcut swallows the key from SF6! Instead, uiohook-napi passively
  // detects bindings.RESET so both SF6 Training Mode and the overlay reset simultaneously.
}

let xinputTimer: NodeJS.Timeout | null = null;

function startGlobalXInputPoller() {
  if (process.platform !== 'win32') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require('koffi');
    let lib: any = null;
    for (const dll of ['xinput1_4.dll', 'xinput1_3.dll', 'xinput9_1_0.dll']) {
      try {
        lib = koffi.load(dll);
        break;
      } catch {
        // try next XInput DLL
      }
    }
    if (!lib) return;

    const XInputGetState = lib.func('uint32 __stdcall XInputGetState(uint32 dwUserIndex, uint8 *pState)');
    const stateBuf = Buffer.alloc(16); // XINPUT_STATE = DWORD(4) + XINPUT_GAMEPAD(12)
    let lastKey = '';

    xinputTimer = setInterval(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      let anyConnected = false;
      const btns = new Set<number>();

      for (let i = 0; i < 4; i++) {
        stateBuf.fill(0);
        const res = XInputGetState(i, stateBuf);
        if (res === 0) {
          anyConnected = true;
          const wButtons = stateBuf.readUInt16LE(4);
          const bLeftTrigger = stateBuf.readUInt8(6);
          const bRightTrigger = stateBuf.readUInt8(7);
          const sThumbLX = stateBuf.readInt16LE(8);
          const sThumbLY = stateBuf.readInt16LE(10);

          // Standard Gamepad API button index mapping (0..15)
          if (wButtons & 0x1000) btns.add(0);  // A
          if (wButtons & 0x2000) btns.add(1);  // B
          if (wButtons & 0x4000) btns.add(2);  // X
          if (wButtons & 0x8000) btns.add(3);  // Y
          if (wButtons & 0x0100) btns.add(4);  // LB
          if (wButtons & 0x0200) btns.add(5);  // RB
          if (bLeftTrigger > 120) btns.add(6); // LT
          if (bRightTrigger > 120) btns.add(7);// RT
          if (wButtons & 0x0020) btns.add(8);  // Back / Select
          if (wButtons & 0x0010) btns.add(9);  // Start
          if (wButtons & 0x0040) btns.add(10); // L3
          if (wButtons & 0x0080) btns.add(11); // R3
          if ((wButtons & 0x0001) || sThumbLY > 16000) btns.add(12);  // Up
          if ((wButtons & 0x0002) || sThumbLY < -16000) btns.add(13); // Down
          if ((wButtons & 0x0004) || sThumbLX < -16000) btns.add(14); // Left
          if ((wButtons & 0x0008) || sThumbLX > 16000) btns.add(15);  // Right
        }
      }

      const arr = Array.from(btns).sort((a, b) => a - b);
      const key = `${anyConnected ? 1 : 0}|${arr.join(',')}`;
      if (key !== lastKey) {
        lastKey = key;
        mainWindow.webContents.send('global-gamepad-state', {
          connected: anyConnected,
          buttons: arr,
        });
      }
    }, 8);
  } catch (err) {
    console.warn('Global XInput poller unavailable:', err);
  }
}

app.whenReady().then(() => {
  createWindow();
  startGlobalKeyHook();
  startGlobalXInputPoller();
  registerOverlayHotkeys(currentHotkeys);
});

ipcMain.handle('set-hotkeys', (_event, hotkeys: { clickThrough?: string; exitOverlay?: string }) => {
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

ipcMain.on('window-resize', (_event, { width, height }: { width: number; height: number }) => {
  if (!mainWindow || mainWindow.isDestroyed() || isOverlayMode) return;
  const nextW = Math.max(MIN_MENU_WIDTH, Math.round(width));
  const nextH = Math.max(MIN_MENU_HEIGHT, Math.round(height));
  mainWindow.setSize(nextW, nextH);
  savedMenuSize = { width: nextW, height: nextH };
  persistSavedMenuSize();
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
