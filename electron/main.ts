import { app, BrowserWindow, globalShortcut, ipcMain, safeStorage, screen, shell } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
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

function applyOverlayMode(enabled: boolean, compact = false) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isOverlayMode = enabled;

  if (enabled) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;
    mainWindow.setResizable(false);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (compact) {
      // Compact overlay in Low-Performance Mode: keep a narrow centered column (<= 1080px wide)
      // but span the full screen height so the top HUD sits at the top edge and the recorded
      // stick bar sits at the bottom edge (~56% of full-screen pixels on 1920x1080).
      const ow = Math.min(width, 1080);
      const oh = height - 1;
      const ox = x + Math.round((width - ow) / 2);
      const oy = y;
      mainWindow.setBounds({ x: ox, y: oy, width: ow, height: oh });
    } else {
      // Use height - 1 on Windows so DWM does not disable alpha transparency for exact fullscreen bounds
      mainWindow.setBounds({ x, y, width, height: height - 1 });
    }
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
    let XInputGetState: any = null;
    if (lib) {
      try { XInputGetState = lib.func('uint32 __stdcall XInputGetState(uint32 dwUserIndex, uint8 *pState)'); } catch { XInputGetState = null; }
    }

    // winmm.dll joyGetPosEx fallback (DirectInput devices: PS4/PS5/Switch Pro/fightsticks)
    let joyGetPosEx: any = null;
    try {
      const winmm = koffi.load('winmm.dll');
      joyGetPosEx = winmm.func('uint32 __stdcall joyGetPosEx(uint32 uJoyID, uint8 *pji)');
    } catch {
      joyGetPosEx = null;
    }
    if (!XInputGetState && !joyGetPosEx) return;
    const joyBuf = Buffer.alloc(52); // JOYINFOEX = 13 x uint32
    const stateBuf = Buffer.alloc(16); // XINPUT_STATE = DWORD(4) + XINPUT_GAMEPAD(12)
    let lastKey = '';

    xinputTimer = setInterval(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      let anyConnected = false;
      const btns = new Set<number>();

      for (let i = 0; i < 4; i++) {
        stateBuf.fill(0);
        const res = XInputGetState ? XInputGetState(i, stateBuf) : 1167;
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

      // DirectInput fallback: only when XInput sees no controller
      if (!anyConnected && joyGetPosEx) {
        for (let id = 0; id < 4; id++) {
          joyBuf.fill(0);
          joyBuf.writeUInt32LE(52, 0);     // dwSize
          joyBuf.writeUInt32LE(0xFF, 4);   // dwFlags = JOY_RETURNALL
          let jr = 1;
          try { jr = joyGetPosEx(id, joyBuf); } catch { jr = 1; }
          if (jr !== 0) continue;
          anyConnected = true;
          const xPos = joyBuf.readUInt32LE(8);
          const yPos = joyBuf.readUInt32LE(12);
          const dwButtons = joyBuf.readUInt32LE(32);
          const pov = joyBuf.readUInt32LE(40);
          for (let b = 0; b < 12; b++) {
            if (dwButtons & (1 << b)) btns.add(b);
          }
          if (pov !== 65535 && pov < 36000) {
            if (pov <= 4500 || pov >= 31500) btns.add(12);
            if (pov >= 4500 && pov <= 13500) btns.add(15);
            if (pov >= 13500 && pov <= 22500) btns.add(13);
            if (pov >= 22500 && pov <= 31500) btns.add(14);
          }
          if (yPos < 16000) btns.add(12);
          if (yPos > 49500) btns.add(13);
          if (xPos < 16000) btns.add(14);
          if (xPos > 49500) btns.add(15);
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
  setupAutoUpdater();
});

ipcMain.handle('set-hotkeys', (_event, hotkeys: { clickThrough?: string; exitOverlay?: string }) => {
  registerOverlayHotkeys(hotkeys);
  return currentHotkeys;
});

ipcMain.handle('set-overlay-mode', (_event, enabled: boolean, compact = false) => {
  applyOverlayMode(enabled, compact);
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

// ---------------------------------------------------------------------------
// Discord login for the Online Combo Library (loopback OAuth redirect)
// The system browser handles Discord login on the Worker; the Worker redirects to
// http://127.0.0.1:<port>/callback?code=...&state=... (a 60s single-use code, never
// the session token). Main process exchanges the code via POST /auth/exchange.
// No client secret ever lives in the app.
// ---------------------------------------------------------------------------
let activeLoginServer: http.Server | null = null;
let cancelActiveLogin: ((error?: string) => void) | null = null;

function getOnlineTokenPath(): string {
  return path.join(app.getPath('userData'), 'online-session.bin');
}

ipcMain.handle('online-token-get', (): string | null => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const filePath = getOnlineTokenPath();
    if (!fs.existsSync(filePath)) return null;
    const encrypted = fs.readFileSync(filePath);
    if (!encrypted.length) return null;
    const decrypted = safeStorage.decryptString(encrypted);
    return /^[A-Za-z0-9_-]{20,128}$/.test(decrypted) ? decrypted : null;
  } catch {
    return null;
  }
});

ipcMain.handle('online-token-set', (_event, token: string): boolean => {
  try {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) return false;
    if (!safeStorage.isEncryptionAvailable()) return false;
    const encrypted = safeStorage.encryptString(token);
    fs.writeFileSync(getOnlineTokenPath(), encrypted);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('online-token-clear', (): void => {
  try {
    fs.rmSync(getOnlineTokenPath(), { force: true });
  } catch {
    // ignore
  }
});

function isAllowedApiBase(apiBase: string): boolean {
  try {
    const u = new URL(apiBase);
    if (u.protocol === 'https:') return true;
    // Allow local `wrangler dev` during development only
    return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost');
  } catch {
    return false;
  }
}

ipcMain.handle('discord-login', async (_event, apiBase: string) => {
  if (typeof apiBase !== 'string' || !isAllowedApiBase(apiBase)) {
    return { ok: false, error: 'invalid_api_base' };
  }
  if (cancelActiveLogin) {
    cancelActiveLogin('superseded');
  }
  const state = crypto.randomBytes(24).toString('base64url');

  return new Promise<{ ok: boolean; token?: string; error?: string }>((resolve) => {
    let settled = false;
    const finish = (result: { ok: boolean; token?: string; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (activeLoginServer === server) activeLoginServer = null;
      if (cancelActiveLogin === cancelFn) cancelActiveLogin = null;
      try {
        server.close();
      } catch {
        // ignore
      }
      resolve(result);
    };
    const cancelFn = (err = 'cancelled') => finish({ ok: false, error: err });
    cancelActiveLogin = cancelFn;

    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (reqUrl.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const okState = reqUrl.searchParams.get('state') === state;
      const code = reqUrl.searchParams.get('code') ?? '';
      let error = reqUrl.searchParams.get('error') ?? (okState ? '' : 'bad_state');
      let token = '';

      if (okState && !error && /^[A-Za-z0-9_-]{20,128}$/.test(code)) {
        try {
          const exchangeUrl = new URL('/auth/exchange', apiBase).toString();
          const exRes = await fetch(exchangeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          const exData = (await exRes.json().catch(() => ({}))) as { token?: unknown; error?: unknown };
          if (exRes.ok && typeof exData.token === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(exData.token)) {
            token = exData.token;
          } else {
            error = typeof exData.error === 'string' ? exData.error : 'exchange_failed';
          }
        } catch {
          error = 'network';
        }
      } else if (!error) {
        error = 'invalid_code';
      }

      const success = Boolean(token) && !error;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        `<!doctype html><meta charset="utf-8"><title>Frame Beat Trainer</title>` +
          `<body style="font-family:system-ui;background:#0b1020;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">` +
          `<div style="text-align:center"><h2>${success ? 'Login successful / 登入成功' : 'Login failed / 登入失敗'}</h2>` +
          `<p>${success ? 'You can close this tab and return to Frame Beat Trainer. / 可以關閉此分頁回到程式。' : 'Please return to the app and try again. / 請回到程式重試。'}</p></div></body>`
      );
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
      finish(success ? { ok: true, token } : { ok: false, error: error || 'exchange_failed' });
    });
    const timer = setTimeout(() => {
      finish({ ok: false, error: 'timeout' });
    }, 5 * 60 * 1000);
    server.on('error', () => {
      finish({ ok: false, error: 'loopback_failed' });
    });
    server.listen(0, '127.0.0.1', () => {
      activeLoginServer = server;
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const start = new URL('/auth/discord/start', apiBase);
      start.searchParams.set('port', String(port));
      start.searchParams.set('state', state);
      shell.openExternal(start.toString());
    });
  });
});

ipcMain.handle('discord-login-cancel', () => {
  if (cancelActiveLogin) {
    cancelActiveLogin('cancelled');
  } else if (activeLoginServer) {
    activeLoginServer.close();
    activeLoginServer = null;
  }
});

// ---------------------------------------------------------------------------
// Auto-updater (NSIS installed builds only; disabled for Portable & dev)
// ---------------------------------------------------------------------------
type AppUpdateStatus =
  | { status: 'available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version?: string }
  | { status: 'error'; message: string };

const isPortableBuild = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
let updaterInstance: any = null;

function canAutoUpdateApp(): boolean {
  return app.isPackaged && !isPortableBuild && Boolean(updaterInstance);
}

function sendUpdateStatus(payload: AppUpdateStatus) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-update-status', payload);
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged || isPortableBuild) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', (info: { version?: string }) => {
      sendUpdateStatus({ status: 'available', version: info?.version ? `v${info.version.replace(/^v/, '')}` : '' });
    });
    autoUpdater.on('download-progress', (progress: { percent?: number }) => {
      sendUpdateStatus({ status: 'downloading', percent: Math.round(progress?.percent ?? 0) });
    });
    autoUpdater.on('update-downloaded', (info: { version?: string }) => {
      sendUpdateStatus({ status: 'downloaded', version: info?.version ? `v${info.version.replace(/^v/, '')}` : undefined });
    });
    autoUpdater.on('error', (err: Error) => {
      sendUpdateStatus({ status: 'error', message: err?.message || 'Update failed' });
    });
    updaterInstance = autoUpdater;
  } catch (err) {
    console.warn('[FighterMusicCombo] electron-updater unavailable:', err);
  }
}

ipcMain.handle('app-update-info', () => ({
  canAutoUpdate: canAutoUpdateApp(),
  isPortable: isPortableBuild,
}));

ipcMain.handle('app-update-check', async () => {
  if (!canAutoUpdateApp()) return { ok: false };
  try {
    await updaterInstance.checkForUpdates();
    return { ok: true };
  } catch (err) {
    sendUpdateStatus({ status: 'error', message: err instanceof Error ? err.message : 'Check failed' });
    return { ok: false };
  }
});

ipcMain.handle('app-update-download', async () => {
  if (!canAutoUpdateApp()) return { ok: false };
  try {
    sendUpdateStatus({ status: 'downloading', percent: 0 });
    await updaterInstance.downloadUpdate();
    return { ok: true };
  } catch (err) {
    sendUpdateStatus({ status: 'error', message: err instanceof Error ? err.message : 'Download failed' });
    return { ok: false };
  }
});

ipcMain.handle('app-update-install', () => {
  if (!canAutoUpdateApp()) return;
  updaterInstance.quitAndInstall(false, true);
});

app.on('will-quit', () => {
  if (cancelActiveLogin) cancelActiveLogin('app_quit');
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
