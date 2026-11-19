// Builds a 1200x630 social share image (Facebook/LinkedIn link preview) for one
// TL;DW! meeting, in the same style as the Factual Perceptions share images.
//
// Usage (from site/):  node scripts/make-tldw-share-image.mjs 2026-11-16-special
//
// Reads the meeting's card in src/data/tldw-meetings.json:
//   title       -> headline
//   category, date -> eyebrow line
//   shareItems  -> optional list (up to 4 short lines) for the "Also in this meeting" panel
// Writes public/og-tldw-<slug>.png. Then set "shareImage": "/og-tldw-<slug>.png"
// on the same card so the page uses it as og:image.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/make-tldw-share-image.mjs <slug>');
  process.exit(1);
}
const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cards = JSON.parse(readFileSync(path.join(siteDir, 'src/data/tldw-meetings.json'), 'utf8'));
const card = cards.find((c) => c.slug === slug);
if (!card) {
  console.error(`No card with slug "${slug}" in tldw-meetings.json`);
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const d = new Date(`${card.date}T12:00:00`);
const mon = d.toLocaleDateString('en-US', { month: 'short' });
const dateText = `${mon}${mon.length > 3 ? '' : mon === 'May' ? '' : '.'} ${d.getDate()}, ${d.getFullYear()}`.replace('Sep.', 'Sept.');
// Council meetings say "City Council"; boards and committees use their own name.
const body = /Committee of the Whole/.test(card.category) || !/Committee|Board/.test(card.category)
  ? 'City Council'
  : card.category;
const items = (card.shareItems || []).slice(0, 4);

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 1200px; height: 630px; font-family: 'DM Sans', sans-serif; color: #fff;
    background: radial-gradient(circle at 100% 100%, #17496e 0%, #00243d 55%); overflow: hidden; }
  .wrap { position: absolute; inset: 0; padding: 56px 64px; display: flex; gap: 48px; }
  .left { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; }
  .brand { font-size: 28px; font-weight: 800; letter-spacing: -0.3px; }
  .brand span { color: #42bfe8; }
  .eyebrow { margin-top: 64px; font-size: 20px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #42bfe8; }
  .badge { display: inline-block; background: #42bfe8; color: #00243d; border-radius: 6px; padding: 2px 10px; margin-right: 10px; letter-spacing: 1px; }
  h1 { margin-top: 18px; font-size: 54px; line-height: 1.08; font-weight: 800; letter-spacing: -0.8px; }
  .foot { margin-top: auto; font-size: 19px; line-height: 1.45; font-weight: 600; color: #b9cdda; }
  .foot b { color: #fff; font-weight: 700; }
  .right { flex: 0 0 420px; align-self: center; background: rgba(255,255,255,0.07);
    border: 1px solid rgba(66,191,232,0.45); border-radius: 14px; padding: 28px 30px; }
  .right h2 { font-size: 18px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #42bfe8; margin-bottom: 14px; }
  .right li { list-style: none; position: relative; padding-left: 26px; font-size: 23px; line-height: 1.25; margin-top: 14px; }
  .right li::before { content: ''; position: absolute; left: 2px; top: 11px; width: 10px; height: 10px; border-radius: 50%; background: #42bfe8; }
</style></head><body><div class="wrap">
  <div class="left">
    <div class="brand">Westbrook <span>Currents</span></div>
    <div class="eyebrow"><span class="badge">TL;DW!</span>${esc(body)} · ${esc(dateText)}</div>
    <h1 id="h">${esc(card.title)}</h1>
    <div class="foot"><b>westbrookcurrents.com</b><br>Independent summary · not an official City record</div>
  </div>
  ${items.length ? `<div class="right"><h2>Also in this meeting</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : ''}
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
// Shrink the headline until the footer still fits on the card.
await page.evaluate(() => {
  const h = document.getElementById('h');
  const foot = document.querySelector('.foot');
  let size = 54;
  while (size > 34 && h.getBoundingClientRect().bottom > foot.getBoundingClientRect().top - 24) {
    size -= 2;
    h.style.fontSize = `${size}px`;
  }
});
const out = path.join(siteDir, 'public', `og-tldw-${slug}.png`);
await page.screenshot({ path: out });
await browser.close();
console.log(out);
