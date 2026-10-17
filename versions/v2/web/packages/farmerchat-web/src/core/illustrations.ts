/**
 * The country farmer illustrations (`farmer_looking_at_*`, app CountryImageAssets /
 * rememberCountryFarmerPainter), served from `config.assetBaseUrl` on the web.
 */

export type FarmerImage = 'camera' | 'sky' | 'phone' | 'phone_square';

const FARMER_IMAGES: readonly FarmerImage[] = ['camera', 'sky', 'phone', 'phone_square'];

/** Country folder for the farmer illustrations: ke/et/ng/in, else ke (rememberCountryFarmerPainter). */
export function farmerCountry(countryCode: string | null | undefined): string {
  const cc = (countryCode ?? '').toLowerCase();
  return ['ke', 'et', 'ng', 'in'].includes(cc) ? cc : 'ke';
}

/** src → in-memory object URL of an illustration already downloaded (see prefetchFarmerIllustrations). */
export const illustrationBlobs = new Map<string, string>();

/**
 * The app bundles its farmer illustrations, so the No-internet screen always shows one. The web
 * serves them from `assetBaseUrl`, which an offline browser cannot reach — the No-internet screen
 * would show an empty box. Download the country's four images while online and keep them as
 * object URLs. A host that serves them without CORS still gets an HTTP-cache warm-up via Image().
 */
export function prefetchFarmerIllustrations(
  base: string | undefined,
  countryCode: string | null | undefined,
  fetchImpl: typeof fetch | undefined = typeof fetch === 'undefined' ? undefined : fetch,
): void {
  if (!base || !fetchImpl) return;
  const country = farmerCountry(countryCode);
  for (const image of FARMER_IMAGES) {
    const src = `${base}${country}/farmer_looking_at_${image}.webp`;
    if (illustrationBlobs.has(src)) continue;
    illustrationBlobs.set(src, src); // in flight: never fetched twice
    fetchImpl(src)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => illustrationBlobs.set(src, URL.createObjectURL(b)))
      .catch(() => {
        illustrationBlobs.delete(src);
        try {
          if (typeof Image !== 'undefined') new Image().src = src;
        } catch {
          // no Image() (non-DOM host): nothing to warm
        }
      });
  }
}

/** The downloaded copy of an illustration when there is one, else its URL. */
export function illustrationSrc(src: string): string {
  return illustrationBlobs.get(src) ?? src;
}
