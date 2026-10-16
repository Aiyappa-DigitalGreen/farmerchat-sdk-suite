/**
 * Send_Query_Initiated / Send_Query payload, pinned to the app's SendQueryProperties
 * (core/analytics/SendQueryAnalytics.kt), AnalyticsProps.kt:44-75 and ChatViewModel.kt:115-176.
 *
 *     node --import ./test/ts-extension-hook.mjs test/sendQueryAnalytics.test.ts
 */
import {
  ChipStatus,
  manualSendChipContext,
  toAnalyticsProperties,
  withResponseChipStatus,
  withValidResponse,
  type SendQueryProps,
} from '../src/core/sendQueryAnalytics.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

const typed: SendQueryProps = { screenName: 'Chat Screen', isFollowupPrompt: false, isImageQuery: false, isTextQuery: true, isVoiceQuery: false, lengthOfTextQuery: 10 };

// Every key, in the app's order, for a plain typed send.
check('typed: full payload', toAnalyticsProperties(typed), {
  screen_name: 'Chat Screen', followup_prompt: false, image_query: false, text_query: true, voice_query: false,
  weather_advice_cta: false, length_of_audio_in_seconds: 0, length_of_Text_query: 10, size_of_image_kb: 0,
  audio_format: '', isOnnboarding_query: false, type: 'text', click_type: 'text',
  agentic_chip_status: 'none', agentic_chip_skipped_type: '', agentic_chip_shown_type: '',
  agentic_chip_type: '', agentic_chip_value: '', agentic_chip_label: '',
  asset_type: '', asset_name: '', concern: '', stage: '', intent: '',
  clarification_needed_asset: false, clarification_needed_concern: false,
});
check('Valid_Query only on Send_Query', 'Valid_Query' in toAnalyticsProperties(typed), false);

// click_type precedence.
const ct = (p: Partial<SendQueryProps>) => toAnalyticsProperties({ ...typed, ...p }).click_type;
check('chip wins over everything', ct({ isAlignmentChip: true, isFollowupPrompt: true, isReadFullAdvice: true }), 'align_chip_sel');
check('read full advice', ct({ isReadFullAdvice: true, isFollowupPrompt: true }), 'read_full_advice');
check('follow-up', ct({ isFollowupPrompt: true }), 'follow-up');
check('image card', ct({ isImageCard: true, isWeatherAdviceCTA: true }), 'Image_Card');
check('text card', ct({ isTextCard: true }), 'Text_Card');
check('weather', ct({ isWeatherAdviceCTA: true, isSSFR: true }), 'Weather');
check('ssfr', ct({ isSSFR: true }), 'SSFR');
check('channel', ct({ channel: 'whatsapp' }), 'whatsapp');
check('image type', toAnalyticsProperties({ ...typed, isTextQuery: false, isImageQuery: true, sizeOfImageKb: 42 }).click_type, 'image');
check('voice type + format', [toAnalyticsProperties({ ...typed, isTextQuery: false, isVoiceQuery: true, audioFormat: 'webm', lengthOfTextQuery: 9 }).type, toAnalyticsProperties({ ...typed, isTextQuery: false, isVoiceQuery: true, audioFormat: 'webm' }).audio_format, toAnalyticsProperties({ ...typed, isTextQuery: false, isVoiceQuery: true, lengthOfTextQuery: 9 }).length_of_Text_query], ['voice', 'webm', 0]);
check('image size only for image', [toAnalyticsProperties({ ...typed, sizeOfImageKb: 5 }).size_of_image_kb, toAnalyticsProperties({ ...typed, isTextQuery: false, isImageQuery: true, sizeOfImageKb: 5 }).size_of_image_kb], [0, 5]);

