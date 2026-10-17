/**
 * Chat guards ported from Android commit a689450: SynthesisGuard (a late #31 reply is dropped)
 * and the onMessageSent rule (once per send, never on retry).
 *
 *     node --import ./test/ts-extension-hook.mjs test/chatGuards.test.ts
 */
import { firesMessageSent, imageSendMessages, latestAiMessageId, synthesisStillWanted } from '../src/core/chatGuards.ts';

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
const answer1 = { kind: 'ai', messageId: 'm1' };
const answer2 = { kind: 'ai', messageId: 'm2' };
const user = { kind: 'user' };
const loadingRow = { kind: 'loading' };

check('newest AI id', latestAiMessageId({ isLoading: false, messages: [answer1, user, answer2, user] }), 'm2');
check('no answer yet', latestAiMessageId({ isLoading: false, messages: [user] }), undefined);

// Listen on answer 1, nothing else happened → play.
check('still the newest answer → play', synthesisStillWanted('m1', { isLoading: false, messages: [user, answer1] }), true);
// Listen on answer 1, then a follow-up was sent: the reply lands while answer 2 loads → drop.
check('a newer send is loading → drop', synthesisStillWanted('m1', { isLoading: true, messages: [user, answer1, user, loadingRow] }), false);
// … or after answer 2 arrived → drop (the DEMO case: #31 took 5.1 s, the chip was tapped at 3.9 s).
check('a newer answer arrived → drop', synthesisStillWanted('m1', { isLoading: false, messages: [user, answer1, user, answer2] }), false);
// Listen on an OLDER answer while it is still the same thread state → play.
check('older answer, nothing new since the tap → play', synthesisStillWanted('m2', { isLoading: false, messages: [answer1, user, answer2] }), true);

check('a first send fires onMessageSent', firesMessageSent({}), true);
check('an explicit non-retry fires', firesMessageSent({ retry: false }), true);
check('a retry does not fire again', firesMessageSent({ retry: true }), false);
// Photo send vs its retry (app sendQuestionWithImage / retryLastRequest InputType.IMAGE).
const earlier = [{ kind: 'ai', id: 'a0' }];
const photo = { kind: 'user', id: 'u1', isFailed: false };
const load1 = { kind: 'loading', id: 'l1' };
const sent = imageSendMessages(earlier, photo, load1);
check('first send: bubble + loading row', sent.map((m) => m.id), ['a0', 'u1', 'l1']);
// The send failed: loading row gone, bubble flagged. Try again →
const failed = [{ kind: 'ai', id: 'a0' }, { kind: 'user', id: 'u1', isFailed: true }];
const retried = imageSendMessages(failed, { kind: 'user', id: 'u1', isFailed: false }, { kind: 'loading', id: 'l2' }, 'u1');
check('retry: no second photo bubble', retried.filter((m) => m.kind === 'user').length, 1);
check('retry: same bubble, then a new loading row', retried.map((m) => m.id), ['a0', 'u1', 'l2']);
check('retry: the bubble is no longer failed', retried[1].isFailed, false);

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} chatGuards test(s) failed`);
}
console.log(`chatGuards: ${passed} assertions passed`);
