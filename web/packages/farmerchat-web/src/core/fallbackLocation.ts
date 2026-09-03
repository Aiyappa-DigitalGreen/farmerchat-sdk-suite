/**
 * The location to use when neither guest init nor IP geolocation resolved one.
 *
 * Port of the Android SDK's `OnboardingSharedViewModel.resolveFallbackCoordinates()` and the
 * country fallback chain around it, which in turn mirror the app's
 * `CountryLatLngProvider.getLatLngFromDeviceLocale(context)`.
 *
 * There is deliberately NO hardcoded city here. A previous build defaulted to one Indian city's
 * coordinates with an invented country and state, so every guest the backend could not place —
 * anywhere on earth — was seeded with that one region and got that region's advice. The exact
 * coordinates are pinned as a regression fixture in `test/countryLatLng.test.ts`, not here.
 */

import { LAST_RESORT_COUNTRY_CODE } from './config';
import type { ResolvedConfig } from './config';
import { fromDeviceLocale, isResolved } from './countryLatLng';

/** A candidate location. `lat`/`lng` are (0, 0) when nothing resolved — see {@link isResolved}. */
export interface FallbackLocation {
  countryCode: string;
  lat: number;
  lng: number;
}

/** The three `ResolvedConfig` knobs this module reads, all "unset → derive" by default. */
export type FallbackConfig = Pick<
  ResolvedConfig,
  'defaultCountryCode' | 'defaultLatitude' | 'defaultLongitude'
>;

/**
 * Order: the host's explicit config override, then the DEVICE LOCALE's country centroid.
 *
 * Returns (code, 0, 0) when neither is available, which callers MUST treat as "no location" —
 * (0, 0) is a real point in the Gulf of Guinea, so sending it is a wrong answer, not a missing
 * one. Guard every use with `isResolved(lat, lng)`.
 *
 * Web-specific: a browser language such as plain `en` carries no region, so the locale branch
 * legitimately yields `''` and (0, 0). A language is never guessed into a country.
 */
export function resolveFallbackCoordinates(
  config: FallbackConfig,
  /** The device locale's region + centroid. Injectable so the region-less case is testable. */
  locale: FallbackLocation = fromDeviceLocale(),
): FallbackLocation {
  if (isResolved(config.defaultLatitude, config.defaultLongitude)) {
    return {
      countryCode: config.defaultCountryCode,
      lat: config.defaultLatitude,
      lng: config.defaultLongitude,
    };
  }
  return { countryCode: locale.countryCode, lat: locale.lat, lng: locale.lng };
}

/**
 * The endpoint #2 `country_code`, which may never be blank (HTTP 400,
 * `{"error": "Country code is required"}` — verified live 2026-09-03 on prod).
 *
 * Chain: server `country_code` → persisted → host config (when non-blank) → device-locale region
 * → {@link LAST_RESORT_COUNTRY_CODE}.
 */
export function resolveCountryCode(
  serverCountryCode: string | null | undefined,
  persistedCountryCode: string | null | undefined,
  configuredCountryCode: string,
  /** The device locale's region (`''` when the browser language carries none). Injectable so the
   *  last-resort branch is testable on a machine whose own locale does carry a region. */
  localeRegion: string = fromDeviceLocale().countryCode,
): string {
  return (
    serverCountryCode?.trim() ||
    persistedCountryCode?.trim() ||
    configuredCountryCode.trim() ||
    localeRegion ||
    LAST_RESORT_COUNTRY_CODE
  );
}

/** Re-exported so callers guard on the same predicate the fallback was built with. */
export { isResolved };
