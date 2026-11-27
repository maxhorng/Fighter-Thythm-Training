import { contextBridge, ipcRenderer } from 'electron';

export interface OverlayState {
  isOverlayMode: boolean;
  isClickThrough: boolean;
}

contextBridge.exposeInMainWorld('electronAPI', {
  setOverlayMode: (enabled: boolean, compact = false): Promise<OverlayState> =>
    ipcRenderer.invoke('set-overlay-mode', enabled, compact),
  setClickThrough: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('set-click-through', enabled),
  setHotkeys: (hotkeys: { clickThrough?: string; exitOverlay?: string; toggleReview?: string; restart?: string }): Promise<void> =>
    ipcRenderer.invoke('set-hotkeys', hotkeys),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window-minimize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window-close'),
  discordLogin: (apiBase: string): Promise<{ ok: boolean; token?: string; error?: string }> =>
    ipcRenderer.invoke('discord-login', apiBase),
  cancelDiscordLogin: (): Promise<void> => ipcRenderer.invoke('discord-login-cancel'),
  getOnlineToken: (): Promise<string | null> => ipcRenderer.invoke('online-token-get'),
  setOnlineToken: (token: string): Promise<boolean> => ipcRenderer.invoke('online-token-set', token),
  clearOnlineToken: (): Promise<void> => ipcRenderer.invoke('online-token-clear'),
  getAppUpdateInfo: (): Promise<{ canAutoUpdate: boolean; isPortable: boolean }> =>
    ipcRenderer.invoke('app-update-info'),
  checkForAppUpdate: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('app-update-check'),
  downloadAppUpdate: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('app-update-download'),
  installAppUpdate: (): Promise<void> => ipcRenderer.invoke('app-update-install'),
  onAppUpdateStatus: (
    callback: (status: {
      status: 'available' | 'downloading' | 'downloaded' | 'error';
      version?: string;
      percent?: number;
      message?: string;
    }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: {
        status: 'available' | 'downloading' | 'downloaded' | 'error';
        version?: string;
        percent?: number;
        message?: string;
      }
    ) => callback(payload);
    ipcRenderer.on('app-update-status', handler);
    return () => ipcRenderer.removeListener('app-update-status', handler);
  },
  resizeWindow: (width: number, height: number): void =>
    ipcRenderer.send('window-resize', { width, height }),
  onGlobalKeyDown: (callback: (code: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, code: string) => callback(code);
    ipcRenderer.on('global-keydown', handler);
    return () => ipcRenderer.removeListener('global-keydown', handler);
  },
  onGlobalKeyUp: (callback: (code: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, code: string) => callback(code);
    ipcRenderer.on('global-keyup', handler);
    return () => ipcRenderer.removeListener('global-keyup', handler);
  },
  onGlobalGamepadState: (callback: (state: { connected: boolean; buttons: number[] }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      state: { connected: boolean; buttons: number[] }
    ) => callback(state);
    ipcRenderer.on('global-gamepad-state', handler);
    return () => ipcRenderer.removeListener('global-gamepad-state', handler);
  },
  onOverlayStateChanged: (callback: (state: OverlayState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: OverlayState) => callback(state);
    ipcRenderer.on('overlay-state-changed', handler);
    return () => ipcRenderer.removeListener('overlay-state-changed', handler);
  },
  onHotkey: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on('hotkey', handler);
    return () => ipcRenderer.removeListener('hotkey', handler);
  },
  consumeDeepLinkCombo: (): Promise<string | null> => ipcRenderer.invoke('deep-link-combo-consume'),
  onDeepLinkCombo: (callback: (comboId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, comboId: string) => callback(comboId);
    ipcRenderer.on('deep-link-combo', handler);
    return () => ipcRenderer.removeListener('deep-link-combo', handler);
  },
});
