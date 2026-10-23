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
    if (overlay) {
      var hero = document.querySelector('.home-hero');
      var heroH = hero ? hero.offsetHeight : window.innerHeight;
      header.classList.toggle('is-solid', window.scrollY > heroH - header.offsetHeight - 8);
    }
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
        // [data-reveal-late] waits until it is well onto the screen, so its fade is seen
        var at = el.hasAttribute('data-reveal-late') ? window.innerHeight * 0.8 : line;
        if (r.top < at) { el.classList.add('is-in'); return false; }
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
        hoverTimer = setTimeout(function () { open(b); }, 90);
      });
      b.addEventListener('mouseleave', function () { clearTimeout(hoverTimer); });
      b.addEventListener('click', function () { open(b); });
      b.addEventListener('focusin', function () { open(b); });
    });
  }

  /* ── Range animation ─────────────────────────────────────────────
     Four unguided rockets fall short and scatter; then two guided rockets
     fly the same long arc and both land on the target. Every frame is
     computed from the elapsed time alone. Looping, each round fades out
     before the next; stopped, all inline changes are removed and the
     drawing is back to its static form (also what reduced motion and
     no-JS visitors see). */
  function rangeAnimation(svg) {
    var NS = 'http://www.w3.org/2000/svg';
    var reduce = reduceMotion;
    var all = function (s) { return Array.prototype.slice.call(svg.querySelectorAll(s)); };

    // when each shot fires and how long it flies (ms)
    var TIMING = [
      { at: 750,  dur: 900 },
      { at: 1100, dur: 950 },
      { at: 1450, dur: 1000 },
      { at: 1800, dur: 1050 },
      { at: 3800, dur: 2000 },  // guided
      { at: 4500, dur: 2000 }   // guided, same lane
    ];
    var shots = all('[data-ra-shot]').map(function (el) {
      var i = +el.getAttribute('data-ra-shot');
      var n = el.getAttribute('data-ra-curve').split(' ').map(Number);  // x y, control x y, x y
      var s = {
        el: el, d: el.getAttribute('d'), guided: el.hasAttribute('data-ra-guided'),
        p0: [n[0], n[1]], p1: [n[2], n[3]], p2: [n[4], n[5]],
        at: TIMING[i].at, dur: TIMING[i].dur
      };
      s.dashes = dasher(s);
      return s;
    });
    var dots = all('[data-ra-dot]');
    var labelWithout = svg.querySelector('[data-ra-label="without"]');
    var labelWith = svg.querySelector('[data-ra-label="with"]');
    var unguided = shots.filter(function (s) { return !s.guided; });
    var guidedShots = shots.filter(function (s) { return s.guided; });
    var landed = function (list) { return Math.max.apply(null, list.map(function (s) { return s.at + s.dur; })); };
    var scatterAt = landed(unguided);                          // last miss is down
    var lastHitAt = landed(guidedShots);
    var END = lastHitAt + 900;              // single play: ends on the full drawing
    // looping: hold the full drawing, fade lines, dots and labels out, and start
    // the next round from that empty state, so there is no jump between rounds
    var FADE_AT = lastHitAt + 2000, FADE = 1000, LOOP_END = FADE_AT + FADE + 500;
    // remember each animated element's own inline style, to put back exactly
    var touched = shots.map(function (s) { return s.el; }).concat(dots, [labelWithout, labelWith]);
    var saved = touched.map(function (el) { return el.getAttribute('style'); });

    var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
    var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };
    var easeInOut = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    var prog = function (ms, start, len) { return clamp((ms - start) / len); };
    function point(s, t) {
      var u = 1 - t;
      return [u * u * s.p0[0] + 2 * u * t * s.p1[0] + t * t * s.p2[0],
              u * u * s.p0[1] + 2 * u * t * s.p1[1] + t * t * s.p2[1]];
    }
    function angle(s, t) {
      var dx = 2 * (1 - t) * (s.p1[0] - s.p0[0]) + 2 * t * (s.p2[0] - s.p1[0]);
      var dy = 2 * (1 - t) * (s.p1[1] - s.p0[1]) + 2 * t * (s.p2[1] - s.p1[1]);
      return Math.atan2(dy, dx) * 180 / Math.PI;
    }
    // Dashed line along a curve, drawn as real short segments (about 3 units
    // each, an odd count so it starts and ends on a dash). Being geometry, the
    // dashes scale with the drawing and look the same in every browser.
    // Returns a function giving the dashes flown up to curve parameter t.
    function dasher(c) {
      var N = 120, pts = [], len = [0], i;
      for (i = 0; i <= N; i++) pts.push(point(c, i / N));
      for (i = 1; i <= N; i++) len.push(len[i - 1] + Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2)));
      var L = len[N], steps = Math.round(L / 3); if (steps % 2 === 0) steps++;
      var seg = L / steps;
      function at(s) {
        var lo = 0, hi = N;
        while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (len[mid] < s) lo = mid; else hi = mid; }
        var f = (s - len[lo]) / ((len[hi] - len[lo]) || 1);
        return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f];
      }
      return function (t) {
        var x = t * N, k = Math.min(Math.floor(x), N - 1), s = t >= 1 ? L : len[k] + (len[k + 1] - len[k]) * (x - k), d = '';
        for (var j = 0; j * seg < s - 1e-9; j += 2) {
          var a = at(j * seg), b = at(Math.min((j + 1) * seg, s));
          d += 'M' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) + 'L' + b[0].toFixed(2) + ' ' + b[1].toFixed(2);
        }
        return d || 'M0 0';
      };
    }
    function make(tag, attrs) {
      var el = document.createElementNS(NS, tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      return el;
    }

    // overlay: rocket bodies, launch flashes and impact rings (removed when done)
    var layer = null, fx = [];
    function build() {
      layer = make('g', { 'data-ra-layer': '' });
      fx = shots.map(function (s) {
        var color = s.guided ? 'var(--prob-stroke)' : 'var(--color-neutral-600)';
        var impact = s.guided ? 'var(--ra-hit)' : 'var(--ra-miss)';
        var o = {
          rocket: make('path', { d: 'M-5 -1.2 L2 -1.2 L4.6 0 L2 1.2 L-5 1.2 Z', style: 'fill:' + color }),
          flash: make('circle', { cx: s.p0[0], cy: s.p0[1], r: 0, style: 'fill:' + color }),
          ring: make('circle', { cx: s.p2[0], cy: 126, r: 0, 'stroke-width': 1, style: 'stroke:' + impact })
        };
        layer.appendChild(o.flash); layer.appendChild(o.ring); layer.appendChild(o.rocket);
        return o;
      });
      svg.appendChild(layer);
    }

    function render(ms) {
      var shown = 1 - easeInOut(prog(ms, FADE_AT, FADE));   // end-of-round fade (looping only)
      shots.forEach(function (s, i) {
        var t = prog(ms, s.at, s.dur), o = fx[i];
        // trail
        s.el.style.opacity = t > 0 ? shown : 0;
        s.el.setAttribute('d', t > 0 ? s.dashes(t) : s.d);
        // rocket body, gone on impact
        var p = point(s, t);
        o.rocket.style.opacity = t > 0 && t < 1 ? 1 : 0;
        o.rocket.setAttribute('transform', 'translate(' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + ') rotate(' + angle(s, t).toFixed(1) + ')');
        // launch flash
        var f = prog(ms, s.at, 320);
        o.flash.setAttribute('r', (1 + 5 * easeOut(f)).toFixed(2));
        o.flash.style.opacity = f > 0 && f < 1 ? .45 * (1 - f) : 0;
        // impact ring
        var r = prog(ms, s.at + s.dur, s.guided ? 900 : 600);
        o.ring.setAttribute('r', (2 + (s.guided ? 14 : 9) * easeOut(r)).toFixed(2));
        o.ring.style.opacity = r > 0 && r < 1 ? .7 * (1 - r) : 0;
      });
      // impact dots pop in where each rocket lands (red misses, green hit)
      dots.forEach(function (d) {
        var s = shots[+d.getAttribute('data-ra-dot')];
        d.setAttribute('r', (2 * easeOut(prog(ms, s.at + s.dur, 220))).toFixed(2));
        d.style.opacity = shown;
      });
      // each label introduces its round: "without kit" before the first three
      // shots, "with guidance kit" once they have landed, before the guided shot
      labelWithout.style.opacity = easeOut(prog(ms, 0, 600)) * shown;
      labelWith.style.opacity = easeOut(prog(ms, scatterAt + 300, 600)) * shown;
    }

    // back to the static drawing, untouched
    function clear() {
      if (layer) { layer.remove(); layer = null; }
      shots.forEach(function (s) { s.el.setAttribute('d', s.d); });
      dots.forEach(function (d) { d.setAttribute('r', 2); });
      touched.forEach(function (el, i) { el.setAttribute('style', saved[i]); });
    }

    var raf = 0, start = 0, speed = 1, loop = false, onDone = null;
    function tick(now) {
      var ms = (now - start) * speed;
      if (loop && ms >= LOOP_END) { start = now; ms = 0; }          // next round, seamlessly
      else if (!loop && ms >= END) { stop(); clear(); if (onDone) onDone(); return; }
      render(ms);
      raf = requestAnimationFrame(tick);
    }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    return {
      // empty stage, ready to play (call before it comes into view)
      reset: function () { stop(); clear(); if (reduce.matches) return; build(); render(0); },
      // looping, it starts from the full drawing and fades it out first (the
      // same fade as between rounds), so starting never jumps
      play: function () {
        stop(); clear();
        if (reduce.matches) return;  // reduced motion: keep the static drawing
        var from = loop ? FADE_AT : 0;
        build(); render(from);
        start = performance.now() - from / speed; raf = requestAnimationFrame(tick);
      },
      finish: function () { stop(); clear(); },
      get playing() { return raf !== 0; },
      set speed(v) { speed = v; },
      set loop(v) { loop = !!v; },
      set onDone(fn) { onDone = fn; }
    };
  }

  /* ── Crew animation ──────────────────────────────────────────────
     Both launchers stand ready; counter-fire hits the forward one, a red
     line strikes it through and it fades; then the rear launcher's
     stand-off distance is drawn out. Plays once and ends on the static
     drawing. */
  function crewAnimation(svg) {
    var NS = 'http://www.w3.org/2000/svg';
    var reduce = reduceMotion;
    var q = function (s) { return svg.querySelector('[data-cr="' + s + '"]'); };
    var A = q('a'), cross = q('cross'), inc = q('in'),
        bar = q('bar'), tickL = q('tick-l'), tickR = q('tick-r'), label = q('label');

    var INTRO = 700;                                       // stand-off fades out, forward launcher fades in
    var INCOMING = { at: INTRO + 700, dur: 1000 };
    var HIT = INCOMING.at + INCOMING.dur;
    var CROSS = HIT + 150, CROSS_DUR = 400;
    var GONE = HIT + 1100, GONE_DUR = 800;                  // hit launcher fades away
    var BAR = GONE + GONE_DUR + 200, BAR_DUR = 900;
    var END = BAR + BAR_DUR + 500;

    var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
    var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };
    var easeInOut = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    var prog = function (ms, start, len) { return clamp((ms - start) / len); };
    function point(c, t) {
      var u = 1 - t;
      return [u * u * c.p0[0] + 2 * u * t * c.p1[0] + t * t * c.p2[0], u * u * c.p0[1] + 2 * u * t * c.p1[1] + t * t * c.p2[1]];
    }
    function angle(c, t) {
      return Math.atan2(2 * (1 - t) * (c.p1[1] - c.p0[1]) + 2 * t * (c.p2[1] - c.p1[1]),
                        2 * (1 - t) * (c.p1[0] - c.p0[0]) + 2 * t * (c.p2[0] - c.p1[0])) * 180 / Math.PI;
    }
    // Dashed line along a curve, drawn as real short segments (about 3 units
    // each, an odd count so it starts and ends on a dash). Being geometry, the
    // dashes scale with the drawing and look the same in every browser.
    // Returns a function giving the dashes flown up to curve parameter t.
    function dasher(c) {
      var N = 120, pts = [], len = [0], i;
      for (i = 0; i <= N; i++) pts.push(point(c, i / N));
      for (i = 1; i <= N; i++) len.push(len[i - 1] + Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2)));
      var L = len[N], steps = Math.round(L / 3); if (steps % 2 === 0) steps++;
      var seg = L / steps;
      function at(s) {
        var lo = 0, hi = N;
        while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (len[mid] < s) lo = mid; else hi = mid; }
        var f = (s - len[lo]) / ((len[hi] - len[lo]) || 1);
        return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f];
      }
      return function (t) {
        var x = t * N, k = Math.min(Math.floor(x), N - 1), s = t >= 1 ? L : len[k] + (len[k + 1] - len[k]) * (x - k), d = '';
        for (var j = 0; j * seg < s - 1e-9; j += 2) {
          var a = at(j * seg), b = at(Math.min((j + 1) * seg, s));
          d += 'M' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) + 'L' + b[0].toFixed(2) + ' ' + b[1].toFixed(2);
        }
        return d || 'M0 0';
      };
    }
    function make(tag, attrs) {
      var el = document.createElementNS(NS, tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      return el;
    }
    var n = inc.getAttribute('data-cr-curve').split(' ').map(Number);   // x y, control x y, x y
    var shot = { d: inc.getAttribute('d'), p0: [n[0], n[1]], p1: [n[2], n[3]], p2: [n[4], n[5]] };
    shot.dashes = dasher(shot);

    // remember what the animation changes, to put it back exactly
    var touched = [A, cross, inc, bar, tickL, tickR, label];
    var ATTRS = ['style', 'd'];
    var saved = touched.map(function (el) {
      return ATTRS.map(function (a) { return el.getAttribute(a); });
    });

    var layer = null, rocket = null, ring = null;
    function build() {
      layer = make('g', { 'data-cr-layer': '' });
      rocket = make('path', { d: 'M-5 -1.2 L2 -1.2 L4.6 0 L2 1.2 L-5 1.2 Z', style: 'fill:var(--color-neutral-700)' });
      ring = make('circle', { cx: shot.p2[0], cy: shot.p2[1], r: 0, 'stroke-width': 1, style: 'stroke:var(--ra-miss)' });
      layer.appendChild(ring); layer.appendChild(rocket);
      svg.appendChild(layer);
    }

    function render(ms) {
      var gone = 1 - easeInOut(prog(ms, GONE, GONE_DUR));    // hit launcher and its traces fade

      var intro = 1 - easeInOut(prog(ms, 0, INTRO * .8));   // static picture's stand-off leaving

      // forward launcher: fades in at the start, fades away after it is hit
      A.style.opacity = easeInOut(prog(ms, INTRO * .3, INTRO * .7)) * gone;

      // counter-fire: trail drawn as the rocket comes in
      var t = prog(ms, INCOMING.at, INCOMING.dur), p = point(shot, t);
      inc.setAttribute('d', t > 0 ? shot.dashes(t) : shot.d);
      inc.style.opacity = t > 0 ? gone : 0;
      rocket.style.opacity = t > 0 && t < 1 ? 1 : 0;
      rocket.setAttribute('transform', 'translate(' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + ') rotate(' + angle(shot, t).toFixed(1) + ')');
      var r = prog(ms, HIT, 700);
      ring.setAttribute('r', (2 + 14 * easeOut(r)).toFixed(2));
      ring.style.opacity = r > 0 && r < 1 ? .7 * (1 - r) : 0;

      // red strike-through drawn across the hit launcher
      var c = easeOut(prog(ms, CROSS, CROSS_DUR));
      cross.style.opacity = c > 0 ? 1 : 0;
      cross.setAttribute('d', 'M-2 98 L' + (-2 + 47 * c).toFixed(2) + ' ' + (98 + 31 * c).toFixed(2));

      // then the stand-off distance of the rear launcher is drawn out
      // (before that, the full bar from the static picture is fading out)
      var b = easeInOut(prog(ms, BAR, BAR_DUR));
      bar.setAttribute('d', 'M52 30 H' + (52 + 358 * (ms < BAR ? 1 : b)).toFixed(2));
      bar.style.opacity = ms < BAR ? intro : 1;
      tickL.style.opacity = ms < BAR ? intro : 1;
      tickR.style.opacity = ms < BAR ? intro : easeOut(prog(ms, BAR + BAR_DUR - 60, 200));
      label.style.opacity = ms < BAR ? intro : easeOut(prog(ms, BAR + BAR_DUR * .5, 600));
    }

    function clear() {
      if (layer) { layer.remove(); layer = null; }
      touched.forEach(function (el, i) {
        ATTRS.forEach(function (a, j) {
          if (saved[i][j] === null) el.removeAttribute(a); else el.setAttribute(a, saved[i][j]);
        });
      });
    }

    var raf = 0, start = 0, speed = 1;
    function tick(now) {
      var ms = (now - start) * speed;
      if (ms >= END) { stop(); clear(); return; }
      render(ms);
      raf = requestAnimationFrame(tick);
    }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    return {
      // starting picture: both launchers, nothing else (call before it comes into view)
      reset: function () { stop(); clear(); if (reduce.matches) return; build(); render(0); },
      play: function () {
        stop(); clear();
        if (reduce.matches) return;  // reduced motion: keep the static drawing
        build(); render(0);
        start = performance.now(); raf = requestAnimationFrame(tick);
      },
      finish: function () { stop(); clear(); },
      get playing() { return raf !== 0; },
      set speed(v) { speed = v; }
    };
  }

  /* ── Box drawings: animate only the open box, while it is on screen ──
     Range loops; Crew plays once each time its box opens. A box that is
     closed or off screen shows its static drawing. */
  function setupFigAnims() {
    if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) return;
    var items = [];
    var range = document.querySelector('[data-range-anim]');
    if (range) { var r = rangeAnimation(range); r.loop = true; items.push({ svg: range, anim: r }); }
    var crew = document.querySelector('[data-crew-anim]');
    if (crew) items.push({ svg: crew, anim: crewAnimation(crew) });
    items.forEach(function (it) {
      var box = it.svg.closest('.prob'), inView = false, active = false;
      function update() {
        var want = inView && box.classList.contains('is-open');
        if (want && !active) { active = true; it.anim.play(); }
        else if (!want && active) { active = false; it.anim.finish(); }
      }
      // watch the HTML wrapper: Safari is unreliable observing SVG
      new IntersectionObserver(function (entries) {
        inView = entries[entries.length - 1].isIntersecting; update();
      }, { threshold: .35 }).observe(it.svg.parentNode);
      new MutationObserver(update).observe(box, { attributes: true, attributeFilter: ['class'] });
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
  setupFigAnims();
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
