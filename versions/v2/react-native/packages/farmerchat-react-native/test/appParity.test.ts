/**
 * Pins the app-parity fixes made to the react-native UI.
 *
 * This package had **no tests and no test runner** before this file. It now uses the same setup
 * the web package chose: Node's native TypeScript support plus a resolve hook, and no test
 * framework — one fewer dependency in a published SDK, and enough for source-level guards.
 *
 * These assert on SOURCE, deliberately. There is no renderer harness here, and every defect that
 * was found on this platform was a source value: a label key that no catalogue contains, a raw
 * literal where the app uses a mask, and an autofocus the app does not do.
 *
 * RUNNER:
 *
 *     node --import ./test/ts-extension-hook.mjs test/appParity.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(p, 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

test('the phone field uses the literal digit mask', () => {
  const src = read('src/ui/screens/AuthScreen.tsx');
  assert.ok(
    src.includes('placeholder="00000 00000"'),
    'App parity: the phone placeholder is the literal digit mask, not a label.'
  );
  assert.ok(
    !src.includes("label('auth_phone_hint'"),
    "`auth_phone_hint` is in no catalogue — it could never resolve, and this was the same " +
      'label-key misuse found on compose, iOS, web and views.'
  );
});

test('the phone field does not autofocus', () => {
  const src = read('src/ui/screens/AuthScreen.tsx');
  const i = src.indexOf('placeholder="00000 00000"');
  const block = src.slice(i - 400, i + 400);
  assert.ok(
    !/\bautoFocus\b/.test(block),
    'App parity (OtpInput.kt:43): the app focuses only its OTP input, never the phone field — ' +
      'otherwise the keyboard covers the agreement card and both send buttons.'
  );
});

test('the OTP input still self-focuses', () => {
  // The counterpart to the test above: removing the phone autofocus must not leave the screen
  // with no focused field, which is exactly what happened on web.
  const src = read('src/ui/components/Inputs.tsx');
  const otp = src.slice(src.indexOf('OTP_LENGTH'));
  assert.ok(/autoFocus/.test(otp), 'the OTP field keeps its autoFocus');
});

test('the composer placeholder resolves the served label everywhere', () => {
  // ChatScreen and HomeScreen were already correct and must stay that way: each passes the
  // served key explicitly rather than relying on a component default, which is precisely how
  // the same bug hid on the compose flavour (Home passed it, Chat took the default).
  for (const f of ['src/ui/screens/ChatScreen.tsx', 'src/ui/screens/HomeScreen.tsx']) {
    assert.ok(
      read(f).includes('Labels.ASK_ABOUT_YOUR_FARM'),
      `${f} must pass Labels.ASK_ABOUT_YOUR_FARM`
    );
  }
});

test('every label key is served or explicitly known-unserved', () => {
  // Every key endpoint #3 serves is `fc_v2_*` prefixed (287 on DEV, zero short keys), so an
  // unprefixed literal is unresolvable by construction — it silently renders the English
  // fallback in every language, which is how 93 of these survived here unnoticed.
  //
  // Two fixtures, and the distinction is the point:
  //   servedLabelKeys.json   — keys the backend returns; these HAVE translations.
  //   unservedLabelKeys.json — keys it has no entry for. English is then the only possible
  //                            output, so it is a content gap, not a code bug — but a tracked one.
  const served: string[] = JSON.parse(read('test/fixtures/servedLabelKeys.json'));
  const allow: string[] = JSON.parse(read('test/fixtures/unservedLabelKeys.json'));
  const known = new Set([...served, ...allow]);
  const strays: string[] = [];
  for (const f of walk('src/ui')) {
    for (const m of read(f).matchAll(/label\(\s*'([a-zA-Z0-9_.]+)'/g)) {
      if (!known.has(m[1])) strays.push(`${m[1]} (${f})`);
    }
  }
  assert.deepEqual(
    strays,
    [],
    'In neither fixture. If the backend serves the string, use its fc_v2_app_label_* key; if it\n' +
      'genuinely does not, add the key to test/fixtures/unservedLabelKeys.json so the gap is\n' +
      `tracked:\n  ${strays.join('\n  ')}`
  );
});

test('the unserved allowlist has not silently grown', () => {
  // A ratchet, not a ceiling: lowering it as keys get mapped is the point. Raising it means a new
  // invented key was accepted.
  const allow: string[] = JSON.parse(read('test/fixtures/unservedLabelKeys.json'));
  assert.ok(allow.length <= 36, `allowlist grew to ${allow.length} (was 36)`);
});
