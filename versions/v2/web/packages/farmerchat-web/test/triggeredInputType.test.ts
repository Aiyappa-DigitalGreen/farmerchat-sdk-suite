/**
 * Pins every chat send's `triggered_input_type` to the app's value
 * (fc-compose-agentic `ui/chat/ChatViewModel.kt:235-243, 993-997, 1391-1395`, `ChatScreen.kt:959-971, 1764-1811`).
 *
 *     node --import ./test/ts-extension-hook.mjs test/triggeredInputType.test.ts
 */

import { followUpTriggeredType, initialQueryTriggeredType } from '../src/core/triggeredInputType.ts';
import { ALIGN_CHIP_SEL } from '../src/core/alignment.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

// Composer / follow-up sends (ChatViewModel.kt:993-997).
check('typed composer question', followUpTriggeredType({}), 'text');
check('typed, explicitly not a follow-up', followUpTriggeredType({ isFollowupPrompt: false }), 'text');
check('tapped follow-up chip', followUpTriggeredType({ isFollowupPrompt: true }), 'follow_up');
check('transcribed voice', followUpTriggeredType({ transcriptionId: 't1' }), 'voice');
check('voice wins over follow-up', followUpTriggeredType({ transcriptionId: 't1', isFollowupPrompt: true }), 'voice');
check('never the old web value "card"', followUpTriggeredType({ isFollowupPrompt: true }) !== 'card', true);

// Opening question (ChatViewModel.kt:235-243 → 1391-1395).
check('host openChat(question)', initialQueryTriggeredType({}), 'text');
check('opened with a voice transcription', initialQueryTriggeredType({ transcriptionId: 't' }), 'voice');
check('weather CTA', initialQueryTriggeredType({ isWeatherAdviceCTA: true, isSSFR: true }), 'weather');
check('SSFR', initialQueryTriggeredType({ isSSFR: true, channel: 'x' }), 'ssfr');
check('channel', initialQueryTriggeredType({ channel: 'whatsapp', contentCardTriggerType: 'text_card' }), 'whatsapp');
check('blank channel falls through', initialQueryTriggeredType({ channel: ' ', contentCardTriggerType: 'image_card' }), 'image_card');
check('statement card', initialQueryTriggeredType({ contentCardTriggerType: 'text_card' }), 'text_card');

// Alignment sends.
check('alignment chip', ALIGN_CHIP_SEL, 'align_chip_sel');

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} triggeredInputType test(s) failed`);
}
console.log(`triggeredInputType: ${passed} assertions passed`);
