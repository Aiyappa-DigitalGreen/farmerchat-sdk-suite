/**
 * Photo-upload downscale — app ImageUtils.kt:198-207 + 256-286: fit within 1000x1000 keeping the
 * aspect ratio (never enlarge; sizes truncated like Kotlin `toInt()`), then JPEG quality 80.
 *
 * Needs the OPTIONAL peer `expo-image-manipulator` (native module `ExpoImageManipulator`, looked up
 * without importing its package — see optionalPeers.ts). Absent, or on any failure: the picker's
 * JPEG (already quality 80) is used unchanged, with one console.warn.
 */
import { optionalExpoNativeModule, warnOnce } from './optionalPeers';

/** ImageUtils.kt `resizeBitmap(…, 1000, 1000)`; null when no resize is needed. */
export function fitWithin(
  width: number,
  height: number,
  max = 1000,
): { width: number; height: number } | null {
  if (!(width > 0 && height > 0)) return null;
  if (width <= max && height <= max) return null;
  const scale = Math.min(max / width, max / height);
  return { width: Math.trunc(width * scale), height: Math.trunc(height * scale) };
}

type SaveOptions = { format?: string; compress?: number; base64?: boolean };
type SavedImage = { uri: string; width: number; height: number; base64?: string };

/** `ExpoImageManipulator`: the v13+ contextual API, or v12's `manipulateAsync`. */
interface ImageManipulatorModule {
  manipulate?(uri: string): {
    resize(size: { width?: number | null; height?: number | null }): unknown;
    renderAsync(): Promise<{ saveAsync(o: SaveOptions): Promise<SavedImage>; release?(): void }>;
    release?(): void;
  };
  manipulateAsync?(
    uri: string,
    actions: Array<{ resize: { width?: number; height?: number } }>,
    saveOptions: SaveOptions,
  ): Promise<SavedImage>;
}

/** App JPEG quality 80. */
const JPEG_80: SaveOptions = { format: 'jpeg', compress: 0.8, base64: true };

/**
 * Returns the base64 to upload: the picked photo shrunk to fit 1000x1000 at JPEG 80 when it is
 * larger and the manipulator is installed; otherwise `base64` unchanged.
 */
export async function shrinkForUpload(image: {
  uri: string;
  base64: string;
  width?: number | null;
  height?: number | null;
}): Promise<{ base64: string; width?: number; height?: number; resized: boolean }> {
  const target = fitWithin(image.width ?? 0, image.height ?? 0);
  if (!target) return { base64: image.base64, resized: false };
  const mod = optionalExpoNativeModule<ImageManipulatorModule>('ExpoImageManipulator');
  if (!mod || (!mod.manipulate && !mod.manipulateAsync)) {
    warnOnce(
      'image-manipulator',
      '[FarmerChat] expo-image-manipulator is not installed — photos are uploaded without the 1000x1000 downscale.',
    );
    return { base64: image.base64, resized: false };
  }
  try {
    let saved: SavedImage;
    if (mod.manipulate) {
      const context = mod.manipulate(image.uri);
      context.resize(target);
      const rendered = await context.renderAsync();
      saved = await rendered.saveAsync(JPEG_80);
      rendered.release?.();
      context.release?.();
    } else {
      saved = await (mod.manipulateAsync as NonNullable<ImageManipulatorModule['manipulateAsync']>)(
        image.uri,
        [{ resize: target }],
        JPEG_80,
      );
    }
    if (!saved.base64) return { base64: image.base64, resized: false };
    return { base64: saved.base64, width: saved.width, height: saved.height, resized: true };
  } catch {
    return { base64: image.base64, resized: false };
  }
}
