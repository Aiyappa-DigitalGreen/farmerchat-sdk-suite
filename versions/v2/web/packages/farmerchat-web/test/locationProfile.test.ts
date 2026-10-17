/**
 * #7 update_user_location → stored place (app LocationPromptHost.kt:524-543).
 *
 *     node --import ./test/ts-extension-hook.mjs test/locationProfile.test.ts
 */
import { locationPrefsFromResponse } from '../src/core/locationProfile.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

// The real DEMO response for Sioux Falls (2026-10-16), trimmed.
const sd = { user_profile: { id: 'x', lat: '43.5446', long: '-96.7311', country: 176, country_name: 'United States', country_code: 'US', geography_level2: 'South Dakota', geography_level2_name: 'South Dakota', geography_level3: 'Minnehaha County' } };
check('Sioux Falls → district place', locationPrefsFromResponse(sd), { countryName: 'United States', countryCode: 'US', state: 'South Dakota', district: 'Minnehaha County', place: 'Minnehaha County' });
check('no district → state', locationPrefsFromResponse({ user_profile: { country_name: 'India', geography_level2_name: 'Karnataka' } })?.place, 'Karnataka');
check('only country', locationPrefsFromResponse({ user_profile: { country_name: 'Kenya' } })?.place, 'Kenya');
check('blank fields are empty', locationPrefsFromResponse({ user_profile: { country_name: '  ' } }), { countryName: '', countryCode: '', state: '', district: '', place: '' });
check('no user_profile → null', locationPrefsFromResponse({ error_message: 'x' }), null);
check('old top-level shape is not read (the app never sends it)', locationPrefsFromResponse({ country: 'India', state: 'Karnataka' } as never), null);
check('null response', locationPrefsFromResponse(null), null);

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} locationProfile test(s) failed`);
}
console.log(`locationProfile: ${passed} assertions passed`);
