/**
 * Pins the 2026-10-09 defaults: CHAT_ONLY is the default mode, `showDrawer` follows the mode
 * unless the host sets it, the bundled `farmerChatApiKey` / `geoApiKey` apply when the host
 * passes nothing or blank, CHAT_ONLY routes straight to chat without the language screen, and
 * each CHAT_ONLY journey start drops the stored conversation id (a new conversation per journey).
 *
 * RUNNER: none (see test/agentic.test.ts):
 *
 *     node --import ./test/ts-extension-hook.mjs test/chatOnlyDefaults.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FARMERCHAT_API_KEY,
  DEFAULT_GEO_API_KEY,
  resolveConfig,
} from '../src/core/config';
import { computeRouteFromSplash } from '../src/ui/router';
import { PrefKeys, SessionStore } from '../src/core/storage';
import { beginChatOnlyJourney } from '../src/core/chatOnlyBootstrap';

test('mode defaults to CHAT_ONLY and showDrawer then resolves to false', () => {
  const c = resolveConfig({ environment: 'prod' });
  assert.equal(c.mode, 'CHAT_ONLY');
  assert.equal(c.showDrawer, false);
  assert.equal(c.showHistory, true);
});

test('FULL_JOURNEY resolves showDrawer to true', () => {
  const c = resolveConfig({ environment: 'prod', mode: 'FULL_JOURNEY' });
  assert.equal(c.mode, 'FULL_JOURNEY');
  assert.equal(c.showDrawer, true);
});

test('an explicit showDrawer wins over the mode', () => {
  assert.equal(resolveConfig({ environment: 'prod', showDrawer: true }).showDrawer, true);
  assert.equal(
    resolveConfig({ environment: 'prod', mode: 'FULL_JOURNEY', showDrawer: false }).showDrawer,
    false,
  );
});

test('unset or blank keys fall back to the bundled defaults; a host value overrides', () => {
  assert.ok(DEFAULT_FARMERCHAT_API_KEY.length > 0);
  assert.ok(DEFAULT_GEO_API_KEY.length > 0);
  const unset = resolveConfig({ environment: 'prod' });
  assert.equal(unset.farmerChatApiKey, DEFAULT_FARMERCHAT_API_KEY);
  assert.equal(unset.geoApiKey, DEFAULT_GEO_API_KEY);
  const blank = resolveConfig({ environment: 'prod', farmerChatApiKey: '  ', geoApiKey: '' });
  assert.equal(blank.farmerChatApiKey, DEFAULT_FARMERCHAT_API_KEY);
  assert.equal(blank.geoApiKey, DEFAULT_GEO_API_KEY);
  const custom = resolveConfig({ environment: 'prod', farmerChatApiKey: 'host-key', geoApiKey: 'host-geo' });
  assert.equal(custom.farmerChatApiKey, 'host-key');
  assert.equal(custom.geoApiKey, 'host-geo');
});

test('CHAT_ONLY with no language chosen lands in chat, FULL_JOURNEY on the language screen', () => {
  const store = new SessionStore();
  assert.deepEqual(computeRouteFromSplash(store, null, 'CHAT_ONLY'), {
    name: 'chat',
    params: { source: 'home' },
  });
  assert.deepEqual(computeRouteFromSplash(store, null, 'FULL_JOURNEY'), { name: 'language' });
});

test('a CHAT_ONLY journey start clears the stored conversation unless opening a history chat', () => {
  const store = new SessionStore();
  store.setString(PrefKeys.NEW_CONVERSATION_ID, 'conv-old');
  beginChatOnlyJourney(store, null);
  assert.equal(store.getString(PrefKeys.NEW_CONVERSATION_ID), null);

  store.setString(PrefKeys.NEW_CONVERSATION_ID, 'conv-old');
  beginChatOnlyJourney(store, { type: 'chatQuery', question: 'q', source: 'deeplink' });
  assert.equal(store.getString(PrefKeys.NEW_CONVERSATION_ID), null);

  store.setString(PrefKeys.NEW_CONVERSATION_ID, 'conv-old');
  beginChatOnlyJourney(store, { type: 'chat', chatId: 'conv-history' });
  assert.equal(store.getString(PrefKeys.NEW_CONVERSATION_ID), 'conv-old');
});
