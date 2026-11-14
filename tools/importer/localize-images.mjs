/* eslint-disable no-console */
/**
 * Post-import step: download remote images referenced by imported pages into content/media-da/
 * and point the pages at the local copies (same layout the bulk importer uses for snapshot pages).
 *
 * Pages imported live (no Bright Data snapshot) keep their source image URLs, which hotlink the
 * bot-protected origin. Run after run-bulk-import.js:
 *
 *   node tools/importer/localize-images.mjs content/es/offers/chooseyourchecking500tiered.plain.html ...
 *
 * Only http(s) image URLs are downloaded; only responses with an image/* content type are saved.
 * /media-da/ paths are rewritten page-relative so they resolve from DA and the local preview.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const MEDIA_DIR = path.join(ROOT, 'content', 'media-da');
const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp', 'image/avif': 'avif',
};
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const cache = new Map();

async function localize(url) {
  if (cache.has(url)) return cache.get(url);
  const result = (async () => {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!res.ok || !EXT[type]) throw new Error(`${res.status} ${type || 'no content-type'}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (type === 'image/svg+xml' && /<script|\bon\w+\s*=|javascript:/i.test(buf.toString('utf8'))) {
      throw new Error('svg contains script content');
    }
    const name = `${crypto.createHash('md5').update(url).digest('hex')}.${EXT[type]}`;
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, name), buf);
    return `/media-da/${name}`;
  })();
  cache.set(url, result);
  return result;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node tools/importer/localize-images.mjs <content/*.plain.html>...');
  process.exit(1);
}
let failures = 0;
for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  const urls = [...new Set([...html.matchAll(/<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"/g)].map((m) => m[1]))];
  let changed = 0;
  for (const raw of urls) {
    const url = raw.replace(/&amp;/g, '&');
    try {
      const local = await localize(url);
      html = html.split(`src="${raw}"`).join(`src="${local}"`);
      changed += 1;
    } catch (e) {
      failures += 1;
      console.warn(`  ! ${file}: ${url} — ${e.message}`);
    }
  }
  // Make /media-da/ references page-relative (e.g. ../media-da/x.png). Root-relative paths don't
  // resolve when Edge Delivery reads the page from DA (they drop the org/repo prefix); relative
  // paths resolve both in DA (<org>/<repo>/media-da/) and in the local preview (/content/media-da/).
  const rel = path.relative(path.dirname(path.resolve(file)), MEDIA_DIR).split(path.sep).join('/');
  const before = html;
  html = html.replace(/(\bsrc=")\/media-da\//g, `$1${rel}/`);
  const relativized = html !== before;
  if (changed || relativized) fs.writeFileSync(file, html);
  console.log(`${file}: ${changed}/${urls.length} remote images localized${relativized ? `, media paths -> ${rel}/` : ''}`);
}
process.exit(failures ? 2 : 0);
