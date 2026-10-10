import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// PWA: inject the precache list + a content VERSION into dist/sw.js (see public/sw.js).
// Precache = app shell only: index.html (as "/"), built JS/CSS, icons, manifest.
// /pdfjs/ support files are cached on first use; user PDFs never touch the SW.
function pwaPrecache() {
  let outDir;
  return {
    name: 'librarian-pwa-precache',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js');
      const walk = dir => readdirSync(dir).flatMap(name => { const full = path.join(dir, name); return statSync(full).isDirectory() ? walk(full) : [full]; });
      const files = walk(outDir).map(full => '/' + path.relative(outDir, full).split(path.sep).join('/'))
        .filter(url => /^\/(assets\/.+\.(js|mjs|css)|index\.html|manifest\.webmanifest|(pwa-\d+x\d+|maskable-\d+x\d+|apple-touch-icon|favicon-64)\.png)$/.test(url))
        .sort();
      const hash = createHash('sha256');
      for (const url of files) hash.update(url).update(readFileSync(path.join(outDir, url)));
      const version = hash.digest('hex').slice(0, 12);
      const urls = files.map(url => url === '/index.html' ? '/' : url);
      const source = readFileSync(swPath, 'utf8');
      if (!source.includes('self.__LIBRARIAN_PRECACHE || []')) throw new Error('sw.js precache placeholder missing');
      writeFileSync(swPath, source.replace("'__LIBRARIAN_SW_VERSION__'", JSON.stringify(version)).replace('self.__LIBRARIAN_PRECACHE || []', JSON.stringify(urls)));
    },
  };
}

// base: './' → relative asset paths, so the built app loads from any origin:
// the web (served at /), Capacitor iOS (capacitor://localhost), and Electron (file://).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'ios' ? [] : [pwaPrecache()],
  // PDF.js documents Safari support for its polyfilled legacy build.
  resolve: mode === 'ios' ? {
    alias: [
      { find: 'pdfjs-dist/build/pdf.mjs', replacement: 'pdfjs-dist/legacy/build/pdf.mjs' },
      { find: 'pdfjs-dist/build/pdf.worker.min.mjs?url', replacement: 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url' },
    ],
  } : undefined,
  build: mode === 'ios' ? { target: 'safari18' } : undefined,
}));
