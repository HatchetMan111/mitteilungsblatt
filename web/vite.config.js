import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Der Build landet in src/public/app und wird vom Express-Server unter
// /app/ mitausgeliefert (Root-URLs wie / oder /archiv liefert der
// SPA-Fallback des Servers aus). Base therefore '/app/'.
export default defineConfig({
  plugins: [react()],
  base: '/app/',
  build: {
    outDir: '../src/public/app',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
      '/pdf': 'http://localhost:3000'
    }
  }
});
