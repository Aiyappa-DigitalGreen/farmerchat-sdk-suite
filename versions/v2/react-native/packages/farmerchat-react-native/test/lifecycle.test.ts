/**
 * Pins the 2026-10-13 lifecycle API (android `FarmerChat` parity): re-initialize no-op vs
 * rebuild, static auth listeners surviving a rebuild, `shutdown()`, `clearAllData()`, and the
 * `debugLogging` path-only log line.
 *
 * Loads the real `FarmerChat.ts` service graph, so it needs the native-module stubs + the
 * transpiling load hook in `native-stubs-hook.mjs`:
 *
 *     node --import ./test/ts-extension-hook.mjs --import ./test/native-stubs-hook.mjs test/lifecycle.test.ts
 */
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { FarmerChat } from '../src/FarmerChat.ts';
import { logPath } from '../src/core/httpClient.ts';
// Plain .mjs in-memory AsyncStorage stub (see native-stubs-hook.mjs).
import { __data } from './stubs/async-storage.mjs';

const storage = __data as Map<string, string>;

beforeEach(() => {
  FarmerChat.shutdown();
  storage.clear();
});

test('re-initialize with the same shape is a no-op; a different mode rebuilds', async () => {
  FarmerChat.initialize({ environment: 'dev' });
  const first = FarmerChat.getInstance();
  await first.ready();

  // Only non-shape fields differ (and mode resolves to the same CHAT_ONLY default) → same instance.
  FarmerChat.initialize({ environment: 'dev', mode: 'CHAT_ONLY', enableVoice: false });
  assert.equal(FarmerChat.getInstance(), first);
  assert.equal(FarmerChat.getInstance().config.enableVoice, true, 'first config wins');

  FarmerChat.initialize({ environment: 'dev', mode: 'FULL_JOURNEY' });
  assert.notEqual(FarmerChat.getInstance(), first);
  assert.equal(FarmerChat.getInstance().config.mode, 'FULL_JOURNEY');

  FarmerChat.initialize({ environment: 'stage', mode: 'FULL_JOURNEY' });
  assert.equal(FarmerChat.getInstance().config.environment, 'stage');
});

test('a rebuild before hydration finishes leaves the old instance inert', async () => {
  FarmerChat.initialize({ environment: 'dev' });
  FarmerChat.initialize({ environment: 'stage' });
  await FarmerChat.getInstance().ready();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(storage.get('fc_sdk_LAST_BASE_URL'), 'https://demo.agent.farmer.chat/');
});

test('an equivalent re-initialize pushes a changed host token once, without rebuilding', async () => {
  const cfg = { environment: 'dev' as const, authMode: 'HOST_TOKEN' as const };
  FarmerChat.initialize({ ...cfg, accessToken: 'tok-1', refreshToken: 'ref-1' });
  const sdk = FarmerChat.getInstance();
  await sdk.ready();
  assert.equal(sdk.store.accessToken, 'tok-1');

  const pushes: string[] = [];
  const update = sdk.session.updateTokens.bind(sdk.session);
  sdk.session.updateTokens = (a: string, r?: string) => {
    pushes.push(a);
    update(a, r);
  };

  FarmerChat.initialize({ ...cfg, accessToken: 'tok-2', refreshToken: 'ref-2' });
  await sdk.ready();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(FarmerChat.getInstance(), sdk, 'no rebuild');
  assert.deepEqual(pushes, ['tok-2']);
  assert.equal(sdk.store.accessToken, 'tok-2');
  assert.equal(sdk.store.refreshToken, 'ref-2');

  FarmerChat.initialize({ ...cfg, accessToken: 'tok-2', refreshToken: 'ref-2' });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(pushes, ['tok-2'], 'identical repeat is not re-pushed');
});

test('a static auth listener survives a rebuild and fires exactly once', async () => {
  FarmerChat.initialize({ environment: 'dev' });
  const seen: boolean[] = [];
  const off = FarmerChat.onAuthStateChanged((a) => seen.push(a));
  const old = FarmerChat.getInstance();
  FarmerChat.initialize({ environment: 'dev', mode: 'FULL_JOURNEY' });
  await FarmerChat.getInstance().ready();
  // The torn-down instance must no longer reach host listeners.
  await old.session.clearAllData();
  assert.deepEqual(seen, [], 'old instance is unbound');
  await FarmerChat.clearAllData();
  assert.deepEqual(seen, [false], 'the new instance reaches the same static listener');
  off();
  await FarmerChat.clearAllData();
  assert.deepEqual(seen, [false], 'unsubscribed');
});

