/**
 * Photo upload EXIF — the part of the app's `utils/ImageUtils.addGpsToImageAndConvertToBase64`
 * (ImageUtils.kt:155-252) that React Native can do without a new native module:
 *
 *  - read the photo's own GPS (from expo-image-picker's `exif`), {@link gpsFromPickerExif};
 *  - write a GPS-only EXIF into the JPEG, {@link writeGpsExif}. The app re-encodes the bitmap
 *    (which drops every original EXIF tag) and then sets GPSLatitude/Ref + GPSLongitude/Ref with
 *    ExifInterface, so its upload carries only GPS. Here the original Exif APP1 is likewise removed
 *    and a GPS-only one inserted (or none, when there is no location).
 *
 * The 1000x1000 downscale (ImageUtils.kt:198-199) runs before this, in imageShrink.ts.
 *
 * Pure TypeScript: no React, no native modules. The base64 is rewritten only in its header bytes;
 * the image data after them is spliced in as base64 text, never decoded.
 */

/** Signed decimal degrees, as the app's ExifInterface `latLong`. */
export interface GpsPoint {
  latitude: number;
  longitude: number;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * GPS of the picked photo from expo-image-picker's `exif` (`exif: true`). Android reports
 * `GPSLatitude` / `GPSLongitude` as signed decimals (ExifInterface `latLong`); iOS nests them in
 * `{GPS}` with N/S/E/W refs. Null when the photo has no location.
 */
export function gpsFromPickerExif(exif: Record<string, unknown> | null | undefined): GpsPoint | null {
  if (!exif) return null;
  const lat = exif.GPSLatitude;
  const lng = exif.GPSLongitude;
  if (isFiniteNumber(lat) && isFiniteNumber(lng) && !(lat === 0 && lng === 0)) {
    const latRef = String(exif.GPSLatitudeRef ?? '');
    const lngRef = String(exif.GPSLongitudeRef ?? '');
    return {
      latitude: latRef === 'S' && lat > 0 ? -lat : lat,
      longitude: lngRef === 'W' && lng > 0 ? -lng : lng,
    };
  }
  const gps = exif['{GPS}'] as Record<string, unknown> | undefined;
  if (gps && isFiniteNumber(gps.Latitude) && isFiniteNumber(gps.Longitude)) {
    return {
      latitude: gps.LatitudeRef === 'S' ? -Math.abs(gps.Latitude) : gps.Latitude,
      longitude: gps.LongitudeRef === 'W' ? -Math.abs(gps.Longitude) : gps.Longitude,
    };
  }
  return null;
}

/**
 * The app's `convertToExifFormat` (ImageUtils.kt:303-309): `deg/1, min/1, (sec*1000)/1000` from
 * the absolute value, as [numerator, denominator] pairs.
 */
export function toExifDms(value: number): Array<[number, number]> {
  const abs = Math.abs(value);
  const degrees = Math.trunc(abs);
  const minutes = Math.trunc((abs - degrees) * 60);
  const seconds = (abs - degrees - minutes / 60) * 3600;
  return [
    [degrees, 1],
    [minutes, 1],
    [Math.trunc(seconds * 1000), 1000],
  ];
}

// --- base64 (own codec: atob/btoa are not on every RN runtime) ------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX: Record<string, number> = Object.fromEntries(
  B64.split('').map((c, i) => [c, i]),
);

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_INDEX[clean[i] ?? 'A'] ?? 0;
    const b = B64_INDEX[clean[i + 1] ?? 'A'] ?? 0;
    const c = B64_INDEX[clean[i + 2] ?? 'A'];
    const d = B64_INDEX[clean[i + 3] ?? 'A'];
    out[o++] = (a << 2) | (b >> 4);
    if (c !== undefined && i + 2 < clean.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d !== undefined && i + 3 < clean.length) out[o++] = ((c ?? 0) & 3) << 6 | d;
  }
  return out.subarray(0, o);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : B64[c & 63];
  }
  return out;
}

// --- EXIF APP1 (big-endian TIFF, IFD0 -> GPS IFD) ---------------------------------------------

