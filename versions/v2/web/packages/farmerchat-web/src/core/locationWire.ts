import type { UpdateLocationRequest } from './types';

/**
 * `update_user_location` body with `lat`/`long` as the strings the app sends
 * (`UpdateLocationRequest(lat: String?, long: String?)`), as the Android SDK does; every other field
 * unchanged. Numbers made DEMO fail the weather question re-sent after a GPS share (2026-10-16).
 */
export function toLocationWire(
  body: UpdateLocationRequest,
): Omit<UpdateLocationRequest, 'lat' | 'long'> & { lat?: string | null; long?: string | null } {
  const str = (v: number | null | undefined) => (v === null || v === undefined ? v : String(v));
  return { ...body, lat: str(body.lat), long: str(body.long) };
}
