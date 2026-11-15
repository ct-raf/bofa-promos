/* eslint-disable no-console */
/**
 * Post-import step: add per-page metadata rows (Nav, Footer, Alternate, Legal Code) from
 * tools/importer/page-settings.json to each page's Metadata block in content/<path>.plain.html.
 * Idempotent: existing rows with the same key are replaced. Run from the project root after
 * run-bulk-import.js (and localize-images.mjs):
 *
 *   node tools/importer/apply-page-settings.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/importer/page-settings.json'), 'utf8'));
const LABELS = {
  nav: 'Nav', footer: 'Footer', alternate: 'Alternate', legalCode: 'Legal Code',
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

let failures = 0;
Object.entries(settings.pages).forEach(([page, values]) => {
  const file = path.join(ROOT, 'content', `${page}.plain.html`);
  if (!fs.existsSync(file)) {
    console.warn(`  ! missing ${file}`);
    failures += 1;
    return;
  }
  let html = fs.readFileSync(file, 'utf8');
  const start = html.indexOf('<div class="metadata">');
  if (start < 0) {
    console.warn(`  ! no metadata block in ${page}`);
    failures += 1;
    return;
  }
  Object.entries(values).forEach(([key, value]) => {
    const label = LABELS[key] || key;
    // drop an existing row for this key (case-insensitive)
    const rowRe = new RegExp(`<div><div>${label}</div><div>[^<]*</div></div>`, 'i');
    html = html.replace(rowRe, '');
    const insertAt = html.indexOf('<div class="metadata">') + '<div class="metadata">'.length;
    html = `${html.slice(0, insertAt)}<div><div>${label}</div><div>${esc(value)}</div></div>${html.slice(insertAt)}`;
  });
  fs.writeFileSync(file, html);
  console.log(`${page}: ${Object.keys(values).join(', ')}`);
});
process.exit(failures ? 2 : 0);
