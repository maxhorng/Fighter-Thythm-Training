import { useEffect, useRef, useState } from 'react';
import { ActionButtonId, ControlMode, KeyBindingMap } from '../types/combo';
import { getButtonsForMode } from '../data/bindings';

interface UseInputEngineOptions {
  mode: ControlMode;
  bindings: KeyBindingMap;
  onActionPress?: (button: ActionButtonId, activeButtons: Set<ActionButtonId>) => void;
  onRawKeyCapture?: (keyboardCode: string) => void;
  onRawGamepadCapture?: (gamepadButton: number) => void;
}

export function useInputEngine({
  mode,
  bindings,
  onActionPress,
  onRawKeyCapture,
  onRawGamepadCapture,
}: UseInputEngineOptions) {
  const [activeButtons, setActiveButtons] = useState<Set<ActionButtonId>>(new Set());
  const [gamepadName, setGamepadName] = useState<string | null>(null);

  const pressedKeysRef = useRef<Set<string>>(new Set());
  const prevGamepadBtnsRef = useRef<Set<number>>(new Set());
  const prevActiveActionsRef = useRef<Set<ActionButtonId>>(new Set());

  const callbacksRef = useRef({ onActionPress, onRawKeyCapture, onRawGamepadCapture });
  callbacksRef.current = { onActionPress, onRawKeyCapture, onRawGamepadCapture };

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
      if (changed) {
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

    // Gamepad 60fps+ polling loop
    let rafId = 0;
    const pollGamepads = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let activePad: Gamepad | null = null;
      for (const p of pads) {
        if (p && p.connected) {
          activePad = p;
          break;
        }
      }

      if (activePad) {
        setGamepadName((prev) => (prev === activePad!.id ? prev : activePad!.id));
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
      } else {
        setGamepadName((prev) => (prev === null ? prev : null));
      }

      rafId = requestAnimationFrame(pollGamepads);
    };
    rafId = requestAnimationFrame(pollGamepads);

    return () => {
      window.removeEventListener('keydown', onWinKeyDown);
      window.removeEventListener('keyup', onWinKeyUp);
      unsubGlobalDown?.();
      unsubGlobalUp?.();
      cancelAnimationFrame(rafId);
    };
  }, []);

  return { activeButtons, gamepadName };
}
