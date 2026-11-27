/**
 * Shared strict validator for online combo uploads / downloads.
 *
 * Used in THREE places so the rules can never drift:
 *   1. Desktop app, before uploading (friendly error messages)
 *   2. Cloudflare Worker, on every upload (authoritative)
 *   3. Desktop app, after downloading (defense in depth)
 *
 * The accepted shape is exactly the existing `ComboData` JSON format used by
 * `src/data/combos.ts` and recorded custom combos. Unknown keys are rejected.
 * Zero dependencies so it bundles cleanly into both Vite and Workers.
 */
import type { ComboData } from '../types/combo';
import { ALL_SF6_CHARACTERS } from '../data/frameData';

export const COMBO_SCHEMA_VERSION = 1;

export const COMBO_LIMITS = {
  maxJsonBytes: 96 * 1024,
  maxTitle: 120,
  maxDescription: 600,
  maxTags: 12,
  maxTagLength: 32,
  minNotes: 1,
  maxNotes: 120,
  maxFrame: 7200,
  maxHoldFrames: 900,
  maxNoteId: 64,
  maxNotation: 48,
  maxMoveName: 80,
  maxInputHistory: 4000,
} as const;

export const SF6_CHARACTER_IDS: ReadonlySet<string> = new Set(ALL_SF6_CHARACTERS.map((c) => c.id));
export const SF6_CHARACTER_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  ALL_SF6_CHARACTERS.map((c) => [c.id, c.name])
);

const DIRECTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const;
const CLASSIC_BUTTONS = new Set<string>([...DIRECTIONS, 'LP', 'MP', 'HP', 'LK', 'MK', 'HK', 'PARRY', 'DI']);
const MODERN_BUTTONS = new Set<string>([...DIRECTIONS, 'L', 'M', 'H', 'SP', 'AUTO', 'PARRY', 'DI']);
const MOTIONS = new Set(['236', '214', '623', '6214', '22', '66', '44', '46', '4646', '28', '360', '720']);
const WINDOW_TYPES = new Set(['link', 'cancel', 'dr-cancel', 'juggle']);
const DIFFICULTIES = new Set(['Beginner', 'Intermediate', 'Advanced', 'Ultra Hard']);
const POSITIONS = new Set(['midscreen', 'corner']);
const MODES = new Set(['classic', 'modern']);

const COMBO_KEYS = new Set([
  'id', 'characterId', 'characterName', 'mode', 'title', 'titleEn', 'difficulty', 'position',
  'description', 'tags', 'notes', 'inputHistory', 'videoUrl',
  // Local-only optional fields: allowed in input but always stripped by sanitizeForUpload()
  'locked', 'lockReason', 'source', 'onlineId', 'author',
]);
const NOTE_KEYS = new Set(['id', 'frame', 'buttons', 'motion', 'windowType', 'holdFrames', 'notation', 'moveName', 'x', 'y']);
const HISTORY_KEYS = new Set(['startFrame', 'durationFrames', 'dir', 'buttons']);

// Control characters (except tab/newline) and bidi override characters are never allowed
const BAD_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  combo?: ComboData;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

function checkStr(
  errors: string[],
  path: string,
  v: unknown,
  opts: { min?: number; max: number; optional?: boolean }
): v is string {
  if (v === undefined && opts.optional) return false;
  if (typeof v !== 'string') {
    errors.push(`${path}: must be a string`);
    return false;
  }
  const len = [...v].length;
  if (len < (opts.min ?? 0)) errors.push(`${path}: too short (min ${opts.min})`);
  if (len > opts.max) errors.push(`${path}: too long (max ${opts.max})`);
  if (BAD_CHARS.test(v)) errors.push(`${path}: contains forbidden control characters`);
  return true;
}

function checkKeys(errors: string[], path: string, obj: Record<string, unknown>, allowed: Set<string>) {
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) errors.push(`${path}: unknown field "${k}"`);
  }
}

/**
 * Validates a value against the strict ComboData format.
 * Returns the parsed combo (same object) when valid. Stops collecting after 30 errors.
 */
