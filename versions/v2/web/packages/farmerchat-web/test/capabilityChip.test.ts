/**
 * Guards the capability-chip routing rule and the exact wire strings behind it.
 * Mirror of android `farmerchat-core/src/test/.../model/CapabilityChipTest.kt`.
 *
 * Background: every alignment chip used to send its own text as the question, so the two
 * CAPABILITY surfaces did nothing — `gps-prompt` never started the location flow and
 * `upload-photo` never opened a picker. A capability chip must invoke a capability and send only
 * the OUTCOME; every other chip still sends text.
 *
 * The constants are asserted literally because they are easy to "helpfully" normalize and a
 * mismatch fails silently — the chip would fall through to the text path and the farmer would
 * send the string "share_precise_location" as their question.
 *
 * `capabilityChipRoute` is the SAME function `ChatScreen.tsx` switches on, not a copy of its
 * table: a re-implemented screen would pass this file while the UI diverged.
 *
 * RUNNER: none (see test/agentic.test.ts).
 *
 *     node --import ./test/ts-extension-hook.mjs test/capabilityChip.test.ts
 */

import {
  CapabilityChip,
  capabilityChipRoute,
  isAdditiveAlignment,
  type AlignmentKind,
  type CapabilityChipInput,
  type CapabilityChipRoute,
} from '../src/core/alignment.ts';

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

/** A chip carrying the capability `action`. */
const invoke = (value: string) => ({ label: 'l', value, action: CapabilityChip.ACTION_SELECT });

/** `label` is carried on the literals purely to mirror the Kotlin test's `AlignmentChip(label=…)`. */
const route = (
  kind: AlignmentKind | null,
  chip: CapabilityChipInput & { label?: string | null },
): CapabilityChipRoute => capabilityChipRoute(kind, chip);

// --- the literal wire strings -----------------------------------------------------------------
// ACTION_SELECT is "invoke", NOT "select"; and the location value is the *precise* one — the app
// has a `share_location` constant commented out directly above it.
check('ACTION_SELECT is "invoke"', CapabilityChip.ACTION_SELECT, 'invoke');
check('VALUE_SHARE_LOCATION is "share_precise_location"', CapabilityChip.VALUE_SHARE_LOCATION, 'share_precise_location');
check('VALUE_TAKE_PHOTO is "take_photo"', CapabilityChip.VALUE_TAKE_PHOTO, 'take_photo');
check('VALUE_CHOOSE_FROM_GALLERY is "choose_from_gallery"', CapabilityChip.VALUE_CHOOSE_FROM_GALLERY, 'choose_from_gallery');
check('VALUE_NOT_NOW is "not_now"', CapabilityChip.VALUE_NOT_NOW, 'not_now');

// --- capability chips invoke their capability --------------------------------------------------

check('gps-prompt share_precise_location → LOCATION', route('GPS_PROMPT', invoke('share_precise_location')), 'LOCATION');
check('upload-photo take_photo → CAMERA', route('UPLOAD_PHOTO', invoke('take_photo')), 'CAMERA');
check('upload-photo choose_from_gallery → GALLERY', route('UPLOAD_PHOTO', invoke('choose_from_gallery')), 'GALLERY');

// --- a decline chip sends text, it does not invoke anything ------------------------------------
// "Not now" on a capability prompt is an ordinary answer to the blocking question.
check('not_now under gps-prompt → TEXT', route('GPS_PROMPT', invoke('not_now')), 'TEXT');
check('not_now under upload-photo → TEXT', route('UPLOAD_PHOTO', invoke('not_now')), 'TEXT');

// --- action must be `invoke` for a capability chip to fire -------------------------------------
// A chip carrying the same value but no `invoke` action is a plain text chip.
check(
  'share_precise_location with no action → TEXT',
  route('GPS_PROMPT', { label: 'l', value: 'share_precise_location', action: null }),
  'TEXT',
);
check(
  'share_precise_location with action "select" → TEXT (the string really is "invoke")',
  route('GPS_PROMPT', { label: 'l', value: 'share_precise_location', action: 'select' }),
  'TEXT',
);
check('take_photo with no action → TEXT', route('UPLOAD_PHOTO', { value: 'take_photo' }), 'TEXT');

// --- the value must match its own kind ---------------------------------------------------------
// take_photo under gps-prompt, or share_location under upload-photo, is not a capability.
check('take_photo under gps-prompt → TEXT', route('GPS_PROMPT', invoke('take_photo')), 'TEXT');
check('share_precise_location under upload-photo → TEXT', route('UPLOAD_PHOTO', invoke('share_precise_location')), 'TEXT');
check('choose_from_gallery under gps-prompt → TEXT', route('GPS_PROMPT', invoke('choose_from_gallery')), 'TEXT');

// --- non-capability surfaces always send text --------------------------------------------------

for (const kind of ['CLARIFY', 'CONFIRM', 'ESCALATE', 'GENDER_SELECT', 'COMMODITY_CONFIRM'] as AlignmentKind[]) {
  check(`${kind} + share_precise_location → TEXT`, route(kind, invoke('share_precise_location')), 'TEXT');
  check(`${kind} + take_photo → TEXT`, route(kind, invoke('take_photo')), 'TEXT');
}
check('no kind at all → TEXT', route(null, invoke('take_photo')), 'TEXT');
check('undefined kind → TEXT', capabilityChipRoute(undefined, invoke('share_precise_location')), 'TEXT');

// --- an unknown / empty chip is never a capability ---------------------------------------------

check('an empty chip → TEXT', route('GPS_PROMPT', {}), 'TEXT');
check('an unknown invoke value → TEXT', route('GPS_PROMPT', invoke('do_a_barrel_roll')), 'TEXT');
// Values travel verbatim: a trimmed/cased variant is a different string and must NOT match.
check('a padded value → TEXT (values are compared verbatim)', route('GPS_PROMPT', invoke(' share_precise_location ')), 'TEXT');
check('an upper-cased value → TEXT', route('UPLOAD_PHOTO', invoke('TAKE_PHOTO')), 'TEXT');

// --- only the two capability kinds are non-additive prompts that invoke ------------------------
// Sanity-check the additive split the surfaces depend on.
check('gps-prompt is exclusive', isAdditiveAlignment('GPS_PROMPT'), false);
check('upload-photo is exclusive', isAdditiveAlignment('UPLOAD_PHOTO'), false);
check('gender-select is additive', isAdditiveAlignment('GENDER_SELECT'), true);
check('commodity-confirm is additive', isAdditiveAlignment('COMMODITY_CONFIRM'), true);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} capabilityChip test(s) failed`);
}
console.log(`capabilityChip: ${passed} assertions passed`);
