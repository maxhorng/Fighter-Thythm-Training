/**
 * Street Fighter 6 Universal System & Character Frame Data (60fps)
 * Used for:
 * 1. Accurate Jump-In Attack (跳攻擊) rhythm training per character
 * 2. Auto-calculating Link (目押), Cancel (取消), and Drive Rush (綠衝) timings in the Combo Editor
 */

export const SF6_SYSTEM_FRAMES = {
  fps: 60,
  /** SF6 4-frame input buffer window (提前 1~4f 輸入會被緩衝吃進) */
  inputBufferFrames: 4,
  /** Hitstop (卡肉幀數) by attack strength */
  hitstop: {
    light: 8,
    medium: 10,
    heavy: 12,
  },
  /** Drive Rush Cancel (綠衝取消) timing constants */
  driveRushCancel: {
    screenFreeze: 11,
    minActionableDash: 8,
    /** Empirically tuned gap from pressing DR to pressing next normal (e.g. 5HP) */
    recommendedNextNormalGap: 27,
  },
  /** Landing recovery frames */
  landingRecovery: {
    emptyJump: 3,
    normalAttack: 4,
  },
} as const;

export type JumpSpeedTier = 'Fast' | 'Standard' | 'Floaty';

export interface JumpFrameData {
  /** Pre-jump startup frames before leaving ground (起跳前搖，多數角色為 4f，桑吉爾夫為 5f) */
  preJumpFrames: number;
  /** Airborne duration frames (滯空幀數) */
  airborneFrames: number;
  /** Total jump frames from input to landing (總跳躍幀數 = preJump + airborne) */
  totalJumpFrames: number;
  /** Recommended frame offset from jump input to press j.HP / j.HK for a deep jump-in (建議低點跳攻擊出招幀數) */
  recommendedJumpInFrame: number;
  /** Jump arc feel */
  speedTier: JumpSpeedTier;
  /** Helpful note for beginners */
  note: string;
}

export interface NormalMoveFrameData {
  notation: string;
  name: string;
  startup: number;
  active: number;
  recovery: number;
  /** Total frames = startup + active + recovery - 1 */
  total: number;
  onHit: number;
  strength: 'light' | 'medium' | 'heavy';
  cancelable: boolean;
}

export interface CharacterFrameData {
  id: string;
  name: string;
  zhName: string;
  accent: string;
  jump: JumpFrameData;
  /** Key combo normals (expandable for all characters) */
  normals?: Record<string, NormalMoveFrameData>;
}

