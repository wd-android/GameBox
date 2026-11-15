import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    // The jar editor (tools/jar-editor) is developer-only: it is served by
    // `npm run dev` at /tools/jar-editor/ and never shipped in the app.
    rollupOptions: { input: { main: resolve(__dirname, 'index.html') } },
  },
});
