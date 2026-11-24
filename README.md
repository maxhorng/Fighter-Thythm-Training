# Frame Beat Trainer (FBT)

**Street Fighter 6 · Transparent Rhythm Combo Trainer Overlay**  
**快打旋風 6 · 透明覆蓋節奏連段訓練器**  
**ストリートファイター6 · 透過オーバーレイ リズムコンボ練習ツール**

> **Author / 作者 / 制作**: `maxhorng / 92anini`  
> **Latest Version / 最新版本 / 最新版**: `v0.3.2`  
> **Download / 永久最新版下載 / ダウンロード**: **[Download Latest Windows Portable `.exe` (Releases Latest)](https://github.com/maxhorng/Frame-Beat-Trainer/releases/latest)**

Click a language below to expand / 點擊下方語言展開說明 / 下の言語をクリックして展開:

---

<details open>
<summary><strong>English</strong></summary>

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

1. **Download**: Go to **[Releases Latest](https://github.com/maxhorng/Frame-Beat-Trainer/releases/latest)**, download **`Frame-Beat-Trainer-*-win-portable.exe`**, and double-click to run (no installation or Node.js required).
   - *If Windows SmartScreen appears*: Click **More info -> Run anyway**. Source code is public on GitHub and every release includes a **SHA-256 checksum**. This is a pure visual rhythm aid — **no macros, no automated inputs, and no memory reading/writing**.
2. **Game Setup**:
   - Set *Street Fighter 6* to **Borderless Windowed**.
   - Enable **Low-Performance Mode** in the app for the smoothest 60fps experience.
   - For Hitbox / Haute42 / Fightstick users, use **XInput (Xbox) mode** for seamless background detection.
3. **Practice**:
   - Open **Settings / Keys & Lang** in the top-right to choose your language, customize global hotkeys (`F7` Review, `F8` Reset, `F9` Click-Through, `F10` Menu), and bind your keyboard/controller.
   - Pick **Classic** or **Modern**, select a character, side (**1P Left / 2P Right**), and combo, then click **Launch Transparent Overlay Mode**.

</details>

<details>
<summary><strong>繁體中文 (Traditional Chinese)</strong></summary>

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

1. **下載執行檔**：前往 **[永久最新版下載連結](https://github.com/maxhorng/Frame-Beat-Trainer/releases/latest)**，下載 **`Frame-Beat-Trainer-*-win-portable.exe`** 並雙擊執行（免安裝、不需 Node.js）。
   - *若 Windows 跳出 SmartScreen 視窗*：點選 **「其他資訊」->「仍要執行」** 即可。本專案原始碼公開於 GitHub 且每個 Release 皆附 **SHA-256 驗證碼**，純視覺節奏輔助，絕無巨集、自動出招或記憶體讀寫。
2. **遊戲設定**：
   - 將《Street Fighter 6》設為 **「無邊框視窗 (Borderless Windowed)」**。
   - 建議開啟 App 內的**低效能模式**，確保遊戲與疊層皆維持穩定 60fps。
   - Hitbox / Haute42 / 大搖玩家建議切換為 **XInput（Xbox）模式**。
3. **開始練習**：
   - 點右上角 **「設定 / 按鍵與語言」** 選擇語言、自訂快捷鍵（`F7` 檢討、`F8` 重來、`F9` 穿透、`F10` 選單）並綁定鍵盤／手把。
   - 選好模式、角色、站位（**1P 左側 / 2P 右側**）與連段，點擊 **「開始透明覆蓋訓練模式 (Overlay)」** 即可開始練習。

</details>

<details>
<summary><strong>日本語 (Japanese)</strong></summary>

### 主な機能

1. **透過オーバーレイ ＆ 軽量モード**
   - 『ストリートファイター6』のゲーム画面上に直接オーバーレイ表示（SF6 の表示設定は**ボーダーレスウィンドウ**推奨）。クリック透過の切替（初期設定 `F9`、変更可能）に対応。
   - **軽量モード**：ぼかし・発光エフェクトを無効化し、1x 解像度かつ Canvas 直接描画（DOM 再描画ゼロ）でゲーム側の FPS 低下を最小限に抑えます。
2. **Windows ネイティブ バックグラウンド入力検出（キーボード / アケコン / レバーレス）**
   - グローバルキーボード監視（`uiohook-napi`）に加え、**Windows ネイティブ XInput ポーリング**（`xinput1_4.dll`）を内蔵。**Haute42 / GP2040-CE / Hitbox / レバーレス / アケコン / Xbox コントローラー**が SF6 にフォーカスした状態でもそのまま反応します。
   - 複数コントローラーの統合読み取りおよび DInput POV Hat にも対応。
3. **60fps フレーム精度判定 ＆ リアルタイム入力ミス診断（`F7`）**
   - 各ヒットを `PERFECT`（±0.35f）、`GOOD`（SF6 の実戦的な目押し・キャンセル・ラッシュ猶予）、`EARLY`、`LATE`、`MISS` で判定。
   - **動的リシンク**：キャンセル、ドライブラッシュ、SA は実際の入力タイミングに自動で追従し、目押し（Link）は厳密なリズムを維持します。
   - **コンボ振り返りドロップダウン（初期設定 `F7`、変更可能）**：各ステップのフレーム誤差と**技が出なかった原因の自動診断**を表示します：
     - コマンド未成立（例：`236` を `23` で早押しして `6` 抜け、`214` の `4` 抜け、`623 / 63214 / 22 / 66 / 44 / 360 / 720` の入力不完全）。
     - キャンセルラッシュ時の方向ミス（`2MK -> ラッシュ` で下や後ろを押しっぱなしにしてしまいラッシュが出ないケース）。
     - `[4]6`、`[2]8`、`[4]646` のタメ時間不足。
     - 方向キー付き通常技（例：`2MK`）やモダン操作の `AUTO` ボタン押し忘れ。
4. **1P 左側 / 2P 右側（反転）両サイド練習**
   - 練習開始前に **1P 左側（標準）** と **2P 右側（反転）** をワンクリックで切替可能。
   - 2P 側ではコマンドスライダー、方向矢印、入力判定、タメ計測、ミス診断のすべてが自動で左右反転されます。
5. **キャラ検索・お気に入りピン留め・コンボ絞り込み**
   - キャラ一覧に**検索ボックス**（英語・日本語・韓国語・中国語および `M. Bison / ベガ (Vega)` の両表記に対応）と**お気に入りピン留め機能**を搭載。
   - コンボ一覧を**難易度**（すべて / 初級 / 中級 / 上級 / Ultra Hard）と**位置**（位置すべて / 中央 / 画面端）で絞り込み可能。
   - 初期キャラ〜豪鬼までのクラシック / モダン両対応 60fps 実機録画コンボを内蔵（今後の DLC キャラも順次追加予定）。
6. **実機 60fps コンボ録画 ＆ JSON 共有**
   - `236 / 214 / 623 / 323 / 33 / 633（6押しっぱなし+2連打） / 63214 / 2147 / 2369 / 360 / 720 / [4]6 / 4646 / [2]8 / 66 / 44`、初段タメ技、ホールド＆リリース、フレーム単位のキー履歴再生に対応。
   - 録画中に**画面端 / 中央**の切替や**カスタムタグ**の付与が可能。
   - ワンクリックで `.json` ファイルへ書き出し・共有、およびファイルからのインポートに対応。
7. **5 言語対応・リサイズ可能ウィンドウ・アップデート通知**
   - **繁體中文 / 简体中文 / English / 日本語 / 한국어** の 5 言語に完全対応（ボタン、キー設定、CAPCOM 公式キャラ名、タグ、HUD、入力ミス診断まで対応）。
   - クライアントウィンドウは**サイズ変更可能**（最小 `1120x760`、右下にリサイズグリップ付き）で、再起動後もサイズを記憶します。
   - 起動時に GitHub Releases の最新版を自動チェックして通知します。

### クイックスタート（Windows ポータブル `.exe`）

1. **ダウンロード**：**[Releases Latest](https://github.com/maxhorng/Frame-Beat-Trainer/releases/latest)** から **`Frame-Beat-Trainer-*-win-portable.exe`** をダウンロードし、ダブルクリックで起動（インストール・Node.js 不要）。
   - *Windows SmartScreen が表示された場合*：**詳細情報 -> 実行** を選択してください。ソースコードは GitHub で公開されており、全リリースに **SHA-256 チェックサム**を添付しています。純粋な視覚リズム練習ツールであり、マクロ・自動入力・メモリ読み書きは一切行いません。
2. **ゲーム設定**：
   - 『ストリートファイター6』を **ボーダーレスウィンドウ** に設定してください。
   - 安定した 60fps 動作のため、アプリ内の**軽量モード**の有効化をおすすめします。
   - レバーレス / Haute42 / アケコンは **XInput（Xbox）モード** での使用を推奨します。
3. **練習開始**：
   - 右上の **「設定 / キー・言語」** から言語を「日本語」に切り替え、ショートカット（`F7` 振り返り / `F8` リトライ / `F9` 透過切替 / `F10` メニュー）とキー割り当てを設定。
   - 操作タイプ、キャラ、立ち位置（**1P 左側 / 2P 右側**）、コンボを選び、**「透過オーバーレイ練習を開始 (Overlay)」** をクリックして練習開始です。

</details>

---

## For Developers / 開發者本地執行

```bash
git clone https://github.com/maxhorng/Frame-Beat-Trainer.git
cd Frame-Beat-Trainer
npm install
npm run dev       # Start in development mode
npm run dist:win  # Build Windows portable .exe (outputs to release/)
```

---

## Support (Optional) / 贊助支持

This tool is **100% free to use**. If it helps you land your combos, feel free to buy the author a coffee:  
本工具**完全免費使用**。如果這個工具幫你成功接出練很久的連段，歡迎隨喜請作者喝杯咖啡：

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/92liang)