// agentic_chip_status: selected / skipped / available / none.
const chip = toAnalyticsProperties({ ...typed, isAlignmentChip: true, agenticChipType: 'alignment-clarify', agenticChipValue: 'rice', agenticChipLabel: 'Rice' });
check('chip pick derives selected', [chip.agentic_chip_status, chip.agentic_chip_type, chip.agentic_chip_value, chip.agentic_chip_label, chip.click_type], ['selected', 'alignment-clarify', 'rice', 'Rice', 'align_chip_sel']);
check('manual send over unpicked chips → skipped', manualSendChipContext({ analyticsType: 'upload-photo', chipCount: 3, selectedCount: 0 }), { status: 'skipped', skippedType: 'upload-photo' });
check('…after a pick → none', manualSendChipContext({ analyticsType: 'alignment-clarify', chipCount: 4, selectedCount: 1 }), { status: 'none', skippedType: null });
check('…plain answer → none', manualSendChipContext({ analyticsType: null, chipCount: 0, selectedCount: 0 }), { status: 'none', skippedType: null });
check('…no answer yet → none', manualSendChipContext(null), { status: 'none', skippedType: null });
const skipped = toAnalyticsProperties({ ...typed, agenticChipStatus: ChipStatus.SKIPPED, agenticChipSkippedType: 'upload-photo' });
check('skipped carries skipped_type only', [skipped.agentic_chip_status, skipped.agentic_chip_skipped_type, skipped.agentic_chip_shown_type], ['skipped', 'upload-photo', '']);
check('skipped_type blank unless skipped', toAnalyticsProperties({ ...typed, agenticChipStatus: 'none', agenticChipSkippedType: 'x' }).agentic_chip_skipped_type, '');

// Send_Query on the response.
const intent = { asset_type: 'crop', asset_name: 'rice', concern: 'fertilizer', stage: null, intent: 'advisory', clarification_needed: { asset: true, concern: false, additional_context: '' } };
const ok = toAnalyticsProperties(withResponseChipStatus(withValidResponse(typed, intent, 22), 'alignment-clarify'));
check('valid + intent + available', [ok.Valid_Query, ok.asset_type, ok.asset_name, ok.concern, ok.stage, ok.intent, ok.clarification_needed_asset, ok.clarification_needed_concern, ok.length_of_Text_query, ok.agentic_chip_status, ok.agentic_chip_shown_type],
  [true, 'crop', 'rice', 'fertilizer', '', 'advisory', true, false, 22, 'available', 'alignment-clarify']);
check('no chips in the response stays none', toAnalyticsProperties(withResponseChipStatus(withValidResponse(typed, null), null)).agentic_chip_status, 'none');
check('a chip pick answered by a new surface stays selected', toAnalyticsProperties(withResponseChipStatus({ ...typed, isAlignmentChip: true, agenticChipStatus: 'selected' }, 'alignment-clarify')).agentic_chip_status, 'selected');
check('skipped stays skipped', toAnalyticsProperties(withResponseChipStatus({ ...typed, agenticChipStatus: 'skipped', agenticChipSkippedType: 'gps-prompt' }, 'upload-photo')).agentic_chip_status, 'skipped');
check('boolean clarification_needed (legacy) → false/false', [toAnalyticsProperties(withValidResponse(typed, { clarification_needed: true })).clarification_needed_asset], [false]);
check('failure carries Valid_Query false', toAnalyticsProperties({ ...typed, isValidQuery: false }).Valid_Query, false);

// A photo from the upload-photo chip.
const photo = toAnalyticsProperties({ screenName: 'Chat Screen', isFollowupPrompt: false, isImageQuery: true, isTextQuery: false, isVoiceQuery: false, sizeOfImageKb: 30, isAlignmentChip: true, agenticChipType: 'upload-photo', agenticChipValue: 'choose_from_gallery', agenticChipLabel: 'Choose from gallery' });
check('photo chip = selected upload-photo pick', [photo.agentic_chip_status, photo.agentic_chip_type, photo.agentic_chip_value, photo.click_type, photo.type, photo.size_of_image_kb], ['selected', 'upload-photo', 'choose_from_gallery', 'align_chip_sel', 'image', 30]);

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} sendQueryAnalytics test(s) failed`);
}
console.log(`sendQueryAnalytics: ${passed} assertions passed`);
