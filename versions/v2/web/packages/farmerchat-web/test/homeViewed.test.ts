/**
 * #25 PATCH api/images/v2/viewed/ (app HomeScreen.kt:2090-2094, ApiServices.kt:247).
 *
 *     node --import ./test/ts-extension-hook.mjs test/homeViewed.test.ts
 */
import { imageViewedRequest, marksImageViewed } from '../src/core/homeViewed.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}
    expected: ${b}
    actual:   ${a}`);
}
check('an unviewed image card is marked', marksImageViewed({ type: 'image', statement_id: 38, is_viewed: false }), true);
check('is_viewed null counts as unviewed', marksImageViewed({ type: 'image', statement_id: 38, is_viewed: null }), true);
check('an already-viewed image card is not', marksImageViewed({ type: 'image', statement_id: 38, is_viewed: true }), false);
// The web used to PATCH text cards too; DEMO answers 404 for those statements.
check('a statement card is never marked', marksImageViewed({ type: 'statement', statement_id: '1c98b1e3-ae27-4e22-af7f-360815e95396' }), false);
check('a text card is never marked', marksImageViewed({ type: 'text', statement_id: 39, is_viewed: false }), false);
check('no statement id → nothing', marksImageViewed({ type: 'image', statement_id: null }), false);
check('statement_id 0 is a real id', marksImageViewed({ type: 'image', statement_id: 0 }), true);
// Body exactly as the app's Gson writes ImageViewedRequest(statement_id: String, user_id, status).
check('body (numeric id)', imageViewedRequest(38, 'u-1'), { statement_id: '38', user_id: 'u-1', status: 'viewed' });
// The real DEMO daily feed id (2026-10-17): a UUID, sent unchanged → 200.
check('body (DEMO uuid)', imageViewedRequest('cd490910-047c-49df-b12f-d7ffd9398aab', 'u-1'), { statement_id: 'cd490910-047c-49df-b12f-d7ffd9398aab', user_id: 'u-1', status: 'viewed' });
if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} homeViewed test(s) failed`);
}
console.log(`homeViewed: ${passed} assertions passed`);
