/**
 * update_user_location sends lat/long as STRINGS, as the app does
 * (`UpdateLocationRequest(lat: String?, long: String?)`) and as the Android SDK does.
 *
 *     node --import ./test/ts-extension-hook.mjs test/locationWire.test.ts
 */
import { toLocationWire } from '../src/core/locationWire.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

check('numbers become strings', toLocationWire({ lat: 12.9716, long: 77.5946, user_id: 'u' }),
  { lat: '12.9716', long: '77.5946', user_id: 'u' });
check('null stays null', toLocationWire({ lat: null, long: null, user_id: 'u' }),
  { lat: null, long: null, user_id: 'u' });
check('absent stays absent', JSON.parse(JSON.stringify(toLocationWire({ user_id: 'u', country: 'IN' }))),
  { user_id: 'u', country: 'IN' });
check('negative', toLocationWire({ lat: -1.2921, long: -36.8219, user_id: 'u' }).lat, '-1.2921');

if (failures.length) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`locationWire: ${passed} assertions passed`);
