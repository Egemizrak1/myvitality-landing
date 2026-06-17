/* MyVitality blog generator
 * Reads content/blog/*.md (frontmatter + Markdown) and writes:
 *   - blog/<slug>/index.html   (each article, styled with the site design)
 *   - blog/index.html          (the blog listing)
 *   - sitemap.xml              (static pages + all blog posts)
 * Run: npm run build
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = __dirname;
const CONTENT = path.join(ROOT, 'content', 'blog');
const SITE = 'https://myvitality.fit';
const OG = `${SITE}/assets/og-image.png`;

marked.setOptions({ headerIds: false, mangle: false });

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- shared chrome (must match the hand-built pages) ----
function nav(active) {
  const item = (href, label) =>
    `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="site-nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo"><img src="/icon-180.png" alt="MyVitality logo"> MyVitality</a>
    <div class="nav-links">
      ${item('/features/', 'Features')}
      ${item('/workout-tracker/', 'Workout')}
      ${item('/recovery-tracker/', 'Recovery')}
      ${item('/community/', 'Community')}
      ${item('/pricing/', 'Pricing')}
      ${item('/blog/', 'Blog')}
      <a href="/#download" class="nav-cta">Get the app</a>
    </div>
  </div>
</nav>`;
}

const FOOTER = `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <a href="/" class="footer-brand"><img src="/icon-180.png" alt="MyVitality logo"> MyVitality</a>
        <p class="footer-about">Fitness, recovery and community in one app. Track workouts, understand your body and stay consistent — built for everyday athletes.</p>
      </div>
      <div class="footer-col"><h4>Product</h4>
        <a href="/features/">Features</a><a href="/workout-tracker/">Workout tracker</a><a href="/recovery-tracker/">Recovery tracker</a><a href="/sleep-tracker/">Sleep tracker</a><a href="/community/">Community</a><a href="/pricing/">Pricing</a>
      </div>
      <div class="footer-col"><h4>Company</h4><a href="/about/">About</a><a href="/blog/">Blog</a><a href="mailto:egemizrak@icloud.com">Contact</a></div>
      <div class="footer-col"><h4>Legal</h4><a href="/privacy-policy/">Privacy Policy</a><a href="/terms/">Terms</a></div>
    </div>
  </div>
  <div class="footer-bottom"><span>© 2026 MyVitality. All rights reserved.</span><span><a href="https://myvitality.fit">myvitality.fit</a></span></div>
</footer>`;

function head({ title, description, url, schema = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/icon-180.png">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${OG}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
${schema}
</head>
<body>`;
}

// ---- article page ----
function renderArticle(p) {
  const url = `${SITE}/blog/${p.slug}/`;
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog/` },
      { '@type': 'ListItem', position: 3, name: p.title, item: url },
    ],
  };
  const article = {
    '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.description,
    author: { '@type': 'Organization', name: 'MyVitality' },
    publisher: { '@type': 'Organization', name: 'MyVitality', logo: { '@type': 'ImageObject', url: `${SITE}/icon-192.png` } },
    datePublished: p.date, dateModified: p.modified || p.date, mainEntityOfPage: url, image: OG,
  };
  const schema =
    `  <script type="application/ld+json">\n  ${JSON.stringify(breadcrumb)}\n  </script>\n` +
    `  <script type="application/ld+json">\n  ${JSON.stringify(article)}\n  </script>`;

  const cta = `<div class="article-cta">
    <h2 style="font-size:1.3rem;margin-bottom:8px">${esc(p.ctaTitle || 'Track it all in one app')}</h2>
    <p class="section-sub" style="margin:0 auto 18px">${esc(p.ctaText || 'MyVitality brings your workouts, recovery, sleep and nutrition together — free, launching on iOS soon.')}</p>
    <a href="${p.ctaHref || '/#download'}" class="btn-primary" style="display:inline-flex">${esc(p.ctaLabel || 'Get notified at launch →')}</a>
  </div>`;

  return `${head({ title: p.metaTitle || `${p.title} | MyVitality`, description: p.description, url, schema })}

${nav('/blog/')}

<header class="page-hero">
  <div class="container" style="max-width:760px">
    <div class="crumbs"><a href="/">Home</a> / <a href="/blog/">Blog</a> / <span>${esc(p.crumb || p.tag)}</span></div>
    <p class="article-meta">${esc(p.tag)} · ${esc(p.readingTime || '6 min read')}</p>
    <h1>${esc(p.title)}</h1>
  </div>
</header>

<section style="padding-top:48px">
  <article class="prose">
${p.html}
  </article>
  ${cta}
</section>

${FOOTER}

<script src="/app.js" defer></script>
<script src="/i18n.js" defer></script>
</body>
</html>
`;
}

// ---- blog index ----
function renderIndex(posts) {
  const url = `${SITE}/blog/`;
  const schema = `  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: url },
  ] })}
  </script>`;
  const cards = posts.map(p => `      <a class="post-card" href="/blog/${p.slug}/">
        <span class="tag">${esc(p.tag)}</span>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.excerpt || p.description)}</p>
      </a>`).join('\n');

  return `${head({ title: 'Blog — Fitness Tracking, Recovery & Consistency | MyVitality', description: 'Practical guides on tracking your fitness progress, building workout consistency, recovery, sleep and the metrics that actually matter.', url, schema })}

${nav('/blog/')}

<header class="page-hero">
  <div class="container">
    <div class="crumbs"><a href="/">Home</a> / <span>Blog</span></div>
    <span class="eyebrow">Blog</span>
    <h1>Guides to train smarter and stay consistent</h1>
    <p class="lede">No fluff — practical, science-grounded advice on tracking your fitness, recovering well and building habits that last.</p>
  </div>
</header>

<section>
  <div class="container">
    <div class="post-grid">
${cards}
    </div>
  </div>
</section>

<section class="cta">
  <div class="container">
    <h2>Put it into <span class="grad">practice</span></h2>
    <p>Track workouts, recovery and sleep in one app — free, launching on iOS soon.</p>
    <p style="position:relative"><a href="/#download" class="btn-primary" style="display:inline-flex">Get notified at launch →</a></p>
  </div>
</section>

${FOOTER}

<script src="/app.js" defer></script>
<script src="/i18n.js" defer></script>
</body>
</html>
`;
}

// ---- sitemap ----
function renderSitemap(posts) {
  const today = new Date().toISOString().slice(0, 10);
  const STATIC = [
    ['/', '1.0', 'weekly'], ['/features/', '0.9', 'monthly'],
    ['/workout-tracker/', '0.9', 'monthly'], ['/recovery-tracker/', '0.9', 'monthly'],
    ['/sleep-tracker/', '0.9', 'monthly'], ['/community/', '0.8', 'monthly'],
    ['/pricing/', '0.7', 'monthly'], ['/about/', '0.5', 'yearly'],
    ['/blog/', '0.7', 'weekly'], ['/privacy-policy/', '0.3', 'yearly'], ['/terms/', '0.3', 'yearly'],
  ];
  const u = (loc, mod, pr, cf) =>
    `  <url><loc>${SITE}${loc}</loc><lastmod>${mod}</lastmod><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`;
  const rows = [
    ...STATIC.map(([loc, pr, cf]) => u(loc, today, pr, cf)),
    ...posts.map(p => u(`/blog/${p.slug}/`, p.modified || p.date, '0.6', 'yearly')),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.join('\n')}
</urlset>
`;
}

// ---- build ----
function build() {
  const files = fs.readdirSync(CONTENT).filter(f => f.endsWith('.md'));
  const posts = files.map(f => {
    const raw = fs.readFileSync(path.join(CONTENT, f), 'utf8');
    const { data, content } = matter(raw);
    const slug = data.slug || f.replace(/\.md$/, '');
    if (!data.title || !data.description || !data.date) throw new Error(`Missing frontmatter in ${f}`);
    return { ...data, slug, html: marked.parse(content) };
  }).sort((a, b) => (a.date < b.date ? 1 : -1));

  for (const p of posts) {
    const dir = path.join(ROOT, 'blog', p.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderArticle(p));
  }
  fs.writeFileSync(path.join(ROOT, 'blog', 'index.html'), renderIndex(posts));
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), renderSitemap(posts));

  console.log(`Built ${posts.length} posts:`);
  posts.forEach(p => console.log(`  /blog/${p.slug}/  — ${p.title}`));
  console.log('Updated blog/index.html and sitemap.xml');
}

build();
