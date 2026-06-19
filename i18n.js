/* MyVitality — site localization (no dependencies)
 * Auto-detects the visitor's language (browser → IP country → English) and
 * translates the page by matching each text element against /i18n/<lang>.json,
 * whose keys are the original English strings. English text lives in the HTML,
 * so no-JS visitors and crawlers still get a valid English page.
 * Translation values may carry inline markup; they are passed through a strict
 * tag/attribute whitelist (no raw innerHTML) before insertion. */
(function () {
  'use strict';
  var d = document, docEl = d.documentElement;
  var STORE = 'mv_lang';
  var LANGS = {
    en: 'English', tr: 'Türkçe', de: 'Deutsch', es: 'Español',
    fr: 'Français', it: 'Italiano', ja: '日本語', ko: '한국어',
    pt: 'Português', ru: 'Русский', zh: '中文', ar: 'العربية'
  };
  var RTL = { ar: 1 };

  // Leaf text elements worth translating. Containers and number/price cells
  // are skipped (see apply()). Standalone links are listed explicitly so we
  // never translate a bare <a> that sits inside another translated block.
  var SEL = [
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
    '.footer-about', '.footer-col h4', '.footer-col a', '.footer-bottom span'
  ].join(',');

  // Rough country → language map for the IP fallback (only supported langs).
  var C2L = {
    TR: 'tr',
    DE: 'de', AT: 'de', CH: 'de', LI: 'de',
    ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
    EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
    SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es',
    FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr',
    IT: 'it', SM: 'it', VA: 'it',
    JP: 'ja', KR: 'ko',
    PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt',
    RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru',
    CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh', SG: 'zh',
    SA: 'ar', AE: 'ar', EG: 'ar', QA: 'ar', KW: 'ar', BH: 'ar', OM: 'ar',
    JO: 'ar', LB: 'ar', IQ: 'ar', MA: 'ar', DZ: 'ar', TN: 'ar', LY: 'ar', YE: 'ar'
  };

  function supported(l) {
    if (!l) return null;
    l = l.toLowerCase();
    if (LANGS[l]) return l;
    l = l.slice(0, 2);
    return LANGS[l] ? l : null;
  }
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  // ── Safe HTML insertion ──
  var ALLOWED = { A: 1, STRONG: 1, EM: 1, B: 1, I: 1, SPAN: 1, BR: 1, SMALL: 1 };
  function safeHref(h) { return /^(\/|https:\/\/myvitality\.fit|mailto:|#)/.test(h || ''); }
  function sanitize(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (c) {
      if (c.nodeType === 1) {
        if (!ALLOWED[c.tagName]) {
          sanitize(c);
          while (c.firstChild) node.insertBefore(c.firstChild, c);
          node.removeChild(c);
          return;
        }
        Array.prototype.slice.call(c.attributes).forEach(function (a) {
          var n = a.name.toLowerCase();
          if (n === 'href' && c.tagName === 'A') { if (!safeHref(a.value)) c.removeAttribute(a.name); }
          else if (n !== 'class') c.removeAttribute(a.name);
        });
        sanitize(c);
      } else if (c.nodeType !== 3) { node.removeChild(c); }
    });
  }
  function setSafe(el, value) {
    // Plain text (no tags, no entities) is assigned directly. Anything with a
    // tag (<) OR an entity reference (&amp; &nbsp; …) is routed through the
    // DOMParser + allowlist sanitizer below, which decodes entities into text
    // nodes — a bare textContent assignment would render "&amp;" literally.
    if (value.indexOf('<') === -1 && value.indexOf('&') === -1) { el.textContent = value; return; }
    var doc = new DOMParser().parseFromString(value, 'text/html');
    sanitize(doc.body);
    el.textContent = '';
    while (doc.body.firstChild) el.appendChild(d.adoptNode(doc.body.firstChild));
  }

  // Cache the original English (HTML + lookup key) once, so toggling works.
  var els = [], cached = false;
  function cacheEnglish() {
    if (cached) return;
    els = Array.prototype.slice.call(d.querySelectorAll(SEL)).filter(function (el) {
      return !el.querySelector('[data-price],[data-count]');
    });
    els.forEach(function (el) {
      el._enHTML = el.innerHTML;
      el._enKey = norm(el.textContent);
    });
    cached = true;
  }

  function apply(lang, dict) {
    cacheEnglish();
    var en = lang === 'en';
    els.forEach(function (el) {
      if (!el._enKey) return;
      var v = en ? el._enHTML : dict[el._enKey];
      if (v != null) setSafe(el, v);
    });
    docEl.lang = lang;
    docEl.dir = RTL[lang] ? 'rtl' : 'ltr';
  }

  function setLang(lang, persist) {
    lang = supported(lang) || 'en';
    if (persist) { try { localStorage.setItem(STORE, lang); } catch (e) {} }
    buildSwitcher(lang);
    if (lang === 'en') { apply('en', {}); return; }
    fetch('/i18n/' + lang + '.json', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (dict) { apply(lang, dict); })
      .catch(function () { apply('en', {}); });
  }

  function buildSwitcher(current) {
    var existing = d.getElementById('langSelect');
    if (existing) { existing.value = current; return; }
    var nav = d.querySelector('.site-nav .nav-inner');
    if (!nav) return;
    var sel = d.createElement('select');
    sel.id = 'langSelect';
    sel.className = 'lang-select';
    sel.setAttribute('aria-label', 'Choose language');
    Object.keys(LANGS).forEach(function (code) {
      var o = d.createElement('option');
      o.value = code; o.textContent = LANGS[code];
      if (code === current) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { setLang(sel.value, true); });
    nav.appendChild(sel);
  }

  function init() {
    var saved;
    try { saved = localStorage.getItem(STORE); } catch (e) {}
    if (supported(saved)) { setLang(saved, false); return; }
    var navs = navigator.languages || [navigator.language || 'en'];
    for (var i = 0; i < navs.length; i++) {
      var hit = supported(navs[i]);
      if (hit) { setLang(hit, false); return; }
    }
    fetch('https://api.country.is/', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { setLang((j && C2L[(j.country || '').toUpperCase()]) || 'en', false); })
      .catch(function () { setLang('en', false); });
  }

  if (d.readyState !== 'loading') init();
  else d.addEventListener('DOMContentLoaded', init);
})();
