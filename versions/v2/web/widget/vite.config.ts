import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * ESM build for React hosts. React and the SDK stay external so the host's
 * single copy of each is used.
 */
export default defineConfig({
  build: {
    // Pinned (= Vite 5's default 'modules' target) so the browser minimum in the README cannot drift on a Vite upgrade.
    target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'],
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'farmerchat-widget.js',
    },
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@digitalgreenorg/farmerchat-web',
      ],
    },
  },
});
