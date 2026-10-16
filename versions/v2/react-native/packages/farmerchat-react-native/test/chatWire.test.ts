/**
 * Round-2 chat fidelity (2026-10-16): alignment-chip wire params, history follow-up ids, and the
 * Listen pill's state timing + wave. The first two are pure functions (`src/core/chatWire.ts`);
 * the rest are source guards, as in appParity.test.ts (no renderer harness in this package).
 *
 *     node --import ./test/ts-extension-hook.mjs test/chatWire.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ALIGN_CHIP_SEL,
  alignmentChipRequestParams,
  historyFollowUpQuestions,
  sortHistoryItems,
} from '../src/core/chatWire.ts';

const read = (p: string) => readFileSync(p, 'utf8');

test('a clarify/confirm chip sends align_chip_sel with the surface server id', () => {
  // App ChatViewModel.kt:1019-1022 (parent = AiResponse.messageId) and :1051.
  assert.equal(ALIGN_CHIP_SEL, 'align_chip_sel');
  assert.deepEqual(alignmentChipRequestParams('CLARIFY', 'srv-1'), {
    triggeredInputType: 'align_chip_sel',
    parentMessageId: 'srv-1',
    locationDeclined: false,
    photoDeclined: false,
  });
  assert.equal(alignmentChipRequestParams('CONFIRM', 'srv-2').parentMessageId, 'srv-2');
});

test('a blank or missing surface id sends no parent_message_id', () => {
  assert.equal(alignmentChipRequestParams('CLARIFY', null).parentMessageId, null);
  assert.equal(alignmentChipRequestParams('CLARIFY', '  ').parentMessageId, null);
  assert.equal(alignmentChipRequestParams('CLARIFY', undefined).parentMessageId, null);
});

test('a GPS / photo surface text chip is the decline chip', () => {
  // App ChatScreen.kt:1654-1663: only the decline chip reaches the text path on these kinds.
  const gps = alignmentChipRequestParams('GPS_PROMPT', 'g');
  assert.equal(gps.locationDeclined, true);
  assert.equal(gps.photoDeclined, false);
  const photo = alignmentChipRequestParams('UPLOAD_PHOTO', 'p');
  assert.equal(photo.photoDeclined, true);
  assert.equal(photo.locationDeclined, false);
});

test('history follow-ups keep only the question text, like the app', () => {
  // App ChatViewModel.kt:1299 maps `.question` only; the ids DEMO sends are discarded.
  assert.deepEqual(
    historyFollowUpQuestions([
      { follow_up_question_id: 'a', sequence: 1, question: 'Q1' },
      { follow_up_question_id: 'b', sequence: 2, question: '' },
      'Q3',
      null,
    ]),
    ['Q1', 'Q3'],
  );
  assert.deepEqual(historyFollowUpQuestions(null), []);
});

test('history items render oldest-first by message_input_time, nulls last, ties stable', () => {
  // App ChatViewModel.kt:1255. DEMO 2026-10-16 returns turns newest-first, 1/3/7 sharing a time.
  const items = [
    { id: 'new-1', message_input_time: '2026-10-16T09:27:08.901923Z' },
    { id: 'new-3', message_input_time: '2026-10-16T09:27:08.901923Z' },
    { id: 'none', message_input_time: null },
    { id: 'new-7', message_input_time: '2026-10-16T09:27:08.901923Z' },
    { id: 'old-1', message_input_time: '2026-10-16T09:25:49.907865Z' },
    { id: 'old-3', message_input_time: '2026-10-16T09:25:49.907865Z' },
  ];
  assert.deepEqual(
    sortHistoryItems(items).map((i) => i.id),
    ['old-1', 'old-3', 'new-1', 'new-3', 'new-7', 'none'],
  );
});

test('useChat wires the alignment params and the history ids', () => {
  const src = read('src/state/useChat.ts');
  assert.ok(src.includes('alignmentChipRequestParams(action.kind, surface?.messageId)'));
  assert.ok(
    !/case 'SelectAlignmentChip'[\s\S]*?triggeredInputType: 'follow_up'[\s\S]*?case 'SendLocationSharedQuery'/.test(src),
    'An alignment chip must not go out as follow_up (app sends align_chip_sel).',
  );
  // Omitted unless set, as Gson omits the app's nulls.
  assert.ok(src.includes("...(params.parentMessageId ? { parent_message_id: params.parentMessageId } : {})"));
  assert.ok(src.includes('parentMessageId: source?.messageId ?? null'), 'location-shared send carries the parent id');
  assert.ok(src.includes('sortHistoryItems(items).forEach('));
  assert.ok(!src.includes('latestFollowUpIds'), 'history must not set follow-up ids (app parity)');
});

test('a capability photo goes straight to chat; no photo answers the surface with photo_declined', () => {
  // App ChatScreen.kt:430-485 (sendAlignmentPhotoDirect / sendAlignmentPhotoDeclineQuery),
  // :527, :579, :639, :669, :739.
  const src = read('src/ui/screens/ChatScreen.tsx');
  assert.ok(/const deliverCapabilityImage[\s\S]*?type: 'SendQuestionWithImage',\s*question: '',/.test(src));
  assert.ok(/kind: AlignmentKinds\.UPLOAD_PHOTO,\s*chip: \{ label: text, value: text \}/.test(src));
  assert.ok(src.includes('Labels.PHOTO_PERMISSION_DECLINED') && src.includes('Labels.PHOTO_NOT_SHARED'));
  assert.ok(src.includes('else declineCapabilityPhoto(messageId, denied);'));
  assert.ok(src.includes('else declineCapabilityPhoto(messageId, false);'));
});

test('the location-denied send is an align_chip_sel GPS pick, not a plain follow-up', () => {
  const src = read('src/ui/screens/ChatScreen.tsx');
  assert.ok(/type: 'SelectAlignmentChip',\s*messageId: srcId,\s*kind: AlignmentKinds.GPS_PROMPT/.test(src));
});

test('Listen flips to playing together with the URL (no prepare lag)', () => {
  // App ChatViewModel.kt:664-670.
  const src = read('src/state/useChat.ts');
  assert.ok(/audioPlaybackUrl: result\.data\.audio,\s*isAudioPlaying: true,/.test(src));
  const screen = read('src/ui/screens/ChatScreen.tsx');
  assert.ok(
    screen.includes("onAction({ type: 'SetAudioPlaying', isPlaying: !state.isAudioPlaying })"),
    'With a clip loaded, a tap toggles play/pause (app handleListen) instead of re-synthesising.',
  );
});

test('every new send and history load clears the previous clip (app clearAudioPlayback)', () => {
  // App ChatViewModel.kt:509, 859, 888, 966, 1018, 1068, 1122, 1153, 1174.
  const src = read('src/state/useChat.ts');
  const staged = src.match(/chatResponseState: UiStates\.loading\(\),\s*\/\/ App clearAudioPlayback\(\)[^\n]*\n\s*audioPlaybackUrl: null,\s*isAudioPlaying: false,/g) ?? [];
  // sendTextQuery (new bubble), sendLocationSharedQuery, sendImageQuery, sendVoiceQuery.
  assert.equal(staged.length, 4);
  assert.ok(src.includes("// App loadChatHistory -> clearAudioPlayback() (ChatViewModel.kt:1174).\n      patch({ audioPlaybackUrl: null, isAudioPlaying: false });"));
});

test('the Listen pill has the app wave and four states', () => {
  const src = read('src/ui/components/ListenButton.tsx');
  // ListenButton.kt:207-211, 14 bars.
  const m = src.match(/const STATIC_HEIGHTS = \[([\s\S]*?)\];/);
  assert.ok(m);
  const heights = (m?.[1] ?? '').split(',').map((x) => x.trim()).filter(Boolean).map(Number);
  assert.deepEqual(heights, [0.15, 0.23, 0.31, 0.5, 0.31, 0.54, 0.73, 0.5, 0.73, 0.38, 0.5, 0.5, 0.31, 0.15]);
  for (const s of ["'Default'", "'Loading'", "'Playing'", "'Paused'"]) assert.ok(src.includes(s));
  assert.ok(src.includes('const WAVE_WIDTH = 54;') && src.includes('const WAVE_HEIGHT = 26;'));
  assert.ok(src.includes('const FADE_MS = 500;'));
});
