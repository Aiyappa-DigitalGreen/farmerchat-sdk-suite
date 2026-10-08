import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Copies the farmer illustrations Android bundles as APK assets
 * (`android/farmerchat-core/src/main/assets/{ke,et,ng,in}/*.webp`) into `<outDir>/illustrations/`,
 * so they ship as files beside the bundle instead of being inlined (~1.5 MB). The SDK loads them
 * from `config.assetBaseUrl`. Single source of truth: the Android tree.
 */
export function copyIllustrations(outDir: string): Plugin {
  const src = resolve(__dirname, '../../android/farmerchat-core/src/main/assets');
  return {
    name: 'farmerchat-copy-illustrations',
    apply: 'build',
    closeBundle() {
      if (!existsSync(src)) {
        this.warn(`illustrations not found at ${src}; skipping`);
        return;
      }
      for (const cc of ['ke', 'et', 'ng', 'in']) {
        cpSync(resolve(src, cc), resolve(outDir, 'illustrations', cc), { recursive: true });
      }
    },
  };
}
