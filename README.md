# RhythmCombo Trainer (Beta)

**Street Fighter 6 · Transparent Rhythm Combo Trainer Overlay**  
**快打旋風 6 · 透明覆蓋節奏連段訓練器**

[English](#english) | [繁體中文](#繁體中文)

> **Author / 作者**: `maxhorng / 92anini`  
> **Latest Version / 最新版本**: `v0.2.0-beta.6`  
> **Download / 永久最新版下載**: **[Download Latest Windows Portable `.exe` (Releases Latest)](https://github.com/maxhorng/Rhythm-Combo-Trainer/releases/latest)**

---

## English

### Concrete Features

1. **Transparent Overlay & Performance Mode**
   - Floats directly on top of *Street Fighter 6* (set SF6 to **Borderless Windowed**) with toggleable mouse click-through (`F9`, customizable).
   - **Low-Performance Mode**: Disables blur/glow effects, uses 1x resolution, and renders live inputs directly on Canvas with zero DOM re-renders to keep SF6 running smoothly at 60fps.
2. **Native Windows Background Keyboard & Controller Support**
   - Global keyboard hook (`uiohook-napi`) + **native Windows background XInput poller** (`xinput1_4.dll`) so **Haute42 / GP2040-CE / Hitbox / Leverless / Fightstick / Xbox controllers** keep working seamlessly even while SF6 has window focus.
   - Merges multiple connected controllers and decodes DInput POV Hat directions.
3. **60fps Frame-Accurate Timing & Real-Time Execution Diagnostics (`F7`)**
   - Judges every hit with `PERFECT` (±0.35f), `GOOD` (SF6-authentic Link / Cancel / Drive Rush windows), `EARLY`, `LATE`, and `MISS`.
   - **Dynamic Re-sync**: Cancels, Drive Rush, and Super Arts dynamically re-sync to your actual execution time while Links stay strictly timed.
   - **Per-Run Combo Review Dropdown (`F7`, customizable)**: Shows every step of the current run with exact frame deltas and **real-time execution error diagnostics**, including:
     - Incomplete motions (e.g., pressing attack at `23` before completing `236`, missing `4` in `214`, incomplete `623 / 63214 / 22 / 66 / 44 / 360 / 720`).
     - Drive Rush Cancel direction errors (e.g., holding Down or Back during `2MK -> DR`, which prevents DR from coming out in SF6).
     - Short charge time for `[4]6`, `[2]8`, and `[4]646`.
     - Missing required directional holds (e.g., `2MK`) or Modern `AUTO` holds.
4. **1P Left / 2P Right (Mirrored) Side Training**
   - Switch between **1P Left (Default)** and **2P Right (Mirrored)** before starting practice.
   - Automatically mirrors motion sliders, directional cues, input detection, charge tracking, and error diagnostics so you can train combos on both sides of the screen.
5. **Fighter Roster, Search, Pinning & Combo Filters**
   - Full SF6 character roster with **search box** (supports English, Traditional/Simplified Chinese, Japanese, Korean, and `M. Bison / Vega` aliases) and **Pin Favorite Character** (pinned fighters stay at the top across restarts).
   - Filter combos by **Difficulty** (`All / Easy / Medium / Hard / Ultra Hard`) and **Position** (`Any Pos / Midscreen / Corner`).
   - Built-in 60fps real-recorded combos for both **Classic** and **Modern** modes (launch roster through Akuma, with more DLC characters on the way).
6. **Live 60fps Combo Recorder & JSON Sharing**
   - Records `236 / 214 / 623 / 323 / 33 / 633 (6->3->6->3) / 63214 / 2147 / 2369 / 360 / 720 / [4]6 / 4646 / [2]8 / 66 / 44`, 1st-hit charge moves, Hold & Release durations, and frame-by-frame stick/button playback history.
   - Supports setting **Corner / Midscreen** position and **custom tags** directly while recording.
   - One-click **Export** to `.json` file or **Copy JSON** to share combos, and **Load `.json` File** to import.
7. **5-Language UI, Resizable Window & Update Notifier**
   - Full **5-language support**: Traditional Chinese, Simplified Chinese, English, Japanese, and Korean — including all buttons, Settings keybind labels, fighter subtitles, combo tags, HUD, and execution error diagnostics.
   - **Resizable client window** (minimum `1120x760`) with a visible bottom-right resize grip that remembers your preferred window size across restarts.
   - Automatically checks GitHub Releases on startup and provides a direct link when a newer version is available.

### Quick Start (Windows Portable `.exe`)

1. **Download**: Go to **[Releases Latest](https://github.com/maxhorng/Rhythm-Combo-Trainer/releases/latest)**, download **`RhythmCombo-Trainer-*-win-portable.exe`**, and double-click to run (no installation or Node.js required).
   - *If Windows SmartScreen appears*: Click **More info -> Run anyway**. Source code is public on GitHub and every release includes a **SHA-256 checksum**. This is a pure visual rhythm aid — **no macros, no automated inputs, and no memory reading/writing**.
2. **Game Setup**:
   - Set *Street Fighter 6* to **Borderless Windowed**.
   - Enable **Low-Performance Mode** in the app for the smoothest 60fps experience.
   - For Hitbox / Haute42 / Fightstick users, use **XInput (Xbox) mode** for seamless background detection.
3. **Practice**:
   - Open **Settings / Keys & Lang** in the top-right to choose your language, customize global hotkeys (`F7` Review, `F8` Reset, `F9` Click-Through, `F10` Menu), and bind your keyboard/controller.
   - Pick **Classic** or **Modern**, select a character, side (**1P Left / 2P Right**), and combo, then click **Launch Transparent Overlay Mode**.

---

## 繁體中文

### 具體功能一覽

1. **透明覆蓋（Transparent Overlay）與低效能模式**
   - 直接浮動在《Street Fighter 6》遊戲畫面上方（請將 SF6 設為「無邊框視窗 / Borderless Windowed」），支援滑鼠穿透切換（預設 `F9`，可自訂）。
   - **低效能模式**：關閉模糊與發光特效、採用 1x 解析度並將即時輸入改為 Canvas 繪製（零 DOM 重繪），大幅降低遊戲掉幀。
2. **Windows 原生背景鍵盤與手把 / Hitbox / 大搖偵測**
   - 結合鍵盤全域監聽（`uiohook-napi`）與 **Windows 原生背景 XInput 輪詢**（`xinput1_4.dll`），支援 **Haute42 / GP2040-CE / Hitbox / Leverless / 大搖 / Xbox 手把**，切進 SF6 訓練場仍可即時同步偵測。
   - 支援多控制器合併讀取與 DInput POV Hat 方向解碼。
3. **60fps 幀數級節奏判定與即時指令錯誤診斷（`F7`）**
   - 提供 `PERFECT`（±0.35f）、`GOOD`（貼近 SF6 真實 Link / Cancel / Drive Rush 容錯）、`EARLY`、`LATE` 與 `MISS` 判定。
   - **動態重同步**：Cancel / Drive Rush / SA 自動對齊你的實際出招時間，Link 則保持嚴格目押節奏。
   - **當次連段檢討下拉面板（預設 `F7`，可自訂）**：隨時查看當次每一擊的幀數誤差與**即時操作錯誤診斷**，包含：
     - 搓招未完成（例如 `236` 只轉到 `23` 就按攻擊鍵、`214` 缺 `4`、`623 / 63214 / 22 / 66 / 44 / 360 / 720` 指令不完整）。
     - 綠衝（DR）方向錯誤（例如 `2MK -> DR` 時仍按住下或後方向導致綠衝出不去）。
     - `[4]6`、`[2]8`、`[4]646` 蓄力時間不足。
     - 方向普通技未按住指定方向（如 `2MK`），或現代模式未按住 `AUTO` 鍵。
4. **1P 左側 / 2P 右側（鏡像）雙邊連段練習**
   - 開始練習前可自由切換 **1P 左側（預設）** 或 **2P 右側（鏡像）**。
   - 切換至 2P 右側時，指令滑條、方向箭頭、實體輸入判定、蓄力計算與錯誤診斷皆會自動鏡像對應。
5. **角色搜尋、最愛釘選與連段分類篩選**
   - 左側角色列表支援**即時搜尋**（支援英文、繁簡中文、日文、韓文以及 `M. Bison / Vega` 雙名搜尋）與**釘選最愛角色**（置頂顯示並於重開機後保留）。
   - 右側連段列表支援依**難度**（全部 / 簡單 / 中等 / 困難 / Ultra Hard）與**站位**（全部位置 / 非角落 / 角落）快速篩選。
   - 內建經典（Classic）與現代（Modern）60fps 實錄連段（涵蓋首發角色至豪鬼 Akuma，後續 DLC 持續擴充）。
6. **實機 60fps 連段錄製與檔案分享**
   - 支援錄製 `236 / 214 / 623 / 323 / 33 / 633（按住 6 連點兩下 2）/ 63214 / 2147 / 2369 / 360 / 720 / [4]6 / 4646 / [2]8 / 66 / 44`、第一擊蓄力、長按放開（Hold & Release）與逐幀搖桿／按鍵輸入軌跡。
   - 錄製時可直接切換**角落 / 非角落**分類並填寫**自訂標籤**。
   - 支援一鍵**匯出 `.json` 檔案**或**複製 JSON** 分享給朋友，並支援**直接載入 `.json` 檔案**匯入。
7. **5 國語言切換、可縮放視窗與新版通知**
   - 完整支援 **繁體中文、简体中文、English、日本語、한국어** 5 國語言（涵蓋主介面按鈕、設定選單全部 18 個按鍵名稱、CAPCOM 官方角色副標、連段標籤、HUD 與指令錯誤診斷）。
   - 支援**自訂客戶端視窗大小**（最小 `1120x760`，右下角附縮放拉把）並於重開機後自動記住上次尺寸。
   - 啟動時自動檢查 GitHub Releases 是否有新版本並顯示下載提示。

### 快速開始（Windows 免安裝 `.exe`）

1. **下載執行檔**：前往 **[永久最新版下載連結](https://github.com/maxhorng/Rhythm-Combo-Trainer/releases/latest)**，下載 **`RhythmCombo-Trainer-*-win-portable.exe`** 並雙擊執行（免安裝、不需 Node.js）。
   - *若 Windows 跳出 SmartScreen 視窗*：點選 **「其他資訊」->「仍要執行」** 即可。本專案原始碼公開於 GitHub 且每個 Release 皆附 **SHA-256 驗證碼**，純視覺節奏輔助，絕無巨集、自動出招或記憶體讀寫。
2. **遊戲設定**：
   - 將《Street Fighter 6》設為 **「無邊框視窗 (Borderless Windowed)」**。
   - 建議開啟 App 內的**低效能模式**，確保遊戲與疊層皆維持穩定 60fps。
   - Hitbox / Haute42 / 大搖玩家建議切換為 **XInput（Xbox）模式**。
3. **開始練習**：
   - 點右上角 **「設定 / 按鍵與語言」** 選擇語言、自訂快捷鍵（`F7` 檢討、`F8` 重來、`F9` 穿透、`F10` 選單）並綁定鍵盤／手把。
   - 選好模式、角色、站位（**1P 左側 / 2P 右側**）與連段，點擊 **「開始透明覆蓋訓練模式 (Overlay)」** 即可開始練習。

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
本工具**完全免費使用**。如果這個工具幫你成功接出練很久的連段，歡迎隨喜請作者喝杯咖啡：

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/92liang)