export function validateCombo(input: unknown): ValidationResult {
  const errors: string[] = [];
  const done = (): ValidationResult => ({ ok: errors.length === 0, errors: errors.slice(0, 30), combo: errors.length === 0 ? (input as ComboData) : undefined });

  if (!isObj(input)) {
    errors.push('root: must be a JSON object');
    return done();
  }
  const c = input;
  checkKeys(errors, 'root', c, COMBO_KEYS);

  checkStr(errors, 'id', c.id, { min: 1, max: 96 });
  if (typeof c.characterId !== 'string' || !SF6_CHARACTER_IDS.has(c.characterId)) {
    errors.push('characterId: unknown SF6 character');
  }
  checkStr(errors, 'characterName', c.characterName, { min: 1, max: 40 });
  if (typeof c.mode !== 'string' || !MODES.has(c.mode)) errors.push('mode: must be "classic" or "modern"');
  checkStr(errors, 'title', c.title, { min: 1, max: COMBO_LIMITS.maxTitle });
  checkStr(errors, 'titleEn', c.titleEn, { min: 1, max: COMBO_LIMITS.maxTitle, optional: true });
  if (typeof c.difficulty !== 'string' || !DIFFICULTIES.has(c.difficulty)) {
    errors.push('difficulty: must be Beginner / Intermediate / Advanced / Ultra Hard');
  }
  if (c.position !== undefined && (typeof c.position !== 'string' || !POSITIONS.has(c.position))) {
    errors.push('position: must be "midscreen" or "corner"');
  }
  checkStr(errors, 'description', c.description, { max: COMBO_LIMITS.maxDescription });

  if (!Array.isArray(c.tags)) {
    errors.push('tags: must be an array');
  } else {
    if (c.tags.length > COMBO_LIMITS.maxTags) errors.push(`tags: at most ${COMBO_LIMITS.maxTags}`);
    c.tags.slice(0, COMBO_LIMITS.maxTags).forEach((tg, i) => checkStr(errors, `tags[${i}]`, tg, { min: 1, max: COMBO_LIMITS.maxTagLength }));
  }

  const allowedButtons = c.mode === 'modern' ? MODERN_BUTTONS : CLASSIC_BUTTONS;

  if (!Array.isArray(c.notes)) {
    errors.push('notes: must be an array');
  } else {
    if (c.notes.length < COMBO_LIMITS.minNotes) errors.push('notes: at least 1 note required');
    if (c.notes.length > COMBO_LIMITS.maxNotes) errors.push(`notes: at most ${COMBO_LIMITS.maxNotes}`);
    let prevFrame = -1;
    const seenIds = new Set<string>();
    for (let i = 0; i < Math.min(c.notes.length, COMBO_LIMITS.maxNotes); i++) {
      if (errors.length >= 30) break;
      const n = c.notes[i];
      const p = `notes[${i}]`;
      if (!isObj(n)) {
        errors.push(`${p}: must be an object`);
        continue;
      }
      checkKeys(errors, p, n, NOTE_KEYS);
      if (checkStr(errors, `${p}.id`, n.id, { min: 1, max: COMBO_LIMITS.maxNoteId })) {
        if (seenIds.has(n.id as string)) errors.push(`${p}.id: duplicate note id`);
        seenIds.add(n.id as string);
      }
      if (!isNum(n.frame, 0, COMBO_LIMITS.maxFrame)) {
        errors.push(`${p}.frame: must be a number between 0 and ${COMBO_LIMITS.maxFrame}`);
      } else {
        if (n.frame < prevFrame) errors.push(`${p}.frame: frames must be in ascending order`);
        prevFrame = n.frame;
      }
      if (!Array.isArray(n.buttons) || n.buttons.length === 0 || n.buttons.length > 8) {
        errors.push(`${p}.buttons: must be a non-empty array (max 8)`);
      } else {
        n.buttons.forEach((b, bi) => {
          if (typeof b !== 'string' || !allowedButtons.has(b)) {
            errors.push(`${p}.buttons[${bi}]: "${String(b)}" is not a valid ${String(c.mode)} button`);
          }
        });
      }
      if (n.motion !== undefined && (typeof n.motion !== 'string' || !MOTIONS.has(n.motion))) {
        errors.push(`${p}.motion: invalid motion`);
      }
      if (n.windowType !== undefined && (typeof n.windowType !== 'string' || !WINDOW_TYPES.has(n.windowType))) {
        errors.push(`${p}.windowType: invalid window type`);
      }
      if (n.holdFrames !== undefined && !isNum(n.holdFrames, 0, COMBO_LIMITS.maxHoldFrames)) {
        errors.push(`${p}.holdFrames: must be 0-${COMBO_LIMITS.maxHoldFrames}`);
      }
      checkStr(errors, `${p}.notation`, n.notation, { min: 1, max: COMBO_LIMITS.maxNotation });
      checkStr(errors, `${p}.moveName`, n.moveName, { max: COMBO_LIMITS.maxMoveName });
      if (!isNum(n.x, 0, 1)) errors.push(`${p}.x: must be between 0 and 1`);
      if (!isNum(n.y, 0, 1)) errors.push(`${p}.y: must be between 0 and 1`);
    }
  }

  if (c.inputHistory !== undefined) {
    if (!Array.isArray(c.inputHistory)) {
      errors.push('inputHistory: must be an array');
    } else {
      if (c.inputHistory.length > COMBO_LIMITS.maxInputHistory) {
        errors.push(`inputHistory: at most ${COMBO_LIMITS.maxInputHistory} entries`);
      }
      for (let i = 0; i < Math.min(c.inputHistory.length, COMBO_LIMITS.maxInputHistory); i++) {
        if (errors.length >= 30) break;
        const h = c.inputHistory[i];
        const p = `inputHistory[${i}]`;
        if (!isObj(h)) {
          errors.push(`${p}: must be an object`);
          continue;
        }
        checkKeys(errors, p, h, HISTORY_KEYS);
        if (!isNum(h.startFrame, 0, COMBO_LIMITS.maxFrame + 600)) errors.push(`${p}.startFrame: out of range`);
        if (!isNum(h.durationFrames, 0, COMBO_LIMITS.maxFrame + 600)) errors.push(`${p}.durationFrames: out of range`);
        if (typeof h.dir !== 'string' || !/^[1-9]$/.test(h.dir)) errors.push(`${p}.dir: must be "1"-"9"`);
        if (!Array.isArray(h.buttons) || h.buttons.length > 12) {
          errors.push(`${p}.buttons: must be an array (max 12)`);
        } else {
          h.buttons.forEach((b, bi) => {
            if (typeof b !== 'string' || !allowedButtons.has(b)) errors.push(`${p}.buttons[${bi}]: invalid button`);
          });
        }
      }
    }
  }

  if (c.locked !== undefined && typeof c.locked !== 'boolean') errors.push('locked: must be boolean');
  checkStr(errors, 'lockReason', c.lockReason, { max: 200, optional: true });
  if (c.source !== undefined && c.source !== 'online') errors.push('source: invalid');
  checkStr(errors, 'onlineId', c.onlineId, { max: 64, optional: true });
  checkStr(errors, 'author', c.author, { max: 64, optional: true });

  return done();
}

