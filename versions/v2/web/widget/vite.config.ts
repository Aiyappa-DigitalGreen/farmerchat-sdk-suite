import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * ESM build for React hosts. React and the SDK stay external so the host's
 * single copy of each is used.
 */
export default defineConfig({
  build: {
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
