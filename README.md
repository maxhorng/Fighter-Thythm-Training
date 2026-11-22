# Fighter Thythm Training (Beta)

**Street Fighter 6 · osu!-Style Transparent Rhythm Combo Trainer Overlay**  
**快打旋風 6 · osu! 風格透明覆蓋節奏連段訓練器**

> **Author / 作者**：`maxhorng / 92anini`  
> **Version / 版本**：`v0.2.0-beta.1`

---

## ✨ 特色功能 (Features)

- **透明覆蓋（Transparent Overlay）**：直接浮動在《Street Fighter 6》遊戲畫面上方（請將 SF6 設為「無邊框視窗 / Borderless Windowed」），支援滑鼠穿透。
- **60fps 幀數級節奏判定**：
  - `PERFECT`（±0.35f 精準對拍）、`GOOD`（貼近 SF6 真實 Link / Cancel / Drive Rush 容錯）、`EARLY` / `LATE` / `MISS`。
  - **動態重同步**：Cancel / Drive Rush / SA 自動對齊你的實際出招時間，Link 則保持嚴格節奏不漂移。
- **實機 60fps 錄製與分享**：
  - 內建實機錄製器，完整支援經典（Classic）與現代（Modern）模式，可錄下 `236 / 214 / 623 / 323 / 33 / 2147 / 2369 / 360 / 720 / [4]6 / [2]8 / 66` 與長按放開（Hold & Release）。
  - 一鍵複製 JSON 分享給朋友，或直接匯入別人的連段 JSON 檔案。
- **底部實錄輸入回放條**：同步顯示錄製當時的搖桿方向與按鍵狀態。
- **全自訂按鍵與語言**：支援鍵盤與手把（Gamepad API）、自訂滑鼠穿透與返回選單全域快捷鍵、支援 **繁體中文 / English** 介面切換。

---

## 🚀 電腦小白快速使用教學（免安裝 `.exe`）

### 步驟 1：下載免安裝執行檔
1. 前往本專案右側的 **[Releases](https://github.com/maxhorng/Fighter-Thythm-Training/releases)** 頁面。
2. 下載最新版本的 **`Fighter-Thythm-Training-0.2.0-beta.1-win-portable.exe`**。
3. 直接雙擊執行即可（**免安裝、不需要裝 Node.js**）。

> **💡 如果 Windows 跳出「Windows 已保護您的電腦」藍色視窗：**  
> 這是因為個人開源小工具沒有購買商業數位簽章憑證。請點選 **「其他資訊」→「仍要執行」** 即可。本專案完全開源，只讀取按鍵做畫面節奏顯示，**不會對遊戲送出任何自動按鍵或修改記憶體**。

### 步驟 2：遊戲設定（非常重要！）
- 請先開啟《Street Fighter 6》，到遊戲設定 → 畫面設定，將顯示模式改為 **「無邊框視窗 (Borderless Windowed)」**（全螢幕模式會蓋住透明覆蓋層）。
- ⚠️ **效能提醒**：本工具需與《Street Fighter 6》同時以 60fps 渲染透明覆蓋層。若電腦配備較舊或背景程式較多，可能會出現畫面掉幀、連段節奏微卡或不同步的情況；建議先**適度調低 SF6 畫質、關閉背景瀏覽器/錄影軟體，並確保訓練場穩定 60fps**，體驗會順暢許多！

### 步驟 3：設定你的按鍵與語言
1. 點擊右上角 **「設定 / 按鍵與語言」**。
2. 可在最上方切換 **繁體中文 / English**。
3. 可自訂 **透明模式全域快捷鍵**：
   - **切換滑鼠穿透**：預設 `F9`
   - **返回使用者選單**：預設 `F10`
   - **重置訓練場 / 同步重來（RESET）**：預設 `F8`（手把預設 `Select`）
4. 點擊各個方向鍵與攻擊鍵欄位，按下你的鍵盤或手把按鈕完成綁定（建議與 SF6 訓練場設定一致）。

### 步驟 4：開始練連段！
1. 選擇 **經典 Classic** 或 **現代 Modern** 模式 → 選擇角色 → 選擇內建連段譜面。
2. 點擊底部 **「開始透明覆蓋訓練模式 (Overlay)」**。
3. 切回 SF6 訓練場畫面，按下連段的 **第一擊** 就會自動開始跑拍子！
4. 練習過程中隨時可按：
   - **`F8`**：重置並重新對拍
   - **`F9`**：切換滑鼠穿透（想用滑鼠點覆蓋層按鈕時按一次）
   - **`F10`**：結束訓練並返回主選單

---

## 🎬 如何錄製自己的連段 / 匯入別人的連段？

### 錄製自己的連段
1. 在主選單選好角色與模式，點右上角 **「● 錄製我的連段」**。
2. 切回 SF6 訓練場直接打出你的連段，程式會以 60fps 精準記錄每一擊與搖桿軌跡。
3. 打錯可按 **`F8`** 清空重錄；打完按 **`F10`** 就會自動儲存並複製 JSON 到剪貼簿！

### 分享或載入別人的連段
- **分享**：在主選單的連段卡片上點 **「複製 JSON」**，貼給朋友即可。
- **載入**：點 **「+ 匯入 / 指令轉譜面」**，把別人分享的 JSON 貼上匯入即可直接開練。

---

## 🛠️ 開發者本地執行（For Developers）

```bash
git clone https://github.com/maxhorng/Fighter-Thythm-Training.git
cd Fighter-Thythm-Training
npm install
npm run dev       # 開發模式啟動
npm run dist:win  # 打包 Windows 免安裝 .exe（輸出於 release/）
```

---

## 📄 Disclaimer / 免責聲明

本工具為純視覺節奏練習輔助軟體，**不包含任何巨集（Macro）、自動出招或記憶體讀取/修改功能**，僅供個人於訓練場練習連段節奏使用。
