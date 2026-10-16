/**
 * Photo preparation for both photo send paths. Port of the app's
 * `ImageUtils.addGpsToImageAndConvertToBase64` (fc-compose-agentic `utils/ImageUtils.kt:161-298`):
 * decode, scale DOWN to fit 1000×1000 (never up, aspect kept), re-encode as JPEG at quality 80,
 * base64 without a data-URL prefix (Android `Base64.NO_WRAP`).
 *
 * GPS, as the app (ImageUtils.kt:169-231): the fix is the picked file's own EXIF GPS, else the
 * device's current location — fetched only when location permission is ALREADY granted (no
 * prompt), 5 s timeout, balanced accuracy. When there is a fix it is written into the re-encoded
 * JPEG's EXIF (`./exifGps`) and returned for the Plantix request; with none, no EXIF is written.
 */
import { insertGpsExif, readJpegGps, type GpsFix } from './exifGps';

/** App resize box (ImageUtils.kt:194, `resizeBitmap(originalBitmap, 1000, 1000)`). */
export const UPLOAD_MAX_DIMENSION = 1000;
/** App JPEG quality (ImageUtils.kt:207, `compressBitmapToBase64(resizedBitmap, 80)`). */
export const UPLOAD_JPEG_QUALITY = 0.8;

/**
 * Port of `ImageUtils.resizeBitmap` (ImageUtils.kt:262-285): unchanged when it already fits,
 * else scaled by min(maxW/w, maxH/h) with each side truncated like Kotlin's `toInt()`.
 */
export function fitWithin(width: number, height: number, maxWidth = UPLOAD_MAX_DIMENSION, maxHeight = UPLOAD_MAX_DIMENSION): { width: number; height: number } {
  if (width <= maxWidth && height <= maxHeight) return { width, height };
  // Kotlin computes in Float (32-bit): `maxWidth.toFloat() / originalWidth`, then
  // `(originalWidth * scale).toInt()`. Math.fround reproduces that rounding, so a 3001 px side
  // lands on 1000 like the app, not 999 as plain doubles would give.
  const f = Math.fround;
  const scale = Math.min(f(maxWidth / width), f(maxHeight / height));
  return { width: Math.trunc(f(width * scale)), height: Math.trunc(f(height * scale)) };
}

/** Kotlin `Double.toString()` for ordinary coordinates: a whole number keeps its ".0". */
export function kotlinDoubleString(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

/** `image_<uuid>.jpg` — the app's `image_name` (ChatViewModel.kt:1866-1867). */
export function uploadImageName(uuid: string): string {
  return `image_${uuid}.jpg`;
}

function randomUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // RFC 4122 v4 from getRandomValues / Math.random for old browsers.
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function blobToBase64NoPrefix(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const s = String(reader.result ?? '');
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.readAsDataURL(blob);
  });
}

export interface PreparedImage {
  base64: string;
  imageName: string;
  width: number;
  height: number;
  /** The GPS fix written into the EXIF (also sent as Plantix latitude/longitude), or null. */
  gps: GpsFix | null;
}

/**
 * `fetchCurrentLocation` (ImageUtils.kt:92-140): skip unless permission is already granted
 * (the app checks ACCESS_FINE/COARSE and never asks), then one fix within [timeoutMs].
 */
export async function currentLocationIfGranted(timeoutMs = 5000): Promise<GpsFix | null> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (!nav?.geolocation || !nav.permissions?.query) return null;
  try {
    const status = await nav.permissions.query({ name: 'geolocation' as PermissionName });
    if (status.state !== 'granted') return null;
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    nav.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: timeoutMs },
    );
  });
}

/**
 * Resize + JPEG-encode [blob] like the app. Null when the image cannot be decoded (the app then
 * shows "Failed to process image", ChatViewModel.kt:1842-1856).
 */
export async function prepareImageForUpload(
  blob: Blob,
  currentLocation: () => Promise<GpsFix | null> = currentLocationIfGranted,
): Promise<PreparedImage | null> {
  let gps: GpsFix | null = null;
  try {
    gps = readJpegGps(new Uint8Array(await blob.arrayBuffer()));
  } catch {
    gps = null;
  }
  if (!gps) gps = await currentLocation();
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // JPEG has no alpha: paint white first so a transparent PNG does not turn black.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', UPLOAD_JPEG_QUALITY));
    if (!jpeg) return null;
    const finalJpeg = gps ? new Blob([insertGpsExif(new Uint8Array(await jpeg.arrayBuffer()), gps) as BlobPart], { type: 'image/jpeg' }) : jpeg;
    return { base64: await blobToBase64NoPrefix(finalJpeg), imageName: uploadImageName(randomUuid()), ...size, gps };
  } finally {
    bitmap.close();
  }
}
