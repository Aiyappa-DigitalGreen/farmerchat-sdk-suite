/**
 * Guards the device-locale location fallback — the web port of the Android SDK's
 * `core/location/CountryLatLngProviderTest.kt` (same five cases), plus the three
 * `regionFromLocaleTag` cases that only exist on web.
 *
 * Background: this SDK used to hardcode Bengaluru (12.9716, 77.5946) as the fallback location,
 * with an invented `'IN'` country and `'Karnataka'` state, so every guest the backend could not
 * place — anywhere on earth — was seeded with Karnataka and got Karnataka's advice. The app never
 * did that: it derives the country from the device locale (`utils/CountryLatLngProvider.kt`) and
 * uses that country's centroid, accepting it only when both parts are non-zero.
 *
 * The centroid table is generated verbatim from the app source; a wrong entry fails silently, so
 * the count and a few spot values are pinned here.
 *
 * RUNNER: none. This package has no test framework (devDependencies: typescript, vite, React
 * types) and adding one was out of scope, so this runs on Node's native TypeScript support with
 * a hand-rolled `check`, matching the 2.0.0 tree's tests:
 *
 *     npm test    # or: node --import ./test/ts-extension-hook.mjs test/countryLatLng.test.ts
 *
 * It imports nothing but the modules under test — no node: builtins — so `tsconfig.test.json`
 * typechecks it with the package's own `types: []` setting.
 */

import {
  COUNTRY_LAT_LNG,
  fromDeviceLocale,
  getLatLng,
  isResolved,
  regionFromLocaleTag,
} from '../src/core/countryLatLng.ts';
import { resolveCountryCode, resolveFallbackCoordinates } from '../src/core/fallbackLocation.ts';
import { COORDINATE_UNSET, DEFAULT_COUNTRY_CODE, DEFAULT_LATITUDE, DEFAULT_LONGITUDE, DEFAULT_STATE_CODE, LAST_RESORT_COUNTRY_CODE } from '../src/core/config.ts';

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

/** The coordinates that must never come back from anything again. */
const BENGALURU: [number, number] = [12.9716, 77.5946];

// ---------------------------------------------------------------------------
// 1. A known country returns its exact centroid (Android: same three spot values)
// ---------------------------------------------------------------------------

check('KE centroid', getLatLng('KE'), [-0.023559, 37.906193]);
check('IN centroid', getLatLng('IN'), [20.593684, 78.96288]);
check('NG centroid', getLatLng('NG'), [9.081999, 8.675277]);

// ---------------------------------------------------------------------------
// 2. An unknown or blank country returns zero, not a guess — THE critical one
// ---------------------------------------------------------------------------

check('unknown country ZZ -> [0, 0]', getLatLng('ZZ'), [0, 0]);
check('blank country -> [0, 0]', getLatLng(''), [0, 0]);
check('lowercase is not matched, as in the app', getLatLng('in'), [0, 0]);

// ---------------------------------------------------------------------------
// 3. Zero coordinates are never treated as resolved
// (0,0) is a real point in the Gulf of Guinea, so sending it is a wrong answer, not a missing one
// ---------------------------------------------------------------------------

check('isResolved(0, 0)', isResolved(0, 0), false);
check('isResolved(0, 37.9)', isResolved(0, 37.9), false);
check('isResolved(-0.02, 0)', isResolved(-0.02, 0), false);
check('isResolved(KE centroid)', isResolved(-0.023559, 37.906193), true);

// ---------------------------------------------------------------------------
// 4. Bengaluru is not the fallback for anything
// ---------------------------------------------------------------------------

{
  const hits = ['IN', 'KE', 'ZZ', '', 'US', 'NG'].map((code) => getLatLng(code));
  check(
    'no country centroid is the old hardcoded default',
    hits.some((hit) => hit[0] === BENGALURU[0] && hit[1] === BENGALURU[1]),
    false,
  );
  check(
    'no table entry anywhere is the old hardcoded default',
    Object.values(COUNTRY_LAT_LNG).some((v) => v[0] === BENGALURU[0] && v[1] === BENGALURU[1]),
    false,
  );
}

// ---------------------------------------------------------------------------
// 5. The table matches the app's entry count (drift = hand-edited instead of regenerated)
// ---------------------------------------------------------------------------

check('247 entries, as in the app', Object.keys(COUNTRY_LAT_LNG).length, 247);

// ---------------------------------------------------------------------------
// 6. regionFromLocaleTag — web-only: a browser language may carry NO region
// ---------------------------------------------------------------------------

check('en-IN -> IN', regionFromLocaleTag('en-IN'), 'IN');
check('en-Latn-IN -> IN', regionFromLocaleTag('en-Latn-IN'), 'IN');
check('en -> "" (a language alone is NOT a country)', regionFromLocaleTag('en'), '');
check('en_IN underscore form -> IN', regionFromLocaleTag('en_IN'), 'IN');
check('sw-KE -> KE', regionFromLocaleTag('sw-KE'), 'KE');
check('lowercase region is upper-cased', regionFromLocaleTag('en-in'), 'IN');
check('null -> ""', regionFromLocaleTag(null), '');
check('undefined -> ""', regionFromLocaleTag(undefined), '');
check('empty -> ""', regionFromLocaleTag(''), '');
// The send-nothing branch: a plain `en` browser carries no region, so no coordinates exist.
check('a region-less tag yields no coordinates', getLatLng(regionFromLocaleTag('en')), [0, 0]);
check('...and those are not resolved', isResolved(...getLatLng(regionFromLocaleTag('en'))), false);

