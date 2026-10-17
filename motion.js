/* MyVitality — scroll motion. Loaded by app.js once the page has settled
 * (after load, the boot screen and the first translation pass), right
 * after GSAP + ScrollTrigger and, on hover + fine pointer devices, Lenis.
 * Never loaded under reduced motion.
 *
 * - Section headings rise line by line out of a mask, once, on entering;
 *   the text beside them follows.
 * - Phones open from the bottom (clip-path) while the screen settles from
 *   1.15x to 1x.
 * - Desktop: Lenis smooth scroll. Touch keeps native scrolling.
 *
 * Only things still below the fold when this runs are prepared (hidden),
 * so nothing on screen blinks out, and without JS or GSAP nothing is
 * hidden at all. Transforms and clip-path only (no layout shift); a
 * heading is split into lines only while it waits, and restored after. */
(function () {
  'use strict';
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  var d = document;
  var nav = d.querySelector('.site-nav');
  var below = function (el) { return el.getBoundingClientRect().top > window.innerHeight; };
  var all = function (sel, ctx) { return [].slice.call((ctx || d).querySelectorAll(sel)); };

  /* ── Smooth scroll (desktop) ── */
  if (window.Lenis && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var lenis = new window.Lenis({ allowNestedScroll: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.mvLenis = lenis; /* app.js stops it while the menu is open */
    /* In-page links glide too, and land below the sticky header. The skip
     * link keeps its native jump, which also moves keyboard focus. */
    d.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a[href*="#"]') : null;
      if (!a || a.classList.contains('skip-link') || a.pathname !== location.pathname || a.hash.length < 2) return;
      var target = d.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -((nav && nav.offsetHeight) || 0) - 12 });
      if (a.hash !== location.hash) history.pushState(null, '', a.hash);
    });
  }

  /* ── Headings: split into masked lines while waiting ── */
  var SPACE = /([ \t\n\r\f]+)/; /* not \s: a no-break space must stay inside its word */

  function split(h) {
    var orig = [].slice.call(h.childNodes);
    var work = h.cloneNode(true), words = [], spaced = false;
    (function wrap(node) {
      [].slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = d.createDocumentFragment();
          c.textContent.split(SPACE).forEach(function (p) {
            if (!p) return;
            if (SPACE.test(p)) { frag.appendChild(d.createTextNode(' ')); spaced = true; return; }
            var w = d.createElement('span');
            w.textContent = p;
            w._mvSpaced = spaced; /* was there a space before it? */
            spaced = false;
            frag.appendChild(w);
            words.push(w);
          });
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') {
          wrap(c);
        }
      });
    })(work);
    if (!words.length) return false;
    h.replaceChildren.apply(h, [].slice.call(work.childNodes));

    /* Group the words by the line they landed on */
    var lines = [], top = null;
    words.forEach(function (w) {
      var t = w.offsetTop;
      if (top === null || t > top + 2) { lines.push([]); top = t; }
      lines[lines.length - 1].push(w);
    });

    /* Rebuild: each line a mask holding its words, each word wrapped in
     * shallow copies of its inline ancestors (e.g. the grey .grad span) */
    var built = lines.map(function (line, n) {
      var mask = d.createElement('span'), inner = d.createElement('span');
      mask.className = 'mv-line'; inner.className = 'mv-line-in';
      mask.appendChild(inner);
      var prevChain = null, prevLeaf = null;
      line.forEach(function (w, i) {
        var chain = [];
        for (var p = w.parentNode; p && p !== h; p = p.parentNode) chain.unshift(p);
        var same = prevChain && chain.length === prevChain.length &&
          chain.every(function (el, k) { return el === prevChain[k]; });
        var gap = i && w._mvSpaced ? ' ' : '';
        if (same) {
          prevLeaf.appendChild(d.createTextNode(gap + w.textContent));
        } else {
          if (gap) inner.appendChild(d.createTextNode(gap));
          var parent = inner;
          chain.forEach(function (el) { var c = el.cloneNode(false); parent.appendChild(c); parent = c; });
          parent.appendChild(d.createTextNode(w.textContent));
          prevChain = chain; prevLeaf = parent;
        }
      });
      /* keep the space at the line break (it collapses there), so the
       * heading's text reads the same while split */
      var next = lines[n + 1];
      if (next && next[0]._mvSpaced) inner.appendChild(d.createTextNode(' '));
      return mask;
    });
    h.replaceChildren.apply(h, built);
    h._mvOrig = orig;
    gsap.set(all('.mv-line-in', h), { yPercent: 135 }); /* clear of the mask, accents included */
    return true;
  }

  function unsplit(h) {
    /* if i18n.js replaced the heading meanwhile, its new content stays */
    if (h._mvOrig && h.querySelector('.mv-line')) h.replaceChildren.apply(h, h._mvOrig);
    h._mvOrig = null;
  }

  var pending = [];

  all('.section-title, .cta h2, .article-cta h2').filter(below).forEach(function (h) {
    if (!split(h)) return;
    /* A heading's block used to fade in whole ([data-reveal]); now the
     * heading rises and the rest of the block follows it up */
    var box = h.closest('[data-reveal]'), followers = [];
    if (box) {
      box.removeAttribute('data-reveal');
      followers = [].slice.call(box.children).filter(function (el) {
        return !el.contains(h) && !el.matches('[data-reveal]') && !el.querySelector('[data-reveal]');
      });
      gsap.set(followers, { opacity: 0, y: 28 });
    }
    var item = { h: h, followers: followers, done: false };
    pending.push(item);
    ScrollTrigger.create({
      trigger: h, start: 'clamp(top 88%)', once: true,
      onEnter: function () {
        item.done = true;
        var tl = gsap.timeline({ onComplete: function () { unsplit(h); } });
        var inners = all('.mv-line-in', h);
        if (inners.length) tl.to(inners, { yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.08 }, 0);
        if (followers.length) {
          tl.to(followers, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06, clearProps: 'opacity,transform' }, 0.18);
        }
      }
    });
  });

  /* Lines are measured at one width: re-split waiting headings when the
   * width changes, and after a language switch rewrote them */
  var resplit = function (force) {
    pending.forEach(function (item) {
      if (item.done) return;
      if (force || !item.h.querySelector('.mv-line')) { unsplit(item.h); split(item.h); }
    });
    ScrollTrigger.refresh();
  };
  var lastW = window.innerWidth, rT;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(rT);
    rT = setTimeout(function () { resplit(true); }, 200);
  });
  d.addEventListener('mv:lang', function () { resplit(false); });

  /* ── Phones: open from the bottom, the screen settling as it does ── */
  all('.phone-wrap .feature-phone').filter(below).forEach(function (ph) {
    var box = ph.closest('[data-reveal]');
    if (box) box.removeAttribute('data-reveal');
    var r = getComputedStyle(ph).borderTopLeftRadius || '44px';
    var screen = ph.querySelector('.phone-screen img, .chat-screen');
    gsap.set(ph, { clipPath: 'inset(100% 0% 0% 0% round ' + r + ')' });
    if (screen) gsap.set(screen, { scale: 1.15, transformOrigin: '50% 35%' });
    ScrollTrigger.create({
      trigger: ph, start: 'clamp(top 90%)', once: true,
      onEnter: function () {
        gsap.to(ph, { clipPath: 'inset(0% 0% 0% 0% round ' + r + ')', duration: 1.2, ease: 'expo.out', clearProps: 'clipPath' });
        if (screen) gsap.to(screen, { scale: 1, duration: 1.6, ease: 'power3.out', clearProps: 'transform' });
      }
    });
  });
})();
