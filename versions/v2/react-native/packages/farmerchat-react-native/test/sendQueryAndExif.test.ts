/**
 * Round 3: Send_Query properties (app SendQueryAnalytics.kt + ChatViewModel chip status) and the
 * photo-upload GPS EXIF (app ImageUtils.kt).
 *
 *     node --import ./test/ts-extension-hook.mjs test/sendQueryAndExif.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ChipStatus,
  base64SizeKb,
  manualSendChipContext,
  minimalSendQueryProps,
  sendQueryAnalyticsProperties,
  withResponseChipStatus,
  withSendQueryResult,
} from '../src/core/sendQueryAnalytics.ts';
import {
  base64ToBytes,
  bytesToBase64,
  gpsFromPickerExif,
  toExifDms,
  writeGpsExif,
} from '../src/core/imageExif.ts';

const read = (p: string) => readFileSync(p, 'utf8');

// --- Send_Query ----------------------------------------------------------------------------

test('property map has the app keys, values and click_type', () => {
  const p = sendQueryAnalyticsProperties({
    screenName: 'Chat Screen',
    isFollowupPrompt: false,
    isImageQuery: false,
    isTextQuery: true,
    isVoiceQuery: false,
    lengthOfTextQuery: 12,
  });
  // SendQueryAnalytics.kt:107-160, AnalyticsProps.kt:44-79.
  assert.deepEqual(Object.keys(p), [
    'screen_name', 'followup_prompt', 'image_query', 'text_query', 'voice_query',
    'weather_advice_cta', 'length_of_audio_in_seconds', 'length_of_Text_query', 'size_of_image_kb',
    'audio_format', 'isOnnboarding_query', 'type', 'click_type', 'agentic_chip_status',
    'agentic_chip_skipped_type', 'agentic_chip_shown_type', 'agentic_chip_type',
    'agentic_chip_value', 'agentic_chip_label', 'asset_type', 'asset_name', 'concern', 'stage',
    'intent', 'clarification_needed_asset', 'clarification_needed_concern',
  ]);
  assert.equal(p.type, 'text');
  assert.equal(p.click_type, 'text');
  assert.equal(p.agentic_chip_status, 'none');
  assert.equal(p.length_of_Text_query, 12);
  assert.equal('Valid_Query' in p, false, 'Valid_Query only once the answer lands');
});

test('click_type precedence follows the app', () => {
  const base = { screenName: 'Chat Screen', isFollowupPrompt: true, isImageQuery: false, isTextQuery: true, isVoiceQuery: false };
  assert.equal(sendQueryAnalyticsProperties(base).click_type, 'follow-up');
  assert.equal(sendQueryAnalyticsProperties({ ...base, isReadFullAdvice: true }).click_type, 'read_full_advice');
  assert.equal(sendQueryAnalyticsProperties({ ...base, isAlignmentChip: true }).click_type, 'align_chip_sel');
  assert.equal(sendQueryAnalyticsProperties({ ...base, isFollowupPrompt: false, isWeatherAdviceCTA: true }).click_type, 'Weather');
  assert.equal(sendQueryAnalyticsProperties({ ...base, isFollowupPrompt: false, isSSFR: true }).click_type, 'SSFR');
  assert.equal(
    sendQueryAnalyticsProperties({ ...base, isFollowupPrompt: false, isTextQuery: false, isImageQuery: true }).click_type,
    'image',
  );
});

test('chip status: selected / skipped / available / none', () => {
  // A chip pick → selected (derived from isAlignmentChip too).
  const pick = sendQueryAnalyticsProperties({
    ...minimalSendQueryProps({ question: 'Wheat', isImageQuery: false, isVoiceQuery: false }),
    isAlignmentChip: true,
    agenticChipType: 'alignment-clarify',
    agenticChipValue: 'wheat',
    agenticChipLabel: 'Wheat',
    agenticChipStatus: ChipStatus.SELECTED,
  });
  assert.equal(pick.agentic_chip_status, 'selected');
  assert.equal(pick.click_type, 'align_chip_sel');
  assert.equal(pick.agentic_chip_value, 'wheat');

  // Typed while chips were on screen and unpicked → skipped + the surface kind.
  const surface = { alignmentKind: 'UPLOAD_PHOTO' as const, alignmentChips: [{ label: 'Take a photo' }], alignmentSelectedValues: [] };
  assert.deepEqual(manualSendChipContext(surface), { status: 'skipped', skippedType: 'upload-photo' });
  const typed = sendQueryAnalyticsProperties(
    minimalSendQueryProps({ question: 'x', isImageQuery: false, isVoiceQuery: false, lastAi: surface }),
  );
  assert.equal(typed.agentic_chip_status, 'skipped');
  assert.equal(typed.agentic_chip_skipped_type, 'upload-photo');
  // Already picked → none.
  assert.equal(manualSendChipContext({ ...surface, alignmentSelectedValues: ['take_photo'] }).status, 'none');

  // The answer shows chips and the send was not a chip reaction → available + shown type.
  const plain = minimalSendQueryProps({ question: 'q', isImageQuery: false, isVoiceQuery: false });
  const available = sendQueryAnalyticsProperties(withResponseChipStatus(plain, 'gps-prompt'));
  assert.equal(available.agentic_chip_status, 'available');
  assert.equal(available.agentic_chip_shown_type, 'gps-prompt');
  // selected / skipped are never overwritten.
  const sel = withResponseChipStatus({ ...plain, agenticChipStatus: 'selected' }, 'gps-prompt');
  assert.equal(sel.agenticChipStatus, 'selected');
  // A photo-chip send has no explicit status: selected, unless its answer shows chips (app).
  const photoChip = { ...plain, isImageQuery: true, isTextQuery: false, isAlignmentChip: true, agenticChipStatus: null };
  assert.equal(sendQueryAnalyticsProperties(photoChip).agentic_chip_status, 'selected');
  assert.equal(sendQueryAnalyticsProperties(photoChip).click_type, 'align_chip_sel');
});

test('Send_Query stamping: Valid_Query + intent fields', () => {
  const p = sendQueryAnalyticsProperties(
    withSendQueryResult(minimalSendQueryProps({ question: 'q', isImageQuery: false, isVoiceQuery: false }), {
      isValid: true,
      question: 'How much fertilizer?',
      intent: {
        asset_type: 'crop',
        asset_name: 'wheat',
        concern: 'nutrient management',
        stage: 'sowing',
        intent: 'advice',
        clarification_needed: { asset: true, concern: false },
      },
    }),
  );
  assert.equal(p.Valid_Query, true);
  assert.equal(p.length_of_Text_query, 'How much fertilizer?'.length);
  assert.equal(p.asset_name, 'wheat');
  assert.equal(p.stage, 'sowing');
  assert.equal(p.clarification_needed_asset, true);
  assert.equal(p.clarification_needed_concern, false);
  const failed = sendQueryAnalyticsProperties(
    withSendQueryResult(minimalSendQueryProps({ question: 'q', isImageQuery: false, isVoiceQuery: false }), { isValid: false }),
  );
  assert.equal(failed.Valid_Query, false);
});

test('Send_Query fires from the answer paths, not with the old invented keys', () => {
  const src = read('src/state/useChat.ts');
  assert.ok(!src.includes('is_valid_query'), 'the app key is Valid_Query');
  assert.ok(src.includes('reportSendQuery(ctx, { isValid: false });'));
  assert.ok(/reportSendQuery\(ctx, \{\s*isValid: true,\s*intent: data\.intent_classification_output/.test(src));
  assert.ok(src.includes('sendQueryAnalyticsProperties(analyticsProps)'), 'Initiated uses the same map');
  const screen = read('src/ui/screens/ChatScreen.tsx');
  assert.ok(screen.includes('analyticsChipValue: AlignmentChipWire.VALUE_NOT_NOW'));
  assert.equal(base64SizeKb('A'.repeat(4 * 1024)), 3);
});

// --- photo EXIF ------------------------------------------------------------------------------

test('picker EXIF GPS: Android signed decimals and iOS {GPS}', () => {
  assert.deepEqual(gpsFromPickerExif({ GPSLatitude: 12.9141, GPSLongitude: 77.6413 }), { latitude: 12.9141, longitude: 77.6413 });
  assert.deepEqual(gpsFromPickerExif({ GPSLatitude: -1.28, GPSLongitude: 36.82 }), { latitude: -1.28, longitude: 36.82 });
  assert.deepEqual(
    gpsFromPickerExif({ '{GPS}': { Latitude: 1.28, LatitudeRef: 'S', Longitude: 36.82, LongitudeRef: 'E' } }),
    { latitude: -1.28, longitude: 36.82 },
  );
  assert.equal(gpsFromPickerExif({ Orientation: 1 }), null);
  assert.equal(gpsFromPickerExif(null), null);
});

test('DMS rationals match ImageUtils.convertToExifFormat', () => {
  // 12.9141 -> 12 deg, 54 min, 50.7599.. s (IEEE, as Kotlin) -> 50759/1000
  assert.deepEqual(toExifDms(12.9141), [[12, 1], [54, 1], [50759, 1000]]);
  assert.deepEqual(toExifDms(-77.6413)[0], [77, 1]);
});

test('base64 codec round-trips', () => {
  for (const n of [0, 1, 2, 3, 4, 5, 100]) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37) & 0xff);
    assert.deepEqual(Array.from(base64ToBytes(bytesToBase64(bytes))), Array.from(bytes));
  }
});

/** SOI + APP0 + Exif APP1 + DQT + data + EOI. */
function fakeJpeg(): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const exifBody = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 0];
  const app1 = [0xff, 0xe1, 0, exifBody.length + 2, ...exifBody];
  const dqt = [0xff, 0xdb, 0x00, 0x05, 1, 2, 3];
  const data = Array.from({ length: 500 }, (_, i) => (i * 13 + 7) & 0xff);
  return Uint8Array.from([0xff, 0xd8, ...app0, ...app1, ...dqt, ...data, 0xff, 0xd9]);
}

