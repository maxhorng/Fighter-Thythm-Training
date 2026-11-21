# Fighter Thythm Training (v1)

一個給 Street Fighter 6 用的透明節奏疊層練習工具（類似 osu! 縮圈），可以蓋在遊戲畫面上方練習連段時機，支援鍵盤與搖桿、經典（Classic）與現代（Modern）操作模式。

## 功能
- 透明疊層覆蓋在遊戲上，左半邊顯示方向 / 指令（`236`、`214`、`623`、`22`、`66`），右半邊顯示攻擊鍵縮圈。
- 支援即時 60fps 錄製自己的連段，錄完可直接存進清單、複製 JSON 或刪除。
- 依 SF6 實際判定區分目押（link）、取消（cancel）、綠衝取消（dr-cancel）與浮空（juggle）容錯窗。

## 啟動方式

需要安裝 [Node.js](https://nodejs.org/)。

```bash
npm install
npm run dev
```

或在 Windows 直接雙擊 `start.bat`。

## 操作快捷鍵
- `F8`：重新開始目前連段（錄製模式中為清空重錄）
- `F9`：切換滑鼠穿透（開啟後滑鼠可直接點遊戲視窗）
- `F10`：結束疊層並回到主選單（錄製模式中會自動儲存連段）
