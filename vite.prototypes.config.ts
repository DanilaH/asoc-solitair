import { defineConfig } from 'vite';
export default defineConfig({
  base: '/', resolve: { dedupe: ['phaser'] },
  build: { outDir: '.recording/prototypes-dist', target: 'es2022', chunkSizeWarningLimit: 1800, rollupOptions: { input: 'tools/prototypes/index.html' } },
});
