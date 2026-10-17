/**
 * Web scenario-pass parity (2026-10-17): profile name, update_user_location place, and the
 * language-save navigation timer.
 *
 *     node --import ./test/ts-extension-hook.mjs test/profile.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { locationPrefsFromResponse, profileDisplayName } from '../src/core/profile.ts';

const read = (p: string) => readFileSync(p, 'utf8');

test('display name follows UserProfile.displayName()', () => {
  assert.equal(profileDisplayName({ first_name: ' Asha ', last_name: 'Rao' }), 'Asha Rao');
  assert.equal(profileDisplayName({ first_name: 'Asha', last_name: null }), 'Asha');
  assert.equal(profileDisplayName({ first_name: 'No Name', last_name: 'Rao' }), 'Rao');
  assert.equal(profileDisplayName({ first_name: 'NULL', last_name: 'no name' }), '');
  assert.equal(profileDisplayName(null), '');
});

test('profile fetches read the wire key user_profile', () => {
  for (const f of ['src/state/useHome.ts', 'src/state/useEnterName.ts']) {
    const src = read(f);
    assert.ok(src.includes('profileDisplayName(result.data.user_profile)'), f);
    assert.ok(!src.includes('.userProfile'), f);
  }
  assert.ok(/export interface FarmerProfile \{\s*user_profile\?:/.test(read('src/core/types.ts')));
});

test('update_user_location place comes from user_profile', () => {
  // DEMO shape (LocationPromptHost.kt:524-543 reads the same fields).
  const p = locationPrefsFromResponse({
    user_profile: {
      country_name: 'India',
      country_code: 'IN',
      geography_level2_name: 'Karnataka',
      geography_level3: 'Bengaluru Urban',
    },
  });
  assert.deepEqual(p, {
    countryName: 'India',
    countryCode: 'IN',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    place: 'Bengaluru Urban',
  });
  assert.equal(
    locationPrefsFromResponse({ user_profile: { country_name: 'Kenya', geography_level2_name: '' } })?.place,
    'Kenya',
  );
  assert.equal(locationPrefsFromResponse({}), null);
  assert.equal(locationPrefsFromResponse(null), null);
  const src = read('src/state/useLocationPrompt.ts');
  assert.ok(src.includes('const place = locationPrefsFromResponse(result.data);'));
  assert.ok(!src.includes('result.data.country'));
});

test('language save consumes the result inside the 500 ms timer', () => {
  const src = read('src/ui/screens/LanguageChooserScreen.tsx');
  assert.ok(
    /setTimeout\(\(\) => \{\s*settings\.consumeLanguageResult\(\);\s*props\.onLanguageSaved\(\);\s*\}, 500\)/.test(src),
  );
});
