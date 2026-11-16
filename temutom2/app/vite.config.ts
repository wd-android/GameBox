import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', target: 'es2020' },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
