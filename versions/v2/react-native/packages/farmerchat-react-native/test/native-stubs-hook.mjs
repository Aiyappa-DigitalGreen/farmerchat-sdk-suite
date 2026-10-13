/**
 * Node hooks for the lifecycle tests, which load `FarmerChat.ts` and its whole service graph
 * (the other tests only import leaf modules). Registered AFTER ts-extension-hook.mjs.
 *
 *  - resolve: points the native-only modules `src/core` imports (react-native, expo-device,
 *    expo-constants, AsyncStorage) at small in-memory stubs in `test/stubs/`.
 *  - load: `src/` uses TypeScript parameter properties (`constructor(private readonly x)`),
 *    which Node's built-in type STRIPPING rejects. So `.ts` files under `src/` are transpiled
 *    with the package's own `typescript` devDependency (transpileModule, no type-check). No new
 *    dependency.
 *
 *     node --import ./test/ts-extension-hook.mjs --import ./test/native-stubs-hook.mjs test/lifecycle.test.ts
 */

import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const STUBS = {
  'react-native': './stubs/react-native.mjs',
  'expo-device': './stubs/expo-device.mjs',
  'expo-constants': './stubs/expo-constants.mjs',
  '@react-native-async-storage/async-storage': './stubs/async-storage.mjs',
};

const SRC_DIR = new URL('../src/', import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const stub = STUBS[specifier];
    if (stub) {
      return { url: new URL(stub, import.meta.url).href, format: 'module', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(SRC_DIR) && url.endsWith('.ts')) {
      const out = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        fileName: fileURLToPath(url),
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          isolatedModules: true,
        },
      });
      return { format: 'module', source: out.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
