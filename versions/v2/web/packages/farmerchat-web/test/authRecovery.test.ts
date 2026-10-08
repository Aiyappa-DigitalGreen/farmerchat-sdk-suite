/**
 * The 401 recovery chain (docs/02 "TokenAuthenticator", Steps 1–3), with `fetch` stubbed.
 *
 * Step 3 (guest re-initialisation) is the one under guard: a GUEST whose identity the backend
 * rejects (send_tokens 400 "User not found or inactive.") must get a fresh `initialize_user`
 * instead of looping 401 → 400 forever — but a phone-verified user must never be replaced, and a
 * network failure must never discard a guest.
 *
 * HttpClient uses constructor parameter properties, which Node's strip-only TypeScript mode cannot
 * run, so this file is bundled first:
 *
 *     ../../widget/node_modules/.bin/esbuild test/authRecovery.test.ts --bundle --platform=node \
 *       --format=esm --outfile=/tmp/authRecovery.mjs && node --test /tmp/authRecovery.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpClient } from '../src/core/http';
import { SessionStore, PrefKeys } from '../src/core/storage';
import { LabelManager } from '../src/core/labels';

type Route = (body: Record<string, unknown>, headers: Record<string, string>) => { status: number; json?: unknown } | 'network';

function setup(routes: Record<string, Route>, seed: (s: SessionStore) => void) {
  const store = new SessionStore();
  for (const k of [PrefKeys.ACCESS_TOKEN, PrefKeys.REFRESH_TOKEN, PrefKeys.USER_ID, PrefKeys.OTP_VERIFIED, PrefKeys.NEW_CONVERSATION_ID]) store.remove(k);
  seed(store);
  const calls: string[] = [];
  const bearers: string[] = [];
  (globalThis as { fetch: unknown }).fetch = async (url: string, init: { headers: Record<string, string>; body?: string }) => {
    const path = url.replace('https://api.test/', '').split('?')[0];
    calls.push(path);
    if (init.headers['Authorization']) bearers.push(`${path}:${init.headers['Authorization']}`);
    const route = routes[path];
    const out = route ? route(init.body ? JSON.parse(init.body) : {}, init.headers) : { status: 404 };
    if (out === 'network') throw new TypeError('fetch failed');
    return new Response(out.json !== undefined ? JSON.stringify(out.json) : '', { status: out.status });
  };
  let expired = 0;
  const http = new HttpClient({
    baseUrl: 'https://api.test/',
    guestApiKey: 'guest-key',
    store,
    labels: new LabelManager(store),
    onSessionExpired: () => {
      expired += 1;
    },
  });
  return { http, store, calls, bearers, expired: () => expired };
}

/** The protected call: 401 for the stale token, 200 for the recovered one. */
const feed: Route = (_b, h) => (h['Authorization'] === 'Bearer new-access' ? { status: 200, json: { sections: [] } } : { status: 401, json: { code: 'token_not_valid' } });

