/**
 * Node resolve hook so the unit tests can import the SDK's own TypeScript sources.
 *
 * The tests run on Node's native TypeScript support (this package has NO test framework and none
 * was added). Node requires exact file specifiers, but `src/` imports its siblings
 * extensionlessly (`./agentic`) the way every bundler expects — so a bare `node test/x.test.ts`
 * fails to resolve them. This hook appends `.ts` for relative specifiers that have no extension,
 * and changes nothing else.
 *
 * Uses only `node:module`'s built-in synchronous hooks — no dependency, no loader thread.
 *
 *     node --import ./test/ts-extension-hook.mjs test/agentic.test.ts
 */

import { registerHooks } from 'node:module';

const HAS_EXTENSION = /\.[cm]?[jt]sx?$|\.json$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !HAS_EXTENSION.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        // fall through to the default resolution and let Node report the real error
      }
    }
    return nextResolve(specifier, context);
  },
});
