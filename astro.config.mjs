import { defineConfig } from 'astro/config';

export default defineConfig({
  build: { inlineStylesheets: 'always', assets: 'assets' },
  vite: {
    build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
  },
});
