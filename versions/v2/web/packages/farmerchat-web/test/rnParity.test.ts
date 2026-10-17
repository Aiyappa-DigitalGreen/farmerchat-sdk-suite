/**
 * Items the React Native full pass found (2026-10-17), checked on web:
 * #4 privacy-policy fields, drawer analytics props, the agentic idle read timeout.
 *
 *     node --import ./test/ts-extension-hook.mjs test/rnParity.test.ts
 */
import { legalLinksFromPrivacyPolicy } from '../src/core/types.ts';
import { chatHistoryFromMenuProps, drawerQuestionClickProps, menuOptionProps } from '../src/core/drawerAnalytics.ts';
import { AGENTIC_STREAM_IDLE_TIMEOUT_MS, readAgenticStream } from '../src/core/agenticStream.ts';
import type { AgenticEvent } from '../src/core/agentic.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

// #4 — app PrivacyPolicyResponse: url / leaderboard_privacy_policy_url / farmerchat_terms_of_use /
// leaderboard_terms_of_use. Privacy = url, terms = farmerchat_terms_of_use.
const body = JSON.parse('{"url": "https://farmer.chat/privacy", "leaderboard_privacy_policy_url": "https://x/lb-privacy", "farmerchat_terms_of_use": "https://farmer.chat/terms", "leaderboard_terms_of_use": "https://x/lb-terms"}');
check('privacy + terms from the app fields', legalLinksFromPrivacyPolicy(body), { privacyPolicyUrl: 'https://farmer.chat/privacy', termsOfUseUrl: 'https://farmer.chat/terms' });
check('blank → null', legalLinksFromPrivacyPolicy({ url: '  ', farmerchat_terms_of_use: '' }), { privacyPolicyUrl: null, termsOfUseUrl: null });
check('the guessed names are not read', legalLinksFromPrivacyPolicy({ privacy_policy_url: 'x', terms_of_use: 'y' } as never), { privacyPolicyUrl: null, termsOfUseUrl: null });

// Drawer — DrawerContent.kt.
check('menu option', menuOptionProps('Help_Support'), { option: 'Help_Support' });
check('Recent chats / See all', chatHistoryFromMenuProps(), { screen_name: 'Menu' });
check('a recent question', drawerQuestionClickProps('c-1', 3), { screen_name: 'Side Menu', conversation_id: 'c-1', question_index: '3' });
check('a question without an id', drawerQuestionClickProps(null, 0), { screen_name: 'Side Menu', conversation_id: '', question_index: '0' });

// Agentic idle read timeout (app readTimeout 60 s).
check('timeout is the app value', AGENTIC_STREAM_IDLE_TIMEOUT_MS, 60_000);
async function collect(response: Response, idleMs: number): Promise<AgenticEvent[]> {
  const out: AgenticEvent[] = [];
  for await (const e of readAgenticStream(response, undefined, idleMs)) out.push(e);
  return out;
}
const enc = new TextEncoder();
// One event, then silence (never closed) — the DEMO stall that hung RN for 17 minutes.
const stalled = new ReadableStream<Uint8Array>({
  start(c) {
    c.enqueue(enc.encode('event: status\ndata: {"stage": "thinking"}\n\n'));
  },
});
const t0 = Date.now();
const stalledEvents = await collect(new Response(stalled, { status: 200 }), 80);
check('a silent stream fails as NETWORK', stalledEvents.map((e) => (e.type === 'failure' ? `${e.type}:${e.kind}:${e.message}` : e.type)), ['failure:NETWORK:Stream timed out']);
check('…after the idle window, not never', Date.now() - t0 < 2000, true);
// A slow but steady stream (gaps shorter than the window) is not cut.
const steady = new ReadableStream<Uint8Array>({
  async start(c) {
    for (const piece of ['event: text_delta\ndata: {"delta": "a"}\n\n', 'event: text_delta\ndata: {"delta": "b"}\n\n']) {
      await new Promise((r) => setTimeout(r, 40));
      c.enqueue(enc.encode(piece));
    }
    c.close();
  },
});
const steadyEvents = await collect(new Response(steady, { status: 200 }), 120);
check('gaps under the window keep streaming', steadyEvents.map((e) => e.type), ['text_delta', 'text_delta']);

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} rnParity test(s) failed`);
}
console.log(`rnParity: ${passed} assertions passed`);
