import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { copyIllustrations } from '../tools/copyIllustrations';

/**
 * Script-tag build: one self-contained IIFE with React, ReactDOM and the SDK
 * bundled in, for pages that have no React and no bundler.
 */
export default defineConfig({
  plugins: [copyIllustrations(resolve(__dirname, 'dist'))],
  // Library mode does not replace this, and React reads it at load time; a plain
  // page has no `process`, so leaving it in throws before the widget boots.
  define: { 'process.env.NODE_ENV': '"production"' },
  resolve: {
    // The SDK is a file: dependency with its own node_modules — without this the
    // bundle can carry two Reacts and every hook throws.
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // Pinned (= Vite 5's default 'modules' target) so the browser minimum in the README cannot drift on a Vite upgrade.
    target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'],
    lib: {
      entry: resolve(__dirname, 'src/embed.ts'),
      name: 'FarmerChatWidgetBundle',
      formats: ['iife'],
      fileName: () => 'farmerchat-widget.iife.js',
    },
    sourcemap: true,
    emptyOutDir: false,
    minify: 'esbuild',
  },
});