/** An APP1 "Exif" segment holding only GPSLatitudeRef/GPSLatitude/GPSLongitudeRef/GPSLongitude. */
export function gpsExifSegment(point: GpsPoint): Uint8Array {
  const tiff: number[] = [];
  const u16 = (v: number) => tiff.push((v >> 8) & 0xff, v & 0xff);
  const u32 = (v: number) => tiff.push((v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
  // Header: "MM", 42, IFD0 at 8.
  tiff.push(0x4d, 0x4d);
  u16(42);
  u32(8);
  // IFD0: one entry (GPSInfo -> GPS IFD at 26), next IFD 0.
  const gpsIfd = 8 + 2 + 12 + 4;
  u16(1);
  u16(0x8825);
  u16(4); // LONG
  u32(1);
  u32(gpsIfd);
  u32(0);
  // GPS IFD: 4 entries, rationals after it.
  const dataStart = gpsIfd + 2 + 4 * 12 + 4;
  const latRef = point.latitude >= 0 ? 0x4e : 0x53; // N / S
  const lngRef = point.longitude >= 0 ? 0x45 : 0x57; // E / W
  u16(4);
  u16(0x0001); // GPSLatitudeRef, ASCII, 2, inline "N\0"
  u16(2);
  u32(2);
  tiff.push(latRef, 0, 0, 0);
  u16(0x0002); // GPSLatitude, RATIONAL x3
  u16(5);
  u32(3);
  u32(dataStart);
  u16(0x0003); // GPSLongitudeRef
  u16(2);
  u32(2);
  tiff.push(lngRef, 0, 0, 0);
  u16(0x0004); // GPSLongitude
  u16(5);
  u32(3);
  u32(dataStart + 24);
  u32(0);
  for (const [n, d] of [...toExifDms(point.latitude), ...toExifDms(point.longitude)]) {
    u32(n);
    u32(d);
  }
  const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]; // "Exif\0\0" + TIFF
  const length = payload.length + 2;
  return Uint8Array.from([0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...payload]);
}

/** A COM (comment) segment of exactly `size` bytes (>= 4), used only as alignment padding. */
function commentSegment(size: number): Uint8Array {
  const length = size - 2;
  const seg = new Uint8Array(size);
  seg[0] = 0xff;
  seg[1] = 0xfe;
  seg[2] = (length >> 8) & 0xff;
  seg[3] = length & 0xff;
  return seg;
}

const isExifApp1 = (bytes: Uint8Array, at: number): boolean =>
  bytes[at + 4] === 0x45 && bytes[at + 5] === 0x78 && bytes[at + 6] === 0x69 && bytes[at + 7] === 0x66;

/**
 * Returns the JPEG (base64, NO_WRAP) with any Exif APP1 removed and, when `point` is given, a
 * GPS-only Exif APP1 inserted right after SOI. Non-JPEG input, or a header too long to rewrite,
 * comes back unchanged.
 *
 * Only the leading segments are decoded. The rewritten head is padded (with a COM segment) to a
 * multiple of 3 bytes so the untouched remainder of the original base64 can be appended as-is.
 */
export function writeGpsExif(base64: string, point: GpsPoint | null): string {
  const HEAD_CHARS = 96 * 1024; // up to ~72 KB of header segments (an Exif APP1 is <= 64 KB)
  const head = base64ToBytes(base64.slice(0, Math.min(base64.length, HEAD_CHARS)));
  if (head[0] !== 0xff || head[1] !== 0xd8) return base64;

  // Walk the APPn / COM segments that follow SOI.
  const kept: Uint8Array[] = [];
  let at = 2;
  let sawExif = false;
  while (at + 4 <= head.length && head[at] === 0xff) {
    const marker = head[at + 1] ?? 0;
    const isAppOrCom = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!isAppOrCom) break;
    const len = ((head[at + 2] ?? 0) << 8) | (head[at + 3] ?? 0);
    const end = at + 2 + len;
    if (end > head.length) return base64; // header longer than we decoded: leave it alone
    if (marker === 0xe1 && isExifApp1(head, at)) sawExif = true;
    else kept.push(head.subarray(at, end));
    at = end;
  }
  if (!sawExif && point === null) return base64;

  // Cut the original at the first 3-byte boundary at/after the walked segments.
  const cut = Math.ceil(at / 3) * 3;
  if (cut > head.length) return base64;
  const rest = head.subarray(at, cut);
  const parts: Uint8Array[] = [Uint8Array.from([0xff, 0xd8])];
  if (point) parts.push(gpsExifSegment(point));
  parts.push(...kept);
  // Pad to a multiple of 3 with a COM segment (5 bytes for residue 1, 4 for residue 2).
  const residue = (parts.reduce((n, p) => n + p.length, 0) + rest.length) % 3;
  if (residue === 1) parts.push(commentSegment(5));
  else if (residue === 2) parts.push(commentSegment(4));
  parts.push(rest);
  const merged = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    merged.set(p, o);
    o += p.length;
  }
  return bytesToBase64(merged) + base64.slice((cut / 3) * 4);
}
