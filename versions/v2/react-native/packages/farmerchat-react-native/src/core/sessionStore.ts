/**
 * SessionStore — namespaced persistence on AsyncStorage (prefix `fc_sdk_`),
 * replicating the app's TokenStore + PreferenceHelperManager key groups
 * (docs/02-api-reference.md §Session & persistence).
 *
 * Hydrated fully into memory at init so reads are synchronous; writes are
 * write-through to AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_PREFIX = 'fc_sdk_';

export const StorageKeys = {
  // --- token store ---
  ACCESS_TOKEN: 'farmer_chat_app_access_token',
  REFRESH_TOKEN: 'farmer_chat_app_refresh_token',
  USER_ID: 'logged_user_id_key',
  DEVICE_ID: 'your_android_device_id',

  // --- auth / session ---
  OTP_VERIFIED: 'OTP_VERIFIED',
  PHONE_NUMBER_LOGIN: 'PHONE_NUMBER_LOGIN',
  FIRST_LOGIN_DONE: 'FIRST_LOGIN_DONE',
  IS_PROFILE_LOADED: 'IS_PROFILE_LOADED',

  // --- onboarding steps ---
  LANGUAGE_DONE: 'LANGUAGE_DONE',
  KEY_NAME_DONE: 'KEY_NAME_DONE',
  KEY_NAME_SCREEN_SEEN: 'KEY_NAME_SCREEN_SEEN',
  USER_NAME_ADDED: 'USER_NAME_ADDED',
  BUILD_VERSION_API_CALLED: 'BUILD_VERSION_API_CALLED',
  TERMS_ACCEPTED: 'TERMS_ACCEPTED',

  // --- language / labels ---
  SELECTED_LANGUAGE_ID: 'SELECTED_LANGUAGE_ID',
  SELECTED_LANGUAGE_CODE: 'SELECTED_LANGUAGE_CODE',
  SELECTED_LANGUAGE_DISPLAY_NAME: 'SELECTED_LANGUAGE_DISPLAY_NAME',
  LANGUAGE_LABELS_JSON: 'LANGUAGE_LABELS_JSON',
  LANGUAGE_LABELS_LOADED: 'LANGUAGE_LABELS_LOADED',

  // --- profile ---
  USER_NAME: 'USER_NAME',
  USER_GENDER: 'USER_GENDER',

  // --- crops ---
  CULTIVATED_CROPS: 'CULTIVATED_CROPS',

  // --- location ---
  FARMER_APP_LATITUDE: 'FARMER_APP_LATITUDE',
  FARMER_APP_LONGITUDE: 'FARMER_APP_LONGITUDE',
  USER_COUNTRY_CODE: 'USER_COUNTRY_CODE',
  USER_COUNTRY_NAME: 'USER_COUNTRY_NAME',
  USER_STATE: 'USER_STATE',
  USER_DISTRICT: 'USER_DISTRICT',
  GPS_LOCATION_SHARED: 'GPS_LOCATION_SHARED',

  // --- chat ---
  NEW_CONVERSATION_ID: 'NEW_CONVERSATION_ID',
  LAST_BASE_URL: 'LAST_BASE_URL',
  FIRST_QUERY_ASKED: 'FIRST_QUERY_ASKED',
  CACHED_HOME_FEED_RESPONSE: 'CACHED_HOME_FEED_RESPONSE',

  // --- permissions ---
  /**
   * Location permission deny count — the app's `PreferenceKeys.PERMISSION_DENY_COUNT`
   * (fc-compose-agentic `core/preference/PreferenceKeys.kt:49`, read/written by
   * `LocationPromptPrefs`); docs/02 "permissions deny/attempt counts" group. Value follows this
   * store's constant-name convention, like the camera/mic counts below.
   */
  PERMISSION_DENY_COUNT: 'PERMISSION_DENY_COUNT',
  CAMERA_PERMISSION_DENY_COUNT: 'CAMERA_PERMISSION_DENY_COUNT',
  MIC_PERMISSION_DENY_COUNT: 'MIC_PERMISSION_DENY_COUNT',
  CAMERA_PERMISSION_ATTEMPT_COUNT: 'CAMERA_PERMISSION_ATTEMPT_COUNT',
  MIC_PERMISSION_ATTEMPT_COUNT: 'MIC_PERMISSION_ATTEMPT_COUNT',

  // --- UI ---
  APPEARANCE_MODE: 'APPEARANCE_MODE',
  FONT_SIZE: 'FONT_SIZE',

  // --- UTM ---
  UTM_SOURCE: 'UTM_SOURCE',
  UTM_MEDIUM: 'UTM_MEDIUM',
  UTM_CAMPAIGN: 'UTM_CAMPAIGN',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

