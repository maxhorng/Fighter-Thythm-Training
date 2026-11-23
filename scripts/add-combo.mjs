#!/usr/bin/env node
/**
 * SF6 實錄連段自動匯入腳本
 *
 * 用法：
 *   1. 直接執行（會跳出記事本視窗，貼上 1 組或多組 JSON → Ctrl+S 存檔 → 關閉視窗即自動匯入）：
 *      npm run add-combo
 *   2. 加上可選標記（套用到本次匯入的所有連段）：
 *      npm run add-combo -- --corner
 *      npm run add-combo -- --mid
 *      npm run add-combo -- --note "安全跳"
 *      npm run add-combo -- --diff "Ultra Hard"
 *      npm run add-combo -- --tag "壓持續,確反"
 *      npm run add-combo -- --clip           (改直接讀取剪貼簿，不開記事本)
 *      npm run add-combo -- --dry            (只預覽，不寫入)
 *      npm run add-combo -- --no-tsc         (跳過 TypeScript 檢查)
 *   3. 或直接匯入指定檔案：
 *      npm run add-combo -- path/to/combos.json --corner
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const COMBOS_PATH = path.resolve(process.cwd(), 'src/data/combos.ts');
const PAD_FILE = path.resolve(process.cwd(), 'scripts/_combo_paste.txt');

const CANCEL_MOTIONS = new Set([
  '236', '214', '623', '6214', '46', '4646', '28', '360', '720',
]);
const LIGHT_OR_MED_BTNS = new Set(['LP', 'LK', 'L', 'MP', 'MK', 'M']);
const HEAVY_OR_SPEC_BTNS = new Set(['HP', 'HK', 'H', 'SP', 'PARRY', 'DI']);

function normalizeDifficulty(raw) {
  if (!raw) return '';
  const s = String(raw).trim().toLowerCase();
  if (s === 'beginner' || s === 'easy' || s === '簡單') return 'Beginner';
  if (s === 'intermediate' || s === 'medium' || s === 'mid' || s === '中級') return 'Intermediate';
  if (s === 'advanced' || s === 'advance' || s === 'hard' || s === '進階') return 'Advanced';
  if (s === 'ultra hard' || s === 'ultrahard' || s === 'ultra') return 'Ultra Hard';
  return raw.trim();
}

// ── CLI 參數解析（同時相容有沒有打 -- 分隔符，以及 npm_config_*） ──
function parseArgs(argv) {
  const opts = {
    file: null,
    clip: process.env.npm_config_clip === 'true',
    corner: process.env.npm_config_corner === 'true',
    mid: process.env.npm_config_mid === 'true',
    note: process.env.npm_config_note || '',
    diff: normalizeDifficulty(process.env.npm_config_diff || ''),
    tags: process.env.npm_config_tag
      ? process.env.npm_config_tag.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    dry: process.env.npm_config_dry === 'true',
    noTsc: process.env.npm_config_no_tsc === 'true',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--corner' || arg === '-corner') opts.corner = true;
    else if (arg === '--mid' || arg === '-mid') opts.mid = true;
    else if (arg === '--clip' || arg === '-clip') opts.clip = true;
    else if (arg === '--dry' || arg === '-dry') opts.dry = true;
    else if (arg === '--no-tsc') opts.noTsc = true;
    else if ((arg === '--note' || arg === '-note') && argv[i + 1]) opts.note = argv[++i];
    else if ((arg === '--diff' || arg === '-diff') && argv[i + 1]) {
      opts.diff = normalizeDifficulty(argv[++i]);
    } else if ((arg === '--tag' || arg === '-tag') && argv[i + 1]) {
      opts.tags.push(...argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    } else if (!arg.startsWith('-') && !opts.file) {
      // 如果有人打 npm run add-combo --diff Beginner 漏了 --，
      // npm 會把 --diff 設成 npm_config_diff='true'，而把 "Beginner" 當成位置參數傳進來
      const maybeDiff = normalizeDifficulty(arg);
      if (
        process.env.npm_config_diff === 'true' &&
        ['Beginner', 'Intermediate', 'Advanced', 'Ultra Hard'].includes(maybeDiff)
      ) {
        opts.diff = maybeDiff;
      } else {
        opts.file = arg;
      }
    }
  }
  return opts;
}

// ── 讀取檔案、剪貼簿或開啟記事本 ──
function readInputText(opts) {
  if (opts.file) {
    return fs.readFileSync(path.resolve(process.cwd(), opts.file), 'utf8');
  }
  if (opts.clip) {
    try {
      return execSync('powershell -NoProfile -Command "Get-Clipboard -Raw"', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      console.error('❌ 無法讀取剪貼簿，請確認剪貼簿有 JSON 內容。');
      process.exit(1);
    }
  }

  // 預設：開啟記事本讓使用者貼上 JSON，存檔並關閉後自動繼續
  fs.writeFileSync(PAD_FILE, '', 'utf8');
  console.log('📝 已開啟記事本視窗！請貼上 1 組或多組連段 JSON → 按 Ctrl+S 存檔 → 關閉記事本即可自動匯入...');
  spawnSync('notepad.exe', [PAD_FILE], { stdio: 'inherit' });
  const content = fs.existsSync(PAD_FILE) ? fs.readFileSync(PAD_FILE, 'utf8') : '';
  try {
    fs.unlinkSync(PAD_FILE);
  } catch {
    // ignore cleanup error
  }
  return content;
}

// ── 解析單組、陣列、或相連多組 JSON ({...}{...}) ──
function extractJsonObjects(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return [];

  // 先嘗試直接 JSON.parse（單一物件或陣列）
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // 繼續用大括號平衡拆解相連的 {...}{...}
  }

  const objects = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const slice = trimmed.slice(start, i + 1);
        objects.push(JSON.parse(slice));
        start = -1;
      }
    }
  }
  return objects;
}

// ── 載入現有 BUILTIN_COMBOS 做去重 ──
function loadExistingCombos(src) {
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  const fakeReq = (p) => (p.startsWith('.') ? { ALL_SF6_CHARACTERS: [] } : require(p));
  new Function('exports', 'require', 'module', js)(mod.exports, fakeReq, mod);
  return mod.exports.BUILTIN_COMBOS || [];
}

function comboSignature(c) {
  const notesSig = (c.notes || [])
    .map((n) => `${n.frame}:${n.notation || ''}`)
    .join('|');
  return `${c.characterId}::${c.mode}::${notesSig}`;
}

// ── 規則推斷 ──
function inferWindowType(note, idx, mode) {
  if (idx === 0) return undefined;
  const btns = note.buttons || [];
  if (btns.includes('PARRY')) return 'dr-cancel';
  if (note.motion && CANCEL_MOTIONS.has(note.motion)) return 'cancel';
  if (mode === 'modern' && btns.includes('SP')) return 'cancel';
  return undefined;
}

function shouldKeepHoldFrames(note) {
  if (!note.holdFrames || note.holdFrames <= 0) return false;
  const btns = note.buttons || [];
  // 生綠衝長按 PARRY
  if (btns.includes('PARRY')) return true;
  // 蓄力/集氣必殺（排除 SA 過場誤按超長 > 35f）
  if (note.motion && note.holdFrames <= 35) return true;
  // 現代模式長按 SP
  if (btns.includes('SP') && note.holdFrames <= 35) return true;
  return false;
}

function inferDifficulty(combo, notes, overrideDiff) {
  if (overrideDiff) return overrideDiff;
  const n0 = notes[0];
  const isLightOrMedStart =
    n0 &&
    !n0.motion &&
    !(n0.buttons || []).some((b) => HEAVY_OR_SPEC_BTNS.has(b)) &&
    (n0.buttons || []).some((b) => LIGHT_OR_MED_BTNS.has(b));
  const hasDR = notes.some(
    (n) => (n.buttons || []).includes('PARRY') || n.windowType === 'dr-cancel'
  );
  if (isLightOrMedStart && !hasDR && notes.length <= 4) {
    return 'Beginner';
  }
  return combo.difficulty || (notes.length >= 6 ? 'Advanced' : 'Intermediate');
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function buildTitleAndTags(combo, notes, opts) {
  const totalHits = notes.length;
  const totalFrames = notes.length > 0 ? notes[notes.length - 1].frame : 0;
  const starter = notes[0]?.notation || '連段';
  const lastNotation = notes[notes.length - 1]?.notation || '';

  const drCount = notes.filter((n) => (n.buttons || []).includes('PARRY')).length;
  const hasSA3 = notes.some((n) => /236236|214214|SA3|2H\+SP|2SP\+H/i.test(n.notation || ''));

  const prefixes = [];
  if (opts.corner) prefixes.push('[角落]');
  if (opts.mid) prefixes.push('[場中]');
  const prefixStr = prefixes.length > 0 ? `${prefixes.join('')} ` : '';

  let title = combo.title || '';
  if (!title || title.includes('實錄連段')) {
    const parts = [starter];
    if (drCount >= 2) parts.push('雙綠衝');
    else if (drCount === 1) parts.push('綠衝');
    if (opts.note) parts.push(opts.note);
    else if (lastNotation && lastNotation !== starter) parts.push(lastNotation);
    title = `${combo.characterName} ${prefixStr}${parts.join(' ')} (${totalHits} 擊 · ${totalFrames}f)`;
  } else if (prefixStr && !title.includes(prefixStr.trim())) {
    title = title.replace(/^(\S+\s+)/, `$1${prefixStr}`);
  }

  const tagSet = new Set(combo.tags || ['實機錄製', '60fps原味']);
  if (opts.corner) tagSet.add('角落限定');
  if (opts.mid) tagSet.add('場中限定');
  if (drCount >= 2) tagSet.add('雙綠衝');
  else if (drCount === 1) tagSet.add('Drive Rush');
  if (hasSA3) tagSet.add('SA3');
  if (opts.note) tagSet.add(opts.note);
  for (const t of opts.tags) tagSet.add(t);

  return { title, tags: Array.from(tagSet), totalHits, totalFrames };
}

// ── 格式化為 combos.ts 單引號精簡格式 ──
function sq(str) {
  return `'${String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function formatNote(n) {
  const parts = [
    `id: ${sq(n.id)}`,
    `frame: ${n.frame}`,
    `buttons: [${(n.buttons || []).map(sq).join(', ')}]`,
  ];
  if (n.motion) parts.push(`motion: ${sq(n.motion)}`);
  if (n.notation) parts.push(`notation: ${sq(n.notation)}`);
  if (n.moveName) parts.push(`moveName: ${sq(n.moveName)}`);
  parts.push(`x: ${n.x ?? 0.54}`);
  parts.push(`y: ${n.y ?? 0.5}`);
  if (n.holdFrames) parts.push(`holdFrames: ${n.holdFrames}`);
  if (n.windowType) parts.push(`windowType: ${sq(n.windowType)}`);
  return `      { ${parts.join(', ')} },`;
}

function formatHistoryItem(h) {
  const btns = (h.buttons || []).map(sq).join(', ');
  return `      { startFrame: ${h.startFrame}, durationFrames: ${h.durationFrames}, dir: ${sq(h.dir)}, buttons: [${btns}] },`;
}

function formatComboEntry(c) {
  const lines = [
    '  {',
    `    id: ${sq(c.id)},`,
    `    characterId: ${sq(c.characterId)},`,
    `    characterName: ${sq(c.characterName)},`,
    `    mode: ${sq(c.mode)},`,
    `    title: ${sq(c.title)},`,
    `    difficulty: ${sq(c.difficulty)},`,
    ...(c.position ? [`    position: ${sq(c.position)},`] : []),
    `    description: ${sq(c.description)},`,
    `    tags: [${c.tags.map(sq).join(', ')}],`,
    '    notes: [',
    ...c.notes.map(formatNote),
    '    ],',
  ];
  if (c.inputHistory && c.inputHistory.length > 0) {
    lines.push('    inputHistory: [');
    lines.push(...c.inputHistory.map(formatHistoryItem));
    lines.push('    ],');
  }
  lines.push('  },');
  return lines.join('\n');
}

// ── 主流程 ──
function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rawText = readInputText(opts);
  const incoming = extractJsonObjects(rawText);

  if (incoming.length === 0) {
    console.error('❌ 找不到有效的連段 JSON，請確認剪貼簿或檔案內容。');
    process.exit(1);
  }

  const combosSrc = fs.readFileSync(COMBOS_PATH, 'utf8');
  const existing = loadExistingCombos(combosSrc);
  const existingSigs = new Set(existing.map(comboSignature));
  const existingIds = new Set(existing.map((c) => c.id));

  const toAppend = [];
  const skipped = [];

  for (const raw of incoming) {
    const sig = comboSignature(raw);
    if (existingSigs.has(sig)) {
      skipped.push(raw.description || raw.title || raw.id);
      continue;
    }
    existingSigs.add(sig);

    const processedNotes = (raw.notes || []).map((n, idx) => {
      const keepHold = shouldKeepHoldFrames(n);
      const wt = n.windowType || inferWindowType(n, idx, raw.mode);
      const cleanMoveName =
        !keepHold && n.moveName && n.moveName.includes('按住')
          ? `${n.notation} (${n.frame}f)`
          : n.moveName;
      const out = {
        id: n.id,
        frame: n.frame,
        buttons: n.buttons || [],
        ...(n.motion ? { motion: n.motion } : {}),
        notation: n.notation,
        moveName: cleanMoveName,
        x: n.x,
        y: n.y,
        ...(keepHold ? { holdFrames: n.holdFrames } : {}),
        ...(wt ? { windowType: wt } : {}),
      };
      return out;
    });

    const { title, tags, totalHits, totalFrames } = buildTitleAndTags(raw, processedNotes, opts);
    const difficulty = inferDifficulty(raw, processedNotes, opts.diff);

    const starterSlug = slugify(processedNotes[0]?.notation || 'combo');
    const posSlug = opts.corner ? 'corner-' : opts.mid ? 'mid-' : '';
    let baseId = `${raw.characterId}-${raw.mode}-${posSlug}${starterSlug}-${totalHits}hit-${totalFrames}f`;
    let finalId = baseId;
    let suffix = 2;
    while (existingIds.has(finalId)) {
      finalId = `${baseId}-${suffix++}`;
    }
    existingIds.add(finalId);

    const position = opts.corner
      ? 'corner'
      : opts.mid
        ? 'midscreen'
        : raw.position || undefined;

    toAppend.push({
      id: finalId,
      characterId: raw.characterId,
      characterName: raw.characterName,
      mode: raw.mode,
      title,
      difficulty,
      ...(position ? { position } : {}),
      description: raw.description || '',
      tags,
      notes: processedNotes,
      inputHistory: raw.inputHistory || [],
    });
  }

  if (skipped.length > 0) {
    console.log(`⚠️  略過 ${skipped.length} 組重複連段：`);
    skipped.forEach((s) => console.log(`   - ${s}`));
  }

  if (toAppend.length === 0) {
    console.log('ℹ️  沒有需要新增的連段。');
    return;
  }

  console.log(`\n✨ 準備新增 ${toAppend.length} 組連段：`);
  toAppend.forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.difficulty}] ${c.title}  (id: ${c.id})`);
  });

  if (opts.dry) {
    console.log('\n🔍 (--dry 預覽模式，未寫入檔案)');
    return;
  }

  const endIdx = combosSrc.lastIndexOf('];');
  if (endIdx === -1) {
    console.error('❌ 在 src/data/combos.ts 中找不到結尾的 ];');
    process.exit(1);
  }

  const formattedBlock = toAppend.map(formatComboEntry).join('\n');
  const nextSrc = `${combosSrc.slice(0, endIdx)}${formattedBlock}\n${combosSrc.slice(endIdx)}`;
  fs.writeFileSync(COMBOS_PATH, nextSrc, 'utf8');
  console.log(`\n✅ 已成功寫入 ${toAppend.length} 組連段至 src/data/combos.ts！`);

  if (!opts.noTsc) {
    console.log('🔎 正在執行 npx tsc --noEmit 檢查...');
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log('✅ TypeScript 檢查通過（0 錯誤）！');
  }
}

main();
