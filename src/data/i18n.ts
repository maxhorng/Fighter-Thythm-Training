export type AppLang = 'zh-TW' | 'en';

export interface OverlayHotkeys {
  clickThrough: string; // KeyboardEvent.code, default 'F9'
  exitOverlay: string;  // KeyboardEvent.code, default 'F10'
  toggleReview: string; // KeyboardEvent.code, default 'F7'
}

export const DEFAULT_OVERLAY_HOTKEYS: OverlayHotkeys = {
  clickThrough: 'F9',
  exitOverlay: 'F10',
  toggleReview: 'F7',
};

/**
 * Returns the localized combo title. When lang === 'en', uses explicit combo.titleEn
 * if provided, or cleanly translates standard Chinese FGC terms into English FGC notation.
 */
export function getComboTitle(
  combo: { title: string; titleEn?: string },
  lang: AppLang
): string {
  if (lang !== 'en') return combo.title;
  if (combo.titleEn) return combo.titleEn;

  const replacements: [RegExp, string][] = [
    [/🚧\s*施工中\.\.\./g, '🚧 WIP...'],
    [/\[角落\]/g, '[Corner]'],
    [/角落連段/g, 'Corner Combo'],
    [/角落/g, 'Corner'],
    [/現代雙震地連段/g, 'Modern Double Seismo Combo'],
    [/雙震地/g, 'Double Seismo'],
    [/練習震地大跳取消火腿/g, 'Seismo SJC Burn Kick Drill'],
    [/震地\+重腳大跳取消/g, 'Seismo + 5HK SJC'],
    [/火腿/g, 'Burn Kick'],
    [/震地/g, 'Seismo'],
    [/中段後續壓持續/g, 'Overhead Oki'],
    [/全資源綠衝連段/g, 'Full-Meter DR Combo'],
    [/全資源大招連段/g, 'Full-Meter Super Combo'],
    [/一鍵 SA3/g, '1-Button SA3'],
    [/消費幀/g, 'Frame Kill'],
    [/安全跳連段/g, 'Safe Jump Combo'],
    [/安全跳/g, 'Safe Jump'],
    [/三綠衝/g, 'Triple DR'],
    [/雙綠衝/g, 'Double DR'],
    [/綠衝起手/g, 'DR'],
    [/綠衝長連段/g, 'DR Long Combo'],
    [/綠衝蓄力收尾/g, 'DR Charge Ender'],
    [/綠衝/g, 'DR'],
    [/目標連疾跑連段/g, 'TC Run Combo'],
    [/目標連蓄力頭槌/g, 'TC Charge Headbutt'],
    [/目標連/g, 'Target Combo'],
    [/蓄力頭槌接/g, 'Charge Headbutt into'],
    [/大銀杏投/g, 'Oicho Throw'],
    [/蓄力起始/g, 'Charge Starter'],
    [/蓄力/g, 'Charge'],
    [/輕攻擊確反/g, 'Light Punish'],
    [/基礎確反/g, 'Basic Punish'],
    [/基礎連段/g, 'BnB Combo'],
    [/浮空壓制/g, 'Juggle Oki'],
    [/浮空連段/g, 'Juggle Combo'],
    [/空連/g, 'Air Combo'],
    [/瞬移壓制/g, 'Teleport Oki'],
    [/壓制連段/g, 'Oki Combo'],
    [/壓制/g, 'Oki'],
    [/後衝投/g, 'Backdash Throw'],
    [/前衝/g, 'Dash'],
    [/雙 OD/g, 'Double OD'],
    [/全套/g, 'Full'],
    [/大招/g, 'Super'],
    [/新夢幻連段/g, 'Shin Dream'],
    [/實錄連段/g, 'Recorded Combo'],
    [/起始/g, 'Starter'],
    [/長連段/g, 'Long Combo'],
    [/連段/g, 'Combo'],
    [/範例/g, 'Sample'],
    [/接/g, 'into'],
    [/投/g, 'Throw'],
    [/(\d+)\s*擊/g, '$1 Hits'],
  ];

  let out = combo.title;
  for (const [pattern, rep] of replacements) {
    out = out.replace(pattern, ` ${rep} `);
  }
  return out.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
}

