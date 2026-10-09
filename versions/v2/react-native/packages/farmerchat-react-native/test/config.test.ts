/**
 * Pins the 2026-10-09 config defaults: CHAT_ONLY by default, `showDrawer` following the mode
 * unless set, and the built-in FarmerChat API key + Google Geolocation key (blank → default).
 *
 *     node --import ./test/ts-extension-hook.mjs test/config.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_FARMERCHAT_API_KEY,
  DEFAULT_GEO_API_KEY,
  resolveConfig,
} from '../src/core/config.ts';

const base = { environment: 'dev' as const };

test('mode defaults to CHAT_ONLY with no drawer', () => {
  const c = resolveConfig(base);
  assert.equal(c.mode, 'CHAT_ONLY');
  assert.equal(c.showDrawer, false);
  assert.equal(c.showHistory, true);
});

test('FULL_JOURNEY resolves showDrawer to true when unset', () => {
  assert.equal(resolveConfig({ ...base, mode: 'FULL_JOURNEY' }).showDrawer, true);
});

test('an explicit showDrawer wins in both modes', () => {
  assert.equal(resolveConfig({ ...base, showDrawer: true }).showDrawer, true);
  assert.equal(resolveConfig({ ...base, mode: 'FULL_JOURNEY', showDrawer: false }).showDrawer, false);
});

test('omitted or blank keys fall back to the built-in defaults', () => {
  assert.ok(DEFAULT_FARMERCHAT_API_KEY.length > 0);
  assert.ok(DEFAULT_GEO_API_KEY.length > 0);
  for (const v of [undefined, '', '   ']) {
    const c = resolveConfig({ ...base, farmerChatApiKey: v, geoApiKey: v });
    assert.equal(c.farmerChatApiKey, DEFAULT_FARMERCHAT_API_KEY);
    assert.equal(c.geoApiKey, DEFAULT_GEO_API_KEY);
  }
  const o = resolveConfig({ ...base, farmerChatApiKey: 'host-fc', geoApiKey: 'host-geo' });
  assert.equal(o.farmerChatApiKey, 'host-fc');
  assert.equal(o.geoApiKey, 'host-geo');
});

test('the geo default is the same value the Android SDK ships', () => {
  const kt = readFileSync(
    '../../../android/farmerchat-core/src/main/java/org/digitalgreen/farmerchat/sdk/core/remote/ApiConstants.kt',
    'utf8',
  );
  const m = /DEFAULT_GEO_API_KEY\s*=\s*"([^"]+)"/.exec(kt);
  assert.ok(m, 'ApiConstants.DEFAULT_GEO_API_KEY not found');
  assert.ok(m[1] === DEFAULT_GEO_API_KEY, 'RN DEFAULT_GEO_API_KEY drifted from Android');
});

test('CHAT_ONLY splash runs the headless bootstrap', () => {
  const src = readFileSync('src/ui/screens/SplashScreen.tsx', 'utf8');
  assert.ok(src.includes('sdk.ensureChatOnlySession()'));
});

test('CHAT_ONLY splash starts a fresh conversation before the bootstrap', () => {
  const src = readFileSync('src/ui/screens/SplashScreen.tsx', 'utf8');
  const begin = src.indexOf('sdk.beginChatOnlyJourney()');
  assert.ok(begin > 0 && begin < src.indexOf('sdk.ensureChatOnlySession()'));
  const sdk = readFileSync('src/core/sdk.ts', 'utf8');
  assert.match(sdk, /pendingTarget\?\.kind !== 'chat'\)\s*\{\s*this\.store\.remove\(StorageKeys\.NEW_CONVERSATION_ID\)/);
});

test('CHAT_ONLY first launch shows the language screen once, then the chat', () => {
  // Decision: !LANGUAGE_DONE && no host languageCode/locale → Language; otherwise Chat.
  const sdk = readFileSync('src/core/sdk.ts', 'utf8');
  assert.match(
    sdk,
    /get chatOnlyNeedsLanguageScreen\(\): boolean \{\s*return !this\.store\.getBoolean\(StorageKeys\.LANGUAGE_DONE\) && !this\.hostLanguageConfigured;/,
  );
  assert.match(sdk, /this\.config\.locale\?\.trim\(\) \|\| this\.config\.languageCode\?\.trim\(\)/);
  // The Language check is the first thing in the CHAT_ONLY branch, before the pending target is
  // consumed (so the target survives the screen), and the screen's callback re-runs the decision.
  const nav = readFileSync('src/ui/navigation/AppNavigator.ts', 'utf8');
  const branch = nav.indexOf("if (this.sdk.config.mode === 'CHAT_ONLY') {", nav.indexOf('routeFromSplash(): void'));
  const lang = nav.indexOf("if (this.sdk.chatOnlyNeedsLanguageScreen) {\n        this.resetTo([{ name: 'Language' }]);", branch);
  const consume = nav.indexOf('this.sdk.consumePendingTarget()', branch);
  assert.ok(branch > 0 && lang > branch && lang < consume);
  const graph = readFileSync('src/ui/navigation/AppNavGraph.tsx', 'utf8');
  assert.ok(graph.includes('onLanguageSubmitted={() => appNavigator.routeFromSplash()}'));
  // openChat while the language screen is up stays pending.
  assert.ok(graph.includes("route !== 'Splash' && route !== 'Language' && !sdk.chatOnlyNeedsLanguageScreen"));
  // The headless bootstrap does not run ahead of the language screen.
  const splash = readFileSync('src/ui/screens/SplashScreen.tsx', 'utf8');
  assert.match(splash, /if \(!sdk\.chatOnlyNeedsLanguageScreen\) \{\s*await sdk\.ensureChatOnlySession\(\);/);
});

test('drawer off: chat bar has history (gated on showHistory) + language', () => {
  const src = readFileSync('src/ui/screens/ChatScreen.tsx', 'utf8');
  assert.ok(src.includes('sdk.config.showDrawer ? undefined : ('));
  assert.match(src, /sdk\.config\.showHistory \? \(\s*<ActionButton\s+testID="fc-chat-history"/);
  assert.ok(src.includes('testID="fc-chat-language"'));
});

test('drawer off: drawer-level screens get back, never a dead drawer opener', () => {
  for (const f of ['ChatHistoryScreen', 'LanguageChooserScreen', 'SettingsScreen', 'HelpScreen']) {
    const src = readFileSync(`src/ui/screens/${f}.tsx`, 'utf8');
    assert.ok(src.includes("navIcon={props.onBack ? 'back' : 'menu'}"), f);
    assert.ok(!src.includes('navIcon="menu"'), f);
  }
  const graph = readFileSync('src/ui/navigation/AppNavGraph.tsx', 'utf8');
  assert.equal(graph.match(/onBack=\{drawerOffBack\(sdk\.config\.showDrawer, appNavigator\)\}/g)?.length, 4);
  assert.ok(graph.includes('onLanguageSaved={() => appNavigator.navigateLanguageSaved()}'));
});
