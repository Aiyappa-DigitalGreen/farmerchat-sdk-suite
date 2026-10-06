/**
 * Guards every label key the web UI passes against what the backend actually serves.
 *
 * Why this test exists: an unserved key is INVISIBLE. `LabelManager.getLabel` falls through to
 * the English fallback, so the UI renders correct-looking English and nothing anywhere errors.
 * The only way to notice is to run the app in a non-English language and read it. That is how
 * 159 invented keys survived a full port and several fidelity passes — web resolved 10 of its
 * 169 distinct keys, and every other string was English for every user in every language.
 *
 * Two fixtures, and the distinction between them is the point:
 *   • servedLabelKeys.json   — the 289 base keys endpoint #3 returns (captured from DEV,
 *                              `?language=1`). A key here HAS a translation.
 *   • unservedLabelKeys.json — the remaining keys, which the backend has no entry for. Those
 *                              render their English fallback, and that is the only behaviour
 *                              available, so it is not a bug. It IS a content gap worth tracking.
 *
 * A new key must land in one list or the other, deliberately. Adding one to the allowlist is
 * cheap and honest; silently inventing one is what this catches.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const served: string[] = JSON.parse(readFileSync('test/fixtures/servedLabelKeys.json', 'utf8'));
const allowlist: string[] = JSON.parse(readFileSync('test/fixtures/unservedLabelKeys.json', 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function keysInSource(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of walk('src/ui')) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/label\(\s*'([a-zA-Z0-9_.]+)'/g)) {
      const list = found.get(m[1]) ?? [];
      list.push(file);
      found.set(m[1], list);
    }
  }
  return found;
}

test('every label key is either served or explicitly known-unserved', () => {
  const known = new Set([...served, ...allowlist]);
  const strays: string[] = [];
  for (const [key, files] of keysInSource()) {
    if (!known.has(key)) strays.push(`${key}  (${files[0]})`);
  }
  assert.deepEqual(
    strays,
    [],
    `These label keys are in neither fixture. If the backend serves the string, use its\n` +
      `fc_v2_app_label_* key; if it genuinely does not, add the key to\n` +
      `test/fixtures/unservedLabelKeys.json so the gap is tracked:\n  ${strays.join('\n  ')}`
  );
});

test('the allowlist has not silently grown', () => {
  // A ratchet, not a ceiling: lowering it as keys get mapped is the point. Raising it means a
  // new invented key was accepted, which is exactly what this file exists to prevent.
  assert.ok(
    allowlist.length <= 64,
    `allowlist grew to ${allowlist.length} (was 64). Map the new key to a served one instead.`
  );
});

test('no key in the allowlist is actually served', () => {
  const servedSet = new Set(served);
  const wrong = allowlist.filter((k) => servedSet.has(k));
  assert.deepEqual(wrong, [], `these are served and should not be allowlisted: ${wrong.join(', ')}`);
});
