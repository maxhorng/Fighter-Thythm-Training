// Verifies every built-in combo passes the strict online combo validator.
// Run: npm run check:schema
import { BUILTIN_COMBOS } from '../src/data/combos';
import { validateCombo, sanitizeForUpload, utf8Bytes, COMBO_LIMITS } from '../src/schema/comboSchema';

let failed = 0;
let maxBytes = 0;
let maxTitle = 0;
let maxTags = 0;
let maxNotes = 0;
let maxHist = 0;
let maxFrame = 0;
for (const combo of BUILTIN_COMBOS) {
  const clean = sanitizeForUpload(combo);
  const bytes = utf8Bytes(JSON.stringify(clean));
  maxBytes = Math.max(maxBytes, bytes);
  maxTitle = Math.max(maxTitle, [...combo.title].length);
  maxTags = Math.max(maxTags, combo.tags.length);
  maxNotes = Math.max(maxNotes, combo.notes.length);
  maxHist = Math.max(maxHist, combo.inputHistory?.length ?? 0);
  maxFrame = Math.max(maxFrame, ...combo.notes.map((n) => n.frame));
  const res = validateCombo(clean);
  if (bytes > COMBO_LIMITS.maxJsonBytes) res.errors.push(`size ${bytes} > ${COMBO_LIMITS.maxJsonBytes}`);
  if (!res.ok || bytes > COMBO_LIMITS.maxJsonBytes) {
    failed++;
    console.log(`FAIL ${combo.id}:`);
    res.errors.slice(0, 5).forEach((e) => console.log('   ', e));
  }
}
console.log(
  `\nChecked ${BUILTIN_COMBOS.length} built-in combos, ${failed} failed.` +
    `\nMax: bytes=${maxBytes} title=${maxTitle} tags=${maxTags} notes=${maxNotes} inputHistory=${maxHist} frame=${maxFrame}`
);

// Negative cases: ensure invalid payloads are strictly rejected
const sample = sanitizeForUpload(BUILTIN_COMBOS[0]);
const invalidCases: { name: string; payload: unknown }[] = [
  { name: 'non-object root', payload: 'not an object' },
  { name: 'unknown root field', payload: { ...sample, injected: true } },
  { name: 'unknown characterId', payload: { ...sample, characterId: 'unknown_char' } },
  { name: 'empty notes', payload: { ...sample, notes: [] } },
  {
    name: 'modern button in classic mode',
    payload: {
      ...sample,
      mode: 'classic',
      notes: [{ ...sample.notes[0], buttons: ['SP'] }],
    },
  },
  {
    name: 'descending note frames',
    payload: {
      ...sample,
      notes: [
        { ...sample.notes[0], id: 'n1', frame: 30 },
        { ...sample.notes[0], id: 'n2', frame: 10 },
      ],
    },
  },
  { name: 'control character in title', payload: { ...sample, title: 'bad\u0000title' } },
];

let negFailed = 0;
for (const tc of invalidCases) {
  const res = validateCombo(tc.payload);
  if (res.ok) {
    negFailed++;
    console.log(`NEG FAIL: "${tc.name}" was unexpectedly accepted`);
  }
}
console.log(`Checked ${invalidCases.length} invalid payloads, ${invalidCases.length - negFailed} rejected (${negFailed} unexpected passes).`);
process.exit(failed || negFailed ? 1 : 0);
