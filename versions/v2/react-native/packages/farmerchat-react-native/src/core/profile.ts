/**
 * Profile + location-response helpers (React-free; pinned by test/profile.test.ts).
 */
import type { GetLocationResponse } from './types';

/**
 * App `UserProfile.displayName()` (ui/profile/data/model/view/UserProfile.kt:44-52): first + last,
 * each dropped when blank / "No Name" / "null" (any case), joined with one space.
 */
export function profileDisplayName(
  u: { first_name?: string | null; last_name?: string | null } | null | undefined,
): string {
  const part = (v: string | null | undefined): string => {
    const t = (v ?? '').trim();
    return /^(no name|null)$/i.test(t) ? '' : t;
  };
  return [part(u?.first_name), part(u?.last_name)].filter((x) => x.length > 0).join(' ').trim();
}

/** What `update_user_location` (#11) says about the farmer's place. */
export interface LocationProfilePrefs {
  countryName: string;
  countryCode: string;
  /** `geography_level2_name`. */
  state: string;
  /** `geography_level3`. */
  district: string;
  /** district > state > country (the app's APPROX_LOCATION_NAME); '' when none. */
  place: string;
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * App `LocationPromptHost` success branch (ui/location/LocationPromptHost.kt:524-543) over
 * `GetLocationResponse { user_profile }` (domain/model/location/GetLocationResponse.kt). Null when
 * the response carries no `user_profile` (then nothing is stored, as in the app).
 */
export function locationPrefsFromResponse(
  res: GetLocationResponse | null | undefined,
): LocationProfilePrefs | null {
  const p = res?.user_profile;
  if (!p || typeof p !== 'object') return null;
  const countryName = clean(p.country_name);
  const countryCode = clean(p.country_code);
  const state = clean(p.geography_level2_name);
  const district = clean(p.geography_level3);
  return { countryName, countryCode, state, district, place: district || state || countryName };
}