test('shutdown makes isInitialized false, is idempotent, and keeps persisted data', async () => {
  FarmerChat.shutdown(); // safe before initialize
  FarmerChat.initialize({ environment: 'dev' });
  await FarmerChat.getInstance().ready();
  assert.equal(FarmerChat.isInitialized, true);
  FarmerChat.shutdown();
  FarmerChat.shutdown();
  assert.equal(FarmerChat.isInitialized, false);
  assert.throws(() => FarmerChat.getInstance(), /Not initialized/);
  assert.throws(() => FarmerChat.isAuthenticated(), /Not initialized/);
  assert.equal(storage.get('fc_sdk_LAST_BASE_URL'), 'https://farmerchat.farmstack.co/mobile-app-dev/');
});

test('listeners registered before shutdown re-bind on the next initialize', async () => {
  FarmerChat.initialize({ environment: 'dev' });
  const seen: boolean[] = [];
  const off = FarmerChat.addAuthStateListener((a) => seen.push(a));
  FarmerChat.shutdown();
  FarmerChat.initialize({ environment: 'dev' });
  await FarmerChat.clearAllData();
  assert.deepEqual(seen, [false]);
  off();
});

test('clearAllData removes only fc_sdk_ keys, flips auth to false, stays initialized', async () => {
  storage.set('fc_sdk_OTP_VERIFIED', 'true');
  storage.set('fc_sdk_farmer_chat_app_access_token', 'tok');
  storage.set('fc_sdk_APPEARANCE_MODE', 'night');
  storage.set('host_app_key', 'keep-me');
  FarmerChat.initialize({ environment: 'dev' });
  await FarmerChat.getInstance().ready();
  assert.equal(FarmerChat.isAuthenticated(), true);
  // Written after hydrate, so it is in storage but not in the store's cache.
  storage.set('fc_sdk_NOT_HYDRATED', 'x');

  const seen: boolean[] = [];
  const off = FarmerChat.addAuthStateListener((a) => seen.push(a));
  await FarmerChat.clearAllData();

  assert.deepEqual(Array.from(storage.keys()), ['host_app_key']);
  assert.equal(FarmerChat.isAuthenticated(), false);
  assert.equal(FarmerChat.isInitialized, true);
  assert.deepEqual(seen, [false]);
  off();
});

test('clearAllData before initialize wipes storage only', async () => {
  storage.set('fc_sdk_USER_NAME', 'a');
  storage.set('other', 'b');
  await FarmerChat.clearAllData();
  assert.deepEqual(Array.from(storage.keys()), ['other']);
  assert.equal(FarmerChat.isInitialized, false);
});

test('debug log path drops host, query and fragment', () => {
  assert.equal(
    logPath('https://farmerchat.farmstack.co/mobile-app-dev/api/chat/x/?user_id=1#f'),
    '/mobile-app-dev/api/chat/x/',
  );
  assert.equal(logPath('https://www.googleapis.com/geolocation/v1/geolocate?key=SECRET'), '/geolocation/v1/geolocate');
});

test('debugLogging defaults off and is the only gate on HttpClient output', async () => {
  const lines: string[] = [];
  const origDebug = console.debug;
  const origFetch = globalThis.fetch;
  console.debug = (...a: unknown[]) => void lines.push(a.join(' '));
  globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch;
  try {
    FarmerChat.initialize({ environment: 'dev' });
    await FarmerChat.getInstance().http.request({ method: 'GET', path: 'api/a/?q=1', apiName: 'a' });
    assert.deepEqual(lines, []);

    FarmerChat.shutdown();
    FarmerChat.initialize({ environment: 'dev', debugLogging: true });
    await FarmerChat.getInstance().http.request({ method: 'GET', path: 'api/a/?q=1', apiName: 'a' });
    assert.equal(lines.length, 1);
    assert.match(lines[0] ?? '', /^\[FarmerChat\] GET \/mobile-app-dev\/api\/a\/ -> 200 \(\d+ms\) rid=\S+$/);
  } finally {
    console.debug = origDebug;
    globalThis.fetch = origFetch;
  }
});