/** Parses the segments up to the first non-APPn/COM marker. */
function segments(bytes: Uint8Array): Array<{ marker: number; at: number; end: number }> {
  const out: Array<{ marker: number; at: number; end: number }> = [];
  let at = 2;
  while (bytes[at] === 0xff) {
    const marker = bytes[at + 1] ?? 0;
    if (!((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe)) break;
    const end = at + 2 + (((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0));
    out.push({ marker, at, end });
    at = end;
  }
  return out;
}

const u16 = (b: Uint8Array, o: number) => ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
const u32 = (b: Uint8Array, o: number) => (u16(b, o) * 65536) + u16(b, o + 2);

test('GPS EXIF is written GPS-only, the old Exif removed, the image data untouched', () => {
  const original = fakeJpeg();
  const out = base64ToBytes(writeGpsExif(bytesToBase64(original), { latitude: 12.9141, longitude: -77.6413 }));
  assert.equal(out[0], 0xff);
  assert.equal(out[1], 0xd8);
  const segs = segments(out);
  const exif = segs.filter((s) => s.marker === 0xe1);
  assert.equal(exif.length, 1, 'exactly one Exif APP1');
  assert.ok(segs.some((s) => s.marker === 0xe0), 'APP0 (JFIF) kept');
  // Parse the GPS IFD back.
  const tiff = (exif[0]?.at ?? 0) + 10;
  assert.equal(String.fromCharCode(out[tiff] ?? 0, out[tiff + 1] ?? 0), 'MM');
  const ifd0 = tiff + u32(out, tiff + 4);
  assert.equal(u16(out, ifd0 + 2), 0x8825);
  const gps = tiff + u32(out, ifd0 + 2 + 8);
  assert.equal(u16(out, gps), 4);
  const entry = (i: number) => gps + 2 + i * 12;
  assert.equal(String.fromCharCode(out[entry(0) + 8] ?? 0), 'N');
  assert.equal(String.fromCharCode(out[entry(2) + 8] ?? 0), 'W');
  const latAt = tiff + u32(out, entry(1) + 8);
  assert.deepEqual([u32(out, latAt), u32(out, latAt + 4), u32(out, latAt + 16), u32(out, latAt + 20)], [12, 1, 50759, 1000]);
  // Everything from the first non-APP segment on is byte-identical.
  const origRest = original.subarray(segments(original).at(-1)?.end ?? 0);
  const outRest = out.subarray(segs.at(-1)?.end ?? 0);
  assert.deepEqual(Array.from(outRest), Array.from(origRest));
});

test('no location: the old Exif is still removed (the app re-encodes without it)', () => {
  const out = base64ToBytes(writeGpsExif(bytesToBase64(fakeJpeg()), null));
  assert.equal(segments(out).filter((s) => s.marker === 0xe1).length, 0);
  assert.equal(out[out.length - 1], 0xd9);
  // Non-JPEG input is returned unchanged.
  assert.equal(writeGpsExif('aGVsbG8=', { latitude: 1, longitude: 1 }), 'aGVsbG8=');
});

test('upload path uses the EXIF writer and the app quality', () => {
  const src = read('src/state/useChat.ts');
  assert.ok(src.includes('gpsFromPickerExif(params.imageExif) ?? (await currentLocationIfPermitted())'));
  assert.ok(src.includes('image: imageBase64,'));
  const overlays = read('src/ui/components/InputOverlays.tsx');
  assert.equal((overlays.match(/quality: 0\.8,\s*exif: true,/g) ?? []).length, 2);
});
