#!/usr/bin/env node
/**
 * SF6 實錄連段自動匯入腳本
 *
 * 用法：
 *   1. 直接複製 1 組或多組連段 JSON 到剪貼簿，然後執行：
 *      npm run add-combo
 *   2. 加上可選標記（套用到本次匯入的所有連段）：
 *      npm run add-combo -- --corner
 *      npm run add-combo -- --mid
 *      npm run add-combo -- --note "安全跳"
 *      npm run add-combo -- --diff "Ultra Hard"
 *      npm run add-combo -- --tag "壓持續,確反"
 *      npm run add-combo -- --dry            (只預覽，不寫入)
 *      npm run add-combo -- --no-tsc         (跳過 TypeScript 檢查)
 *   3. 或從檔案匯入：
 *      npm run add-combo -- path/to/combos.json --corner
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const COMBOS_PATH = path.resolve(process.cwd(), 'src/data/combos.ts');

const CANCEL_MOTIONS = new Set([
  '236', '214', '623', '6214', '46', '4646', '28', '360', '720',
]);
const LIGHT_OR_MED_BTNS = new Set(['LP', 'LK', 'L', 'MP', 'MK', 'M']);
const HEAVY_OR_SPEC_BTNS = new Set(['HP', 'HK', 'H', 'SP', 'PARRY', 'DI']);

// ── CLI 參數解析 ──
function parseArgs(argv) {
  const opts = {
    file: null,
    corner: false,
    mid: false,
    note: '',
    diff: '',
    tags: [],
    dry: false,
    noTsc: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--corner') opts.corner = true;
    else if (arg === '--mid') opts.mid = true;
    else if (arg === '--dry') opts.dry = true;
    else if (arg === '--no-tsc') opts.noTsc = true;
    else if (arg === '--note' && argv[i + 1]) opts.note = argv[++i];
    else if (arg === '--diff' && argv[i + 1]) opts.diff = argv[++i];
    else if (arg === '--tag' && argv[i + 1]) {
      opts.tags.push(...argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    } else if (!arg.startsWith('--') && !opts.file) {
      opts.file = arg;
    }
  }
  return opts;
}

// ── 讀取剪貼簿或檔案 ──
function readInputText(file) {
  if (file) {
    return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  }
  try {
    return execSync('powershell -NoProfile -Command "Get-Clipboard -Raw"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    console.error('❌ 無法讀取剪貼簿，請確認剪貼簿有 JSON 內容，或改傳檔案路徑。');
    process.exit(1);
  }
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
  const rawText = readInputText(opts.file);
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

    toAppend.push({
      id: finalId,
      characterId: raw.characterId,
      characterName: raw.characterName,
      mode: raw.mode,
      title,
      difficulty,
      ...(opts.corner ? { position: 'corner' } : opts.mid ? { position: 'midscreen' } : {}),
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
