/* FAFNER AERO — shared site behaviour: header, menu, motion.
   Page scripts (e.g. careers/careers.js) load before this file and may
   register hooks on window.FafnerPage:
     beforeReveal()        — build DOM that should take part in reveals
     afterReveal(api)      — runs once the reveal observer exists        */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var page = window.FafnerPage || {};

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── Header ───────────────────────────────────────────────────────── */
  var header = document.querySelector('.site-header');
  var overlay = header && header.classList.contains('is-overlay');
  function onScrollHeader() {
    if (!header) return;
    // homepage: stay transparent over the pinned hero until content slides under the header
    if (overlay) header.classList.toggle('is-solid', window.scrollY > window.innerHeight - header.offsetHeight - 8);
    else header.classList.toggle('is-compact', window.scrollY > 24);
  }

  /* ── Mobile menu sheet ────────────────────────────────────────────── */
  var toggle = document.querySelector('.menu-toggle');
  var sheet = document.getElementById('mobile-nav');
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
    sheet.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    if (header) header.classList.toggle('menu-is-open', open);
  }
  if (toggle && sheet) {
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
    sheet.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 768px)').addEventListener('change', function (m) { if (m.matches) setMenu(false); });
  }

  /* ── Active section in the nav (homepage) ─────────────────────────── */
  function setupScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-spy]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var sections = {};
    links.forEach(function (a) {
      var id = a.getAttribute('data-spy');
      var el = document.getElementById(id);
      if (el) sections[id] = el;
    });
    var visible = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      var current = null;
      Object.keys(sections).forEach(function (id) { if (visible[id] && !current) current = id; });
      links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('data-spy') === current); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(sections).forEach(function (id) { spy.observe(sections[id]); });
  }

  /* ── Scroll reveal ────────────────────────────────────────────────
     Elements fade in once their top edge comes onto the screen. Anything
     already scrolled past (fast flick, anchor jump) is revealed too, so no
     content is ever left invisible. */
  var observer = null; // kept for page hooks; reveal uses a scroll sweep
  function setupReveal() {
    var pending = Array.prototype.slice.call(document.querySelectorAll('[data-reveal], .reveal-img'));
    if (reduceMotion.matches) { pending.forEach(function (el) { el.classList.add('is-in'); }); return; }
    var ticking = false;
    function sweep() {
      ticking = false;
      var line = window.innerHeight * 0.94;
      pending = pending.filter(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return true;  // not displayed at this size
        if (r.top < line) { el.classList.add('is-in'); return false; }
        return true;
      });
      if (!pending.length) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(sweep); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // first sweep after first paint so on-screen content still gets its fade
    requestAnimationFrame(function () { requestAnimationFrame(sweep); });
  }

  /* ── Headline decode ──────────────────────────────────────────────
     [data-scramble] starts as random characters and settles into the real
     letters from left to right, once. Each letter's width is measured and
     locked first so lines never reflow; the original markup is restored
     afterwards. Screen readers get the plain text from an .sr-only copy. */
  var SCRAMBLE_WIDE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#<>=+';
  var SCRAMBLE_SLIM = '1I|/:!';
  function setupScramble() {
    document.querySelectorAll('[data-scramble]').forEach(function (el) {
      if (reduceMotion.matches) { el.classList.add('is-in'); return; }
      var original = el.innerHTML;
      var text = el.textContent;
      var started = false;

      function start() {
        if (started) return;
        started = true;
        // words in nowrap spans, letters in inline-block spans; spaces stay text
        var html = '';
        text.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { html += ' '; return; }
          html += '<span class="scr-word">' + part.split('').map(function (c) {
            return '<span class="scr-ch">' + esc(c) + '</span>';
          }).join('') + '</span>';
        });
        el.innerHTML = '<span class="sr-only">' + esc(text) + '</span><span aria-hidden="true">' + html + '</span>';

        var fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
        var chars = Array.prototype.map.call(el.querySelectorAll('.scr-ch'), function (span) {
          var w = span.getBoundingClientRect().width;
          return { span: span, final: span.textContent, pool: w < fontSize * 0.36 ? SCRAMBLE_SLIM : SCRAMBLE_WIDE, w: w };
        });
        function noise(c) { c.span.textContent = c.pool.charAt(Math.floor(Math.random() * c.pool.length)); }
        chars.forEach(function (c) { c.span.style.width = c.w + 'px'; c.span.classList.add('is-noise'); noise(c); });
        el.classList.add('is-in');

        var duration = 1000, spread = 0.7, t0 = null, lastSwap = 0;
        function frame(now) {
          if (t0 === null) t0 = now;
          var p = (now - t0) / duration;
          var swap = now - lastSwap > 50;  // change noise ~20 times a second
          if (swap) lastSwap = now;
          var done = true;
          chars.forEach(function (c, i) {
            if (c.settled) return;
            // letter i settles at a point that moves left to right across the run
            if (p >= (1 - spread) + spread * (i / chars.length)) {
              c.settled = true;
              c.span.textContent = c.final;
              c.span.classList.remove('is-noise');
              return;
            }
            done = false;
            if (swap) noise(c);
          });
          if (done) el.innerHTML = original;
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }

      if (document.fonts && document.fonts.ready) document.fonts.ready.then(start, start);
      else start();
      setTimeout(start, 1000);  // fallback if font loading never settles
    });
  }

  /* ── Problem blocks: one open at a time ───────────────────────────
     Opens on hover (mouse), on tap/click and on keyboard focus. Without
     JS all blocks stay open (CSS only collapses them under .js). */
  function setupProbs() {
    var blocks = Array.prototype.slice.call(document.querySelectorAll('.prob'));
    if (!blocks.length) return;
    function open(target) {
      blocks.forEach(function (b) {
        var on = b === target;
        b.classList.toggle('is-open', on);
        var btn = b.querySelector('.prob-toggle');
        if (btn) btn.setAttribute('aria-expanded', String(on));
        var sign = b.querySelector('.prob-sign');
        if (sign) sign.textContent = on ? '\u2212' : '+';
      });
    }
    var hover = window.matchMedia('(hover: hover) and (pointer: fine)');
    var hoverTimer;
    blocks.forEach(function (b) {
      // short delay so a pointer just passing across doesn't flick blocks open
      b.addEventListener('mouseenter', function () {
        if (!hover.matches) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function () { open(b); }, 140);
      });
      b.addEventListener('mouseleave', function () { clearTimeout(hoverTimer); });
      b.addEventListener('click', function () { open(b); });
      b.addEventListener('focusin', function () { open(b); });
    });
  }

  /* ── Photographs fade in once loaded ─────────────────────────────── */
  function revealMedia(container) {
    if (!container) return;
    var img = container.querySelector('img');
    function show() { requestAnimationFrame(function () { container.classList.add('is-in'); }); }
    if (!img || img.complete) show(); else { img.addEventListener('load', show); img.addEventListener('error', show); }
  }

  /* ── Copy email address ───────────────────────────────────────────── */
  function setupCopy() {
    document.querySelectorAll('[data-copy]').forEach(function (btn) {
      var label = btn.textContent;
      var status = document.getElementById(btn.getAttribute('aria-describedby') || '');
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-copy');
        var done = function () {
          btn.textContent = 'Copied';
          btn.classList.add('is-copied');
          if (status) status.textContent = 'Email address copied to clipboard';
          clearTimeout(btn._t);
          btn._t = setTimeout(function () {
            btn.textContent = label; btn.classList.remove('is-copied');
            if (status) status.textContent = '';
          }, 2000);
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(value).then(done, fallback);
        } else { fallback(); }
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = value; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
          document.body.removeChild(ta);
        }
      });
    });
  }

  /* ── Boot ─────────────────────────────────────────────────────────── */
  root.classList.add('js');
  if (page.beforeReveal) page.beforeReveal();
  setupReveal();
  setupScramble();
  setupProbs();
  if (page.afterReveal) page.afterReveal({ observer: observer, reduceMotion: reduceMotion });
  revealMedia(document.querySelector('.hero-media'));  // careers photo band
  revealMedia(document.querySelector('.home-hero'));   // homepage hero
  setupScrollSpy();
  setupCopy();
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  window.addEventListener('resize', onScrollHeader);

  window.__fafnerBooted = true;
})();
