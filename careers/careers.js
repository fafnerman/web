/* FAFNER AERO — Careers: role data, positions filter, role page.
   Loaded before ../assets/site.js, which handles header, menu and motion. */

/* ── Open positions ──────────────────────────────────────────────────────
   Edit this list to publish roles. Each entry becomes a row on /careers/
   and a page at /careers/role.html?id=<id>.
   Optional fields left empty ('' or []) are simply not shown.            */
var FAFNER_ROLES = [
  {
    id: 'student-assistant-mechanical-engineer',
    title: 'Student Assistant, Mechanical Engineer',
    discipline: 'Engineering',
    location: 'Remote / on-site',
    type: 'Student assistant',
    clearance: 'Must be eligible for a Danish security clearance',
    applyBy: '',         // e.g. '1 December 2026'
    summary: '',         // a short paragraph about the role
    duties: [],          // 'What you will do' bullet points
    requirements: []     // 'What we are looking for' bullet points
  },
  {
    id: 'mechanical-engineer-part-time',
    title: 'Mechanical Engineer',
    discipline: 'Engineering',
    location: 'Remote / on-site',
    type: 'Part-time',
    clearance: '',
    applyBy: '',
    summary: '',
    duties: [],
    requirements: []
  }
];

var FAFNER_DISCIPLINES = ['Engineering', 'Production', 'Operations', 'Business'];
var FAFNER_EMAIL = 'contact@fafneraero.com';

(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mailto(subject) {
    return 'mailto:' + FAFNER_EMAIL + '?subject=' + encodeURIComponent(subject);
  }

  /* ── Careers index: positions list + filter ───────────────────────── */
  function setupPositions(api) {
    var list = document.getElementById('roles');
    var filterBar = document.getElementById('filters');
    var empty = document.getElementById('roles-empty');
    if (!list || !filterBar) return;
    var current = 'All';

    // Only offer filters for disciplines that currently have roles; hide the bar if there is nothing to filter.
    var inUse = FAFNER_DISCIPLINES.filter(function (d) { return FAFNER_ROLES.some(function (r) { return r.discipline === d; }); });
    if (inUse.length < 2) filterBar.hidden = true;
    filterBar.innerHTML = ['All'].concat(inUse).map(function (d) {
      return '<button type="button" class="filter" aria-pressed="' + (d === current) + '" data-filter="' + esc(d) + '">' + esc(d) + '</button>';
    }).join('');

    function rowHTML(r, i) {
      return '<li><a class="role-row sub enter" style="--i:' + i + '" href="role.html?id=' + encodeURIComponent(r.id) + '">' +
        '<span class="role-loc">' + esc(r.location) + '</span>' +
        '<span class="role-title">' + esc(r.title) + '</span>' +
        '<span class="role-type">' + esc(r.type) + '</span>' +
        '<span class="role-go"><span class="role-go-t">View role</span><span class="role-arr" aria-hidden="true">\u2192</span></span></a></li>';
    }

    // Roles grouped under a discipline header, e.g. "Engineering (2)"
    function render(animate) {
      var rows = FAFNER_ROLES.filter(function (r) { return current === 'All' || r.discipline === current; });
      var i = 0;
      list.innerHTML = FAFNER_DISCIPLINES.map(function (d) {
        var group = rows.filter(function (r) { return r.discipline === d; });
        if (!group.length) return '';
        return '<li class="role-group"><h3 class="role-group-k">' + esc(d) + ' (' + group.length + ')</h3>' +
          '<ul class="role-list">' + group.map(function (r) { return rowHTML(r, i++); }).join('') + '</ul></li>';
      }).join('');
      if (!animate) list.querySelectorAll('.enter').forEach(function (el) { el.classList.remove('enter'); });
      empty.hidden = rows.length !== 0;
    }

    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter');
      if (!btn || btn.dataset.filter === current) return;
      current = btn.dataset.filter;
      filterBar.querySelectorAll('.filter').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      if (api.reduceMotion.matches) { render(false); return; }
      list.classList.add('is-leaving');
      setTimeout(function () { list.classList.remove('is-leaving'); render(true); }, 200);
    });

    render(false);
  }

  /* ── Role detail page ─────────────────────────────────────────────── */
  function setupRolePage() {
    var page = document.getElementById('role-page');
    if (!page) return;
    var id = new URLSearchParams(window.location.search).get('id');
    var role = FAFNER_ROLES.filter(function (r) { return r.id === id; })[0];

    if (!role) {
      document.title = 'Position not found — Careers at FAFNER';
      page.querySelector('[data-f="discipline"]').textContent = 'Careers';
      page.querySelector('[data-f="title"]').textContent = 'This position is no longer open.';
      page.querySelector('.spec').remove();
      page.querySelector('.role-body').innerHTML = '<p>See all <a href="./#positions" style="text-decoration:underline;text-underline-offset:4px">open positions</a>, or send an open application to ' + esc(FAFNER_EMAIL) + '.</p>';
      page.querySelector('.apply .btn').href = mailto('Open application');
      return;
    }

    document.title = role.title + ' — Careers at FAFNER';
    function set(f, v) {
      var el = page.querySelector('[data-f="' + f + '"]');
      if (!el) return;
      if (v) { el.textContent = v; return; }
      var cell = el.closest('[data-hide-empty]');
      if (cell) cell.remove(); else el.textContent = '';
    }
    set('discipline', role.discipline);
    set('title', role.title);
    set('location', role.location);
    set('type', role.type);
    set('clearance', role.clearance);
    set('applyBy', role.applyBy);
    set('summary', role.summary);
    function list(f, items) {
      var el = page.querySelector('[data-f="' + f + '"]');
      if (!items || !items.length) { el.closest('section').remove(); return; }
      el.innerHTML = items.map(function (t) { return '<li class="ruled">' + esc(t) + '</li>'; }).join('');
    }
    list('duties', role.duties);
    list('requirements', role.requirements);
    if (!role.summary) { var sum = page.querySelector('[data-f="summary"]'); if (sum) sum.closest('section').remove(); }
    var body = page.querySelector('.role-body');
    if (body && !body.children.length) {
      body.innerHTML = '<section><h3>The role</h3><p>For details about this position, email us at ' + esc(FAFNER_EMAIL) + ' and put the role title in the subject line.</p></section>';
    }
    page.querySelector('.apply .btn').href = mailto('Application — ' + role.title);
  }

  window.FafnerPage = {
    beforeReveal: setupRolePage,
    afterReveal: setupPositions
  };
})();
