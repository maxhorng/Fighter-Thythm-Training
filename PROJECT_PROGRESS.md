# Frame Beat Trainer (FBT) — Shared Project Progress & Handoff

> **Last Updated**: 2026-11-23  
> **Current Version**: `v0.2.0-beta.12` (commit `34d8d4e` on `master`)  
> **GitHub Repo**: `https://github.com/maxhorng/Frame-Beat-Trainer`  
> **Latest Release**: `https://github.com/maxhorng/Frame-Beat-Trainer/releases/latest`  
> **Author**: `maxhorng / 92anini` (`https://ko-fi.com/92liang`)

---

## 1. Tech Stack & Architecture
- **Frontend**: React 18 + TypeScript + Vite (`src/`)
- **Desktop / Overlay**: Electron 33 (`electron/main.ts`, `electron/preload.ts`) bundled via `esbuild` (`npm run build:electron`)
- **Packaging**: `electron-builder` Windows Portable `.exe` (`npm run dist:win` -> `release/Frame-Beat-Trainer-${version}-win-portable.exe`)
- **Global Input**:
  - Keyboard: `uiohook-napi` in `electron/main.ts` (passive hook so SF6 `RESET` key is never swallowed).
  - Controllers: 120Hz native Windows `xinput1_4.dll` (`XInputGetState`) + `winmm.dll` (`joyGetPosEx`) DirectInput fallback via `koffi` in `electron/main.ts`, merged with Web Gamepad API in `src/hooks/useInputEngine.ts`.

---

## 2. Key Files
- `electron/main.ts`: Frameless transparent window, compact low-perf overlay (`1080 x full screen height` narrow column), persistent window size (`userData/window-size.json`), global hotkeys (`F7`/`F9`/`F10`), `uiohook-napi`, XInput + `winmm.dll` DirectInput poller.
- `electron/preload.ts`: IPC bridge (`setOverlayMode(enabled, compact)`, `setClickThrough`, `setHotkeys`, `resizeWindow`, `minimizeWindow`, `closeWindow`, global key/gamepad listeners).
- `src/App.tsx`: Top-level state (`selectedGame`, `mode`, `playerSide`, `lowPerfMode`, `sfxEnabled`, `customCombos`, `bindings`, `lang`, `overlayHotkeys`).
- `src/components/GameHubView.tsx`: Multi-game landing screen (currently Street Fighter 6 + Coming Soon placeholder).
- `src/components/MenuView.tsx`: SF6 trainer menu — Classic/Modern toggle, character search + favorite pinning (`☆/★`), difficulty (`Beginner -> Ultra Hard`) & position (`Midscreen / Corner`) filters, custom combo Wrench edit modal, Online Combos button & per-combo Upload button, 1P/2P side toggle, update checker, bottom-right resize grip.
- `src/components/OnlineCombosModal.tsx`: Online Combo Library modal (Browse with character/difficulty/mode/position/search/sort filters, Heart like, 1-click schema-validated Download, My Uploads status/delete, Upload custom combo with live pre-validation and Discord OAuth login, full 5-language UI via `src/data/onlineI18n.ts`).
- `src/schema/comboSchema.ts`: Shared zero-dependency strict validator & sanitizer (`validateCombo`, `sanitizeForUpload`) used across desktop upload, Worker upload, and desktop download.
- `src/utils/onlineApi.ts` & `src/config/online.ts`: Online API client, token persistence, and Worker URL configuration.
- `server/`: Cloudflare Worker API (`server/src/index.ts`, `server/schema.sql`, `server/wrangler.toml`, `server/DEPLOY.md`) on Free Tier (Workers + D1 only, no R2 / no credit card required; approved `/files/<id>.json` served from D1 with `Cache-Control: public, max-age=300` edge cache), Discord OAuth2 loopback login, rate limiting (3/hr & 10/day per Discord account, 20/day per IP), likes, deduped downloads, and admin moderation endpoints.
- `src/components/OverlayView.tsx`: 60fps transparent Canvas overlay, dynamic re-sync, 1P/2P mirroring, `+1f` target-frame beat cue SFX (`playBeatCue`), `F7` per-run Combo Review (persists until manual `RESET`/`F8`) with real-time execution/motion/DR/charge diagnostics (including carry-in direction for `2MP -> 236P`).
- `src/components/RecordOverlayView.tsx`: Live 60fps combo recorder supporting `236 / 214 / 623 / 323 / 33 / 633 (6->3->6->3) / 63214 / 2147 / 2369 / 360 / 720 / [4]6 / 4646 / [2]8 / 66 / 44`, 1st-hit charge, hold/release, Corner/Midscreen toggle, custom title & tags.
- `src/components/KeybindPanel.tsx`: 5-language dropdown (`zh-TW`, `zh-CN`, `en`, `ja`, `ko`), customizable global hotkeys, and 18 localized button bindings.
- `src/data/i18n.ts`: Complete 5-language dictionary (`I18N`, `BUTTON_LABELS`, `CHARACTER_LOCALIZED_NAMES`, `getComboTitle`, `translateTag`).
- `src/utils/soundEngine.ts`: Zero-latency Web Audio API synthesized SFX (`playBeatCue`, `playJudgment`, `setVolume`, `setEnabled`).
- `src/data/combos.ts`: Built-in 60fps real-recorded SF6 combos (launch roster through Akuma). **DO NOT break the existing JSON schema.**
- `src/data/frameData.ts`: SF6 character metadata & frame data.