type Listener = () => void;

export class SessionStore {
  private cache = new Map<string, string>();
  private hydrated = false;
  private listeners = new Set<Listener>();

  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    const allKeys = await AsyncStorage.getAllKeys();
    const ours = allKeys.filter((k) => k.startsWith(STORAGE_PREFIX));
    if (ours.length > 0) {
      const pairs = await AsyncStorage.multiGet(ours);
      for (const [k, v] of pairs) {
        if (v !== null) this.cache.set(k.slice(STORAGE_PREFIX.length), v);
      }
    }
    this.hydrated = true;
    this.emit();
  }

  get isHydrated(): boolean {
    return this.hydrated;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const l of Array.from(this.listeners)) l();
  }

  // --- typed accessors -----------------------------------------------------

  getString(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  getBoolean(key: string, defaultValue = false): boolean {
    const v = this.cache.get(key);
    if (v === undefined) return defaultValue;
    return v === 'true';
  }

  getInt(key: string, defaultValue = 0): number {
    const v = this.cache.get(key);
    if (v === undefined) return defaultValue;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? defaultValue : n;
  }

  getDouble(key: string): number | null {
    const v = this.cache.get(key);
    if (v === undefined) return null;
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }

  getJson<T>(key: string): T | null {
    const v = this.cache.get(key);
    if (v === undefined) return null;
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }

  set(key: string, value: string | number | boolean | null): void {
    if (value === null) {
      this.remove(key);
      return;
    }
    const str = String(value);
    this.cache.set(key, str);
    this.emit();
    void AsyncStorage.setItem(STORAGE_PREFIX + key, str).catch(() => undefined);
  }

  setJson(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  }

  remove(key: string): void {
    this.cache.delete(key);
    this.emit();
    void AsyncStorage.removeItem(STORAGE_PREFIX + key).catch(() => undefined);
  }

  // --- token store (clear() removes only tokens, like the app) -------------

  get accessToken(): string | null {
    return this.getString(StorageKeys.ACCESS_TOKEN);
  }

  get refreshToken(): string | null {
    return this.getString(StorageKeys.REFRESH_TOKEN);
  }

  get userId(): string | null {
    return this.getString(StorageKeys.USER_ID);
  }

  saveTokens(accessToken: string, refreshToken: string | null): void {
    this.set(StorageKeys.ACCESS_TOKEN, accessToken);
    if (refreshToken !== null) this.set(StorageKeys.REFRESH_TOKEN, refreshToken);
  }

  saveUserId(userId: string): void {
    this.set(StorageKeys.USER_ID, userId);
  }

  /** TokenStore.clear() — removes only tokens. */
  clearTokens(): void {
    this.remove(StorageKeys.ACCESS_TOKEN);
    this.remove(StorageKeys.REFRESH_TOKEN);
  }

  /** Stable per-install device id (generated once, persisted). */
  getOrCreateDeviceId(): string {
    let id = this.getString(StorageKeys.DEVICE_ID);
    if (!id) {
      id =
        'fcrn-' +
        Date.now().toString(36) +
        '-' +
        Math.random().toString(36).slice(2, 12);
      this.set(StorageKeys.DEVICE_ID, id);
    }
    return id;
  }

  /**
   * Logout clear — clears everything except appearance mode
   * (app: prefClearAll preserving appearance) and the device id.
   */
  async clearAllPreservingAppearance(): Promise<void> {
    const appearance = this.getString(StorageKeys.APPEARANCE_MODE);
    const deviceId = this.getString(StorageKeys.DEVICE_ID);
    const keys = Array.from(this.cache.keys()).map((k) => STORAGE_PREFIX + k);
    this.cache.clear();
    if (appearance !== null) {
      this.cache.set(StorageKeys.APPEARANCE_MODE, appearance);
    }
    if (deviceId !== null) {
      this.cache.set(StorageKeys.DEVICE_ID, deviceId);
    }
    this.emit();
    try {
      if (keys.length > 0) await AsyncStorage.multiRemove(keys);
      if (appearance !== null) {
        await AsyncStorage.setItem(
          STORAGE_PREFIX + StorageKeys.APPEARANCE_MODE,
          appearance,
        );
      }
      if (deviceId !== null) {
        await AsyncStorage.setItem(
          STORAGE_PREFIX + StorageKeys.DEVICE_ID,
          deviceId,
        );
      }
    } catch {
      // storage failures are non-fatal; in-memory state is authoritative
    }
  }
}
