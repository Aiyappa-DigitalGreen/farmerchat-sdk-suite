/**
 * Farmer illustrations (app rememberCountryFarmerPainter / CountryImageAssets): country folder and
 * the offline-safe prefetch.
 *
 *     node --import ./test/ts-extension-hook.mjs test/illustrations.test.ts
 */
import { farmerCountry, illustrationSrc, prefetchFarmerIllustrations } from '../src/core/illustrations.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}
check('India', farmerCountry('IN'), 'in');
check('Ethiopia', farmerCountry('et'), 'et');
check('unbundled country → ke', farmerCountry('US'), 'ke');
check('unknown → ke', farmerCountry(null), 'ke');

const base = 'https://x.test/illustrations/';
const fetched: string[] = [];
const okFetch = (async (u: string) => {
  fetched.push(u);
  return new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }));
}) as unknown as typeof fetch;
prefetchFarmerIllustrations(base, 'IN', okFetch);
prefetchFarmerIllustrations(base, 'IN', okFetch); // second call: nothing fetched twice
await new Promise((r) => setTimeout(r, 20));
check('the four country images, once each', fetched, [
  `${base}in/farmer_looking_at_camera.webp`,
  `${base}in/farmer_looking_at_sky.webp`,
  `${base}in/farmer_looking_at_phone.webp`,
  `${base}in/farmer_looking_at_phone_square.webp`,
]);
check('offline-safe copy is used', illustrationSrc(`${base}in/farmer_looking_at_sky.webp`).startsWith('blob:'), true);
check('never-fetched image → its URL', illustrationSrc(`${base}ke/farmer_looking_at_sky.webp`), `${base}ke/farmer_looking_at_sky.webp`);

const badFetch = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
prefetchFarmerIllustrations(base, 'NG', badFetch);
await new Promise((r) => setTimeout(r, 20));
check('failed download → plain URL (retried later)', illustrationSrc(`${base}ng/farmer_looking_at_sky.webp`), `${base}ng/farmer_looking_at_sky.webp`);
prefetchFarmerIllustrations(undefined, 'IN', okFetch);
check('no asset base → nothing', fetched.length, 4);

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} illustrations test(s) failed`);
}
console.log(`illustrations: ${passed} assertions passed`);
