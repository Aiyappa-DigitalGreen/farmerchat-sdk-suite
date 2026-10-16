/**
 * Pins the static-API lifecycle (core/lifecycle.ts, Android FarmerChat.kt parity): re-initialize
 * with an equivalent config is a no-op while any of environment / mode / showDrawer / showHistory /
 * showSettings rebuilds; a host auth listener survives the rebuild and hears only the NEW instance;
 * shutdown clears the instance but keeps the listener; clearAllData removes every fc_sdk_ key
 * (appearance and tokens included) and nothing else, and flips auth to false.
 *
 * The real SessionManager cannot load under Node's strip-only TypeScript (parameter properties),
 * so the graph factory is a stand-in that keeps the real SessionStore over a localStorage shim and
 * mirrors SessionManager.clearLocalData exactly.
 *
 * RUNNER: none (see test/agentic.test.ts):
 *
 *     node --import ./test/ts-extension-hook.mjs test/lifecycle.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// localStorage shim BEFORE any SessionStore exists, so the store persists across instances and a
// non-SDK key can prove it survives the wipe.
const backing = new Map<string, string>();
const localStorageShim = {
  get length() {
    return backing.size;
  },
  key: (i: number) => Array.from(backing.keys())[i] ?? null,
  getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
  setItem: (k: string, v: string) => void backing.set(k, String(v)),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
};
(globalThis as unknown as { window: unknown }).window = { localStorage: localStorageShim };

const { createSdkLifecycle } = await import('../src/core/lifecycle.ts');
const { resolveConfig } = await import('../src/core/config.ts');
const { SessionStore, PrefKeys } = await import('../src/core/storage.ts');
type FarmerChatConfig = import('../src/core/config.ts').FarmerChatConfig;
type ResolvedConfig = import('../src/core/config.ts').ResolvedConfig;
type SessionStoreT = InstanceType<typeof SessionStore>;

class FakeSession {
  listeners = new Set<(a: boolean) => void>();
  store: SessionStoreT;
  constructor(store: SessionStoreT) {
    this.store = store;
  }
  onAuthStateChanged(l: (a: boolean) => void): () => void {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }
  emit(v: boolean): void {
    for (const l of this.listeners) l(v);
  }
  clearLocalData(): void {
    this.store.clearAll([]);
    this.emit(false);
  }
  pushed: Array<[string, string | undefined]> = [];
  updateTokens(accessToken: string, refreshToken?: string): void {
    this.pushed.push([accessToken, refreshToken]);
  }
  isAuthenticated(): boolean {
    return this.store.getBool(PrefKeys.OTP_VERIFIED, false);
  }
}

interface FakeServices {
  config: ResolvedConfig;
  session: FakeSession;
  store: SessionStoreT;
}

function newLifecycle() {
  let builds = 0;
  const lc = createSdkLifecycle<FakeServices>((c: FarmerChatConfig) => {
    builds++;
    const store = new SessionStore();
    return { config: resolveConfig(c), session: new FakeSession(store), store };
  });
  return { lc, builds: () => builds };
}

const base: FarmerChatConfig = { environment: 'stage', mode: 'FULL_JOURNEY' };

test('equivalent re-initialize keeps the instance; first config wins for other fields', () => {
  const { lc, builds } = newLifecycle();
  const a = lc.initialize(base);
  // A new object, different non-shape fields, and the mode-derived defaults spelled out.
  const b = lc.initialize({
    ...base,
    languageCode: 'hi',
    showDrawer: true,
    showHistory: true,
    showSettings: true,
  });
  assert.equal(b, a);
  assert.equal(builds(), 1);
  assert.equal(lc.currentConfig(), base);
  // CHAT_ONLY default: undefined mode and explicit CHAT_ONLY are the same shape.
  const { lc: lc2, builds: builds2 } = newLifecycle();
  lc2.initialize({ environment: 'demo' });
  lc2.initialize({ environment: 'demo', mode: 'CHAT_ONLY' });
  assert.equal(builds2(), 1);
});

test('each of the five shape fields forces a rebuild', () => {
  const variants: FarmerChatConfig[] = [
    { ...base, environment: 'demo' },
    { ...base, mode: 'CHAT_ONLY' },
    { ...base, showDrawer: false },
    { ...base, showHistory: false },
    { ...base, showSettings: false },
  ];
  for (const v of variants) {
    const { lc, builds } = newLifecycle();
    const a = lc.initialize(base);
    const b = lc.initialize(v);
    assert.notEqual(b, a, JSON.stringify(v));
    assert.equal(builds(), 2);
    assert.equal(lc.current(), b);
  }
});

test('a static auth listener survives a rebuild and hears only the new instance', () => {
  const { lc } = newLifecycle();
  const old = lc.initialize(base);
  const heard: boolean[] = [];
  lc.addAuthListener((v) => heard.push(v));
  old.session.emit(true);
  assert.deepEqual(heard, [true]);

  const next = lc.initialize({ ...base, mode: 'CHAT_ONLY' });
  assert.notEqual(next, old);
  old.session.emit(true); // torn down: unbound
  assert.deepEqual(heard, [true]);
  next.session.emit(true);
  assert.deepEqual(heard, [true, true]);
  lc.clearAllData();
  assert.deepEqual(heard, [true, true, false]);
});

test('shutdown clears the instance, keeps listeners, and is idempotent', () => {
  const { lc } = newLifecycle();
  const first = lc.initialize(base);
  const heard: boolean[] = [];
  const off = lc.addAuthListener((v) => heard.push(v));
  lc.shutdown();
  lc.shutdown();
  assert.equal(lc.current(), null);
  assert.equal(lc.currentConfig(), null);
  first.session.emit(true);
  assert.deepEqual(heard, []);
  // Same config after shutdown builds fresh and the kept listener binds to it.
  const again = lc.initialize(base);
  assert.notEqual(again, first);
  again.session.emit(true);
  assert.deepEqual(heard, [true]);
  off();
  again.session.emit(false);
  assert.deepEqual(heard, [true]);
});

test('clearAllData removes every fc_sdk_ key (appearance + tokens) and nothing else', () => {
  backing.clear();
  backing.set('host_app_key', 'keep-me');
  backing.set('fc_sdkish', 'not-our-namespace');
  const { lc } = newLifecycle();
  const s = lc.initialize(base);
  s.store.setString(PrefKeys.ACCESS_TOKEN, 'a');
  s.store.setString(PrefKeys.REFRESH_TOKEN, 'r');
  s.store.setString(PrefKeys.APPEARANCE_MODE, 'night');
  s.store.setBool(PrefKeys.OTP_VERIFIED, true);
  assert.equal(s.session.isAuthenticated(), true);
  const heard: boolean[] = [];
  lc.addAuthListener((v) => heard.push(v));

  lc.clearAllData();

  assert.deepEqual(
    Array.from(backing.keys()).filter((k) => k.startsWith('fc_sdk_')),
    [],
  );
  assert.equal(backing.get('host_app_key'), 'keep-me');
  assert.equal(backing.get('fc_sdkish'), 'not-our-namespace');
  assert.equal(s.session.isAuthenticated(), false);
  assert.deepEqual(heard, [false]);
  assert.equal(lc.current(), s, 'stays initialized');
});

test('clearAllData before initialize still wipes only the namespace', () => {
  backing.clear();
  backing.set('fc_sdk_farmer_chat_app_access_token', 'stale');
  backing.set('other', 'x');
  const { lc } = newLifecycle();
  lc.clearAllData();
  assert.deepEqual(Array.from(backing.keys()), ['other']);
  assert.equal(lc.current(), null);
});

test('equivalent re-init with a new accessToken pushes it once, without rebuilding', () => {
  const { lc, builds } = newLifecycle();
  const host: FarmerChatConfig = { ...base, authMode: 'HOST_TOKEN', accessToken: 't1', refreshToken: 'r1' };
  const s = lc.initialize(host);
  lc.initialize({ ...host }); // same token: nothing pushed
  assert.deepEqual(s.session.pushed, []);
  assert.equal(lc.initialize({ ...host, accessToken: 't2', refreshToken: 'r2' }), s);
  assert.deepEqual(s.session.pushed, [['t2', 'r2']]);
  lc.initialize({ ...host, accessToken: 't2', refreshToken: 'r2' }); // same new token again
  assert.deepEqual(s.session.pushed, [['t2', 'r2']]);
  assert.equal(lc.currentConfig()?.accessToken, 't2');
  assert.equal(builds(), 1);
});
