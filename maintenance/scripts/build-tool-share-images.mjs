import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire('/Users/lillypad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp = require('sharp');
const products = JSON.parse(await fs.readFile(path.join(root, 'content/tool-product-pages.json'), 'utf8'));
for (const product of products) {
  const asset = path.join(root, 'reports/tool-product-pages-20261006/stage/assets/tool-products', product.asset);
  if (product.slug === 'mockup') {
    await sharp(path.join(root, 'reports/tool-product-pages-20261006/demo-media/actual-mockup-export.png')).resize(1440, 960, { fit: 'contain', background: '#e8e8e5' }).webp({ quality: 88 }).toFile(asset + '.webp');
  }
  await sharp(asset + '.webp').resize(1200, 630, { fit: 'contain', background: '#101319' }).jpeg({ quality: 88 }).toFile(asset + '-share.jpg');
}
console.log(JSON.stringify({ shareImages: products.length, source: 'Actual public-tool workspace captures' }));
