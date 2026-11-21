import { ComboData } from '../types/combo';

export interface CharacterInfo {
  id: string;
  name: string;
  title: string;
  accent: string;
}

export const CHARACTERS: CharacterInfo[] = [
  { id: 'ryu', name: 'Ryu', title: '隆 · 永恆的求道者', accent: '#38bdf8' },
  { id: 'ken', name: 'Ken', title: '肯 · 烈火格鬥家', accent: '#f43f5e' },
  { id: 'luke', name: 'Luke', title: '路克 · 新世代戰士', accent: '#facc15' },
  { id: 'chunli', name: 'Chun-Li', title: '春麗 · 蒼藍翡翠', accent: '#60a5fa' },
  { id: 'jp', name: 'JP', title: 'JP · 虛空魔導士', accent: '#6366f1' },
  { id: 'ed', name: 'Ed', title: '艾德 · 精神力拳擊手', accent: '#a855f7' },
];

/**
 * SF6 Frame Timing Reference (60fps):
 * - Link (目押): Total Frames (Startup + Active + Recovery - 1) + Hitstop (~10f M / ~12f H)
 * - Special / DR Cancel (取消): Startup + ~4~6f into Hitstop
 * - Drive Rush Cancel -> Next Normal: ~10f DR Freeze + ~10f Dash Startup = ~20f
 */
