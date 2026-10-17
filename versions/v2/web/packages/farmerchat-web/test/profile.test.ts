/**
 * #9 view_user_profile name (app UserProfile.displayName, ui/profile/data/model/view/UserProfile.kt:44-52).
 *
 *     node --import ./test/ts-extension-hook.mjs test/profile.test.ts
 */
import { profileDisplayName } from '../src/core/profile.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}
// The real DEMO view_user_profile body after saving "Ravi" (2026-10-17), trimmed: snake_case `user_profile`.
const body = JSON.parse('{"user_profile": {"user_id": "u", "first_name": "Ravi", "last_name": null, "country_name": "India"}}');
check('reads user_profile.first_name', profileDisplayName(body.user_profile), 'Ravi');
check('first + last', profileDisplayName({ first_name: 'Ravi', last_name: 'Kumar' }), 'Ravi Kumar');
check('"No Name" placeholder is blank', profileDisplayName({ first_name: 'No Name', last_name: 'null' }), '');
check('null profile', profileDisplayName(null), '');
check('the camelCase key never arrives', (body as Record<string, unknown>).userProfile, undefined);
if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} profile test(s) failed`);
}
console.log(`profile: ${passed} assertions passed`);
