# RhythmCombo Trainer (Beta)

**Street Fighter 6 · osu!-Style Transparent Rhythm Combo Trainer Overlay**  
**快打旋風 6 · osu! 風格透明覆蓋節奏連段訓練器**

> **Author / 作者**：`maxhorng / 92anini`  
> **Latest Version / 最新版本**：`v0.2.0-beta.2`  
> **Download / 永久最新版下載**：**[下載最新 Windows 免安裝 `.exe` (Releases Latest)](https://github.com/maxhorng/Fighter-Thythm-Training/releases/latest)**

---

## 特色功能 (Features)

- **透明覆蓋（Transparent Overlay）＋ 效能模式**：
  - 直接浮動在《Street Fighter 6》遊戲畫面上方（請將 SF6 設為「無邊框視窗 / Borderless Windowed」），支援滑鼠穿透。
  - **內建「效能模式（低耗能模式）」**：大幅降低透明疊層的 GPU / CPU 負擔，**強烈推薦優先開啟**，讓 SF6 與疊層同時維持最順暢的 60fps。
- **Windows 原生背景手把 / Hitbox / 大搖偵測**：
  - 除了鍵盤全域監聽（`uiohook-napi`），更內建 **Windows 原生背景 XInput 監聽**，支援 **Haute42 / GP2040-CE / Hitbox / Leverless / 大搖 / Xbox 手把**，切進 SF6 訓練場一樣即時同步偵測（同時支援多控制器合併讀取與 DInput POV Hat）。
- **60fps 幀數級節奏判定**：
  - `PERFECT`（±0.35f 精準對拍）、`GOOD`（貼近 SF6 真實 Link / Cancel / Drive Rush 容錯）、`EARLY` / `LATE` / `MISS`。
  - **動態重同步**：Cancel / Drive Rush / SA 自動對齊你的實際出招時間，Link 則保持嚴格節奏不漂移。
- **第一季全首發角色（至 Rashid 前）內建 60fps 實錄連段**：
  - 涵蓋經典（Classic）與現代（Modern）模式，包含一般連段、角落連段與紫色 **`Ultra Hard`** 高難度挑戰，後續 DLC 角色將持續更新。
- **全新 SF6 角色專屬色卡介面 ＆ 啟動視覺化教學**：
  - 左側選角列採用角色專屬漸層色卡、斜體頭像徽章與連段數量提示；首次啟動自動彈出 **4 步驟圖文新手教學**（隨時可由右上角「使用教學 / Guide」重看）。
- **實機 60fps 錄製與檔案分享**：
  - 完整支援 `236 / 214 / 623 / 323 / 33 / 63214 / 2147 / 2369 / 360 / 720 / [4]6 / 4646 / [2]8 / 66 / 44`、第一擊蓄力與長按放開（Hold & Release）。
  - 連段卡片支援 **一鍵匯出 `.json` 檔案**（可直接傳檔給朋友）或複製文字；匯入視窗支援 **直接選擇檔案匯入**。
- **全自訂按鍵與多語系**：
  - 支援自訂 **滑鼠穿透（預設 `F9`）**、**返回選單（預設 `F10`）** 與 **不搶鍵同步重置（`RESET`，預設 `F8`，可設成與 SF6 相同的重置鍵如 `2`）**。
  - 支援 **繁體中文 / English** 即時切換。

---

## 電腦小白快速使用教學（免安裝 `.exe`）

### 步驟 1：下載免安裝執行檔
1. 點擊上方 **[永久最新版下載連結](https://github.com/maxhorng/Fighter-Thythm-Training/releases/latest)**。
2. 滑到頁面下方 **Assets**，下載 **`RhythmCombo-Trainer-*-win-portable.exe`**。
3. 直接雙擊執行即可（**免安裝、不需要裝 Node.js**）。

> **如果 Windows 跳出「Windows 已保護您的電腦」藍色視窗：**  
> 這是因為個人作品沒有購買商業數位簽章憑證。請點選 **「其他資訊」→「仍要執行」** 即可。本專案原始碼完全公開於 GitHub，且每個 Release 均附有 **SHA-256 校驗碼**，純粹做畫面節奏輔助，**絕不含任何木馬、巨集自動出招或記憶體讀寫**。

### 步驟 2：遊戲與效能設定（非常重要）
- 請先開啟《Street Fighter 6》，到遊戲設定 → 畫面設定，將顯示模式改為 **「無邊框視窗 (Borderless Windowed)」**（獨佔全螢幕會蓋住透明覆蓋層）。
- **強烈推薦先開啟「效能模式（低耗能模式）」**：若電腦同時跑 SF6 與透明疊層覺得微卡，開啟效能模式並確保 SF6 訓練場穩定 60fps，體感會大幅變順。
- **Hitbox / Haute42 / 大搖玩家**：建議切換為 **XInput（Xbox）模式**，進遊戲後即可全天候背景即時偵測。

### 步驟 3：設定你的按鍵與語言
1. 點擊右上角 **「設定 / 按鍵與語言」**。
2. 可在最上方切換 **繁體中文 / English**，並自訂 **切換滑鼠穿透（預設 `F9`）** 與 **返回選單（預設 `F10`）** 全域快捷鍵。
3. 點擊各個方向鍵、攻擊鍵與 `RESET`（重置鍵）欄位，按下你的鍵盤、Hitbox 或手把按鈕完成綁定（建議與 SF6 訓練場一致）。

### 步驟 4：開始練連段
1. 選擇 **經典 Classic** 或 **現代 Modern** 模式 → 選擇角色 → 選擇連段譜面。
2. 點擊底部 **「開始透明覆蓋訓練模式 (Overlay)」**。
3. 切回 SF6 訓練場畫面，按下連段的 **第一擊** 就會自動開始跑拍子。

---

## 如何錄製自己的連段 / 匯入別人的連段檔案

- **錄製**：點右上角 **「錄製我的連段」** → 切回 SF6 直接打出連段 → 打錯按 **`RESET`** 清空重錄，打完按 **`F10`** 自動儲存並複製。
- **分享**：在主選單連段卡片上點 **「匯出 / Export」** 直接下載檔案傳給朋友（或點「複製 JSON」）。
- **載入**：點 **「匯入 / 指令轉譜面」** → 切到 JSON 分頁 → 點 **「選擇 .json 檔案匯入」** 即可直接開練。

---

## 開發者本地執行 (For Developers)

```bash
git clone https://github.com/maxhorng/Fighter-Thythm-Training.git
cd Fighter-Thythm-Training
npm install
npm run dev       # 開發模式啟動
npm run dist:win  # 打包 Windows 免安裝 .exe（輸出於 release/）
```

---

## 贊助支持 (Support — Optional)

本工具**完全免費使用**。如果這個小工具幫你成功接出練很久的連段，歡迎隨喜請作者喝杯咖啡：

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/92liang)

---

## License & Disclaimer / 授權與免責聲明

- 本專案採 **All Rights Reserved（原始碼可見、僅供個人免費使用與分享連段檔案，禁止未經授權之修改、商用與再發佈）**，詳見 [LICENSE](./LICENSE)。
- 本工具為純視覺節奏練習輔助軟體，**不包含任何巨集（Macro）、自動出招或記憶體讀取/修改功能**，僅供個人於訓練場練習連段節奏使用。
