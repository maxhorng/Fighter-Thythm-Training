import { ComboData } from '../types/combo';
import { ALL_SF6_CHARACTERS } from './frameData';

export interface CharacterInfo {
  id: string;
  name: string;
  title: string;
  accent: string;
}

export const CHARACTERS: CharacterInfo[] = ALL_SF6_CHARACTERS.map((c) => ({
  id: c.id,
  name: c.name,
  title: c.zhName,
  accent: c.accent,
}));

export const BUILTIN_COMBOS: ComboData[] = [
  // ================= ED CLASSIC =================
  {
    id: 'ed-classic-shin-dream',
    characterId: 'ed',
    characterName: 'Ed',
    mode: 'classic',
    title: 'Ed Momochi「Shin Dream」新夢幻連段 (延遲 SA2 版)',
    difficulty: 'Advanced',
    description:
      '源自 YouTube (Xvabv_Z-9Gk)：214EX → 最晚延遲取消 SA2 → 微走 6214HP → 微走步 623HP → 微走步 623HP → 66 → 6HP → 快速 623HP → 66 → 66 → 623HP（標準體重限定）。',
    tags: ['Classic', 'Ed', 'Shin Dream', 'Momochi', 'SA2'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['LEFT', 'MP', 'HP'], motion: '214', windowType: 'link', notation: '214EX', moveName: 'OD 精神閃擊 (多段打肉)', x: 0.54, y: 0.50 },
      { id: 'n2', frame: 95.4, buttons: ['LEFT', 'LP'], motion: '214', windowType: 'cancel', notation: 'SA2', moveName: '最晚延遲取消 SA2 (+95.4f)', x: 0.62, y: 0.50 },
      { id: 'n3', frame: 242, buttons: ['LEFT', 'HP'], motion: '6214', windowType: 'link', notation: '6214HP', moveName: '微走3f → 6214HP 半圈', x: 0.70, y: 0.50 },
      { id: 'n4', frame: 304, buttons: ['RIGHT', 'HP'], motion: '623', windowType: 'link', notation: '623HP', moveName: '微走步 昇龍 1 (+62f)', x: 0.78, y: 0.50 },
      { id: 'n5', frame: 390, buttons: ['RIGHT', 'HP'], motion: '623', windowType: 'link', notation: '623HP', moveName: '微走步 昇龍 2 (+86f)', x: 0.86, y: 0.50 },
      { id: 'n6', frame: 434, buttons: ['RIGHT'], motion: '66', windowType: 'link', notation: '66', moveName: '前衝 Dash (+44f)', x: 0.54, y: 0.50 },
      { id: 'n7', frame: 450, buttons: ['RIGHT', 'HP'], windowType: 'link', notation: '6HP', moveName: '前重拳 6HP (+16f)', x: 0.62, y: 0.50 },
      { id: 'n8', frame: 512, buttons: ['RIGHT', 'HP'], motion: '623', windowType: 'link', notation: '623HP', moveName: '快速昇龍 Quick DP (+62f)', x: 0.70, y: 0.50 },
      { id: 'n9', frame: 560, buttons: ['RIGHT'], motion: '66', windowType: 'link', notation: '66', moveName: '前衝 1 (+48f)', x: 0.78, y: 0.50 },
      { id: 'n10', frame: 578, buttons: ['RIGHT'], motion: '66', windowType: 'link', notation: '66', moveName: '前衝 2 (+18f)', x: 0.86, y: 0.50 },
      { id: 'n11', frame: 600, buttons: ['RIGHT', 'HP'], motion: '623', windowType: 'cancel', notation: '623HP', moveName: '昇龍收尾 Final DP (+22f)', x: 0.54, y: 0.50 },
    ],
  },

  // ================= JP MODERN =================
  {
    id: 'jp-modern-5hp-sa2-demo',
    characterId: 'jp',
    characterName: 'JP',
    mode: 'modern',
    title: 'modern jp 5HPSA2範例',
    difficulty: 'Advanced',
    description:
      '實機 60fps 錄製：H(0f) → H(22f) → SA2(214214M)(58f) → 2M(185f) → H(228f) → H(250f) → 214H(284f) → H(335f) → H(355f) → 22L(394f) → 3SP(451f) → 236M(521f) → 22H(576f) → 214H(631f)',
    tags: ['Modern', 'JP', 'SA2', '實機錄製'],
    notes: [
      { id: 'n1', frame: 0, buttons: ['H'], windowType: 'link', notation: 'H', moveName: '5H (0f)', x: 0.54, y: 0.50 },
      { id: 'n2', frame: 22, buttons: ['H'], windowType: 'cancel', notation: 'H', moveName: '5H (22f)', x: 0.62, y: 0.50 },
      { id: 'n3', frame: 58, buttons: ['LEFT', 'M'], motion: '214', windowType: 'cancel', notation: 'SA2(214214M)', moveName: 'SA2(214214M) (58f)', x: 0.70, y: 0.50 },
      { id: 'n4', frame: 185, buttons: ['DOWN', 'M'], windowType: 'link', notation: '2M', moveName: '2M (185f)', x: 0.78, y: 0.50 },
      { id: 'n5', frame: 228, buttons: ['H'], windowType: 'link', notation: 'H', moveName: '5H (228f)', x: 0.86, y: 0.50 },
      { id: 'n6', frame: 250, buttons: ['H'], windowType: 'cancel', notation: 'H', moveName: '5H (250f)', x: 0.54, y: 0.50 },
      { id: 'n7', frame: 284, buttons: ['LEFT', 'H'], motion: '214', windowType: 'cancel', notation: '214H', moveName: '214H (284f)', x: 0.62, y: 0.50 },
      { id: 'n8', frame: 335, buttons: ['H'], windowType: 'link', notation: 'H', moveName: '5H (335f)', x: 0.70, y: 0.50 },
      { id: 'n9', frame: 355, buttons: ['H'], windowType: 'cancel', notation: 'H', moveName: '5H (355f)', x: 0.78, y: 0.50 },
      { id: 'n10', frame: 394, buttons: ['DOWN', 'L'], motion: '22', windowType: 'cancel', notation: '22L', moveName: '22L (394f)', x: 0.86, y: 0.50 },
      { id: 'n11', frame: 451, buttons: ['DOWN', 'RIGHT', 'SP'], windowType: 'juggle', notation: '3SP', moveName: '3SP (451f)', x: 0.54, y: 0.50 },
      { id: 'n12', frame: 521, buttons: ['RIGHT', 'M'], motion: '236', windowType: 'juggle', notation: '236M', moveName: '236M (521f)', x: 0.62, y: 0.50 },
      { id: 'n13', frame: 576, buttons: ['DOWN', 'H'], motion: '22', windowType: 'juggle', notation: '22H', moveName: '22H (576f)', x: 0.70, y: 0.50 },
      { id: 'n14', frame: 631, buttons: ['LEFT', 'H'], motion: '214', windowType: 'juggle', notation: '214H', moveName: '214H (631f)', x: 0.78, y: 0.50 },
    ],
  },
];
