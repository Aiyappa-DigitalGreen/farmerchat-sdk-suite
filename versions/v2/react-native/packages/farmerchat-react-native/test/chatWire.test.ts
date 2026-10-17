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
  criticallyDampedProgress,
  fetchesFollowUps,
  omitNullFields,
  marksCardViewed,
  statementIdOf,
  synthesisStillWanted,
  historyFollowUpQuestions,
  historyVoiceText,
  imageQueryName,
  imageQueryText,
  shareCardText,
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
    /type: 'SetAudioPlaying',\s*isPlaying: !state\.isAudioPlaying,/.test(screen),
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

// --- Round 3 ---------------------------------------------------------------------------------

test('voice history text: query_text first, heard_query_text only when it is null', () => {
  // App ChatViewModel.kt:1273 `item.query_text ?: item.heard_query_text ?: ""`.
  assert.equal(historyVoiceText({ query_text: 'typed', heard_query_text: 'heard' }), 'typed');
  assert.equal(historyVoiceText({ query_text: null, heard_query_text: 'heard' }), 'heard');
  assert.equal(historyVoiceText({ heard_query_text: 'heard' }), 'heard');
  assert.equal(historyVoiceText({ query_text: '', heard_query_text: 'heard' }), '', 'blank is not null');
  assert.equal(historyVoiceText({}), '');
});

test('image query: default crop question when blank; image_<uuid>.jpg name', () => {
  // App ChatViewModel.kt:1127, 1858-1862.
  assert.equal(imageQueryText('  ', 'What is wrong with my crop?'), 'What is wrong with my crop?');
  assert.equal(imageQueryText(' Spots on leaves ', 'D'), 'Spots on leaves');
  assert.equal(imageQueryName('abc'), 'image_abc.jpg');
  assert.match(imageQueryName(), /^image_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/);
});

