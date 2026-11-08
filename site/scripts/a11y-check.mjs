// Automated accessibility check for every built page.
// Serves site/dist locally, opens each page in Chromium at desktop and phone
// widths, opens every <details> section, and runs axe-core with the
// WCAG 2.0/2.1 A and AA rules. Exits non-zero if any page has a violation.
//
// Automated tools catch only part of WCAG. Passing this check supports the
// wording "passes automated WCAG 2.1 AA scans", not "WCAG compliant".
//
// Usage (from site/, after `npm run build`):
//   node scripts/a11y-check.mjs

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '..', 'dist');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 375, height: 812 },
];
// Pages kept out of search and navigation (see astro.config sitemap filter).
const SKIP = [/^\/verify\//];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

function listPages(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.posix.join(base, entry.name);
    if (entry.isDirectory()) out.push(...listPages(path.join(dir, entry.name), rel));
    else if (entry.name === 'index.html') out.push('/' + (base ? base + '/' : ''));
  }
  return out;
}

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dist, p);
    if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    else if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const pages = listPages(dist).filter((p) => !SKIP.some((re) => re.test(p))).sort();
if (!pages.length) {
  console.error(`No pages found in ${dist}. Run "npm run build" first.`);
  process.exit(2);
}

const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let failures = 0;
let checked = 0;

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  for (const p of pages) {
    try {
      await page.goto(origin + p, { waitUntil: 'load', timeout: 30000 });
    } catch (err) {
      console.log(`  ! ${vp.name} ${p}: page did not finish loading (${err.message.split('\n')[0]}); checking what loaded`);
    }
    // Check the open state of collapsible sections too.
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    checked++;
    for (const v of results.violations) {
      failures++;
      console.log(`✗ ${vp.name} ${p}  [${v.impact}] ${v.id}: ${v.help}`);
      for (const n of v.nodes.slice(0, 5)) console.log(`    ${n.target.join(' ')}`);
      if (v.nodes.length > 5) console.log(`    ...and ${v.nodes.length - 5} more`);
      console.log(`    ${v.helpUrl}`);
    }
  }
  await context.close();
}

await browser.close();
server.close();

console.log(`\nChecked ${pages.length} pages at ${VIEWPORTS.length} widths (${checked} scans).`);
if (failures) {
  console.log(`${failures} accessibility violation(s) found. Fix them before merging (see CLAUDE.md).`);
  process.exit(1);
}
console.log('No automated WCAG 2.1 A/AA violations found.');
