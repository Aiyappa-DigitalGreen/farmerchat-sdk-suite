/**
 * GPS in JPEG EXIF, without a dependency. Port of the GPS half of the app's
 * `ImageUtils.addGpsToImageAndConvertToBase64` (fc-compose-agentic `utils/ImageUtils.kt`):
 *
 * - `readJpegGps` ≈ `readGpsFromImage` (:47-90): the picked file's own GPSLatitude/Ref +
 *   GPSLongitude/Ref, as decimal degrees (`convertFromExifFormat`, :314-340).
 * - `insertGpsExif` ≈ the `ExifInterface(...).apply { setAttribute(TAG_GPS_LATITUDE …) ;
 *   saveAttributes() }` block (:213-231) on the re-encoded JPEG: an APP1 "Exif" segment right
 *   after SOI holding IFD0 → GPS IFD with exactly the four tags the app sets
 *   (GPSLatitudeRef, GPSLatitude, GPSLongitudeRef, GPSLongitude), big-endian (ExifInterface's
 *   default byte order for a file that had no EXIF).
 * - `toExifDms` = `convertToExifFormat` (:303-309): "d/1,m/1,(s*1000).toInt()/1000".
 *
 * Pure byte functions (no DOM), so the Node test runner pins them.
 */

export interface GpsFix {
  latitude: number;
  longitude: number;
}

/** `convertToExifFormat`: [[deg,1],[min,1],[trunc(sec*1000),1000]] of |value|. */
export function toExifDms(value: number): Array<[number, number]> {
  const abs = Math.abs(value);
  const degrees = Math.trunc(abs);
  const minutes = Math.trunc((abs - degrees) * 60);
  const seconds = (abs - degrees - minutes / 60.0) * 3600;
  return [
    [degrees, 1],
    [minutes, 1],
    [Math.trunc(seconds * 1000), 1000],
  ];
}

const TAG_GPS_IFD = 0x8825;
const TAG_LAT_REF = 0x0001;
const TAG_LAT = 0x0002;
const TAG_LON_REF = 0x0003;
const TAG_LON = 0x0004;
const TYPE_ASCII = 2;
const TYPE_LONG = 4;
const TYPE_RATIONAL = 5;

/** The APP1 payload ("Exif\0\0" + big-endian TIFF) carrying the four GPS tags. */
export function buildGpsExifPayload(fix: GpsFix): Uint8Array {
  // TIFF layout (offsets from the TIFF header):
  //   0  "MM" 002A 00000008
  //   8  IFD0: 1 entry (GPSInfo → 26), next 0                    = 18 bytes
  //  26  GPS IFD: 4 entries, next 0                               = 54 bytes
  //  80  GPSLatitude  3 × RATIONAL                                = 24 bytes
  // 104  GPSLongitude 3 × RATIONAL                                = 24 bytes
  const tiffLength = 128;
  const out = new Uint8Array(6 + tiffLength);
  out.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 0); // "Exif\0\0"
  const v = new DataView(out.buffer, 6);
  v.setUint16(0, 0x4d4d); // "MM"
  v.setUint16(2, 0x002a);
  v.setUint32(4, 8);
  // IFD0
  v.setUint16(8, 1);
  entry(v, 10, TAG_GPS_IFD, TYPE_LONG, 1, 26);
  v.setUint32(22, 0);
  // GPS IFD
  v.setUint16(26, 4);
  asciiEntry(v, 28, TAG_LAT_REF, fix.latitude >= 0 ? 'N' : 'S');
  entry(v, 40, TAG_LAT, TYPE_RATIONAL, 3, 80);
  asciiEntry(v, 52, TAG_LON_REF, fix.longitude >= 0 ? 'E' : 'W');
  entry(v, 64, TAG_LON, TYPE_RATIONAL, 3, 104);
  v.setUint32(76, 0);
  writeRationals(v, 80, toExifDms(fix.latitude));
  writeRationals(v, 104, toExifDms(fix.longitude));
  return out;
}

function entry(v: DataView, at: number, tag: number, type: number, count: number, value: number): void {
  v.setUint16(at, tag);
  v.setUint16(at + 2, type);
  v.setUint32(at + 4, count);
  v.setUint32(at + 8, value);
}

