import { contextBridge, ipcRenderer } from 'electron';

export interface OverlayState {
  isOverlayMode: boolean;
  isClickThrough: boolean;
}

contextBridge.exposeInMainWorld('electronAPI', {
  setOverlayMode: (enabled: boolean): Promise<OverlayState> =>
    ipcRenderer.invoke('set-overlay-mode', enabled),
  setClickThrough: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('set-click-through', enabled),
  setHotkeys: (hotkeys: { clickThrough?: string; exitOverlay?: string; toggleReview?: string; restart?: string }): Promise<void> =>
    ipcRenderer.invoke('set-hotkeys', hotkeys),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window-minimize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window-close'),
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
});
