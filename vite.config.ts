import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

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

/** Só no dev: recebe capturas de tela do jogo (POST /__snap?name=x) e salva em .snaps/. */
function devSnapshots(): Plugin {
  return {
    name: 'fb-dev-snapshots',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__snap', (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const name = (new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? 'snap').replace(/[^a-z0-9_-]/gi, '');
          const data = Buffer.concat(chunks).toString().replace(/^data:image\/\w+;base64,/, '');
          mkdirSync('.snaps', { recursive: true });
          writeFileSync(`.snaps/${name}.png`, Buffer.from(data, 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

/** Hash do código que gera a arte: muda → o cache de sprites no IndexedDB é refeito. */
function artHash(): string {
  const h = createHash('sha1');
  for (const dir of ['src/art', 'src/data']) {
    for (const f of readdirSync(dir).sort()) h.update(readFileSync(join(dir, f)));
  }
  return h.digest('hex').slice(0, 10);
}

export default defineConfig({
  base: './',
  define: { __ART_HASH__: JSON.stringify(artHash()) },
  plugins: [serviceWorker(), devSnapshots()],
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