function asciiEntry(v: DataView, at: number, tag: number, ch: 'N' | 'S' | 'E' | 'W'): void {
  v.setUint16(at, tag);
  v.setUint16(at + 2, TYPE_ASCII);
  v.setUint32(at + 4, 2); // the letter + NUL, stored inline
  v.setUint8(at + 8, ch.charCodeAt(0));
  v.setUint8(at + 9, 0);
  v.setUint16(at + 10, 0);
}

function writeRationals(v: DataView, at: number, values: Array<[number, number]>): void {
  values.forEach(([num, den], i) => {
    v.setUint32(at + i * 8, num);
    v.setUint32(at + i * 8 + 4, den);
  });
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

/** Index of the first APP1 "Exif" segment's payload, or -1. */
function findExifPayload(bytes: Uint8Array): { start: number; length: number; segStart: number } | null {
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1]!;
    if (marker === 0xda || marker === 0xd9) break; // start of scan / end of image
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (len < 2) break;
    if (
      marker === 0xe1 &&
      len >= 8 &&
      bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78 && bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66 &&
      bytes[i + 8] === 0 && bytes[i + 9] === 0
    ) {
      return { start: i + 10, length: len - 8, segStart: i };
    }
    i += 2 + len;
  }
  return null;
}

/**
 * Returns [jpeg] with an APP1 EXIF GPS segment right after SOI. An existing EXIF APP1 is dropped
 * (the re-encoded canvas JPEG never has one; ExifInterface likewise rewrites the segment).
 * Non-JPEG input is returned unchanged.
 */
export function insertGpsExif(jpeg: Uint8Array, fix: GpsFix): Uint8Array {
  if (!isJpeg(jpeg)) return jpeg;
  let body = jpeg.subarray(2);
  const existing = findExifPayload(jpeg);
  if (existing) {
    const segEnd = existing.start + existing.length;
    body = concat(jpeg.subarray(2, existing.segStart), jpeg.subarray(segEnd));
  }
  const payload = buildGpsExifPayload(fix);
  const segLen = payload.length + 2;
  const app1 = new Uint8Array(4 + payload.length);
  app1.set([0xff, 0xe1, (segLen >> 8) & 0xff, segLen & 0xff], 0);
  app1.set(payload, 4);
  return concat(new Uint8Array([0xff, 0xd8]), app1, body);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** `readGpsFromImage` + `convertFromExifFormat`: the file's own GPS fix, or null. */
export function readJpegGps(bytes: Uint8Array): GpsFix | null {
  if (!isJpeg(bytes)) return null;
  const exif = findExifPayload(bytes);
  if (!exif || exif.length < 8) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset + exif.start, exif.length);
  const order = v.getUint16(0);
  const le = order === 0x4949;
  if (!le && order !== 0x4d4d) return null;
  const u16 = (o: number) => v.getUint16(o, le);
  const u32 = (o: number) => v.getUint32(o, le);
  try {
    const ifd0 = u32(4);
    const n0 = u16(ifd0);
    let gpsOffset = -1;
    for (let k = 0; k < n0; k++) {
      const e = ifd0 + 2 + k * 12;
      if (u16(e) === TAG_GPS_IFD) gpsOffset = u32(e + 8);
    }
    if (gpsOffset < 0) return null;
    const n = u16(gpsOffset);
    let latRef = 'N';
    let lonRef = 'E';
    let lat: number | null = null;
    let lon: number | null = null;
    const dms = (off: number) => {
      const r = (i: number) => {
        const den = u32(off + i * 8 + 4);
        return den === 0 ? NaN : u32(off + i * 8) / den;
      };
      return r(0) + r(1) / 60 + r(2) / 3600;
    };
    for (let k = 0; k < n; k++) {
      const e = gpsOffset + 2 + k * 12;
      const tag = u16(e);
      if (tag === TAG_LAT_REF) latRef = String.fromCharCode(v.getUint8(e + 8));
      else if (tag === TAG_LON_REF) lonRef = String.fromCharCode(v.getUint8(e + 8));
      else if (tag === TAG_LAT && u16(e + 2) === TYPE_RATIONAL) lat = dms(u32(e + 8));
      else if (tag === TAG_LON && u16(e + 2) === TYPE_RATIONAL) lon = dms(u32(e + 8));
    }
    if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      latitude: latRef === 'S' ? -lat : lat,
      longitude: lonRef === 'W' ? -lon : lon,
    };
  } catch {
    return null; // truncated / malformed EXIF: treat as "no GPS", like the app's catch.
  }
}