export const SF6_CHARACTER_FRAME_DATA: Record<string, CharacterFrameData> = {
  // ==================== BASE ROSTER (18) ====================
  ryu: {
    id: 'ryu',
    name: 'Ryu',
    zhName: '隆',
    accent: '#38bdf8',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍軌道，j.HP / j.HK 建議在起跳後約 28f 按出打低點。',
    },
    normals: {
      '5MP': { notation: '5MP', name: '立中拳', startup: 6, active: 4, recovery: 11, total: 20, onHit: 7, strength: 'medium', cancelable: true },
      '2MP': { notation: '2MP', name: '蹲中拳', startup: 6, active: 3, recovery: 14, total: 22, onHit: 5, strength: 'medium', cancelable: true },
      '2MK': { notation: '2MK', name: '蹲中腳', startup: 8, active: 3, recovery: 18, total: 28, onHit: 1, strength: 'medium', cancelable: true },
      '5HP': { notation: '5HP', name: '立重拳', startup: 10, active: 5, recovery: 18, total: 32, onHit: 4, strength: 'heavy', cancelable: true },
      '4HP': { notation: '4HP', name: '後重拳', startup: 7, active: 4, recovery: 21, total: 31, onHit: 1, strength: 'heavy', cancelable: true },
      'j.HP': { notation: 'j.HP', name: '跳重拳', startup: 9, active: 6, recovery: 0, total: 15, onHit: 10, strength: 'heavy', cancelable: false },
    },
  },
  ken: {
    id: 'ken',
    name: 'Ken',
    zhName: '肯',
    accent: '#f43f5e',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍，j.HP 與 j.MK（打背）皆適合在 27~29f 出招。',
    },
    normals: {
      '5MP': { notation: '5MP', name: '立中拳', startup: 5, active: 4, recovery: 14, total: 22, onHit: 4, strength: 'medium', cancelable: true },
      '2MP': { notation: '2MP', name: '蹲中拳', startup: 6, active: 4, recovery: 14, total: 23, onHit: 5, strength: 'medium', cancelable: true },
      '2MK': { notation: '2MK', name: '蹲中腳', startup: 7, active: 3, recovery: 18, total: 27, onHit: 1, strength: 'medium', cancelable: true },
      '5HP': { notation: '5HP', name: '立重拳', startup: 10, active: 5, recovery: 17, total: 31, onHit: 3, strength: 'heavy', cancelable: true },
    },
  },
  luke: {
    id: 'luke',
    name: 'Luke',
    zhName: '路克',
    accent: '#facc15',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍，j.HP 判定極強，約 28f 出招落地接 2HP 或 5MP。',
    },
    normals: {
      '2MP': { notation: '2MP', name: '蹲中拳', startup: 6, active: 4, recovery: 13, total: 22, onHit: 5, strength: 'medium', cancelable: true },
      '2MK': { notation: '2MK', name: '蹲中腳', startup: 7, active: 3, recovery: 18, total: 27, onHit: 1, strength: 'medium', cancelable: true },
      '2HP': { notation: '2HP', name: '蹲重拳', startup: 7, active: 5, recovery: 24, total: 35, onHit: 1, strength: 'heavy', cancelable: true },
    },
  },
  chunli: {
    id: 'chunli',
    name: 'Chun-Li',
    zhName: '春麗',
    accent: '#60a5fa',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 41,
      totalJumpFrames: 45,
      recommendedJumpInFrame: 31,
      speedTier: 'Floaty',
      note: '偏浮空 45f 跳躍（比標準慢 3f），跳攻擊要稍微晚一點約 31f 再按！',
    },
    normals: {
      '5MP': { notation: '5MP', name: '立中拳', startup: 5, active: 4, recovery: 11, total: 19, onHit: 6, strength: 'medium', cancelable: true },
      '2MK': { notation: '2MK', name: '蹲中腳', startup: 7, active: 3, recovery: 18, total: 27, onHit: 1, strength: 'medium', cancelable: true },
      '4HP': { notation: '4HP', name: '後重拳', startup: 8, active: 5, recovery: 19, total: 31, onHit: 3, strength: 'heavy', cancelable: true },
    },
  },
  cammy: {
    id: 'cammy',
    name: 'Cammy',
    zhName: '嘉米',
    accent: '#22c55e',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 36,
      totalJumpFrames: 40,
      recommendedJumpInFrame: 26,
      speedTier: 'Fast',
      note: '高速低弧度 40f 跳躍，跳入速度快，建議提早至 26f 按跳攻擊。',
    },
  },
  guile: {
    id: 'guile',
    name: 'Guile',
    zhName: '凱爾',
    accent: '#84cc16',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 39,
      totalJumpFrames: 43,
      recommendedJumpInFrame: 29,
      speedTier: 'Standard',
      note: '43f 跳躍，略微偏慢 1f，適合在空中蓄力下方向。',
    },
  },
  juri: {
    id: 'juri',
    name: 'Juri',
    zhName: '韓蛛俐',
    accent: '#d946ef',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍，j.HK 距離長，約 28f 出招。',
    },
  },
  jamie: {
    id: 'jamie',
    name: 'Jamie',
    zhName: '傑米',
    accent: '#f59e0b',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍（1酒後可搭配空中無影蹴改變落點）。',
    },
  },
  kimberly: {
    id: 'kimberly',
    name: 'Kimberly',
    zhName: '金伯莉',
    accent: '#ec4899',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 36,
      totalJumpFrames: 40,
      recommendedJumpInFrame: 26,
      speedTier: 'Fast',
      note: '高速 40f 跳躍，搭配空中肘落（2MP）可改變落地節奏。',
    },
  },
  manon: {
    id: 'manon',
    name: 'Manon',
    zhName: '瑪儂',
    accent: '#a855f7',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 39,
      totalJumpFrames: 43,
      recommendedJumpInFrame: 29,
      speedTier: 'Standard',
      note: '43f 跳躍，j.HP 攻擊距離遠，約 29f 出招。',
    },
  },
  marisa: {
    id: 'marisa',
    name: 'Marisa',
    zhName: '瑪麗莎',
    accent: '#ef4444',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 40,
      totalJumpFrames: 44,
      recommendedJumpInFrame: 30,
      speedTier: 'Floaty',
      note: '偏慢 44f 重型跳躍，跳重拳可蓄力，一般低點約 30f 出招。',
    },
  },
  zangief: {
    id: 'zangief',
    name: 'Zangief',
    zhName: '桑吉爾夫',
    accent: '#dc2626',
    jump: {
      preJumpFrames: 5,
      airborneFrames: 41,
      totalJumpFrames: 46,
      recommendedJumpInFrame: 32,
      speedTier: 'Floaty',
      note: '起跳前搖 5f + 滯空 41f（總計 46f），跳攻擊需明顯晚按（約 32f）。',
    },
  },
  dhalsim: {
    id: 'dhalsim',
    name: 'Dhalsim',
    zhName: '達爾西姆',
    accent: '#fb923c',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 47,
      totalJumpFrames: 51,
      recommendedJumpInFrame: 37,
      speedTier: 'Floaty',
      note: '全遊戲最浮空 51f 跳躍，需大幅延後至約 37f 再按低點跳攻擊。',
    },
  },
  ehonda: {
    id: 'ehonda',
    name: 'E. Honda',
    zhName: '本田',
    accent: '#3b82f6',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 40,
      totalJumpFrames: 44,
      recommendedJumpInFrame: 30,
      speedTier: 'Floaty',
      note: '44f 偏慢跳躍，約 30f 出招打低點。',
    },
  },
  blanka: {
    id: 'blanka',
    name: 'Blanka',
    zhName: '布蘭卡',
    accent: '#10b981',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍，j.HK 與 j.MK 打背約 28f 出招。',
    },
  },
  deejay: {
    id: 'deejay',
    name: 'Dee Jay',
    zhName: '迪傑',
    accent: '#eab308',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍，支援空中膝撞（2LK）提前落地。',
    },
  },
  lily: {
    id: 'lily',
    name: 'Lily',
    zhName: '莉莉',
    accent: '#14b8a6',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 39,
      totalJumpFrames: 43,
      recommendedJumpInFrame: 29,
      speedTier: 'Standard',
      note: '43f 跳躍，j.HP 範圍大，約 29f 出招。',
    },
  },
  jp: {
    id: 'jp',
    name: 'JP',
    zhName: 'JP',
    accent: '#6366f1',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 40,
      totalJumpFrames: 44,
      recommendedJumpInFrame: 30,
      speedTier: 'Floaty',
      note: '44f 偏浮空跳躍，約 30f 出招打低點。',
    },
  },

  // ==================== YEAR 1 DLC (4) ====================
  rashid: {
    id: 'rashid',
    name: 'Rashid',
    zhName: '拉希德',
    accent: '#0ea5e9',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍，具備二段跳與三角跳變化。',
    },
  },
  aki: {
    id: 'aki',
    name: 'A.K.I.',
    zhName: '阿鬼',
    accent: '#c084fc',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍，約 28f 按跳攻擊打低點。',
    },
  },
  ed: {
    id: 'ed',
    name: 'Ed',
    zhName: '艾德',
    accent: '#818cf8',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍，約 28f 出招。',
    },
  },
  akuma: {
    id: 'akuma',
    name: 'Akuma',
    zhName: '豪鬼',
    accent: '#be123c',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 37,
      totalJumpFrames: 41,
      recommendedJumpInFrame: 27,
      speedTier: 'Fast',
      note: '偏快 41f 跳躍，j.HP / j.MK 建議約 27f 出招。',
    },
  },

  // ==================== YEAR 2 DLC ====================
  mbison: {
    id: 'mbison',
    name: 'M. Bison',
    zhName: '貝卡',
    accent: '#991b1b',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 40,
      totalJumpFrames: 44,
      recommendedJumpInFrame: 30,
      speedTier: 'Floaty',
      note: '偏浮空 44f 跳躍，約 30f 出招打低點。',
    },
  },
  terry: {
    id: 'terry',
    name: 'Terry',
    zhName: '泰瑞',
    accent: '#e11d48',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍，j.HP / j.HK 約 28f 出招。',
    },
  },
  mai: {
    id: 'mai',
    name: 'Mai',
    zhName: '不知火舞',
    accent: '#f43f5e',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 37,
      totalJumpFrames: 41,
      recommendedJumpInFrame: 27,
      speedTier: 'Fast',
      note: '靈活 41f 跳躍，建議約 27f 出招。',
    },
  },
  elena: {
    id: 'elena',
    name: 'Elena',
    zhName: '艾蓮娜',
    accent: '#10b981',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: '標準 42f 跳躍，長手腳跳攻擊約 28f 出招。',
    },
  },
  sagat: {
    id: 'sagat',
    name: 'Sagat',
    zhName: '沙加特',
    accent: '#f59e0b',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 39,
      totalJumpFrames: 43,
      recommendedJumpInFrame: 29,
      speedTier: 'Standard',
      note: '偏高大 43f 跳躍，建議約 29f 出招。',
    },
  },
  cviper: {
    id: 'cviper',
    name: 'C. Viper',
    zhName: '深紅毒蛇',
    accent: '#dc2626',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 37,
      totalJumpFrames: 41,
      recommendedJumpInFrame: 27,
      speedTier: 'Fast',
      note: '高機動 41f 跳躍（含超級跳躍），約 27f 出招。',
    },
  },
  alex: {
    id: 'alex',
    name: 'Alex',
    zhName: '亞歷克斯',
    accent: '#eab308',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 40,
      totalJumpFrames: 44,
      recommendedJumpInFrame: 30,
      speedTier: 'Floaty',
      note: '力量型 44f 跳躍，約 30f 出招打低點。',
    },
  },
  ingrid: {
    id: 'ingrid',
    name: 'Ingrid',
    zhName: '英格麗特',
    accent: '#ec4899',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 37,
      totalJumpFrames: 41,
      recommendedJumpInFrame: 27,
      speedTier: 'Fast',
      note: '輕快 41f 跳躍，約 27f 出招。',
    },
  },
  yasmine: {
    id: 'yasmine',
    name: 'Yasmine',
    zhName: '雅絲敏',
    accent: '#14b8a6',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: 'Year 4 新角，標準 42f 跳躍，約 28f 出招。',
    },
  },
  arjun: {
    id: 'arjun',
    name: 'Arjun',
    zhName: '阿爾俊',
    accent: '#f97316',
    jump: {
      preJumpFrames: 4,
      airborneFrames: 38,
      totalJumpFrames: 42,
      recommendedJumpInFrame: 28,
      speedTier: 'Standard',
      note: 'Year 4 新角，標準 42f 跳躍，約 28f 出招。',
    },
  },
};

export const ALL_SF6_CHARACTERS = Object.values(SF6_CHARACTER_FRAME_DATA);

/**
 * Helper: Calculate recommended link gap (in 60fps frames) after a normal hits
 */
export function calcLinkFrames(move: NormalMoveFrameData): number {
  const hitstop = SF6_SYSTEM_FRAMES.hitstop[move.strength];
  return move.total + hitstop;
}

/**
 * Helper: Calculate recommended cancel gap (in 60fps frames) after a normal hits
 */
export function calcCancelFrames(move: NormalMoveFrameData): number {
  const halfHitstop = Math.round(SF6_SYSTEM_FRAMES.hitstop[move.strength] * 0.6);
  return move.startup + halfHitstop;
}
