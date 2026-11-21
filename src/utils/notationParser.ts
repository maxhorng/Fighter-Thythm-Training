import { ActionButtonId, ComboData, ComboNote, ControlMode, MotionType } from '../types/combo';
import { SF6_CHARACTER_FRAME_DATA, SF6_SYSTEM_FRAMES } from '../data/frameData';
import sf6DbRaw from '../data/sf6_framedata_db.json';

interface FatMove {
  numCmd?: string;
  ezCmd?: string;
  moveName?: string;
  startup?: number | string;
  total?: number | string;
  hitstop?: number | string;
}

interface FatChar {
  stats?: {
    fJump?: string; // e.g. "45 (4+38+3)" or "49 (5+41+3)"
    nJump?: string;
  };
  moves?: {
    normal?: Record<string, FatMove>;
  };
}

const sf6Db = sf6DbRaw as Record<string, FatChar>;

function parseFirstNum(val: number | string | undefined, fallback: number): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const m = val.match(/\d+/);
    if (m) return parseInt(m[0], 10);
  }
  return fallback;
}

function getCharacterJumpFrames(characterId: string): { preJump: number; airborne: number; landing: number; total: number } {
  const charMeta = SF6_CHARACTER_FRAME_DATA[characterId];
  const dbKey = Object.keys(sf6Db).find(
    (k) => k.toLowerCase().replace(/[^a-z]/g, '') === characterId.toLowerCase().replace(/[^a-z]/g, '')
  );
  const fJumpStr = dbKey ? sf6Db[dbKey]?.stats?.fJump : undefined;
  if (fJumpStr) {
    // Parse "45 (4+38+3)"
    const m = fJumpStr.match(/(\d+)\s*\((\d+)\+(\d+)\+(\d+)\)/);
    if (m) {
      return {
        total: parseInt(m[1], 10),
        preJump: parseInt(m[2], 10),
        airborne: parseInt(m[3], 10),
        landing: parseInt(m[4], 10),
      };
    }
  }
  const j = charMeta?.jump ?? SF6_CHARACTER_FRAME_DATA.ryu.jump;
  return { preJump: j.preJumpFrames, airborne: j.airborneFrames, landing: 3, total: j.totalJumpFrames + 3 };
}

function findMoveInDb(characterId: string, notation: string): FatMove | undefined {
  const dbKey = Object.keys(sf6Db).find(
    (k) => k.toLowerCase().replace(/[^a-z]/g, '') === characterId.toLowerCase().replace(/[^a-z]/g, '')
  );
  const normals = dbKey ? sf6Db[dbKey]?.moves?.normal : undefined;
  if (!normals) return undefined;
  const target = notation.toUpperCase().replace(/\s+/g, '');
  return Object.values(normals).find(
    (m) => m.numCmd?.toUpperCase().replace(/\s+/g, '') === target
  );
}

interface ParsedToken {
  raw: string;
  connector: 'start' | 'link' | 'cancel';
}

function tokenizeNotation(notation: string): ParsedToken[] {
  const normalized = notation
    .replace(/→/g, '>')
    .replace(/->/g, '>')
    .replace(/~/g, ' xx ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens: ParsedToken[] = [];
  const parts = normalized.split(/\s*(>|xx)\s*/i).filter(Boolean);

  let nextConnector: 'start' | 'link' | 'cancel' = 'start';
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === '>') {
      nextConnector = 'link';
    } else if (lower === 'xx') {
      nextConnector = 'cancel';
    } else {
      tokens.push({ raw: part.trim(), connector: nextConnector });
      nextConnector = 'link';
    }
  }
  return tokens;
}

function inferButtonsAndMotion(
  raw: string,
  mode: ControlMode
): { buttons: ActionButtonId[]; motion?: MotionType; strength: 'light' | 'medium' | 'heavy'; isJumpAttack: boolean; isJumpStart: boolean; isDR: boolean } {
  const upper = raw.toUpperCase().replace(/\s+/g, '');

  if (upper === '9' || upper === '↗' || upper === 'JUMP' || upper === '前跳') {
    return { buttons: ['RIGHT', 'UP'], strength: 'light', isJumpAttack: false, isJumpStart: true, isDR: false };
  }
  if (upper === 'DR' || upper === 'DRC' || upper === 'PARRY') {
    return { buttons: ['PARRY'], strength: 'medium', isJumpAttack: false, isJumpStart: false, isDR: true };
  }
  if (upper === 'DI') {
    return { buttons: ['DI'], strength: 'heavy', isJumpAttack: false, isJumpStart: false, isDR: false };
  }

  let motion: MotionType | undefined;
  if (upper.includes('236')) motion = '236';
  else if (upper.includes('214')) motion = '214';
  else if (upper.includes('623')) motion = '623';

  const isJumpAttack = upper.startsWith('J.');
  const buttons: ActionButtonId[] = [];

  if (!motion && !isJumpAttack) {
    if (upper.startsWith('2')) buttons.push('DOWN');
    else if (upper.startsWith('4')) buttons.push('LEFT');
    else if (upper.startsWith('6')) buttons.push('RIGHT');
  }

  let strength: 'light' | 'medium' | 'heavy' = 'medium';

  if (mode === 'classic') {
    if (upper.endsWith('LP')) { buttons.push('LP'); strength = 'light'; }
    else if (upper.endsWith('MP')) { buttons.push('MP'); strength = 'medium'; }
    else if (upper.endsWith('HP')) { buttons.push('HP'); strength = 'heavy'; }
    else if (upper.endsWith('LK')) { buttons.push('LK'); strength = 'light'; }
    else if (upper.endsWith('MK')) { buttons.push('MK'); strength = 'medium'; }
    else if (upper.endsWith('HK')) { buttons.push('HK'); strength = 'heavy'; }
    else if (upper.endsWith('P')) { buttons.push('HP'); strength = 'heavy'; }
    else if (upper.endsWith('K')) { buttons.push('MK'); strength = 'medium'; }
    else { buttons.push('MP'); }
  } else {
    if (upper.includes('AUTO')) buttons.push('AUTO');
    if (upper.endsWith('SP')) { buttons.push('SP'); strength = 'heavy'; }
    else if (upper.endsWith('L')) { buttons.push('L'); strength = 'light'; }
    else if (upper.endsWith('M')) { buttons.push('M'); strength = 'medium'; }
    else if (upper.endsWith('H')) { buttons.push('H'); strength = 'heavy'; }
    else { buttons.push('M'); }
  }

  return { buttons, motion, strength, isJumpAttack, isJumpStart: false, isDR: false };
}

