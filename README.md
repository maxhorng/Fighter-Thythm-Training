# RhythmCombo Trainer (Beta)

**Street Fighter 6 · osu!-Style Transparent Rhythm Combo Trainer Overlay**  
**快打旋風 6 · osu! 風格透明覆蓋節奏連段訓練器**

[English](#english) | [繁體中文](#繁體中文)

> **Author / 作者**: `maxhorng / 92anini`  
> **Latest Version / 最新版本**: `v0.2.0-beta.3`  
> **Download / 永久最新版下載**: **[Download Latest Windows Portable `.exe` (Releases Latest)](https://github.com/maxhorng/Rhythm-Combo-Trainer/releases/latest)**

---

## English

### Features

- **Transparent Overlay + Performance Mode**:
  - Floats directly on top of *Street Fighter 6* (set SF6 to **Borderless Windowed**) with mouse click-through support.
  - **Built-in Performance Mode (Low-Resource Mode)**: Greatly reduces GPU/CPU overhead from the transparent overlay. **Highly recommended to enable first** for the smoothest 60fps experience alongside SF6.
- **Native Windows Background Controller / Hitbox / Fightstick Support**:
  - Alongside global keyboard monitoring (`uiohook-napi`), includes a **native Windows background XInput poller** supporting **Haute42 / GP2040-CE / Hitbox / Leverless / Fightstick / Xbox controllers** — keeps working seamlessly even while SF6 has window focus (also merges multiple connected controllers and decodes DInput POV Hat).
- **60fps Frame-Accurate Timing & Per-Run Review**:
  - `PERFECT` (±0.35f exact frame), `GOOD` (SF6-authentic Link / Cancel / Drive Rush tolerance), `EARLY`, `LATE`, and `MISS`.
  - **Dynamic Re-sync**: Cancels, Drive Rush, and Super Arts dynamically re-sync to your actual execution time, while Links stay strictly timed.
  - **Collapsible Combo Review Dropdown (`F7`, customizable)**: Press `F7` anytime (even in click-through mode) to view every step of the combo — any `EARLY / LATE / MISS` steps are grayed out with exact frame offsets (auto-clears on `RESET`).
- **Built-in 60fps Real-Recorded Combos (Launch Roster through Akuma)**:
  - Covers both **Classic** and **Modern** modes, including standard combos, corner routes, and purple **`Ultra Hard`** challenges. More DLC characters coming soon.
- **SF6 Character Grid UI & Visual Startup Guide**:
  - Stylized per-character color cards, emblem badges, and live combo-count badges; includes a 4-step visual onboarding guide on first launch (reopen anytime via **Guide**).
- **Live 60fps Recorder & File Sharing**:
  - Captures `236 / 214 / 623 / 323 / 33 / 63214 / 2147 / 2369 / 360 / 720 / [4]6 / 4646 / [2]8 / 66 / 44`, 1st-hit charge moves, and Hold & Release durations.
  - One-click **Export** to a `.json` file to share with friends, or **Load `.json` File** directly in the Import modal.
- **Customizable Hotkeys, Bilingual UI & Update Checker**:
  - Customize **Combo Review (`F7`)**, **Click-Through (`F9`)**, **Return to Menu (`F10`)**, and non-blocking **RESET (`F8`, can match your SF6 Training Mode reset key such as `2`)**.
  - Switch between **English** and **Traditional Chinese** anytime; automatically checks GitHub for newer versions on startup.

### Quick Start (Windows Portable `.exe` — No Install Needed)

1. **Download**: Go to **[Releases Latest](https://github.com/maxhorng/Rhythm-Combo-Trainer/releases/latest)**, scroll to **Assets**, download **`RhythmCombo-Trainer-*-win-portable.exe`**, and double-click to run (no Node.js required).
   - *If Windows SmartScreen appears*: Click **More info → Run anyway**. Source code is publicly visible on GitHub and every release includes a **SHA-256 checksum**. This is a pure visual rhythm aid — **no macros, no automated inputs, and no memory reading/writing**.
2. **Game & Performance Setup**:
   - Set *Street Fighter 6* display mode to **Borderless Windowed** (Exclusive Fullscreen hides transparent overlays).
   - **Recommended**: Enable **Performance Mode** in the app and ensure SF6 runs at a stable 60fps.
   - **Hitbox / Haute42 / Fightstick users**: Use **XInput (Xbox) mode** for seamless background detection while SF6 is focused.
3. **Bind Keys & Practice**:
   - Open **Settings / Keys & Lang** in the top-right to switch language, customize global hotkeys, and bind your keyboard/controller to match SF6.
   - Pick **Classic** or **Modern** → choose a character & combo → click **Start Transparent Overlay Training** → focus SF6 and press the 1st hit to begin.

### Recording & Sharing Combos

- **Record**: Click **Record My Combo** → play your combo in SF6 Training Mode (`RESET` to clear and retry, `F10` to save & copy).
- **Share**: Click **Export** on any combo card to download a `.json` file you can send to friends (or click **Copy JSON**).
- **Load**: Click **Import / Load Combo** → JSON tab → **Load `.json` File**.

---

## 繁體中文

### 特色功能

- **透明覆蓋（Transparent Overlay）＋ 效能模式**：
  - 直接浮動在《Street Fighter 6》遊戲畫面上方（請將 SF6 設為「無邊框視窗 / Borderless Windowed」），支援滑鼠穿透。
  - **內建「效能模式（低耗能模式）」**：大幅降低透明疊層的 GPU / CPU 負擔，**強烈推薦優先開啟**，讓 SF6 與疊層同時維持最順暢的 60fps。
- **Windows 原生背景手把 / Hitbox / 大搖偵測**：
  - 除了鍵盤全域監聽（`uiohook-napi`），更內建 **Windows 原生背景 XInput 監聽**，支援 **Haute42 / GP2040-CE / Hitbox / Leverless / 大搖 / Xbox 手把**，切進 SF6 訓練場一樣即時同步偵測（同時支援多控制器合併讀取與 DInput POV Hat）。
- **60fps 幀數級節奏判定 ＆ 當次檢討視窗**：
  - `PERFECT`（±0.35f 精準對拍）、`GOOD`（貼近 SF6 真實 Link / Cancel / Drive Rush 容錯）、`EARLY` / `LATE` / `MISS`。
  - **動態重同步**：Cancel / Drive Rush / SA 自動對齊你的實際出招時間，Link 則保持嚴格節奏不漂移。
  - **可收合當次連段檢討（預設 `F7`，可自訂）**：遊戲中隨時按 `F7` 展開完整連段檢討，失誤擊數（`太早 / 太晚 / MISS`）會變灰並標出精確偏差幀數，按 `RESET` 重來自動清空。
- **全首發角色至豪鬼（Akuma）內建 60fps 實錄連段**：
  - 涵蓋經典（Classic）與現代（Modern）模式，包含一般連段、角落連段與紫色 **`Ultra Hard`** 高難度挑戰，後續 DLC 角色將持續更新。
- **全新 SF6 角色專屬色卡介面 ＆ 啟動視覺化教學**：
  - 左側選角列採用角色專屬漸層色卡、斜體頭像徽章與連段數量提示；首次啟動自動彈出 **4 步驟圖文新手教學**（隨時可由右上角「使用教學 / Guide」重看）。
- **實機 60fps 錄製與檔案分享**：
  - 完整支援 `236 / 214 / 623 / 323 / 33 / 63214 / 2147 / 2369 / 360 / 720 / [4]6 / 4646 / [2]8 / 66 / 44`、第一擊蓄力與長按放開（Hold & Release）。
  - 連段卡片支援 **一鍵匯出 `.json` 檔案**（可直接傳檔給朋友）或複製文字；匯入視窗支援 **直接選擇檔案匯入**。
- **全自訂按鍵、多語系與新版通知**：
  - 支援自訂 **展開/收合當次連段檢討（預設 `F7`）**、**滑鼠穿透（預設 `F9`）**、**返回選單（預設 `F10`）** 與 **不搶鍵同步重置（`RESET`，預設 `F8`，可設成與 SF6 相同的重置鍵如 `2`）**。
  - 支援 **繁體中文 / English** 即時切換，啟動時會自動檢查 GitHub 是否有新版本並提示下載。

### 電腦小白快速使用教學（免安裝 `.exe`）

1. **下載執行檔**：前往 **[永久最新版下載連結](https://github.com/maxhorng/Rhythm-Combo-Trainer/releases/latest)**，滑到下方 **Assets** 下載 **`RhythmCombo-Trainer-*-win-portable.exe`**，直接雙擊執行（免安裝、不需 Node.js）。
   - *若 Windows 跳出藍色 SmartScreen 視窗*：點選 **「其他資訊」→「仍要執行」** 即可。本專案原始碼公開於 GitHub 且每個 Release 皆附 **SHA-256 校驗碼**，絕無木馬、自動出招或記憶體讀寫。
2. **遊戲與效能設定**：
   - 將《Street Fighter 6》畫面設為 **「無邊框視窗 (Borderless Windowed)」**。
   - **強烈推薦先開啟「效能模式（低耗能模式）」** 並確保 SF6 訓練場穩定 60fps。
   - **Hitbox / Haute42 / 大搖玩家**：建議切換為 **XInput（Xbox）模式**，進遊戲後即可全天候背景即時偵測。
3. **設定按鍵並開始練習**：
   - 點右上角 **「設定 / 按鍵與語言」** 綁定鍵盤/手把按鍵與快捷鍵。
   - 選好模式與連段 → 點 **「開始透明覆蓋訓練模式 (Overlay)」** → 切回 SF6 按下第一擊即自動開始跑拍。

### 錄製與分享連段

- **錄製**：點右上角 **「錄製我的連段」** → 切回 SF6 直接打出連段（打錯按 `RESET` 清空重錄，打完按 `F10` 自動儲存並複製）。
- **分享**：在連段卡片上點 **「匯出 / Export」** 直接下載檔案傳給朋友（或點「複製 JSON」）。
- **載入**：點 **「匯入 / 指令轉譜面」** → JSON 分頁 → **「選擇 .json 檔案匯入」**。

---

## For Developers / 開發者本地執行

```bash
git clone https://github.com/maxhorng/Rhythm-Combo-Trainer.git
cd Rhythm-Combo-Trainer
npm install
npm run dev       # Start in development mode
npm run dist:win  # Build Windows portable .exe (outputs to release/)
```

---

## Support (Optional) / 贊助支持

This tool is **100% free to use**. If it helps you land your combos, feel free to buy the author a coffee:  
本工具**完全免費使用**。如果這個小工具幫你成功接出練很久的連段，歡迎隨喜請作者喝杯咖啡：

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/92liang)

---

## License & Disclaimer / 授權與免責聲明

- **All Rights Reserved (Source-Available Personal Use)**: Free to view source code, run official releases for personal training, and share combo files. Unauthorized modification, redistribution, or commercial use is prohibited. See [LICENSE](./LICENSE).
- Pure visual rhythm training aid — **no macros, no automated inputs, and no game memory reading/writing**.
