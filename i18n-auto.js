/* i18n-auto.js — auto-translate NEW site copy via DeepL.
 *
 * Extracts the translatable English strings straight out of the marketing
 * HTML (the same selectors i18n.js uses at runtime), diffs them against the
 * existing i18n/<lang>.json dictionaries, and asks DeepL only for the strings
 * that aren't translated yet. Existing values (the curated i18n-build.js table
 * and the blog) are never overwritten, so re-runs cost nothing — you only pay
 * for genuinely new copy.
 *
 * Workflow: edit the English HTML → `npm run i18n` → done. No hand-kept table.
 *
 *   DEEPL_API_KEY=xxxx node i18n-auto.js          translate missing strings
 *   node i18n-auto.js --dry                        report only, no API call
 *   DEEPL_API_KEY=xxxx node i18n-auto.js --blog    also crawl blog posts
 *
 * Get a free key (500k chars/month) at https://www.deepl.com/pro-api — the
 * free tier key ends in ':fx' and is auto-detected below.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');

const ROOT = __dirname;
const I18N_DIR = path.join(ROOT, 'i18n');
const LANGS = ['tr', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pt', 'ru', 'zh', 'ar'];

// Our lang code → DeepL target code. DeepL needs region for PT; ZH = simplified.
const DEEPL_LANG = {
  tr: 'TR', de: 'DE', es: 'ES', fr: 'FR', it: 'IT', ja: 'JA',
  ko: 'KO', pt: 'PT-BR', ru: 'RU', zh: 'ZH', ar: 'AR'
};

// Leaf text elements worth translating — kept byte-for-byte in sync with the
// SEL list in i18n.js so the keys we extract match the keys it looks up.
const SEL = [
  '.nav-links > a', '.eyebrow', '.section-title', '.section-sub', '.lede',
  '.home-hero h1', '.page-hero h1', '.hero-meta span', '.crumbs span',
  '.btn-primary', '.waitlist-note', '.waitlist-msg',
  '.problem-card .x', '.problem-card p',
  '.feat-title', '.feat-desc', '.more',
  '.devices-strip-label', '.device-badge-note',
  '.feature-list li', '.step-title', '.step-desc',
  '.why-cell h3', '.why-cell p',
  '.compare th', '.compare td', '.compare caption', '.compare-links', '.beta-note',
  '.trust-cell h3', '.trust-cell p', '.fc-val',
  '.faq summary', '.faq p', '.price-name', '.price-amount small',
  '.cta h2', '.cta p', '.ring-cap', '.ring-cap-sub',
  '.article-cta h2', '.article-cta p', '.article-meta',
  '.prose p', '.prose h2', '.prose h3', '.prose li', '.prose blockquote',
  '.post-card h3', '.post-card p', '.post-card .tag',
  '.footer-about', '.footer-col h3', '.footer-col a', '.footer-bottom span'
].join(',');

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

// ── CLI ──
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const WITH_BLOG = args.includes('--blog');
const KEY = process.env.DEEPL_API_KEY || '';

// ── 1. Collect HTML files (skip node_modules; skip blog posts unless --blog) ──
function htmlFiles(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'assets' || name === 'screenshots' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) htmlFiles(full, acc);
    else if (name.endsWith('.html')) acc.push(full);
  }
  return acc;
}
function isBlogPost(file) {
  const rel = path.relative(ROOT, file);
  return rel.startsWith('blog' + path.sep) && rel !== path.join('blog', 'index.html');
}

const files = htmlFiles(ROOT, []).filter((f) => WITH_BLOG || !isBlogPost(f));

// ── 2. Extract { key(normalized text) → html(innerHTML) } across all pages ──
const source = new Map();
for (const file of files) {
  const root = parse(fs.readFileSync(file, 'utf8'), { comment: false });
  for (const el of root.querySelectorAll(SEL)) {
    if (el.querySelector('[data-price],[data-count]')) continue; // dynamic cells
    const key = norm(el.textContent);
    if (!key) continue;
    const html = norm(el.innerHTML);
    if (!source.has(key)) source.set(key, html);
  }
}
console.log(`Scanned ${files.length} pages → ${source.size} unique English strings.`);

// ── 3. DeepL batch translate ──
async function deepl(texts, target) {
  const host = KEY.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const res = await fetch(host + '/v2/translate', {
    method: 'POST',
    headers: { Authorization: 'DeepL-Auth-Key ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: texts, source_lang: 'EN', target_lang: target,
      tag_handling: 'html', preserve_formatting: true
    })
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).translations.map((t) => t.text);
}

async function chunked(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...await fn(items.slice(i, i + size)));
  return out;
}

// ── 4. Per-language: fill only the missing keys, write JSON ──
(async function run() {
  let totalNew = 0, totalChars = 0;
  const rows = [];

  for (const lang of LANGS) {
    const file = path.join(I18N_DIR, lang + '.json');
    let dict = {};
    try { dict = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* fresh */ }

    const missing = [...source.entries()].filter(([key]) => dict[key] == null);
    let added = 0, chars = 0;

    if (missing.length && KEY && !DRY) {
      const htmls = missing.map(([, html]) => html);
      chars = htmls.reduce((n, h) => n + h.length, 0);
      try {
        const translated = await chunked(htmls, 40, (batch) => deepl(batch, DEEPL_LANG[lang]));
        missing.forEach(([key], i) => { if (translated[i] != null) { dict[key] = translated[i]; added++; } });
        fs.writeFileSync(file, JSON.stringify(dict));
      } catch (err) {
        rows.push(`  ${lang}: SKIPPED — ${err.message}`);
        continue;
      }
    } else {
      chars = missing.reduce((n, [, html]) => n + html.length, 0);
    }

    totalNew += added; totalChars += chars;
    const note = !KEY || DRY ? `${missing.length} would translate (~${chars} chars)`
      : `${added} translated, ${dict ? Object.keys(dict).length : 0} total`;
    rows.push(`  ${lang}: ${note}`);
  }

  console.log('\nPer language:');
  rows.forEach((r) => console.log(r));

  if (DRY || !KEY) {
    const est = totalChars; // missing chars for ONE language ≈ per-language cost
    console.log(`\n[dry] No API calls made.${!KEY ? ' (DEEPL_API_KEY not set)' : ''}`);
    console.log(`[dry] ~${est} source chars/language × ${LANGS.length} langs to translate the gap.`);
    if (!KEY) console.log('[dry] Set DEEPL_API_KEY and re-run to fill the gaps.');
  } else {
    console.log(`\nDone: ${totalNew} strings translated across ${LANGS.length} languages (~${totalChars} chars billed).`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
