/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Emits sw.js with the full list of built files, so the service worker can
 * precache everything (lazy chunks included) and its cache name changes with
 * every release.
 */
function offlineServiceWorker(): Plugin {
  return {
    name: 'mindvault-offline-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const files = [...new Set(['index.html', 'favicon.svg', 'manifest.webmanifest', ...built])].sort();
      const version = createHash('sha256').update(built.sort().join('|')).digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./build/sw-template.js', import.meta.url), 'utf8');
      const source = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(['./', ...files.map((f) => `./${f}`)]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineServiceWorker()],
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // React and the puzzle engine change at different rates; separate
        // chunks let browsers keep one cached while the other updates.
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          if (id.includes('/src/engine/')) return 'engine';
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 60000,
  },
});
