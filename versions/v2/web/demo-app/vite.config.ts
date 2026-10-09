import { defineConfig } from 'vite';

/**
 * The hosted web-app showcase. Served under /app/ by web/railway/server.mjs, so asset URLs are
 * based there. No React plugin: esbuild's automatic JSX runtime is all a one-component page needs.
 */
export default defineConfig({
  base: '/app/',
  esbuild: { jsx: 'automatic' },
  resolve: {
    // The SDK is a file: dependency with its own node_modules; without this the bundle can carry
    // two Reacts and every hook throws (same trap as widget/vite.embed.config.ts).
    dedupe: ['react', 'react-dom'],
  },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 800 },
});
