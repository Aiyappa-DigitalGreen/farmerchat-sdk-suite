/**
 * Namespaced session/preference store on localStorage.
 * All keys are prefixed `fc_sdk_` so the SDK never collides with the host app
 * (docs/03-sdk-architecture.md principle 5). Falls back to in-memory storage
 * when localStorage is unavailable (private mode / sandboxed iframes).
 */

const PREFIX = 'fc_sdk_';

/** Preference keys — mirrors the app's pref groups (docs/02 "Session & persistence"). */
export const PrefKeys = {
  // TokenStore
  ACCESS_TOKEN: 'farmer_chat_app_access_token',
  REFRESH_TOKEN: 'farmer_chat_app_refresh_token',
  USER_ID: 'logged_user_id_key',
  DEVICE_ID: 'your_android_device_id',
  // auth/session
  OTP_VERIFIED: 'OTP_VERIFIED',
  PHONE_NUMBER_LOGIN: 'PHONE_NUMBER_LOGIN',
  FIRST_LOGIN_DONE: 'FIRST_LOGIN_DONE',
  // onboarding steps
  LANGUAGE_DONE: 'LANGUAGE_DONE',
  KEY_NAME_DONE: 'KEY_NAME_DONE',
  KEY_NAME_SCREEN_SEEN: 'KEY_NAME_SCREEN_SEEN',
  USER_NAME: 'USER_NAME',
  USER_NAME_ADDED: 'USER_NAME_ADDED',
  ACCEPT_TERMS_DONE: 'ACCEPT_TERMS_DONE',
  BUILD_VERSION_API_CALLED: 'BUILD_VERSION_API_CALLED',
  // language
  SELECTED_LANGUAGE_ID: 'SELECTED_LANGUAGE_ID',
  SELECTED_LANGUAGE_CODE: 'SELECTED_LANGUAGE_CODE',
  SELECTED_LANGUAGE_DISPLAY_NAME: 'SELECTED_LANGUAGE_DISPLAY_NAME',
  LANGUAGE_LABELS: 'LANGUAGE_LABELS',
  LANGUAGE_LABELS_LOADED: 'LANGUAGE_LABELS_LOADED',
  // location
  FARMER_APP_LATITUDE: 'FARMER_APP_LATITUDE',
  FARMER_APP_LONGITUDE: 'FARMER_APP_LONGITUDE',
  USER_COUNTRY_CODE: 'USER_COUNTRY_CODE',
  USER_COUNTRY_NAME: 'USER_COUNTRY_NAME',
  USER_STATE: 'USER_STATE',
  USER_DISTRICT: 'USER_DISTRICT',
  GPS_LOCATION_SHARED: 'GPS_LOCATION_SHARED',
  // chat
  NEW_CONVERSATION_ID: 'NEW_CONVERSATION_ID',
  LAST_BASE_URL: 'LAST_BASE_URL',
  FIRST_QUERY_ASKED: 'FIRST_QUERY_ASKED',
  CACHED_HOME_FEED_RESPONSE: 'CACHED_HOME_FEED_RESPONSE',
  // permissions (web keeps deny/attempt counters for parity)
  MIC_PERMISSION_DENY_COUNT: 'MIC_PERMISSION_DENY_COUNT',
  CAMERA_PERMISSION_DENY_COUNT: 'CAMERA_PERMISSION_DENY_COUNT',
  // ui
  APPEARANCE_MODE: 'APPEARANCE_MODE',
  FONT_SIZE: 'FONT_SIZE',
} as const;

export type PrefKey = (typeof PrefKeys)[keyof typeof PrefKeys];

interface BackingStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

function createLocalStorageBacking(): BackingStore | null {
  try {
    const ls = window.localStorage;
    const probe = `${PREFIX}__probe__`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      getItem: (k) => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
      removeItem: (k) => ls.removeItem(k),
      keys: () => {
        const out: string[] = [];
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k !== null) out.push(k);
        }
        return out;
      },
    };
  } catch {
    return null;
  }
}

function createMemoryBacking(): BackingStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    keys: () => Array.from(map.keys()),
  };
}

export class SessionStore {
  private backing: BackingStore;
  private listeners = new Set<(key: string) => void>();

  constructor() {
    this.backing = (typeof window !== 'undefined' && createLocalStorageBacking()) || createMemoryBacking();
  }

  getString(key: string): string | null {
    return this.backing.getItem(PREFIX + key);
  }

  setString(key: string, value: string): void {
    this.backing.setItem(PREFIX + key, value);
    this.notify(key);
  }

  getBool(key: string, def = false): boolean {
    const v = this.getString(key);
    return v === null ? def : v === 'true';
  }

  setBool(key: string, value: boolean): void {
    this.setString(key, value ? 'true' : 'false');
  }

  getInt(key: string): number | null {
    const v = this.getString(key);
    if (v === null) return null;
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }

  setInt(key: string, value: number): void {
    this.setString(key, String(value));
  }

  getJson<T>(key: string): T | null {
    const v = this.getString(key);
    if (v === null) return null;
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }

  setJson(key: string, value: unknown): void {
    this.setString(key, JSON.stringify(value));
  }

  remove(key: string): void {
    this.backing.removeItem(PREFIX + key);
    this.notify(key);
  }

  /** Clears every fc_sdk_ key, preserving the given keys (logout preserves appearance). */
  clearAll(preserve: string[] = []): void {
    const preserved = new Map<string, string>();
    for (const key of preserve) {
      const v = this.getString(key);
      if (v !== null) preserved.set(key, v);
    }
    for (const raw of this.backing.keys()) {
      if (raw.startsWith(PREFIX)) this.backing.removeItem(raw);
    }
    for (const [key, v] of preserved) this.backing.setItem(PREFIX + key, v);
    this.notify('*');
  }

  /** Clears only the token keys (mirrors TokenStore.clear()). */
  clearTokens(): void {
    this.remove(PrefKeys.ACCESS_TOKEN);
    this.remove(PrefKeys.REFRESH_TOKEN);
  }

  onChange(listener: (key: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(key: string): void {
    for (const l of this.listeners) {
      try {
        l(key);
      } catch {
        // listener errors never break storage
      }
    }
  }
}
