import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';

/** Gera o service worker com a lista de arquivos do build (cache offline completo). */
function serviceWorker(): Plugin {
  return {
    name: 'fb-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const extra = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
      const version = Date.now().toString(36);
      const tpl = readFileSync('scripts/sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__FILES__', JSON.stringify([...extra, ...files]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: tpl });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  server: { host: true, port: 5173 },
  preview: { port: 4173 },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    sourcemap: false,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
