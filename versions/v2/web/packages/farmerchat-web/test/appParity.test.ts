/**
 * Pins the app-parity fixes made to the web UI.
 *
 * Web has never had pixel verification against the app — it cannot, the app is Android. What it
 * CAN be guarded against is the specific class of defect that was found and fixed here: a wrong
 * label key, a raw literal where a served label belongs, and an autofocus the app does not do.
 *
 * These assert on the SOURCE rather than on rendered output, deliberately: there is no DOM
 * harness in this package and none was added, and every defect fixed was a source value.
 *
 * RUNNER: none (see test/agentic.test.ts):
 *
 *     node --import ./test/ts-extension-hook.mjs test/appParity.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('the phone field uses the literal digit mask, not the heading label', () => {
  const src = read('src/ui/screens/AuthScreen.tsx');
  assert.ok(
    src.includes('placeholder="00000 00000"'),
    'App parity: the phone placeholder is the literal digit mask.'
  );
  assert.ok(
    !src.includes("label('auth_phone_placeholder'"),
    "`auth_phone_placeholder` was never a served key — it rendered English in every language, " +
      'and was the same label-key misuse found on compose, iOS, RN and views.'
  );
});

test('the phone field does not autofocus', () => {
  const src = read('src/ui/screens/AuthScreen.tsx');
  // The app auto-focuses only its OTP input (OtpInput.kt:43), never the phone field — otherwise
  // the keyboard covers the agreement card and both send buttons.
  const phoneBlock = src.slice(
    src.indexOf('placeholder="00000 00000"') - 400,
    src.indexOf('placeholder="00000 00000"') + 400
  );
  assert.ok(
    !/\bautoFocus\b/.test(phoneBlock),
    'App parity: the phone field must not take focus on entry.'
  );
});

test('the OTP input self-focuses on mount', () => {
  const src = read('src/ui/components/common.tsx');
  const otp = src.slice(src.indexOf('export function OtpInput'));
  assert.ok(
    otp.includes('refs.current[0]?.focus()'),
    "App parity (OtpInput.kt:46-52): the OTP input is the ONE field the app focuses. Web was the " +
      'only platform where removing the phone autofocus left no focused field at all.'
  );
});

test('the composer placeholder uses a served label key', () => {
  const src = read('src/ui/components/inputs.tsx');
  assert.ok(
    src.includes("label('fc_v2_app_label_ask_about_your_farm'"),
    'Must use the served key.'
  );
  assert.ok(
    !src.includes("label('input_type_placeholder'"),
    '`input_type_placeholder` exists in no catalogue — it could never resolve.'
  );
});

test('every label key is prefixed or explicitly allowlisted', () => {
  // Backstop for labelKeys.test.ts: every key endpoint #3 serves is `fc_v2_*` prefixed (287 on
  // DEV, zero short keys), so an unprefixed key is unresolvable by construction.
  const served: string[] = JSON.parse(read('test/fixtures/servedLabelKeys.json'));
  const allow: string[] = JSON.parse(read('test/fixtures/unservedLabelKeys.json'));
  const known = new Set([...served, ...allow]);
  const src = read('src/ui/screens/AuthScreen.tsx') + read('src/ui/components/inputs.tsx');
  const strays: string[] = [];
  for (const m of src.matchAll(/label\(\s*'([a-zA-Z0-9_.]+)'/g)) {
    if (!known.has(m[1])) strays.push(m[1]);
  }
  assert.deepEqual(strays, [], `unknown label keys: ${strays.join(', ')}`);
});