/**
 * Converts a standard SF6 combo notation string into a 60fps ComboData chart
 * using the full 32-character SF6 Frame Data DB (jump frames, total, hitstop, startup).
 * If the combo starts with a jump-in attack (e.g. "j.HP > 5MP"), automatically inserts
 * the Forward-Jump (9 / ↗) trigger at frame 0!
 */
export function parseNotationToCombo(options: {
  characterId: string;
  mode: ControlMode;
  title: string;
  notation: string;
}): ComboData {
  const charMeta = SF6_CHARACTER_FRAME_DATA[options.characterId] ?? SF6_CHARACTER_FRAME_DATA.ryu;
  const jump = getCharacterJumpFrames(options.characterId);
  const rawTokens = tokenizeNotation(options.notation);

  // If first token is a jump attack (e.g. j.HP), prepend Forward-Jump (9) at frame 0!
  const tokens: ParsedToken[] =
    rawTokens.length > 0 && rawTokens[0].raw.toUpperCase().startsWith('J.')
      ? [{ raw: '9', connector: 'start' }, ...rawTokens]
      : rawTokens;

  const notes: ComboNote[] = [];
  let currentFrame = 0;
  let prevStrength: 'light' | 'medium' | 'heavy' = 'medium';
  let prevRaw = '';
  let prevWasDR = false;
  let prevWasJumpStart = false;
  let prevWasJumpAttack = false;

  const count = Math.max(1, tokens.length);

  tokens.forEach((tok, idx) => {
    const parsed = inferButtonsAndMotion(tok.raw, options.mode);

    if (idx > 0) {
      if (prevWasJumpStart && parsed.isJumpAttack) {
        // Press jump-in attack ~12f before landing for a deep jump-in hit
        currentFrame += Math.max(18, jump.preJump + jump.airborne - 12);
      } else if (prevWasJumpAttack) {
        // Remaining airtime (~12f) + landing + heavy hitstop (~11f)
        currentFrame += 12 + SF6_SYSTEM_FRAMES.hitstop.heavy;
      } else if (prevWasDR) {
        currentFrame += SF6_SYSTEM_FRAMES.driveRushCancel.recommendedNextNormalGap;
      } else {
        const dbMove = findMoveInDb(options.characterId, prevRaw);
        if (tok.connector === 'cancel') {
          const startup = parseFirstNum(dbMove?.startup, prevStrength === 'light' ? 4 : prevStrength === 'medium' ? 6 : 9);
          const hitstop = parseFirstNum(dbMove?.hitstop, SF6_SYSTEM_FRAMES.hitstop[prevStrength]);
          currentFrame += startup + Math.round(hitstop * 0.6);
        } else {
          // Link (目押)
          const total = parseFirstNum(dbMove?.total, prevStrength === 'light' ? 14 : prevStrength === 'medium' ? 20 : 32);
          const hitstop = parseFirstNum(dbMove?.hitstop, SF6_SYSTEM_FRAMES.hitstop[prevStrength]);
          currentFrame += total + hitstop;
        }
      }
    }

    const x =
      count === 1
        ? 0.72
        : Number((0.54 + (idx / (count - 1)) * 0.35).toFixed(3));

    const dbMove = findMoveInDb(options.characterId, tok.raw);
    notes.push({
      id: `imp-${idx + 1}`,
      frame: currentFrame,
      buttons: parsed.buttons,
      motion: parsed.motion,
      notation: parsed.isJumpStart ? '↗ 前跳' : tok.raw,
      moveName: parsed.isJumpStart
        ? `前上起跳 (${jump.total}f)`
        : parsed.isDR
        ? '綠衝取消'
        : parsed.isJumpAttack
        ? '低點跳攻擊'
        : dbMove?.moveName ?? tok.raw,
      x,
      y: 0.50,
    });

    prevStrength = parsed.strength;
    prevRaw = tok.raw;
    prevWasDR = parsed.isDR;
    prevWasJumpStart = parsed.isJumpStart;
    prevWasJumpAttack = parsed.isJumpAttack;
  });

  return {
    id: `custom-${Date.now()}`,
    characterId: charMeta.id,
    characterName: charMeta.name,
    mode: options.mode,
    title: options.title.trim() || `${charMeta.name} 自訂連段`,
    difficulty: notes.length >= 5 ? 'Intermediate' : 'Beginner',
    description: `已套用 SF6 完整資料庫（跳躍 ${jump.total}f = ${jump.preJump}+${jump.airborne}+${jump.landing}）：${options.notation}`,
    tags: ['資料庫計算', `${jump.total}f跳躍`],
    notes,
  };
}