export const I18N = {
  'zh-TW': {
    appSubtitle: 'Street Fighter 6 · osu! 風格透明覆蓋節奏連段訓練器',
    authorCredit: '作者: maxhorng / 92anini',
    betaBadge: 'BETA',
    keybindBtn: '設定 / 按鍵與語言',
    step1Title: '1. 操作模式',
    classicLabel: '經典 Classic',
    classicSub: '6 鍵 (LP MP HP / LK MK HK)',
    modernLabel: '現代 Modern',
    modernSub: '4 鍵 (L M H SP + AUTO)',
    step2Title: '2. 選擇角色 (SF6 全角色)',
    startTriggerTitle: '觸發方式',
    triggerFirst: '按第一擊自動開始',
    triggerCountdown: '3 秒倒數開始',
    liveInputTitle: '即時輸入監控',
    liveInputIdle: '按下鍵盤或手把測試...',
    step3Title: '3. 選擇連段譜面',
    recordBtn: '● 錄製我的連段',
    importBtn: '匯入 / 指令轉譜面',
    emptyCombos: '此角色目前尚未有連段，點上方「● 錄製我的連段」或「+ 匯入 / 指令轉譜面」即可新增。',
    unlockBtn: '🔒 解鎖（後果自負）',
    copyJson: '複製 JSON',
    copiedJson: '已複製!',
    deleteComboTitle: '刪除此自訂/實錄連段',
    showRecordedInputs: '在畫面最底下同步顯示「錄製時的搖桿方向與攻擊鍵」（需含實錄 inputHistory）',
    lowPerfMode: '低效能模式（關閉模糊與發光特效、1x 解析度、零 DOM 重繪，大幅降低遊戲掉幀）',
    startOverlayBtn: '開始透明覆蓋訓練模式 (Overlay)',
    hotkeyHintRestart: '重來',
    hotkeyHintClickThrough: '切換滑鼠穿透',
    hotkeyHintExit: '返回選單',
    hotkeyHintPrefix: '進入透明模式後：',
    // KeybindPanel
    settingsTitle: '設定、按鍵與控制器',
    settingsSub: '點擊右側欄位後按下任意鍵盤或手把按鈕即可綁定',
    gamepadDetected: '已偵測控制器',
    gamepadNotDetected: '未偵測到控制器（可插上手把後按任意鍵喚醒）',
    resetDefault: '還原預設',
    languageLabel: '介面語言 / Language',
    globalHotkeysTitle: '透明模式全域快捷鍵（系統層級，遊戲中隨時有效）',
    clickThroughLabel: '切換滑鼠穿透 (Click-Through)',
    exitOverlayLabel: '返回使用者選單 (Exit Overlay)',
    toggleReviewLabel: '展開/收合當次連段檢討 (Review)',
    pressAnyKey: '請按下任意鍵...',
    pressGamepad: '請按手把鍵...',
    unbound: '未綁定',
  },
  en: {
    appSubtitle: 'Street Fighter 6 · osu!-Style Transparent Rhythm Combo Trainer',
    authorCredit: 'Author: maxhorng / 92anini',
    betaBadge: 'BETA',
    keybindBtn: 'Settings / Keys & Lang',
    step1Title: '1. Control Mode',
    classicLabel: 'Classic',
    classicSub: '6-Button (LP MP HP / LK MK HK)',
    modernLabel: 'Modern',
    modernSub: '4-Button (L M H SP + AUTO)',
    step2Title: '2. Select Character (Full SF6 Roster)',
    startTriggerTitle: 'Start Trigger',
    triggerFirst: 'Start on 1st Hit',
    triggerCountdown: '3s Countdown',
    liveInputTitle: 'Live Input Monitor',
    liveInputIdle: 'Press keyboard or gamepad to test...',
    step3Title: '3. Select Combo Chart',
    recordBtn: '● Record My Combo',
    importBtn: 'Import / Load Combo',
    emptyCombos: 'No combos for this character yet. Click "● Record My Combo" or "+ Import / Load Combo" above.',
    unlockBtn: '🔒 Unlock (At Your Own Risk)',
    copyJson: 'Copy JSON',
    copiedJson: 'Copied!',
    deleteComboTitle: 'Delete this custom/recorded combo',
    showRecordedInputs: 'Show recorded stick & button playback bar at the bottom (requires inputHistory)',
    lowPerfMode: 'Low-Performance Mode (disable blur/glow, 1x canvas DPR, zero-DOM input strip to prevent FPS drops)',
    startOverlayBtn: 'Start Transparent Overlay Training',
    hotkeyHintRestart: 'Restart',
    hotkeyHintClickThrough: 'Toggle Click-Through',
    hotkeyHintExit: 'Return to Menu',
    hotkeyHintPrefix: 'In Overlay Mode: ',
    // KeybindPanel
    settingsTitle: 'Settings, Keybinds & Controller',
    settingsSub: 'Click any slot on the right and press a keyboard or gamepad button to bind',
    gamepadDetected: 'Controller detected',
    gamepadNotDetected: 'No controller detected (plug in and press any button)',
    resetDefault: 'Reset Defaults',
    languageLabel: 'Language / 介面語言',
    globalHotkeysTitle: 'Global Overlay Hotkeys (works even while SF6 is focused)',
    clickThroughLabel: 'Toggle Mouse Click-Through',
    exitOverlayLabel: 'Return to Main Menu',
    toggleReviewLabel: 'Toggle Combo Review Dropdown',
    pressAnyKey: 'Press any key...',
    pressGamepad: 'Press button...',
    unbound: 'Unbound',
  },
} as const;
