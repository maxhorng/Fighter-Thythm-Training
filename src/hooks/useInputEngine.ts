import { useEffect, useRef, useState } from 'react';
import { ActionButtonId, ControlMode, KeyBindingMap } from '../types/combo';
import { getButtonsForMode } from '../data/bindings';

interface UseInputEngineOptions {
  mode: ControlMode;
  bindings: KeyBindingMap;
  syncReactState?: boolean;
  onActionPress?: (button: ActionButtonId, activeButtons: Set<ActionButtonId>) => void;
  onActionRelease?: (button: ActionButtonId, activeButtons: Set<ActionButtonId>) => void;
  onRawKeyCapture?: (keyboardCode: string) => void;
  onRawGamepadCapture?: (gamepadButton: number) => void;
}

export function useInputEngine({
  mode,
  bindings,
  syncReactState = true,
  onActionPress,
  onActionRelease,
  onRawKeyCapture,
  onRawGamepadCapture,
}: UseInputEngineOptions) {
  const [activeButtons, setActiveButtons] = useState<Set<ActionButtonId>>(new Set());
  const [gamepadName, setGamepadName] = useState<string | null>(null);

  const pressedKeysRef = useRef<Set<string>>(new Set());
  const prevGamepadBtnsRef = useRef<Set<number>>(new Set());
  const prevActiveActionsRef = useRef<Set<ActionButtonId>>(new Set());
  const syncReactStateRef = useRef(syncReactState);
  syncReactStateRef.current = syncReactState;
  const gamepadNameRef = useRef<string | null>(null);

  const callbacksRef = useRef({ onActionPress, onActionRelease, onRawKeyCapture, onRawGamepadCapture });
  callbacksRef.current = { onActionPress, onActionRelease, onRawKeyCapture, onRawGamepadCapture };

  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const syncActiveActions = () => {
      const allowedButtons = getButtonsForMode(modeRef.current);
      const currentBindings = bindingsRef.current;
      const nextActive = new Set<ActionButtonId>();

      for (const btnId of allowedButtons) {
        const b = currentBindings[btnId];
        if (!b) continue;
        if (b.keyboardCode && pressedKeysRef.current.has(b.keyboardCode)) {
          nextActive.add(btnId);
        }
        if (b.gamepadButton !== null && prevGamepadBtnsRef.current.has(b.gamepadButton)) {
          nextActive.add(btnId);
        }
      }

      // Detect rising edges
      for (const btnId of nextActive) {
        if (!prevActiveActionsRef.current.has(btnId)) {
          callbacksRef.current.onActionPress?.(btnId, nextActive);
        }
      }

      // Detect falling edges (button releases — used for charge/hold moves like Luke Flash Knuckle)
      for (const btnId of prevActiveActionsRef.current) {
        if (!nextActive.has(btnId)) {
          callbacksRef.current.onActionRelease?.(btnId, nextActive);
        }
      }

      // Update React state only if changed
      let changed = nextActive.size !== prevActiveActionsRef.current.size;
      if (!changed) {
        for (const id of nextActive) {
          if (!prevActiveActionsRef.current.has(id)) {
            changed = true;
            break;
          }
        }
      }

      prevActiveActionsRef.current = nextActive;
      if (changed && syncReactStateRef.current) {
        setActiveButtons(new Set(nextActive));
      }
    };

    const handleKeyDown = (code: string) => {
      if (callbacksRef.current.onRawKeyCapture) {
        callbacksRef.current.onRawKeyCapture(code);
        return;
      }
      if (!pressedKeysRef.current.has(code)) {
        pressedKeysRef.current.add(code);
        syncActiveActions();
      }
    };

    const handleKeyUp = (code: string) => {
      if (pressedKeysRef.current.has(code)) {
        pressedKeysRef.current.delete(code);
        syncActiveActions();
      }
    };

    // Local window keyboard listeners
    const onWinKeyDown = (e: KeyboardEvent) => {
      if (callbacksRef.current.onRawKeyCapture) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.repeat) return;
      handleKeyDown(e.code);
    };
    const onWinKeyUp = (e: KeyboardEvent) => {
      handleKeyUp(e.code);
    };
    window.addEventListener('keydown', onWinKeyDown);
    window.addEventListener('keyup', onWinKeyUp);

    // Electron global keyboard hook (works even when SF6 is focused!)
    const unsubGlobalDown = window.electronAPI?.onGlobalKeyDown(handleKeyDown);
    const unsubGlobalUp = window.electronAPI?.onGlobalKeyUp(handleKeyUp);

    // Gamepad 60fps+ polling loop (only runs while a gamepad is connected)
    let rafId = 0;
    let isPollingGamepad = false;

    const getConnectedGamepad = (): Gamepad | null => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (p && p.connected) return p;
      }
      return null;
    };

    const pollGamepads = () => {
      const activePad = getConnectedGamepad();

      if (activePad) {
        if (gamepadNameRef.current !== activePad.id) {
          gamepadNameRef.current = activePad.id;
          setGamepadName(activePad.id);
        }
        const nextGpBtns = new Set<number>();

        activePad.buttons.forEach((btn, idx) => {
          if (btn.pressed || btn.value > 0.5) {
            nextGpBtns.add(idx);
          }
        });

        // Map Left Analog Stick to D-Pad (12=Up, 13=Down, 14=Left, 15=Right)
        const axX = activePad.axes[0] ?? 0;
        const axY = activePad.axes[1] ?? 0;
        if (axY < -0.5) nextGpBtns.add(12);
        if (axY > 0.5) nextGpBtns.add(13);
        if (axX < -0.5) nextGpBtns.add(14);
        if (axX > 0.5) nextGpBtns.add(15);

        // Raw capture mode for keybinding
        if (callbacksRef.current.onRawGamepadCapture) {
          for (const idx of nextGpBtns) {
            if (!prevGamepadBtnsRef.current.has(idx)) {
              callbacksRef.current.onRawGamepadCapture(idx);
              break;
            }
          }
        }

        // Check if gamepad state changed
        let gpChanged = nextGpBtns.size !== prevGamepadBtnsRef.current.size;
        if (!gpChanged) {
          for (const idx of nextGpBtns) {
            if (!prevGamepadBtnsRef.current.has(idx)) {
              gpChanged = true;
              break;
            }
          }
        }

        if (gpChanged) {
          prevGamepadBtnsRef.current = nextGpBtns;
          syncActiveActions();
        }

        rafId = requestAnimationFrame(pollGamepads);
      } else {
        isPollingGamepad = false;
        if (gamepadNameRef.current !== null) {
          gamepadNameRef.current = null;
          setGamepadName(null);
        }
        if (prevGamepadBtnsRef.current.size > 0) {
          prevGamepadBtnsRef.current = new Set();
          syncActiveActions();
        }
      }
    };

    const startGamepadPolling = () => {
      if (!isPollingGamepad) {
        isPollingGamepad = true;
        rafId = requestAnimationFrame(pollGamepads);
      }
    };

    const onGamepadConnected = () => startGamepadPolling();
    const onGamepadDisconnected = () => {
      if (!getConnectedGamepad() && isPollingGamepad) {
        cancelAnimationFrame(rafId);
        isPollingGamepad = false;
        if (gamepadNameRef.current !== null) {
          gamepadNameRef.current = null;
          setGamepadName(null);
        }
        if (prevGamepadBtnsRef.current.size > 0) {
          prevGamepadBtnsRef.current = new Set();
          syncActiveActions();
        }
      }
    };

    window.addEventListener('gamepadconnected', onGamepadConnected);
    window.addEventListener('gamepaddisconnected', onGamepadDisconnected);
    if (getConnectedGamepad()) {
      startGamepadPolling();
    }

    return () => {
      window.removeEventListener('keydown', onWinKeyDown);
      window.removeEventListener('keyup', onWinKeyUp);
      window.removeEventListener('gamepadconnected', onGamepadConnected);
      window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
      unsubGlobalDown?.();
      unsubGlobalUp?.();
      cancelAnimationFrame(rafId);
    };
  }, []);

  return { activeButtons, activeButtonsRef: prevActiveActionsRef, gamepadName };
}
