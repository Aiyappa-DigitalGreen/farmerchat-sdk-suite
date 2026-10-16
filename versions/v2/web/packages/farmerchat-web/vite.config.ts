import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { copyIllustrations } from '../../tools/copyIllustrations';

export default defineConfig({
  plugins: [copyIllustrations(resolve(__dirname, 'dist'))],
  build: {
    // Pinned (= Vite 5's default 'modules' target) so the browser minimum in the README cannot drift on a Vite upgrade.
    target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'],
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FarmerChatWeb',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'farmerchat-web.js' : 'farmerchat-web.cjs'),
    },
    sourcemap: true,
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
      output: {
        exports: 'named',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
