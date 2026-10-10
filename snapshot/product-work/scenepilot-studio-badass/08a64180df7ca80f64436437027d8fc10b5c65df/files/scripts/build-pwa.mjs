// Writes site/sw.js from public/sw.js with the precache list of the CURRENT
// site/app (editor) and site/tools (film tools) builds, and copies the web app
// manifest + icons. Run after `npm run build:app` and `npm run build:tools`.
//
//   node scripts/build-pwa.mjs            -> site/sw.js, site/manifest.webmanifest
//   node scripts/build-pwa.mjs --check    -> prints the precache summary only
//
// Precached: HTML entry pages, every JS/CSS/worker/font/image the bundles emit,
// icons and small models. Not precached (cached on first use instead): the
// ~34 MB MediaPipe WASM runtime under /app/mediapipe/.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const site = path.join(root, "site");
const checkOnly = process.argv.includes("--check");
const MAX_PRECACHE_FILE = 2 * 1024 * 1024;

function walk(directory, prefix) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    const url = `${prefix}${name}`;
    return statSync(full).isDirectory() ? walk(full, `${url}/`) : [{ full, url }];
  });
}

const entries = [
  ...walk(path.join(site, "app"), "/app/").filter(({ url }) => !url.startsWith("/app/mediapipe/")),
  ...walk(path.join(site, "tools"), "/tools/"),
].filter(({ full, url }) => !url.endsWith(".map") && !url.endsWith("/NOTICE.txt") && statSync(full).size <= MAX_PRECACHE_FILE);

if (!entries.some(({ url }) => url === "/app/index.html")) throw new Error("site/app/index.html missing: run `npm run build:app` first.");
if (!entries.some(({ url }) => url === "/tools/index.html")) throw new Error("site/tools/index.html missing: run `npm run build:tools` first.");

const statics = ["manifest.webmanifest", "app-icon-192.png", "app-icon-512.png", "app-icon-maskable-512.png", "app-icon-maskable-192.png"];
const hash = createHash("sha256");
const urls = [];
for (const { full, url } of entries.sort((a, b) => a.url.localeCompare(b.url))) {
  hash.update(url).update(readFileSync(full));
  urls.push(url.endsWith("/index.html") ? url.slice(0, -"index.html".length) : url);
}
for (const name of statics) {
  const source = path.join(root, "public", name);
  if (!existsSync(source)) continue;
  hash.update(name).update(readFileSync(source));
  urls.push(`/${name}`);
}
const template = readFileSync(path.join(root, "public", "sw.js"), "utf8");
hash.update(template);
const buildId = hash.digest("hex").slice(0, 12);
const bytes = entries.reduce((sum, { full }) => sum + statSync(full).size, 0);
console.log(`PWA precache: ${urls.length} URLs, ${(bytes / 1e6).toFixed(1)} MB, build ${buildId}`);
if (checkOnly) process.exit(0);

const output = template
  .replace(/^const BUILD_ID = "dev";$/m, `const BUILD_ID = ${JSON.stringify(buildId)};`)
  .replace(/^const PRECACHE = \[\];$/m, `const PRECACHE = ${JSON.stringify(urls, null, 0).replaceAll("\",\"", "\",\n  \"")};`);
if (output === template) throw new Error("public/sw.js placeholders not found.");
writeFileSync(path.join(site, "sw.js"), output);
for (const name of statics) {
  const source = path.join(root, "public", name);
  if (existsSync(source)) copyFileSync(source, path.join(site, name));
}
console.log("Wrote site/sw.js and copied the manifest + icons.");
