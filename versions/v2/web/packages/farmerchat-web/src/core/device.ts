/**
 * Device identity + Device-Info header payload.
 * The app sends `Device-Info: <url-encoded JSON device config>` on every request
 * (docs/02 "Interceptor chain" step 5). On web the payload is derived from
 * navigator/userAgent data.
 */

import { SessionStore, PrefKeys } from './storage';

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Stable per-browser device id, persisted under the fc_sdk_ namespace. */
export function getOrCreateDeviceId(store: SessionStore): string {
  let id = store.getString(PrefKeys.DEVICE_ID);
  if (!id) {
    id = generateUuid();
    store.setString(PrefKeys.DEVICE_ID, id);
  }
  return id;
}

export interface DeviceInfo {
  platform: string;
  os: string;
  os_version: string;
  browser: string;
  browser_version: string;
  user_agent: string;
  screen_width: number;
  screen_height: number;
  device_language: string;
  timezone: string;
  sdk: string;
}

function detectBrowser(ua: string): { browser: string; version: string } {
  const rules: Array<[string, RegExp]> = [
    ['Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Opera', /(?:OPR|Opera)\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/],
    ['Firefox', /Firefox\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];
  for (const [name, re] of rules) {
    const m = ua.match(re);
    if (m) return { browser: name, version: m[1] ?? '' };
  }
  return { browser: 'Unknown', version: '' };
}

function detectOs(ua: string): { os: string; version: string } {
  const rules: Array<[string, RegExp]> = [
    ['Android', /Android ([\d.]+)/],
    ['iOS', /OS ([\d_]+) like Mac OS X/],
    ['Windows', /Windows NT ([\d.]+)/],
    ['macOS', /Mac OS X ([\d_.]+)/],
    ['Linux', /Linux/],
    ['ChromeOS', /CrOS/],
  ];
  for (const [name, re] of rules) {
    const m = ua.match(re);
    if (m) return { os: name, version: (m[1] ?? '').replace(/_/g, '.') };
  }
  return { os: 'Unknown', version: '' };
}

export function collectDeviceInfo(): DeviceInfo {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const ua = nav?.userAgent ?? '';
  const { browser, version: browserVersion } = detectBrowser(ua);
  const { os, version: osVersion } = detectOs(ua);
  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    timezone = '';
  }
  return {
    platform: 'web',
    os,
    os_version: osVersion,
    browser,
    browser_version: browserVersion,
    user_agent: ua,
    screen_width: typeof screen !== 'undefined' ? screen.width : 0,
    screen_height: typeof screen !== 'undefined' ? screen.height : 0,
    device_language: nav?.language ?? 'en',
    timezone,
    sdk: 'farmerchat-web',
  };
}

/** URL-encoded JSON payload for the Device-Info header. */
export function deviceInfoHeaderValue(): string {
  return encodeURIComponent(JSON.stringify(collectDeviceInfo()));
}