test('guest rejected by send_tokens (400) is re-initialised and the request retried', async () => {
  let initBody: Record<string, unknown> = {};
  let initKey = '';
  const t = setup(
    {
      'api/images/v2/daily/': feed,
      'api/user/send_tokens/': () => ({ status: 400, json: { detail: 'User not found or inactive.' } }),
      'api/user/initialize_user/': (b, h) => {
        initBody = b;
        initKey = h['API-Key'];
        return { status: 201, json: { access_token: 'new-access', refresh_token: 'new-refresh', user_id: 'new-user' } };
      },
    },
    (s) => {
      s.setString(PrefKeys.ACCESS_TOKEN, 'stale');
      s.setString(PrefKeys.USER_ID, 'mock-user-1');
      s.setString(PrefKeys.NEW_CONVERSATION_ID, 'old-conversation');
      s.setString(PrefKeys.FARMER_APP_LATITUDE, '12.97');
      s.setString(PrefKeys.FARMER_APP_LONGITUDE, '77.59');
    },
  );
  const res = await t.http.request<{ sections: unknown[] }>({ method: 'GET', path: 'api/images/v2/daily/' });
  assert.equal(res.ok, true);
  assert.deepEqual(t.calls, ['api/images/v2/daily/', 'api/user/send_tokens/', 'api/user/initialize_user/', 'api/images/v2/daily/']);
  assert.equal(initKey, 'guest-key');
  assert.equal(initBody.lat, 12.97);
  assert.equal(initBody.long, 77.59);
  assert.ok(typeof initBody.device_id === 'string' && (initBody.device_id as string).length > 0);
  assert.equal(t.store.getString(PrefKeys.ACCESS_TOKEN), 'new-access');
  assert.equal(t.store.getString(PrefKeys.REFRESH_TOKEN), 'new-refresh');
  assert.equal(t.store.getString(PrefKeys.USER_ID), 'new-user');
  assert.equal(t.store.getString(PrefKeys.NEW_CONVERSATION_ID), null);
  assert.equal(t.expired(), 0);
});

test('a phone-verified user is never replaced: send_tokens 400 ends in session expired', async () => {
  const t = setup(
    {
      'api/images/v2/daily/': feed,
      'api/user/send_tokens/': () => ({ status: 400, json: { detail: 'User not found or inactive.' } }),
      'api/user/initialize_user/': () => ({ status: 201, json: { access_token: 'new-access', user_id: 'new-user' } }),
    },
    (s) => {
      s.setString(PrefKeys.ACCESS_TOKEN, 'stale');
      s.setString(PrefKeys.USER_ID, 'farmer-1');
      s.setBool(PrefKeys.OTP_VERIFIED, true);
    },
  );
  const res = await t.http.request({ method: 'GET', path: 'api/images/v2/daily/' });
  assert.equal(res.ok, false);
  assert.ok(!t.calls.includes('api/user/initialize_user/'));
  assert.equal(t.store.getString(PrefKeys.USER_ID), 'farmer-1');
  assert.equal(t.expired(), 1);
});

test('a network failure on send_tokens never discards the guest', async () => {
  const t = setup(
    {
      'api/images/v2/daily/': feed,
      'api/user/send_tokens/': () => 'network',
      'api/user/initialize_user/': () => ({ status: 201, json: { access_token: 'new-access', user_id: 'new-user' } }),
    },
    (s) => {
      s.setString(PrefKeys.ACCESS_TOKEN, 'stale');
      s.setString(PrefKeys.USER_ID, 'guest-1');
    },
  );
  const res = await t.http.request({ method: 'GET', path: 'api/images/v2/daily/' });
  assert.equal(res.ok, false);
  assert.ok(!t.calls.includes('api/user/initialize_user/'));
  assert.equal(t.store.getString(PrefKeys.USER_ID), 'guest-1');
});

test('the refresh token still wins first: Step 3 does not run when Step 1 succeeds', async () => {
  const t = setup(
    {
      'api/images/v2/daily/': feed,
      'api/user/get_new_access_token/': () => ({ status: 200, json: { access_token: 'new-access', refresh_token: 'r2' } }),
      'api/user/initialize_user/': () => ({ status: 201, json: { access_token: 'other', user_id: 'other' } }),
    },
    (s) => {
      s.setString(PrefKeys.ACCESS_TOKEN, 'stale');
      s.setString(PrefKeys.REFRESH_TOKEN, 'r1');
      s.setString(PrefKeys.USER_ID, 'guest-1');
    },
  );
  const res = await t.http.request({ method: 'GET', path: 'api/images/v2/daily/' });
  assert.equal(res.ok, true);
  assert.deepEqual(t.calls, ['api/images/v2/daily/', 'api/user/get_new_access_token/', 'api/images/v2/daily/']);
  assert.equal(t.store.getString(PrefKeys.USER_ID), 'guest-1');
});
