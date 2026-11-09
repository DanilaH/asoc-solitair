import { defineConfig } from 'vite';
export default defineConfig({
  base: './', resolve: { dedupe: ['phaser'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 1800 },
});