test('agentic image queries ride #27a with image + image_name; Plantix only without agentic', () => {
  const src = read('src/state/useChat.ts');
  assert.ok(/if \(sdk\.config\.enableAgenticChat\) \{[\s\S]*?triggered_input_type: 'image',[\s\S]*?image: imageBase64,\s*image_name: imageName,[\s\S]*?await streamAgenticAnswer\(request, placeholderId/.test(src));
  assert.ok(src.includes('query: queryForApi,') && !src.includes('fc-image-'));
});

test('animated pin follows the default Compose spring (critically damped, k = 1500)', () => {
  assert.equal(criticallyDampedProgress(0), 0);
  assert.ok(criticallyDampedProgress(0.05) > 0.5 && criticallyDampedProgress(0.05) < 0.7);
  assert.ok(criticallyDampedProgress(0.3) > 0.9998);
  let prev = 0;
  for (let t = 0; t <= 0.4; t += 0.01) {
    const p = criticallyDampedProgress(t);
    assert.ok(p >= prev && p <= 1, 'monotonic, no overshoot');
    prev = p;
  }
  const screen = read('src/ui/screens/ChatScreen.tsx');
  assert.ok(!/scrollTo(Index|Offset|End)\(\{[^}]*animated: true/.test(screen), 'no animated programmatic scroll (RN 0.76 dead-tap bug)');
  assert.ok(screen.includes('requestAnimationFrame(step)') && screen.includes('onScrollBeginDrag={cancelPin}'));
});

test('share card truncates like ShareCard.kt', () => {
  const long = 'x'.repeat(2000);
  assert.deepEqual(
    [shareCardText(long, long, true).title.length, shareCardText(long, long, true).body.length],
    [50, 460],
  );
  assert.deepEqual(
    [shareCardText(long, long, false).title.length, shareCardText(long, long, false).body.length],
    [70, 940],
  );
  const src = read('src/ui/screens/ChatScreen.tsx');
  assert.ok(src.includes('lastUser?.imageUri ?? null'), 'card uses the LAST question and its photo');
});

test('Listen analytics carry the app properties', () => {
  // App ChatScreen.kt:1080-1097, 1316-1340; AnalyticsProps.kt:4, 42.
  const src = read('src/state/useChat.ts');
  assert.ok(src.includes('? { screen_name: ScreenNames.CHAT }'));
  assert.ok(src.includes('No_of_seconds_played: Math.max(0, Math.floor(action.secondsPlayed ?? 0))'));
});

// --- web parity: null fields + #29 gating -------------------------------------------------

test('request bodies omit null / undefined fields, as the app Gson does', () => {
  // AgenticChatDataSource.kt:58 gson.toJson (no serializeNulls).
  assert.deepEqual(
    omitNullFields({ query: 'q', statement_id: null, ssfr_crop: null, transcription_id: undefined, retry: false, message_id: '' }),
    { query: 'q', retry: false, message_id: '' },
  );
  const src = read('src/state/useChat.ts');
  assert.ok(src.includes('const request: TextPromptRequest = omitNullFields({'));
  assert.ok(src.includes('sdk.api.imageAnalysis(omitNullFields({'));
});

test('#29 follow-ups are skipped after an exclusive alignment surface only', () => {
  // ChatViewModel.kt:2020-2025.
  for (const k of ['CLARIFY', 'CONFIRM', 'ESCALATE', 'GPS_PROMPT', 'UPLOAD_PHOTO'] as const) {
    assert.equal(fetchesFollowUps(k, 'm1', false), false, k);
  }
  assert.equal(fetchesFollowUps('GENDER_SELECT', 'm1', false), true);
  assert.equal(fetchesFollowUps('COMMODITY_CONFIRM', 'm1', null), true);
  assert.equal(fetchesFollowUps(null, 'm1', null), true);
  assert.equal(fetchesFollowUps(null, null, null), false);
  assert.equal(fetchesFollowUps(null, 'm1', true), false);
  assert.ok(read('src/state/useChat.ts').includes('if (fetchesFollowUps(alignmentKind, serverMessageId, data.hide_follow_up_question))'));
});

// --- Android scenario-pass parity (2026-10-17) ------------------------------------------------

test('a late synthesise_audio reply is dropped once the farmer moved on', () => {
  const answered = [{ kind: 'user', id: 'u1' }, { kind: 'ai', id: 'a1' }];
  assert.equal(synthesisStillWanted('a1', answered, false), true);
  assert.equal(synthesisStillWanted('a1', answered, true), false, 'a new answer is loading');
  const moved = [...answered, { kind: 'user', id: 'u2' }, { kind: 'ai', id: 'a2' }];
  assert.equal(synthesisStillWanted('a1', moved, false), false, 'no longer the latest answer');
  assert.ok(read('src/state/useChat.ts').includes('!synthesisStillWanted(answerLocalId, stateRef.current.messages, stateRef.current.isLoading)'));
});

test('onAnswerReceived carries the server message_id, never the local list id', () => {
  const src = read('src/state/useChat.ts');
  assert.ok(!src.includes("fireCallback('onAnswerReceived', serverMessageId ?? aiLocalId)"));
  assert.equal((src.match(/fireCallback\('onAnswerReceived', serverMessageId \?\? ''\)/g) ?? []).length, 2);
});

test('a language row tap only selects; labels change on Save', () => {
  const src = read('src/state/useSettings.ts');
  const select = src.slice(src.indexOf('const selectLanguage'), src.indexOf('const submitLanguage'));
  assert.ok(!select.includes('getLabels') && !select.includes('setLabels') && !select.includes('sdk.store.set'));
  const save = src.slice(src.indexOf('const submitLanguage'), src.indexOf('const consumeLanguageResult'));
  assert.ok(save.includes('sdk.api.getLabels(languageId)') && save.includes('sdk.labels.setLabels(labels.data)'));
});

test('only image Home cards are marked viewed, with a string statement_id', () => {
  // App HomeScreen.kt:2092-2093.
  assert.equal(marksCardViewed({ type: 'image', statement_id: 7, is_viewed: false }), true);
  assert.equal(marksCardViewed({ type: 'statement', statement_id: 7 }), false);
  assert.equal(marksCardViewed({ type: 'image', statement_id: 7, is_viewed: true }), false);
  assert.equal(marksCardViewed({ type: 'image', statement_id: null }), false);
  // DEMO sends a UUID string (scenario pass 2026-10-17: a `typeof === 'number'` check marked none).
  assert.equal(marksCardViewed({ type: 'image', statement_id: '6295d904-c7da-4782-a406-09bdca99657e' }), true);
  assert.equal(marksCardViewed({ type: 'statement', statement_id: '21d795fa' }), false);
  assert.equal(statementIdOf({ statement_id: 'abc' }), 'abc');
  assert.equal(statementIdOf({ statement_id: 42 }), '42');
  assert.equal(statementIdOf({ statement_id: '  ' }), null);
  assert.equal(statementIdOf({}), null);
  const home = read('src/ui/screens/HomeScreen.tsx');
  assert.ok(!home.includes("typeof section.statement_id === 'number'") && !home.includes("typeof row.section.statement_id === 'number'"));
  assert.ok(read('src/ui/screens/HomeScreen.tsx').includes('marksCardViewed(row.section)'));
});

test('the composer field grows to hold an attached photo and the caption', () => {
  // Scenario D3: `flex: 1` collapsed the field to minHeight and clipped the text input.
  const src = read('src/ui/components/InputComposer.tsx');
  const field = src.slice(src.indexOf('  field: {'), src.indexOf('  inputWrap: {'));
  assert.ok(field.includes('    flexGrow: 1,') && !field.includes('\n    flex: 1,'));
});

test('FULL_JOURNEY first launch: no guest init on the splash (onboarding does it with coordinates)', () => {
  // App OnboardingSharedViewModel.kt:341-366; scenario E1 placed the farmer at the locale centroid.
  const src = read('src/ui/screens/SplashScreen.tsx');
  assert.ok(/\} else if \(sdk\.isLanguageSelected\) \{\s*\/\/[^\n]*\n\s*await sdk\.session\.ensureGuestSession\(\);/.test(src));
  assert.ok(read('src/state/useOnboarding.ts').includes('sdk.session.ensureGuestSession({ lat, long: lng, accuracy })'));
});

test('the FAB fallback ✕ moves left of the Home weather pill', async () => {
  const { fallbackCloseSlotFor, onFallbackCloseSlot, setFallbackCloseSlot } = await import('../src/core/exitSignal.ts');
  assert.equal(fallbackCloseSlotFor('Home'), 'left');
  assert.equal(fallbackCloseSlotFor('Language'), 'right');
  assert.equal(fallbackCloseSlotFor(null), 'right');
  assert.equal(fallbackCloseSlotFor('Home', true), 'hidden', 'drawer open: no ✕ over the drawer');
  assert.equal(fallbackCloseSlotFor('AccountBenefits'), 'hidden', 'no ✕ over its Skip chip');
  const { isDrawerOpenInState } = await import('../src/core/exitSignal.ts');
  const open = { type: 'drawer', history: [{ type: 'route' }, { type: 'drawer', status: 'open' }], routes: [] };
  assert.equal(isDrawerOpenInState(open), true);
  assert.equal(isDrawerOpenInState({ type: 'stack', routes: [{ state: open }] }), true);
  assert.equal(isDrawerOpenInState({ type: 'drawer', history: [{ type: 'route' }], routes: [] }), false);
  const seen: string[] = [];
  const off = onFallbackCloseSlot((s) => seen.push(s));
  setFallbackCloseSlot('left');
  setFallbackCloseSlot('left');
  setFallbackCloseSlot('right');
  off();
  assert.deepEqual(seen, ['right', 'left', 'right']);
  assert.ok(read('src/FarmerChatFab.tsx').includes("closeSlot === 'left' ? { left: FALLBACK_CLOSE_LEFT_HOME } : { right: 16 }"));
});

test('FullScreenMessage follows the app: real country farmer images, back + Skip chips, main + subtitle', () => {
  const fsm = read('src/ui/components/FullScreenMessage.tsx');
  assert.ok(!/🧑|🌦|📍/u.test(fsm), 'no emoji placeholders');
  assert.ok(fsm.includes('countryFarmerIllustration(props.illustration, countryCode)'));
  assert.ok(fsm.includes("navIcon={props.onBack ? 'back' : 'none'}"));
  const assets = read('src/ui/assets.ts');
  for (const n of ['camera', 'sky', 'phone']) {
    for (const c of ['ke', 'et', 'ng', 'in']) assert.ok(assets.includes(`../assets/${c}/farmer_looking_at_${n}.webp`), `${c}/${n}`);
  }
  const acct = read('src/ui/screens/AccountScreens.tsx');
  // App AppNavGraph.kt:800-835.
  for (const k of ['Labels.SAVE_YOUR_QUESTIONS_ANSWERS', 'Labels.WELL_SAVE_YOUR_CHATS_YOU_CONTINUE', 'primaryState="Chevron"', "rightLabel={label(Labels.SKIP, 'Skip')}", 'onBack={() => {', 'Labels.YOURE_ALL_SET']) {
    assert.ok(acct.includes(k), k);
  }
  const err = read('src/ui/screens/ErrorScreen.tsx');
  assert.ok(err.includes('Labels.FARMERCHAT_NEEDS_THE_INTERNET') && err.includes('Labels.FARMERCHAT_COULDNT_LOAD'));
});

test('country flags are images (the API sends a URL), never printed as text', () => {
  const inputs = read('src/ui/components/Inputs.tsx');
  assert.ok(!inputs.includes("{props.flag ?? '🇮🇳'}"));
  assert.ok(inputs.includes('<FlagMark flag={props.flag ?? null} width={20} height={20} radius={4} />'));
  const picker = read('src/ui/components/CountryPicker.tsx');
  assert.ok(!picker.includes('`${item.flag ? `${item.flag} ` :'));
});

test('home weather chip: current_temp verbatim, SVG icons fall back (scenario E, 2026-10-17)', async () => {
  const { weatherChipText, weatherIconUri } = await import('../src/core/chatWire.ts');
  assert.equal(weatherChipText('27 °C'), '27 °C');
  assert.equal(weatherChipText(null), '--°');
  assert.equal(weatherChipText(''), '--°');
  assert.equal(weatherIconUri('https://x.org/icons/04d.svg'), null);
  assert.equal(weatherIconUri('https://x.org/icons/04d.SVG?v=2'), null);
  assert.equal(weatherIconUri('https://x.org/icons/04d.png'), 'https://x.org/icons/04d.png');
  assert.equal(weatherIconUri('cloudy'), null);
  assert.equal(weatherIconUri(null), null);
  const home = read('src/ui/screens/HomeScreen.tsx');
  assert.ok(!home.includes('`${weather.current_temp}°`'));
  assert.ok(home.includes('weatherIconUrl={weatherIconUri(weather?.weather_icon)}'));
});

test('drawer follows the app DrawerContent.kt (scenario E4, 2026-10-17)', async () => {
  const { drawerMenuOption } = await import('../src/core/chatWire.ts');
  assert.equal(drawerMenuOption('home'), 'Home');
  assert.equal(drawerMenuOption('settings/language'), 'Language');
  assert.equal(drawerMenuOption('settings'), 'Settings');
  assert.equal(drawerMenuOption('help'), 'Help_Support');
  assert.equal(drawerMenuOption('signup'), 'Signup');
  assert.equal(drawerMenuOption('chatHistory'), null);
  const drawer = read('src/ui/navigation/DrawerContent.tsx');
  assert.ok(drawer.includes('export const DRAWER_WIDTH = 320;'));
  assert.ok(drawer.includes('backgroundColor: b.surfaceSecondary'));
  assert.ok(drawer.includes('Labels.SAVE_YOUR_QUESTIONS_ANSWERS'));
  assert.ok(drawer.includes('Labels.WELL_SAVE_YOUR_CHATS_YOU_CONTINUE'));
  assert.ok(drawer.includes('Labels.HELP_SUPPORT'));
  assert.ok(drawer.includes("`${label(Labels.LANGUAGE, 'Language')}: "));
  assert.ok(!drawer.includes("'drawer_recent'"), 'invented label keys removed');
  const graph = read('src/ui/navigation/AppNavGraph.tsx');
  assert.ok(graph.includes("CHAT_HISTORY_CLICK_EVENT, { screen_name: 'Menu' }"));
  assert.ok(!graph.includes('MENU_OPTION_CLICK_EVENT, { route }'));
});

test('screens with DefaultAppBar do not pad the top inset twice (scenario E4/E7/E8)', () => {
  for (const f of ['HelpScreen', 'AuthScreen', 'LanguageChooserScreen', 'ChatHistoryScreen', 'SettingsNameScreen', 'LegalContentScreen']) {
    const src = read(`src/ui/screens/${f}.tsx`);
    assert.ok(src.includes('DefaultAppBar'), f);
    assert.ok(src.includes("edges={['left', 'right', 'bottom']}"), `${f} SafeAreaView must leave the top edge to the app bar`);
  }
});

test('auth phone step matches AuthScreen.kt (scenario E8, 2026-10-17)', () => {
  const src = read('src/ui/screens/AuthScreen.tsx');
  for (const key of ['AGREEMENT_CARD_TITLE', 'AGREEMENT_POINT_VERIFICATION_CODE', 'AGREEMENT_POINT_UPDATES',
    'AGREEMENT_CARD_INFO_TEXT', 'AUTH_CONSENT_PREFIX', 'AUTH_CONSENT_SUFFIX', 'SEND_VIA_SMS', 'SEND_VIA_WHATSAPP',
    'SENDING_CODE', 'PLEASE_ENTER', 'SECONDS', 'VERIFYING']) {
    assert.ok(src.includes(`Labels.${key}`), key);
  }
  assert.ok(src.includes("title={label(Labels.SIGN_UP, 'Sign up')}"));
  for (const invented of ["'auth_send_sms'", "'auth_send_whatsapp'", "'auth_legal_prefix'", "'otp_resend_in'", "'auth_loading_channels'"]) {
    assert.ok(!src.includes(invented), `invented key ${invented}`);
  }
  const labels = read('src/core/labels.ts');
  assert.ok(labels.includes("AGREEMENT_CARD_TITLE: 'fc_v2_app_label_agreement_card_title'"));
  assert.ok(src.includes('return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, \'0\')}`;'), 'app m:ss timer');
});

test('enter-name screen matches EnterNameScreen.kt (scenario E1, 2026-10-17)', () => {
  const src = read('src/ui/screens/EnterNameScreen.tsx');
  assert.ok(src.includes("label(Labels.WE_GREET_YOU_NAME, 'So we can greet you by name')"));
  assert.ok(src.includes("label(Labels.YOUR_NAME_OR_NICKNAME, 'Your name or nickname')"));
  assert.ok(!src.includes("'name_subtitle'"), 'invented key removed');
  assert.ok(!src.includes('styles.footer'), 'buttons sit under the field, not pinned to the bottom');
  assert.ok(src.includes('<LogoMark size={32} color={c.borderActive}'));
});

test('language chooser keeps an expanded-only selection visible (LanguageChooserScreen.kt:138-149)', async () => {
  const { collapsedLanguages } = await import('../src/core/chatWire.ts');
  const p = [{ id: 1 }, { id: 2 }];
  const all = [...p, { id: 9 }];
  assert.deepEqual(collapsedLanguages(p, all, 9).map((l) => l.id), [9, 1, 2]);
  assert.deepEqual(collapsedLanguages(p, all, 2).map((l) => l.id), [1, 2]);
  assert.deepEqual(collapsedLanguages(p, all, 77).map((l) => l.id), [1, 2]);
  assert.deepEqual(collapsedLanguages(p, all, null).map((l) => l.id), [1, 2]);
});

test('auth privacy link uses endpoint privacy_policy, never a guessed URL (scenario E8)', () => {
  const src = read('src/ui/screens/AuthScreen.tsx');
  assert.ok(src.includes('sdk.api.getPrivacyPolicy()'));
  assert.ok(!src.includes("'https://digitalgreen.org/privacy-policy/'"), 'the guessed URL 404s on digitalgreen.org');
  assert.ok(src.includes("if (privacyUrl && privacyUrl.trim() !== '')"));
});

test('legal links read the app PrivacyPolicyResponse fields (url / farmerchat_terms_of_use)', async () => {
  const { legalLinksOf } = await import('../src/core/chatWire.ts');
  assert.deepEqual(legalLinksOf({ url: 'https://p', farmerchat_terms_of_use: 'https://t' }), {
    privacyPolicyUrl: 'https://p',
    termsOfUseUrl: 'https://t',
  });
  assert.deepEqual(legalLinksOf({ url: ' ', privacy_policy_url: 'https://old' }), {
    privacyPolicyUrl: 'https://old',
    termsOfUseUrl: null,
  });
  assert.deepEqual(legalLinksOf({}), { privacyPolicyUrl: null, termsOfUseUrl: null });
  for (const f of ['src/state/useOnboarding.ts', 'src/state/useHome.ts', 'src/ui/screens/AuthScreen.tsx']) {
    assert.ok(read(f).includes('legalLinksOf(result.data)'), f);
  }
});

test('home cards honour the host cardCornerRadius at render (scenario F1)', () => {
  const src = read('src/ui/components/Cards.tsx');
  const sheet = src.slice(src.indexOf('const styles = StyleSheet.create({'));
  const card = sheet.slice(sheet.indexOf('card: {'), sheet.indexOf('},', sheet.indexOf('card: {')));
  assert.ok(!card.includes('borderRadius'), 'a module-load StyleSheet freezes the default radius');
  assert.equal(src.split('{ borderRadius: radius.xxl }').length - 1, 3);
});

test('FAB fallback ✕ follows the live safe-area top (scenario F3)', () => {
  const src = read('src/FarmerChatFab.tsx');
  assert.ok(!src.includes('const FALLBACK_CLOSE_TOP ='));
  assert.ok(!src.includes('StatusBar.currentHeight'), 'a startup constant does not follow density changes');
  assert.ok(src.includes('const top = insets.top + 8;'), 'both platforms follow the live inset');
  assert.ok(!src.includes('<SafeAreaProvider style={StyleSheet.absoluteFill}'), 'a full-screen native provider swallows touches on Android');
  assert.ok(src.includes("closeColumn: { position: 'absolute', top: 0, width: FALLBACK_CLOSE_SIZE }"));
  assert.ok(src.includes('setCloseColumnHeight(top + FALLBACK_CLOSE_SIZE)'), 'column ends under the button: no dead zone below the bar');
});

test('Name_Save_Click_Event only for name saves, on the tap (scenario C7)', () => {
  const src = read('src/state/useEnterName.ts');
  const i = src.indexOf('NAME_SAVE_CLICK');
  assert.ok(i > 0 && src.lastIndexOf('NAME_SAVE_CLICK') === i, 'tracked once');
  assert.ok(src.slice(i - 120, i).includes('if (body.name)'));
  assert.ok(i < src.indexOf('await sdk.api.updateUserProfile(body)'), 'before the call, as the app does');
});
