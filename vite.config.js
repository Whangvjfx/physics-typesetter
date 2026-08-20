import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  server: {
    host: true,
    port: 3000,
    open: true,
    watch: {
      ignored: ['**/ios/**', '**/dist/**']
    }
  }
});