---

## 3. Strict Project Rules & Constraints
1. **Release Checksum Rule (`.agents/rules/release-checksum.md`)**:
   - Whenever building/publishing a `.exe` or creating/updating a GitHub Release:
     1. Compute SHA-256 via PowerShell `(Get-FileHash <file> -Algorithm SHA256).Hash`.
     2. Include the SHA-256 checksum clearly in the GitHub Release Notes.
     3. Report the SHA-256 checksum to the user in the final response.
2. **PowerShell 5.1**: Use `;` instead of `&&` when chaining commands in PowerShell.
3. **No Emojis in README / Release Notes**: User prefers clean text without emojis in `README.md` and release notes.
4. **Preserve `combos.ts` Schema**: Do not change the existing `ComboData` JSON format in `combos.ts` (optional fields only).
5. **Update Progress File**: After completing major features or releases, update `PROJECT_PROGRESS.md` so all agents/models stay in sync.
6. **Release Packaging Policy**:
   - **Normal / minor releases (e.g. `v0.3.6`, `v0.3.7`)**: Build ONLY the NSIS installer (`npm run dist:win:setup` -> `Frame-Beat-Trainer-Setup-${version}.exe` + `latest.yml` + `.blockmap`) to cut build/upload time in half and keep users on 1-click auto-update.
   - **Major milestones (e.g. `v0.4.0`, `v1.0.0`)**: Build BOTH NSIS + Portable (`npm run dist:win:all`). Keep the `portable` target in `package.json` intact.

---

## 4. Recent Release History
- **Unreleased (working tree)**: Added **Online Combo Sharing** (Cloudflare Workers + D1 Free Tier backend in `server/` — no R2 / no credit card required, shared strict validator in `src/schema/comboSchema.ts`, Electron loopback Discord OAuth in `electron/main.ts` & `electron/preload.ts`, `OnlineCombosModal.tsx` with Browse/Filter/Search/Sort/Like/Download/My Uploads/Upload in all 5 languages, upload button on custom combos in `MenuView.tsx`, and `server/DEPLOY.md`).
- **Unreleased (working tree)**: Added "Adaptive Tempo" toggle (`dynamicResync`, localStorage `fmc_dynamic_resync_v1`, default OFF). OFF = playback strictly reproduces recorded rhythm; ON = late presses on `cancel` / `dr-cancel` / `juggle` notes shift `startTimeRef` (old always-on behavior). Wired via `App.tsx` -> `MenuView.tsx` checkbox (below SFX) -> `OverlayView.tsx` prop; i18n keys `dynamicResync` / `dynamicResyncHint` in all 5 languages. (committed `164c2d2`)
- **Unreleased (working tree)**: Low-perf compact overlay changed from `1080x620` to `1080 x (screenHeight-1)` (Plan A, ~56% of 1080p pixels vs 32% before) so top HUD sits at screen top and recorded stick bar at screen bottom. Fixed live input pills overlapping the recorded stick bar (pills now sit above the bar in both canvas and DOM modes). Future option (Plan B): `setShape` region to expose only HUD / center / bottom bar (~38% pixels).
- `v0.2.0-beta.12` (`34d8d4e`): Compact low-perf overlay (`1080x620`), `+1f` beat cue visual sync, `winmm.dll` DirectInput background fallback.
- `v0.2.0-beta.11` (`99f400e`): Target-frame Web Audio beat cue SFX + GameHubView titlebar layout fix.
- `v0.2.0-beta.10` (`ff9989e`): Carry-in direction fix for `2MP -> 236P` diagnostics, default Beginner->Ultra Hard sorting, simplified checkbox labels.
- `v0.2.0-beta.9` (`85854e4`): Rebranded to **Frame Beat Trainer (FBT)** (`maxhorng/Frame-Beat-Trainer`).
- `v0.2.0-beta.8` (`3dbbfa9`): Multi-game hub landing screen + custom combo edit Wrench modal.

---

## 5. Potential Next Steps / Backlog
- Add more SF6 DLC character built-in combos (beyond Akuma).
- Optional audio offset fine-tuning slider (ms) in Settings if users need custom Bluetooth/monitor sync.
- Optional CSS GPU-composited `transform: scale()` approach ring for even lower overlay latency.
- Expand `GameHubView` to additional fighting games in future versions.