export const BUILTIN_COMBOS: ComboData[] = [
  // ================= RYU CLASSIC =================
  {
    id: 'ryu-classic-bnb',
    characterId: 'ryu',
    characterName: 'Ryu',
    mode: 'classic',
    title: '基礎確反連段 (2MK → 236HP 波動拳)',
    difficulty: 'Beginner',
    description: '2MK 發生 8f + 命中卡肉取消(+6f) → 14f 時完成 236HP 波動拳取消。',
    tags: ['BnB', '236滑條', 'Cancel 取消'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['DOWN', 'MK'], notation: '2MK', moveName: '蹲中腳 (8f)', x: 0.62, y: 0.50 },
      { id: 'n2', frame: 14, buttons: ['HP'], motion: '236', notation: '236HP', moveName: '重波動拳 (取消)', x: 0.78, y: 0.50 },
    ],
  },
  {
    id: 'ryu-classic-jumpin',
    characterId: 'ryu',
    characterName: 'Ryu',
    mode: 'classic',
    title: '跳攻擊起手連段 (↗前跳 → j.HP → 5MP → 2MP → 236HP)',
    difficulty: 'Beginner',
    description: '按下前上(↗)起跳瞬間啟動！依據 Ryu 45f 跳躍數據 (4+38+3)，練習低點跳重拳落地接連段。',
    tags: ['跳攻擊練習', '45f跳躍', '新手必練'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['RIGHT', 'UP'], notation: '↗ 前跳', moveName: '前上起跳 (45f)', x: 0.54, y: 0.50 },
      { id: 'n2', frame: 30, buttons: ['HP'], notation: 'j.HP', moveName: '低點跳重拳 (+30f)', x: 0.63, y: 0.50 },
      { id: 'n3', frame: 54, buttons: ['MP'], notation: '5MP', moveName: '落地立中拳', x: 0.72, y: 0.50 },
      { id: 'n4', frame: 84, buttons: ['DOWN', 'MP'], notation: '2MP', moveName: '蹲中拳 (目押)', x: 0.81, y: 0.50 },
      { id: 'n5', frame: 96, buttons: ['HP'], motion: '236', notation: '236HP', moveName: '重波動拳 (取消)', x: 0.89, y: 0.50 },
    ],
  },
  {
    id: 'ryu-classic-dr',
    characterId: 'ryu',
    characterName: 'Ryu',
    mode: 'classic',
    title: '綠衝核心連段 (5MP → 2MP → DR → 5HP → 4HP → 623HP)',
    difficulty: 'Intermediate',
    description: '真實 SF6 幀數：5MP(+30f目押) → 2MP(+12f取消綠衝) → DR(+27f綠衝空窗) → 5HP(+44f目押) → 4HP(+15f取消昇龍)。',
    tags: ['Drive Rush', '真實幀數', '目押+取消'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['MP'], notation: '5MP', moveName: '立中拳 (起手)', x: 0.54, y: 0.50 },
      { id: 'n2', frame: 30, buttons: ['DOWN', 'MP'], notation: '2MP', moveName: '蹲中拳 (目押)', x: 0.61, y: 0.50 },
      { id: 'n3', frame: 42, buttons: ['PARRY'], notation: 'DR', moveName: '綠衝取消', x: 0.68, y: 0.50 },
      { id: 'n4', frame: 69, buttons: ['HP'], notation: '5HP', moveName: '立重拳 (+27f)', x: 0.75, y: 0.50 },
      { id: 'n5', frame: 113, buttons: ['LEFT', 'HP'], notation: '4HP', moveName: '後重拳 (目押)', x: 0.82, y: 0.50 },
      { id: 'n6', frame: 128, buttons: ['HP'], motion: '623', notation: '623HP', moveName: '重昇龍拳 (取消)', x: 0.89, y: 0.50 },
    ],
  },

  // ================= RYU MODERN =================
  {
    id: 'ryu-modern-bnb',
    characterId: 'ryu',
    characterName: 'Ryu',
    mode: 'modern',
    title: '現代基礎連段 (2M → SP 波動拳)',
    difficulty: 'Beginner',
    description: '2M (8f) 命中卡肉瞬間按下 SP 取消波動拳。',
    tags: ['Modern', 'Cancel 取消'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['DOWN', 'M'], notation: '2M', moveName: '蹲中攻擊 (8f)', x: 0.62, y: 0.50 },
      { id: 'n2', frame: 14, buttons: ['SP'], notation: 'SP', moveName: '波動拳 (取消)', x: 0.78, y: 0.50 },
    ],
  },
  {
    id: 'ryu-modern-auto',
    characterId: 'ryu',
    characterName: 'Ryu',
    mode: 'modern',
    title: '現代輔助綠衝連段 (AUTO+M → DR → 5H → 6+SP)',
    difficulty: 'Intermediate',
    description: '輔助中攻擊命中取消綠衝(+12f) → 綠衝暗轉+衝刺空窗(+28f) → 重攻擊取消一鍵昇龍(+16f)。',
    tags: ['Modern', 'Drive Rush', '真實幀數'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['AUTO', 'M'], notation: 'AUTO+M', moveName: '輔助中攻擊', x: 0.58, y: 0.50 },
      { id: 'n2', frame: 12, buttons: ['PARRY'], notation: 'DR', moveName: '綠衝取消 (+12f)', x: 0.68, y: 0.50 },
      { id: 'n3', frame: 40, buttons: ['H'], notation: '5H', moveName: '重攻擊 (綠衝後+28f)', x: 0.78, y: 0.50 },
      { id: 'n4', frame: 56, buttons: ['RIGHT', 'SP'], notation: '6+SP', moveName: '昇龍拳 (取消)', x: 0.88, y: 0.50 },
    ],
  },

  // ================= KEN CLASSIC =================
  {
    id: 'ken-classic-tc',
    characterId: 'ken',
    characterName: 'Ken',
    mode: 'classic',
    title: '肯經典目標連段 (5MP → 5HP → 236MK 迅雷腳)',
    difficulty: 'Beginner',
    description: '5MP → 5HP 目標連段取消(+12f) → 236MK 迅雷腳取消(+16f) → 6LK 派生下段(+22f)。',
    tags: ['Target Combo', '236滑條'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['MP'], notation: '5MP', moveName: '立中拳', x: 0.58, y: 0.50 },
      { id: 'n2', frame: 12, buttons: ['HP'], notation: '5HP', moveName: '目標連段重拳', x: 0.68, y: 0.50 },
      { id: 'n3', frame: 28, buttons: ['MK'], motion: '236', notation: '236MK', moveName: '迅雷腳', x: 0.78, y: 0.50 },
      { id: 'n4', frame: 50, buttons: ['RIGHT', 'LK'], notation: '6LK', moveName: '迅雷派生下段', x: 0.88, y: 0.50 },
    ],
  },

  // ================= KEN MODERN =================
  {
    id: 'ken-modern-tc',
    characterId: 'ken',
    characterName: 'Ken',
    mode: 'modern',
    title: '現代肯迅雷壓制 (5M → 5M → 2+SP 迅雷)',
    difficulty: 'Beginner',
    description: '目標連段快速取消接迅雷腳。',
    tags: ['Modern', 'Target Combo'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['M'], notation: '5M', moveName: '中攻擊 1', x: 0.60, y: 0.50 },
      { id: 'n2', frame: 12, buttons: ['M'], notation: '5M', moveName: '中攻擊 2', x: 0.72, y: 0.50 },
      { id: 'n3', frame: 28, buttons: ['DOWN', 'SP'], notation: '2+SP', moveName: '迅雷腳', x: 0.84, y: 0.50 },
    ],
  },

  // ================= LUKE CLASSIC =================
  {
    id: 'luke-classic-perfect',
    characterId: 'luke',
    characterName: 'Luke',
    mode: 'classic',
    title: '路克精準蓄力節奏 (2MP → 214MP 閃光拳)',
    difficulty: 'Advanced',
    description: '2MP 命中取消(+12f)接 214MP，蓄力 23f 後精準放開！',
    tags: ['214滑條', '進階節奏'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['DOWN', 'MP'], notation: '2MP', moveName: '蹲中拳', x: 0.60, y: 0.50 },
      { id: 'n2', frame: 12, buttons: ['MP'], motion: '214', notation: '214MP', moveName: '中閃光拳(蓄力)', x: 0.72, y: 0.50 },
      { id: 'n3', frame: 35, buttons: ['HP'], notation: 'PERFECT', moveName: '精準釋放 (+23f)', x: 0.84, y: 0.50 },
    ],
  },

  // ================= LUKE MODERN =================
  {
    id: 'luke-modern-bnb',
    characterId: 'luke',
    characterName: 'Luke',
    mode: 'modern',
    title: '現代路克牆角迸發連段 (DI → 5H → 4+SP)',
    difficulty: 'Beginner',
    description: '迸發撞牆硬直後接重攻擊取消閃光拳。',
    tags: ['Modern', 'Drive Impact'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['DI'], notation: 'DI', moveName: '動力迸發', x: 0.60, y: 0.50 },
      { id: 'n2', frame: 46, buttons: ['H'], notation: '5H', moveName: '重攻擊 (等撞牆)', x: 0.72, y: 0.50 },
      { id: 'n3', frame: 62, buttons: ['LEFT', 'SP'], notation: '4+SP', moveName: '閃光拳 (取消)', x: 0.84, y: 0.50 },
    ],
  },

  // ================= CHUN-LI CLASSIC =================
  {
    id: 'chunli-classic-bnb',
    characterId: 'chunli',
    characterName: 'Chun-Li',
    mode: 'classic',
    title: '春麗基礎百裂連段 (2MK → 236MK 百裂腳)',
    difficulty: 'Beginner',
    description: '2MK 發生 7f + 命中卡肉取消(+6f) → 13f 取消 236MK 百裂腳。',
    tags: ['BnB', '236滑條'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['DOWN', 'MK'], notation: '2MK', moveName: '蹲中腳 (7f)', x: 0.62, y: 0.50 },
      { id: 'n2', frame: 13, buttons: ['MK'], motion: '236', notation: '236MK', moveName: '中百裂腳 (取消)', x: 0.78, y: 0.50 },
    ],
  },

  // ================= CHUN-LI MODERN =================
  {
    id: 'chunli-modern-bnb',
    characterId: 'chunli',
    characterName: 'Chun-Li',
    mode: 'modern',
    title: '現代春麗快速壓制 (5L → 5L → SP 百裂腳)',
    difficulty: 'Beginner',
    description: '輕攻擊連打取消(+10f)接必殺技(+10f)。',
    tags: ['Modern', '新手必練'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['L'], notation: '5L', moveName: '輕攻擊 1', x: 0.60, y: 0.50 },
      { id: 'n2', frame: 10, buttons: ['L'], notation: '5L', moveName: '輕攻擊 2', x: 0.72, y: 0.50 },
      { id: 'n3', frame: 20, buttons: ['SP'], notation: 'SP', moveName: '百裂腳 (取消)', x: 0.84, y: 0.50 },
    ],
  },

  // ================= JP MODERN =================
  {
    id: 'jp-modern-dr-full',
    characterId: 'jp',
    characterName: 'JP',
    mode: 'modern',
    title: '現代 JP 綠衝核心連段 (5H → 5H → DR → 2H xx 3SP → 236M → 22H)',
    difficulty: 'Advanced',
    description: '依據 JP 資料庫幀數計算：5H(12f)目標連 → 綠衝(+27f) → 2H(9f)取消3SP → 236M 中杖擊(236滑條) → 22H 重尖刺收尾。',
    tags: ['Modern', 'JP', 'Drive Rush', '236滑條'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['H'], notation: '5H', moveName: '立重攻擊 (12f)', x: 0.53, y: 0.50 },
      { id: 'n2', frame: 18, buttons: ['H'], notation: '5H', moveName: '目標連第2段', x: 0.59, y: 0.50 },
      { id: 'n3', frame: 36, buttons: ['PARRY'], notation: 'DR', moveName: '綠衝取消', x: 0.65, y: 0.50 },
      { id: 'n4', frame: 63, buttons: ['DOWN', 'H'], notation: '2H', moveName: '蹲重攻擊 (9f)', x: 0.71, y: 0.50 },
      { id: 'n5', frame: 79, buttons: ['DOWN', 'SP'], notation: '3+SP', moveName: '斜下必殺 (取消)', x: 0.77, y: 0.50 },
      { id: 'n6', frame: 125, buttons: ['M'], motion: '236', notation: '236M', moveName: '中杖擊 (236滑條)', x: 0.83, y: 0.50 },
      { id: 'n7', frame: 187, buttons: ['DOWN', 'H'], notation: '22H', moveName: '重尖刺收尾', x: 0.89, y: 0.50 },
    ],
  },
  {
    id: 'jp-modern-sa2-route-a',
    characterId: 'jp',
    characterName: 'JP',
    mode: 'modern',
    title: '現代 JP SA2 連段【mJP1.mp4 實測校準 · 路線A】',
    difficulty: 'Advanced',
    description: '依 mJP1.mp4 實際影片 60fps 時間軸校準（含 SA2 2.2秒動畫與各段浮空等待）：5H→5H→SA2→2M→5H→5H xx 214H→5H→5H→236M→3+SP→236M→22H',
    tags: ['Modern', 'JP', 'mJP1.mp4校準', 'SA2 虛空'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['H'], notation: '5H', moveName: '立重攻擊 1', x: 0.54, y: 0.50 },
      { id: 'n2', frame: 15, buttons: ['H'], notation: '5H', moveName: '立重攻擊 2', x: 0.62, y: 0.50 },
      { id: 'n3', frame: 30, buttons: ['LEFT', 'SP', 'H'], notation: 'SA2', moveName: 'SA2 (4+SP+H)', x: 0.70, y: 0.50 },
      { id: 'n4', frame: 162, buttons: ['DOWN', 'M'], notation: '2M', moveName: '等動畫後 2M (+132f)', x: 0.78, y: 0.50 },
      { id: 'n5', frame: 198, buttons: ['H'], notation: '5H', moveName: '立重攻擊 1', x: 0.86, y: 0.50 },
      { id: 'n6', frame: 216, buttons: ['H'], notation: '5H', moveName: '立重攻擊 2', x: 0.54, y: 0.50 },
      { id: 'n7', frame: 240, buttons: ['H'], motion: '214', notation: '214H', moveName: '虛空傳送門 (取消)', x: 0.62, y: 0.50 },
      { id: 'n8', frame: 306, buttons: ['H'], notation: '5H', moveName: '立重攻擊 1 (+66f)', x: 0.70, y: 0.50 },
      { id: 'n9', frame: 324, buttons: ['H'], notation: '5H', moveName: '立重攻擊 2', x: 0.78, y: 0.50 },
      { id: 'n10', frame: 348, buttons: ['M'], motion: '236', notation: '236M', moveName: '中杖擊 (路線A)', x: 0.86, y: 0.50 },
      { id: 'n11', frame: 390, buttons: ['DOWN', 'SP'], notation: '3+SP', moveName: '斜下必殺 (+42f)', x: 0.58, y: 0.50 },
      { id: 'n12', frame: 456, buttons: ['M'], motion: '236', notation: '236M', moveName: '中杖擊 (+66f)', x: 0.72, y: 0.50 },
      { id: 'n13', frame: 522, buttons: ['DOWN', 'H'], notation: '22H', moveName: '重尖刺收尾 (+66f)', x: 0.86, y: 0.50 },
    ],
  },
  {
    id: 'jp-modern-sa2-route-b',
    characterId: 'jp',
    characterName: 'JP',
    mode: 'modern',
    title: '現代 JP SA2 連段【mJP1.mp4 實測校準 · 路線B：22L】',
    difficulty: 'Advanced',
    description: '依 mJP1.mp4 時間軸校準，第 10 招起切換為 22L→3+SP→236M→22H（分支路線 B）',
    tags: ['Modern', 'JP', 'mJP1.mp4校準', '路線B'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['H'], notation: '5H', moveName: '立重攻擊 1', x: 0.54, y: 0.50 },
      { id: 'n2', frame: 15, buttons: ['H'], notation: '5H', moveName: '立重攻擊 2', x: 0.62, y: 0.50 },
      { id: 'n3', frame: 30, buttons: ['LEFT', 'SP', 'H'], notation: 'SA2', moveName: 'SA2 (4+SP+H)', x: 0.70, y: 0.50 },
      { id: 'n4', frame: 162, buttons: ['DOWN', 'M'], notation: '2M', moveName: '等動畫後 2M (+132f)', x: 0.78, y: 0.50 },
      { id: 'n5', frame: 198, buttons: ['H'], notation: '5H', moveName: '立重攻擊 1', x: 0.86, y: 0.50 },
      { id: 'n6', frame: 216, buttons: ['H'], notation: '5H', moveName: '立重攻擊 2', x: 0.54, y: 0.50 },
      { id: 'n7', frame: 240, buttons: ['H'], motion: '214', notation: '214H', moveName: '虛空傳送門 (取消)', x: 0.62, y: 0.50 },
      { id: 'n8', frame: 306, buttons: ['H'], notation: '5H', moveName: '立重攻擊 1 (+66f)', x: 0.70, y: 0.50 },
      { id: 'n9', frame: 324, buttons: ['H'], notation: '5H', moveName: '立重攻擊 2', x: 0.78, y: 0.50 },
      { id: 'n10', frame: 348, buttons: ['DOWN', 'L'], notation: '22L', moveName: '輕尖刺 (路線B)', x: 0.86, y: 0.50 },
      { id: 'n11', frame: 390, buttons: ['DOWN', 'SP'], notation: '3+SP', moveName: '斜下必殺 (+42f)', x: 0.58, y: 0.50 },
      { id: 'n12', frame: 456, buttons: ['M'], motion: '236', notation: '236M', moveName: '中杖擊 (+66f)', x: 0.72, y: 0.50 },
      { id: 'n13', frame: 522, buttons: ['DOWN', 'H'], notation: '22H', moveName: '重尖刺收尾 (+66f)', x: 0.86, y: 0.50 },
    ],
  },
  {
    id: 'jp-modern-recorded-sa3',
    characterId: 'jp',
    characterName: 'JP',
    mode: 'modern',
    title: '現代 JP 實錄連段【真實容錯窗版】(403f 全套)',
    difficulty: 'Advanced',
    description: '依你的 12 擊實錄 JSON 校準，綠衝取消（DR）已放寬為 SF6 真實超寬取消窗（-10f ~ +14f Perfect），並搭配動態校準對齊停頓。',
    tags: ['Modern', 'JP', '實錄標準版', 'DR寬鬆窗'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['H'], windowType: 'link', notation: '5H', moveName: '立重攻擊 1', x: 0.54, y: 0.50 },
      { id: 'n2', frame: 17, buttons: ['H'], windowType: 'cancel', notation: '5H', moveName: '目標連 2 (取消窗)', x: 0.62, y: 0.50 },
      { id: 'n3', frame: 47, buttons: ['PARRY'], windowType: 'dr-cancel', notation: 'DR', moveName: '綠衝取消 (超寬窗)', x: 0.70, y: 0.50 },
      { id: 'n4', frame: 67, buttons: ['RIGHT', 'H'], windowType: 'juggle', notation: '6H', moveName: '前重攻擊', x: 0.78, y: 0.50 },
      { id: 'n5', frame: 107, buttons: ['RIGHT', 'L'], windowType: 'juggle', notation: '6L', moveName: '前輕追打', x: 0.86, y: 0.50 },
      { id: 'n6', frame: 165, buttons: ['RIGHT', 'H'], windowType: 'juggle', notation: '6H', moveName: '前重攻擊', x: 0.54, y: 0.50 },
      { id: 'n7', frame: 198, buttons: ['DOWN', 'SP'], windowType: 'cancel', notation: '2SP', moveName: '下必殺 (取消)', x: 0.62, y: 0.50 },
      { id: 'n8', frame: 260, buttons: ['AUTO', 'H'], windowType: 'juggle', notation: 'AUTO+H', moveName: '輔助重攻擊', x: 0.70, y: 0.50 },
      { id: 'n9', frame: 277, buttons: ['RIGHT', 'M'], motion: '236', windowType: 'cancel', notation: '236M', moveName: '中杖擊 (236滑條)', x: 0.78, y: 0.50 },
      { id: 'n10', frame: 330, buttons: ['DOWN', 'H'], windowType: 'juggle', notation: '2H', moveName: '蹲重攻擊', x: 0.86, y: 0.50 },
      { id: 'n11', frame: 388, buttons: ['DOWN', 'LEFT', 'SP'], windowType: 'juggle', notation: '1SP', moveName: '斜下必殺', x: 0.54, y: 0.50 },
      { id: 'n12', frame: 403, buttons: ['DOWN', 'SP', 'H'], windowType: 'cancel', notation: '2SP+H', moveName: 'SA 收尾 (雙鍵)', x: 0.62, y: 0.50 },
    ],
  },

  // ================= ED CLASSIC =================
  {
    id: 'ed-classic-bnb',
    characterId: 'ed',
    characterName: 'Ed',
    mode: 'classic',
    title: 'Ed 基礎目標連 → 精神閃擊 (214MP)',
    difficulty: 'Beginner',
    description: 'Ed 經典基礎連段：5MP → 5HP（目標連）取消 214MP 精神閃擊，熟悉節奏與取消窗。',
    tags: ['Classic', 'Ed', '基礎連段'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['MP'], windowType: 'link', notation: '5MP', moveName: '立中拳', x: 0.56, y: 0.50 },
      { id: 'n2', frame: 15, buttons: ['HP'], windowType: 'cancel', notation: '5HP', moveName: '目標連重拳', x: 0.68, y: 0.50 },
      { id: 'n3', frame: 32, buttons: ['LEFT', 'MP'], motion: '214', windowType: 'cancel', notation: '214MP', moveName: '精神閃擊 (214M)', x: 0.80, y: 0.50 },
    ],
  },

  // ================= ED MODERN =================
  {
    id: 'ed-modern-bnb',
    characterId: 'ed',
    characterName: 'Ed',
    mode: 'modern',
    title: '現代 Ed 基礎目標連 → 精神閃擊 (4+SP)',
    difficulty: 'Beginner',
    description: '現代 Ed 入門連段：M → H → 4+SP（精神閃擊），可直接作為起手練習或自行錄製進階連段。',
    tags: ['Modern', 'Ed', '基礎連段'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['M'], windowType: 'link', notation: '5M', moveName: '立中攻擊', x: 0.56, y: 0.50 },
      { id: 'n2', frame: 15, buttons: ['H'], windowType: 'cancel', notation: '5H', moveName: '目標連重攻擊', x: 0.68, y: 0.50 },
      { id: 'n3', frame: 32, buttons: ['LEFT', 'SP'], windowType: 'cancel', notation: '4SP', moveName: '精神閃擊 (4+SP)', x: 0.80, y: 0.50 },
    ],
  },
  {
    id: 'ed-modern-dream-combo',
    characterId: 'ed',
    characterName: 'Ed',
    mode: 'modern',
    title: '現代 Ed 簡單夢幻連段【精準幀數版】(10 擊 · 583f)',
    difficulty: 'Advanced',
    description: 'Ed 實錄 60fps 夢幻連段：AUTO+H → 214H+M → 214M → 214H → 236H → 6H+M → 6H → 236H → 6H+M → 236H（PERFECT 精準 ±1.5f，GOOD 為真實可連容錯窗）。',
    tags: ['Modern', 'Ed', '夢幻連段', '精準幀數'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['AUTO', 'H'], windowType: 'link', notation: 'AUTO+H', moveName: 'AUTO+H (0f)', x: 0.54, y: 0.50 },
      { id: 'n2', frame: 20, buttons: ['LEFT', 'H', 'M'], motion: '214', windowType: 'cancel', notation: '214H+M', moveName: 'OD 214 (20f)', x: 0.62, y: 0.50 },
      { id: 'n3', frame: 110, buttons: ['LEFT', 'M'], motion: '214', windowType: 'link', notation: '214M', moveName: '214M (110f)', x: 0.70, y: 0.50 },
      { id: 'n4', frame: 261, buttons: ['LEFT', 'H'], motion: '214', windowType: 'link', notation: '214H', moveName: '214H (261f)', x: 0.78, y: 0.50 },
      { id: 'n5', frame: 344, buttons: ['RIGHT', 'H'], motion: '236', windowType: 'link', notation: '236H', moveName: '236H (344f)', x: 0.86, y: 0.50 },
      { id: 'n6', frame: 409, buttons: ['RIGHT', 'H', 'M'], windowType: 'link', notation: '6H+M', moveName: '6H+M (409f)', x: 0.54, y: 0.50 },
      { id: 'n7', frame: 426, buttons: ['RIGHT', 'H'], windowType: 'link', notation: '6H', moveName: '6H (426f)', x: 0.62, y: 0.50 },
      { id: 'n8', frame: 485, buttons: ['RIGHT', 'H'], motion: '236', windowType: 'link', notation: '236H', moveName: '236H (485f)', x: 0.70, y: 0.50 },
      { id: 'n9', frame: 552, buttons: ['RIGHT', 'H', 'M'], windowType: 'link', notation: '6H+M', moveName: '6H+M (552f)', x: 0.78, y: 0.50 },
      { id: 'n10', frame: 583, buttons: ['RIGHT', 'H'], motion: '236', windowType: 'cancel', notation: '236H', moveName: '236H 收尾 (583f)', x: 0.86, y: 0.50 },
    ],
  },
];
