/**
 * What `update_user_location` (#7) tells the SDK about the farmer's place. Port of the app's
 * `LocationPromptHost` success branch (fc-compose-agentic `ui/location/LocationPromptHost.kt:524-543`)
 * over its response model `GetLocationResponse { user_profile: UserProfile }`
 * (`domain/model/location/GetLocationResponse.kt`): country name + code, state
 * (`geography_level2_name`), district (`geography_level3`), and the readable place name the
 * location bubble / pill shows — district, else state, else country.
 *
 * React-free so the Node test runner pins it (`test/locationProfile.test.ts`).
 */
import type { GetLocationResponse } from './types';

export interface LocationProfilePrefs {
  countryName: string;
  countryCode: string;
  state: string;
  district: string;
  /** district > state > country; '' when none. */
  place: string;
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Null when the response carries no `user_profile`. */
export function locationPrefsFromResponse(res: GetLocationResponse | null | undefined): LocationProfilePrefs | null {
  const p = res?.user_profile;
  if (!p || typeof p !== 'object') return null;
  const countryName = clean(p.country_name);
  const countryCode = clean(p.country_code);
  const state = clean(p.geography_level2_name);
  const district = clean(p.geography_level3);
  return { countryName, countryCode, state, district, place: district || state || countryName };
}
