/**
 * Optional peers: native-module lookup without expo-modules-core, the 1000x1000 upload downscale
 * (app ImageUtils.kt), and the "never require an optional package lazily" rule.
 *
 *     node --import ./test/ts-extension-hook.mjs test/optionalPeers.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fitWithin, shrinkForUpload } from '../src/core/imageShrink.ts';
import { optionalExpoNativeModule } from '../src/core/optionalPeers.ts';

const g = globalThis as { expo?: { modules?: Record<string, unknown> } };

test('fitWithin: fit 1000x1000, keep aspect, never enlarge, truncate like Kotlin toInt', () => {
  assert.deepEqual(fitWithin(1416, 800), { width: 1000, height: 564 });
  assert.deepEqual(fitWithin(3000, 4000), { width: 750, height: 1000 });
  assert.equal(fitWithin(1000, 1000), null);
  assert.equal(fitWithin(640, 480), null);
  assert.equal(fitWithin(0, 0), null);
});

test('native modules are read from globalThis.expo.modules (no expo-modules-core)', () => {
  delete g.expo;
  assert.equal(optionalExpoNativeModule('ExpoSharing'), null);
  g.expo = { modules: { ExpoSharing: { shareAsync: () => undefined } } };
  assert.ok(optionalExpoNativeModule('ExpoSharing'));
  delete g.expo;
});

test('shrink: absent manipulator → original base64; v13 and v12 APIs → resized JPEG 80', async () => {
  delete g.expo;
  const big = { uri: 'file:///a.jpg', base64: 'ORIG', width: 1416, height: 800 };
  assert.deepEqual(await shrinkForUpload(big), { base64: 'ORIG', resized: false });

  const calls: unknown[] = [];
  g.expo = {
    modules: {
      ExpoImageManipulator: {
        manipulate: (uri: string) => ({
          resize: (size: unknown) => calls.push(['resize', uri, size]),
          renderAsync: async () => ({
            saveAsync: async (o: unknown) => {
              calls.push(['save', o]);
              return { uri: 'file:///b.jpg', width: 1000, height: 564, base64: 'SMALL' };
            },
          }),
        }),
      },
    },
  };
  const r = await shrinkForUpload(big);
  assert.equal(r.base64, 'SMALL');
  assert.equal(r.resized, true);
  assert.deepEqual(calls, [
    ['resize', 'file:///a.jpg', { width: 1000, height: 564 }],
    ['save', { format: 'jpeg', compress: 0.8, base64: true }],
  ]);
  // Small photo: untouched, manipulator not called.
  calls.length = 0;
  assert.equal((await shrinkForUpload({ ...big, width: 800, height: 600 })).base64, 'ORIG');
  assert.equal(calls.length, 0);

  g.expo = {
    modules: {
      ExpoImageManipulator: {
        manipulateAsync: async (_u: string, actions: unknown, o: unknown) => {
          calls.push([actions, o]);
          return { uri: 'x', width: 750, height: 1000, base64: 'V12' };
        },
      },
    },
  };
  assert.equal((await shrinkForUpload({ ...big, width: 3000, height: 4000 })).base64, 'V12');
  assert.deepEqual(calls[0], [[{ resize: { width: 750, height: 1000 } }], { format: 'jpeg', compress: 0.8, base64: true }]);

  // A failing manipulator falls back to the original.
  g.expo = { modules: { ExpoImageManipulator: { manipulate: () => { throw new Error('boom'); } } } };
  assert.equal((await shrinkForUpload(big)).base64, 'ORIG');
  delete g.expo;
});

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

test('optional packages are required only at the top level of core/optionalPeers.ts', () => {
  const optional = ['react-native-view-shot', 'react-native-webview', 'expo-localization', 'expo-sharing', 'expo-image-manipulator', 'expo-modules-core'];
  for (const file of walk('src')) {
    if (file.endsWith('optionalPeers.ts')) continue;
    const src = readFileSync(file, 'utf8');
    for (const pkg of optional) {
      assert.ok(!src.includes(`require('${pkg}')`), `${file} requires ${pkg} lazily`);
      assert.ok(!new RegExp(`^import (?!type)[^;]*from '${pkg}'`, 'm').test(src), `${file} imports ${pkg}`);
    }
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const name of ['expo-sharing', 'expo-image-manipulator', 'react-native-view-shot', 'react-native-webview', 'expo-localization']) {
    assert.equal(pkg.peerDependenciesMeta[name]?.optional, true, `${name} must be an optional peer`);
  }
});