// ---------------------------------------------------------------------------
// 7. The config sentinels mean "derive", not a place
// ---------------------------------------------------------------------------

check('no default country is invented', DEFAULT_COUNTRY_CODE, '');
check('no default state is invented', DEFAULT_STATE_CODE, '');
check('coordinates default to the unset sentinel', [DEFAULT_LATITUDE, DEFAULT_LONGITUDE], [COORDINATE_UNSET, COORDINATE_UNSET]);
check('the unset sentinel is never resolved', isResolved(DEFAULT_LATITUDE, DEFAULT_LONGITUDE), false);
check('the last resort is the app’s own literal', LAST_RESORT_COUNTRY_CODE, 'KE');

// ---------------------------------------------------------------------------
// 8. resolveFallbackCoordinates — host override wins, otherwise the device locale
// ---------------------------------------------------------------------------

check(
  'an explicit host location wins',
  resolveFallbackCoordinates({ defaultCountryCode: 'NG', defaultLatitude: 9.081999, defaultLongitude: 8.675277 }),
  { countryCode: 'NG', lat: 9.081999, lng: 8.675277 },
);
{
  // Unset config falls through to the device locale, whose region depends on the machine running
  // the test — so assert the invariant instead of a value: either it resolved to a real centroid,
  // or it is exactly (0, 0) and must be treated as "no location".
  const derived = resolveFallbackCoordinates({
    defaultCountryCode: DEFAULT_COUNTRY_CODE,
    defaultLatitude: DEFAULT_LATITUDE,
    defaultLongitude: DEFAULT_LONGITUDE,
  });
  const locale = fromDeviceLocale();
  check('unset config derives from the device locale', derived, {
    countryCode: locale.countryCode,
    lat: locale.lat,
    lng: locale.lng,
  });
  check(
    'a derived location is either a real centroid or exactly (0, 0)',
    isResolved(derived.lat, derived.lng) || (derived.lat === 0 && derived.lng === 0),
    true,
  );
  check(
    'nothing derives Bengaluru',
    derived.lat === BENGALURU[0] && derived.lng === BENGALURU[1],
    false,
  );
}

// ---------------------------------------------------------------------------
// 9. resolveCountryCode — server -> persisted -> host config -> locale -> 'KE'
// ---------------------------------------------------------------------------

check('the server value wins', resolveCountryCode('NG', 'IN', 'US'), 'NG');
check('a blank server value falls through to the store', resolveCountryCode('  ', 'IN', 'US'), 'IN');
check('null server + null store falls through to the host config', resolveCountryCode(null, null, 'US'), 'US');
check('a blank host config is skipped, not sent', resolveCountryCode(null, null, '   ') !== '', true);
{
  // With nothing configured the answer comes from the locale, else the last resort — but it is
  // NEVER blank: endpoint #2 rejects a blank country_code with HTTP 400.
  const derived = resolveCountryCode(null, null, DEFAULT_COUNTRY_CODE);
  check('the chain never yields a blank country_code', /^[A-Z]{2}$/.test(derived), true);
}

// ---------------------------------------------------------------------------
// 10. The region-less browser, pinned deterministically
//
// A plain `en` browser language carries NO region. On the machine running this test `Intl` almost
// certainly DOES resolve one (`en-US` → `US`), so the locale is injected rather than observed —
// otherwise these two, the only assertions that exercise the `'KE'` floor and the send-nothing
// branch end-to-end, would pass vacuously.
// ---------------------------------------------------------------------------

const NO_REGION = { countryCode: '', lat: 0, lng: 0 };
const UNSET_CONFIG = {
  defaultCountryCode: DEFAULT_COUNTRY_CODE,
  defaultLatitude: DEFAULT_LATITUDE,
  defaultLongitude: DEFAULT_LONGITUDE,
};

check(
  'a region-less browser lands on the last resort, never blank',
  resolveCountryCode(null, null, DEFAULT_COUNTRY_CODE, ''),
  LAST_RESORT_COUNTRY_CODE,
);
check(
  'a region-less browser resolves NO coordinates (the send-nothing branch)',
  resolveFallbackCoordinates(UNSET_CONFIG, NO_REGION),
  NO_REGION,
);
check(
  '...and the seed path must therefore skip #11',
  isResolved(
    resolveFallbackCoordinates(UNSET_CONFIG, NO_REGION).lat,
    resolveFallbackCoordinates(UNSET_CONFIG, NO_REGION).lng,
  ),
  false,
);
check(
  'a region-less browser with a host config still uses the host config',
  resolveCountryCode(null, null, 'NG', ''),
  'NG',
);
check(
  'a regioned browser is preferred over the last resort',
  resolveCountryCode(null, null, DEFAULT_COUNTRY_CODE, 'IN'),
  'IN',
);
check(
  'a regioned browser yields that country centroid',
  resolveFallbackCoordinates(UNSET_CONFIG, { countryCode: 'IN', ...{ lat: getLatLng('IN')[0], lng: getLatLng('IN')[1] } }),
  { countryCode: 'IN', lat: 20.593684, lng: 78.96288 },
);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} countryLatLng test(s) failed`);
}
console.log(`countryLatLng: ${passed} assertions passed`);
