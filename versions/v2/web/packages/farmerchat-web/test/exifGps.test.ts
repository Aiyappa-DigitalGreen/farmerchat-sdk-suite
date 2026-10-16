/**
 * EXIF GPS bytes, pinned to the app's ImageUtils.kt (convertToExifFormat :303-309, the
 * ExifInterface GPS block :213-231, readGpsFromImage :47-90).
 *
 *     node --import ./test/ts-extension-hook.mjs test/exifGps.test.ts
 */
import { buildGpsExifPayload, insertGpsExif, readJpegGps, toExifDms } from '../src/core/exifGps.ts';
import { kotlinDoubleString } from '../src/core/imageUpload.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// convertToExifFormat: d/1, m/1, trunc(s*1000)/1000 — Kotlin Double maths (IEEE, same as JS).
check('Bengaluru lat', toExifDms(12.9716), [[12, 1], [58, 1], [17760, 1000]]);
check('Bengaluru lon (truncates 40559.99…)', toExifDms(77.5946), [[77, 1], [35, 1], [40559, 1000]]);
check('southern value uses |value|', toExifDms(-33.8688), [[33, 1], [52, 1], [7680, 1000]]);

// The exact APP1 payload: "Exif\0\0", big-endian TIFF, IFD0 {GPSInfo→26}, GPS IFD with the four
// tags the app sets, then the two RATIONAL triples.
check(
  'payload bytes',
  hex(buildGpsExifPayload({ latitude: 12.9716, longitude: 77.5946 })),
  '457869660000' + // Exif\0\0
    '4d4d002a00000008' + // MM, 42, IFD0 @8
    '0001' + '8825000400000001' + '0000001a' + '00000000' + // IFD0: GPSInfo LONG 1 → 26; next 0
    '0004' + // GPS IFD: 4 entries
    '0001000200000002' + '4e000000' + // GPSLatitudeRef ASCII 2 "N\0"
    '0002000500000003' + '00000050' + // GPSLatitude RATIONAL 3 @80
    '0003000200000002' + '45000000' + // GPSLongitudeRef ASCII 2 "E\0"
    '0004000500000003' + '00000068' + // GPSLongitude RATIONAL 3 @104
    '00000000' +
    '0000000c00000001' + '0000003a00000001' + '00004560000003e8' + // 12/1 58/1 17760/1000
    '0000004d00000001' + '0000002300000001' + '00009e6f000003e8', // 77/1 35/1 40559/1000
);
check('S/W refs', hex(buildGpsExifPayload({ latitude: -1, longitude: -2 }).subarray(6 + 28, 6 + 40)).slice(16, 18) + hex(buildGpsExifPayload({ latitude: -1, longitude: -2 }).subarray(6 + 52, 6 + 64)).slice(16, 18), '5357');

// A canvas-like JPEG: SOI, APP0 JFIF, (pretend) scan, EOI.
const jfif = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
const withGps = insertGpsExif(jfif, { latitude: 12.9716, longitude: 77.5946 });
check('APP1 sits right after SOI', hex(withGps.subarray(0, 4)), 'ffd8ffe1');
check('APP1 length = payload + 2', (withGps[4]! << 8) | withGps[5]!, 134 + 2);
check('rest of the file untouched', hex(withGps.subarray(4 + 134 + 2)), hex(jfif.subarray(2)));
const back = readJpegGps(withGps);
check('round trip lat', back && near(back.latitude, 12 + 58 / 60 + 17.76 / 3600), true);
check('round trip lon', back && near(back.longitude, 77 + 35 / 60 + 40.559 / 3600), true);
const sw = readJpegGps(insertGpsExif(jfif, { latitude: -33.8688, longitude: -70.5 }));
check('S/W read back negative', sw && sw.latitude < 0 && sw.longitude < 0, true);
check('re-inserting replaces, never duplicates', hex(insertGpsExif(withGps, { latitude: 1, longitude: 2 })).split('ffe1').length - 1, 1);
check('non-JPEG untouched', hex(insertGpsExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { latitude: 1, longitude: 1 })), '89504e47');
check('no EXIF -> no fix', readJpegGps(jfif), null);
check('PNG -> no fix', readJpegGps(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])), null);

// Little-endian ("II") EXIF as cameras write it: lat 10°30'0" S, lon 20°15'36" E.
function leJpeg(): Uint8Array {
  const tiff = new Uint8Array(128);
  const v = new DataView(tiff.buffer);
  v.setUint16(0, 0x4949); v.setUint16(2, 42, true); v.setUint32(4, 8, true);
  v.setUint16(8, 1, true); v.setUint16(10, 0x8825, true); v.setUint16(12, 4, true); v.setUint32(14, 1, true); v.setUint32(18, 26, true);
  v.setUint16(26, 4, true);
  const ent = (at: number, tag: number, type: number, count: number, val: number) => { v.setUint16(at, tag, true); v.setUint16(at + 2, type, true); v.setUint32(at + 4, count, true); v.setUint32(at + 8, val, true); };
  ent(28, 1, 2, 2, 0); tiff[36] = 0x53; // 'S'
  ent(40, 2, 5, 3, 80);
  ent(52, 3, 2, 2, 0); tiff[60] = 0x45; // 'E'
  ent(64, 4, 5, 3, 104);
  [[10, 1], [30, 1], [0, 1], [20, 1], [15, 1], [36, 1]].forEach(([n, d], i) => { v.setUint32(80 + i * 8, n!, true); v.setUint32(84 + i * 8, d!, true); });
  const len = 2 + 6 + tiff.length;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff, 0xff, 0xd9]);
}
const le = readJpegGps(leJpeg());
check('little-endian camera EXIF read', le && near(le.latitude, -10.5) && near(le.longitude, 20.26), true);

// Plantix latitude/longitude strings = Kotlin Double.toString().
check('Kotlin double string', [kotlinDoubleString(12.9716), kotlinDoubleString(77), kotlinDoubleString(-1.5)], ['12.9716', '77.0', '-1.5']);

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} exifGps test(s) failed`);
}
console.log(`exifGps: ${passed} assertions passed`);