/**
 * Returns a clean copy containing only the shareable ComboData fields
 * (drops local-only fields like locked / source / onlineId / author).
 */
export function sanitizeForUpload(combo: ComboData): ComboData {
  const out: ComboData = {
    id: combo.id,
    characterId: combo.characterId,
    characterName: combo.characterName,
    mode: combo.mode,
    title: combo.title,
    difficulty: combo.difficulty,
    description: combo.description ?? '',
    tags: [...(combo.tags ?? [])],
    notes: combo.notes.map((n) => {
      const note: ComboData['notes'][number] = {
        id: n.id,
        frame: n.frame,
        buttons: [...n.buttons],
        notation: n.notation,
        moveName: n.moveName ?? '',
        x: n.x,
        y: n.y,
      };
      if (n.motion !== undefined) note.motion = n.motion;
      if (n.windowType !== undefined) note.windowType = n.windowType;
      if (n.holdFrames !== undefined) note.holdFrames = n.holdFrames;
      return note;
    }),
  };
  if (combo.titleEn !== undefined) out.titleEn = combo.titleEn;
  if (combo.position !== undefined) out.position = combo.position;
  if (combo.inputHistory !== undefined) {
    out.inputHistory = combo.inputHistory.map((h) => ({
      startFrame: h.startFrame,
      durationFrames: h.durationFrames,
      dir: h.dir,
      buttons: [...h.buttons],
    }));
  }
  return out;
}

/** UTF-8 byte length of a string (works in browsers and Workers). */
export function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}
