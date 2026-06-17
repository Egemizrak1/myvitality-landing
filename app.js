/* MyVitality — shared site behaviour (no dependencies)
 * Skip link · mobile menu · nav scroll state · scroll reveals · count-up
 * · hero carousel · waitlist capture. Safe to include on every page. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn) {
    if (d.readyState !== 'loading') fn();
    else d.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var nav = d.querySelector('.site-nav');
    var inner = nav && nav.querySelector('.nav-inner');
    var links = nav && nav.querySelector('.nav-links');

    /* ── Skip link + main landmark ── */
    if (!d.querySelector('.skip-link')) {
      var skip = d.createElement('a');
      skip.className = 'skip-link'; skip.href = '#main'; skip.textContent = 'Skip to content';
      d.body.insertBefore(skip, d.body.firstChild);
    }
    var main = d.querySelector('main, header.home-hero, header.page-hero') || d.querySelector('section');
    if (main && !main.id) main.id = 'main';

    /* ── Nav scroll state ── */
    if (nav) {
      var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 40); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* ── Mobile menu — built from existing .nav-links ── */
    if (nav && inner && links) {
      var toggle = d.createElement('button');
      toggle.className = 'nav-toggle';
      toggle.setAttribute('aria-label', 'Open menu');
      toggle.setAttribute('aria-expanded', 'false');
      for (var s = 0; s < 3; s++) toggle.appendChild(d.createElement('span'));
      inner.appendChild(toggle);

      var overlay = d.createElement('div');
      overlay.className = 'mobile-menu';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Menu');
      var menuInner = d.createElement('div');
      menuInner.className = 'mobile-menu-inner';
      links.querySelectorAll('a').forEach(function (a) { menuInner.appendChild(a.cloneNode(true)); });
      overlay.appendChild(menuInner);
      d.body.appendChild(overlay);

      var setOpen = function (open) {
        root.classList.toggle('menu-open', open);
        overlay.classList.toggle('open', open);
        toggle.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      };
      toggle.addEventListener('click', function () { setOpen(!overlay.classList.contains('open')); });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay || e.target.tagName === 'A') setOpen(false);
      });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
      window.addEventListener('resize', function () { if (window.innerWidth > 820) setOpen(false); });
    }

    /* ── Count-up (runs once when in view) ── */
    function countUp(el) {
      var end = parseInt(el.getAttribute('data-count'), 10) || 0;
      var suf = el.getAttribute('data-suffix') || '';
      if (reduce) { el.textContent = end + suf; return; }
      var start = null, dur = 1200;
      function tick(t) {
        if (start === null) start = t;
        var p = Math.min((t - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * eased) + suf;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    /* ── Scroll reveals + deferred count-up ── */
    var revealEls = d.querySelectorAll('[data-reveal]');
    var counters = d.querySelectorAll('[data-count]');
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add('in');
          if (en.target.querySelectorAll) en.target.querySelectorAll('[data-count]').forEach(countUp);
          io.unobserve(en.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      revealEls.forEach(function (el) { io.observe(el); });

      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return; countUp(en.target); cio.unobserve(en.target);
        });
      }, { threshold: 0.5 });
      counters.forEach(function (el) { cio.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('in'); });
      counters.forEach(countUp);
    }

    /* ── Hero screenshot carousel ── */
    var carousel = d.getElementById('heroCarousel');
    if (carousel) {
      var slides = carousel.querySelectorAll('.phone-slide');
      var dots = carousel.querySelectorAll('.carousel-dot');
      if (slides.length) {
        var cur = 0, timer;
        var go = function (n) {
          slides[cur].classList.remove('active'); if (dots[cur]) dots[cur].classList.remove('active');
          cur = (n + slides.length) % slides.length;
          slides[cur].classList.add('active'); if (dots[cur]) dots[cur].classList.add('active');
        };
        var play = function () { timer = setInterval(function () { go(cur + 1); }, 3400); };
        if (!reduce) play();
        dots.forEach(function (dot, i) {
          dot.addEventListener('click', function () { clearInterval(timer); go(i); if (!reduce) play(); });
        });
      }
    }

    /* ── Waitlist capture ── */
    var API = 'https://fitsync-api-phi.vercel.app/api/waitlist';
    d.querySelectorAll('.waitlist-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = form.querySelector('input[type=email]');
        var btn = form.querySelector('button');
        var msg = form.querySelector('.waitlist-msg');
        var email = (input.value || '').trim();
        if (!email || !input.checkValidity()) { input.reportValidity(); return; }
        var label = btn.textContent;
        btn.disabled = true; btn.textContent = 'Joining…';
        if (msg) { msg.className = 'waitlist-msg'; msg.textContent = ''; }
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, source: form.getAttribute('data-source') || 'home' })
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
        }).then(function (r) {
          if (r.ok && r.data && r.data.success) {
            if (msg) { msg.className = 'waitlist-msg ok'; msg.textContent = "✓ You're on the list — we'll email you at launch."; }
            input.disabled = true; input.value = ''; btn.style.display = 'none';
          } else {
            if (msg) { msg.className = 'waitlist-msg err'; msg.textContent = (r.data && r.data.message) || 'Something went wrong — please try again.'; }
            btn.disabled = false; btn.textContent = label;
          }
        }).catch(function () {
          if (msg) { msg.className = 'waitlist-msg err'; msg.textContent = 'Network error — please try again.'; }
          btn.disabled = false; btn.textContent = label;
        });
      });
    });
  });
})();
