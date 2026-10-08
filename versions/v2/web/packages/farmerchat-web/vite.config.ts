import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { copyIllustrations } from '../../tools/copyIllustrations';

export default defineConfig({
  plugins: [copyIllustrations(resolve(__dirname, 'dist'))],
  build: {
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
