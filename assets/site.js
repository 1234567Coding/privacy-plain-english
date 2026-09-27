/* Privacy Plain English — shared site enhancements.
   Progressive enhancement: every feature degrades gracefully if JS fails.
   Features: search, table of contents + scroll-spy, reading progress bar,
   sortable tables, FAQ accordions, dark mode toggle, back-to-top. */
(function () {
  'use strict';

  var doc = document;

  function onReady(fn) {
    if (doc.readyState !== 'loading') fn();
    else doc.addEventListener('DOMContentLoaded', fn);
  }

  /* ---------- Dark mode (applied ASAP; toggle injected later) ---------- */
  var themeKey = 'ppe-theme';
  function currentTheme() {
    try {
      var saved = localStorage.getItem(themeKey);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark' : 'light';
  }
  function applyTheme(t) {
    doc.documentElement.setAttribute('data-theme', t);
  }
  applyTheme(currentTheme());

  /* ---------- Site root helper (search-index.json + article links) ---------- */
  // styles.css lives at the site root on every page, so use it to find root.
  var rootUrl = (function () {
    var link = doc.querySelector('link[rel="stylesheet"]');
    if (link && link.href) return link.href.replace(/[^/]+$/, '');
    return '';
  })();
  var isArticlePage = /\/articles\//.test(location.pathname);

  onReady(function () {
    initThemeToggle();
    initSearch();
    initToc();
    initProgressBar();
    initSortableTables();
    initFaqAccordions();
    initBackToTop();
  });

  /* ---------- 6. Dark mode toggle ---------- */
  function initThemeToggle() {
    if (doc.querySelector('.theme-toggle')) return;
    var header = doc.querySelector('.header-inner');
    var navToggle = doc.getElementById('navToggle');
    if (!header || !navToggle) return;
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.title = 'Toggle dark mode';
    function render() {
      var t = currentTheme();
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(themeKey, next); } catch (e) {}
      applyTheme(next);
      render();
    });
    render();
    header.insertBefore(btn, navToggle);
  }

  /* ---------- 1. Site-wide client-side search ---------- */
  var searchIndex = null;
  var searchLoading = null;
  function loadSearchIndex() {
    if (searchIndex) return Promise.resolve(searchIndex);
    if (!searchLoading) {
      searchLoading = fetch(rootUrl + 'search-index.json', { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('index fetch failed'); return r.json(); })
        .then(function (data) { searchIndex = Array.isArray(data) ? data : []; return searchIndex; })
        .catch(function () { searchIndex = []; return searchIndex; });
    }
    return searchLoading;
  }

  function norm(s) {
    // Strip separators entirely so "wifi" matches "Wi-Fi" and "well-known".
    return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function initSearch() {
    var nav = doc.querySelector('nav.site-nav');
    var ul = nav && nav.querySelector('ul');
    if (!ul || ul.querySelector('.search-item')) return;

    var li = doc.createElement('li');
    li.className = 'search-item';
    li.innerHTML =
      '<div class="search" role="search">' +
        '<label class="visually-hidden" for="siteSearch">Search articles</label>' +
        '<input id="siteSearch" class="search-input" type="search" placeholder="Search articles…" autocomplete="off" aria-expanded="false" aria-controls="searchResults" role="combobox" aria-autocomplete="list">' +
        '<ul id="searchResults" class="search-results" role="listbox" hidden></ul>' +
      '</div>';
    ul.appendChild(li);

    var input = li.querySelector('.search-input');
    var results = li.querySelector('.search-results');
    var activeIdx = -1;
    var prefix = isArticlePage ? '../' : '';

    function close() {
      results.hidden = true;
      results.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      activeIdx = -1;
    }

    function render(matches, q) {
      results.innerHTML = '';
      activeIdx = -1;
      if (!q) { close(); return; }
      if (!matches.length) {
        var none = doc.createElement('li');
        none.className = 'search-empty';
        none.textContent = 'No articles match "' + q + '".';
        results.appendChild(none);
      } else {
        matches.slice(0, 8).forEach(function (m, i) {
          var item = doc.createElement('li');
          item.setAttribute('role', 'option');
          item.id = 'searchOpt' + i;
          var a = doc.createElement('a');
          a.href = prefix + m.url;
          var t = doc.createElement('span');
          t.className = 'search-title';
          t.textContent = m.title;
          var x = doc.createElement('span');
          x.className = 'search-excerpt';
          x.textContent = m.excerpt || '';
          a.appendChild(t);
          a.appendChild(x);
          item.appendChild(a);
          results.appendChild(item);
        });
      }
      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function search(q) {
      var words = (q || '').trim().toLowerCase().split(/\s+/).map(norm).filter(function (w) { return w; });
      if (!words.length) { close(); return; }
      loadSearchIndex().then(function (idx) {
        var matches = idx.filter(function (e) {
          var hay = norm(e.title + ' ' + (e.excerpt || '') + ' ' + (e.headings || []).join(' '));
          return words.every(function (word) { return hay.indexOf(word) !== -1; });
        });
        render(matches, input.value.trim());
      });
    }

    var debounce = null;
    input.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () { search(input.value); }, 150);
    });

    input.addEventListener('keydown', function (e) {
      var options = results.querySelectorAll('[role="option"]');
      if (e.key === 'Escape') { close(); input.blur(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!options.length) return;
        e.preventDefault();
        activeIdx = e.key === 'ArrowDown'
          ? (activeIdx + 1) % options.length
          : (activeIdx - 1 + options.length) % options.length;
        options.forEach(function (o, i) { o.classList.toggle('active', i === activeIdx); });
        input.setAttribute('aria-activedescendant', options[activeIdx].id);
      } else if (e.key === 'Enter' && activeIdx >= 0 && options[activeIdx]) {
        var link = options[activeIdx].querySelector('a');
        if (link) { e.preventDefault(); location.href = link.href; }
      }
    });

    doc.addEventListener('click', function (e) {
      if (!li.contains(e.target)) close();
    });

    // Warm the index on first focus so results feel instant.
    input.addEventListener('focus', function warm() {
      loadSearchIndex();
      input.removeEventListener('focus', warm);
    }, { once: true });
  }

  /* ---------- 2. Article table of contents + scroll-spy ---------- */
  function slugify(text) {
    return text.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
      || 'section';
  }

  function initToc() {
    var article = doc.querySelector('.article-body');
    if (!article || article.dataset.tocDone) return;
    article.dataset.tocDone = 'true';
    var headings = Array.prototype.filter.call(
      article.querySelectorAll('h2, h3'),
      function (h) { return !h.closest('.keep-reading'); }
    );
    if (headings.length < 2) return;

    var used = {};
    headings.forEach(function (h) {
      if (!h.id) {
        var base = slugify(h.textContent), id = base, n = 2;
        while (used[id] || doc.getElementById(id)) { id = base + '-' + (n++); }
        used[id] = true;
        h.id = id;
      }
    });

    var aside = doc.createElement('aside');
    aside.className = 'toc';
    aside.setAttribute('aria-label', 'Table of contents');
    aside.innerHTML = '<p class="toc-title">On this page</p>';
    var list = doc.createElement('ul');
    headings.forEach(function (h) {
      var li = doc.createElement('li');
      li.className = h.tagName === 'H3' ? 'toc-sub' : 'toc-top';
      var a = doc.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.dataset.target = h.id;
      li.appendChild(a);
      list.appendChild(li);
    });
    aside.appendChild(list);

    var layout = doc.createElement('div');
    layout.className = 'article-layout';
    article.parentNode.insertBefore(layout, article);
    layout.appendChild(aside);
    layout.appendChild(article);
    doc.documentElement.classList.add('has-toc');

    // Scroll-spy
    var links = list.querySelectorAll('a');
    function setActive(id) {
      links.forEach(function (a) {
        a.classList.toggle('active', a.dataset.target === id);
      });
    }
    if ('IntersectionObserver' in window) {
      var current = null;
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) current = en.target.id;
        });
        if (current) setActive(current);
      }, { rootMargin: '-20% 0px -70% 0px' });
      headings.forEach(function (h) { obs.observe(h); });
    }
  }

  /* ---------- 3. Reading progress bar ---------- */
  function initProgressBar() {
    var article = doc.querySelector('.article-body');
    if (!article || doc.querySelector('.reading-progress')) return;
    var bar = doc.createElement('div');
    bar.className = 'reading-progress';
    bar.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(bar);
    var fill = doc.createElement('div');
    fill.className = 'reading-progress-fill';
    bar.appendChild(fill);

    var ticking = false;
    function update() {
      ticking = false;
      var top = article.getBoundingClientRect().top + window.scrollY;
      var total = article.offsetHeight - window.innerHeight;
      var done = window.scrollY - top;
      var pct = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
      fill.style.width = (pct * 100).toFixed(1) + '%';
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- 4. Sortable comparison tables ---------- */
  function initSortableTables() {
    var tables = doc.querySelectorAll('.article-body table');
    tables.forEach(function (table) {
      if (table.dataset.sortableDone) return;
      table.dataset.sortableDone = 'true';
      var thead = table.querySelector('thead');
      if (!thead) return;
      var ths = thead.querySelectorAll('th');
      ths.forEach(function (th, col) {
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'sort-btn';
        btn.setAttribute('aria-label', 'Sort by ' + th.textContent.trim());
        btn.innerHTML = '<span>' + th.innerHTML + '</span><span class="sort-arrow" aria-hidden="true"></span>';
        th.innerHTML = '';
        th.appendChild(btn);
        th.setAttribute('aria-sort', 'none');
        btn.addEventListener('click', function () {
          var dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
          ths.forEach(function (o) { o.setAttribute('aria-sort', 'none'); });
          th.setAttribute('aria-sort', dir);
          sortTable(table, col, dir === 'ascending');
        });
      });
    });
  }

  function cellValue(row, col) {
    var cell = row.children[col];
    var v = cell ? cell.textContent.trim() : '';
    var num = parseFloat(v.replace(/[$,%]/g, '').replace(/,/g, ''));
    return { text: v.toLowerCase(), num: isNaN(num) ? null : num };
  }

  function sortTable(table, col, asc) {
    var tbody = table.querySelector('tbody') || table;
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    rows.sort(function (a, b) {
      var va = cellValue(a, col), vb = cellValue(b, col);
      var cmp;
      if (va.num !== null && vb.num !== null) cmp = va.num - vb.num;
      else cmp = va.text < vb.text ? -1 : va.text > vb.text ? 1 : 0;
      return asc ? cmp : -cmp;
    });
    rows.forEach(function (r) { tbody.appendChild(r); });
  }

  /* ---------- 5. FAQ accordions ---------- */
  function initFaqAccordions() {
    doc.querySelectorAll('dl.faq').forEach(function (dl, dlIdx) {
      Array.prototype.forEach.call(dl.querySelectorAll('dt'), function (dt, i) {
        if (dt.querySelector('button.faq-q')) return; // already enhanced
        var dd = dt.nextElementSibling;
        if (!dd || dd.tagName !== 'DD') return;
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'faq-q';
        btn.setAttribute('aria-expanded', 'false');
        var panelId = 'faq-panel-' + dlIdx + '-' + i;
        btn.setAttribute('aria-controls', panelId);
        var chev = doc.createElement('span');
        chev.className = 'faq-chevron';
        chev.setAttribute('aria-hidden', 'true');
        chev.textContent = '▾';
        var label = doc.createElement('span');
        label.className = 'faq-q-text';
        label.innerHTML = dt.innerHTML;
        btn.appendChild(label);
        btn.appendChild(chev);
        dd.id = panelId;
        dd.hidden = true;
        dt.innerHTML = '';
        dt.appendChild(btn);
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', String(!open));
          dd.hidden = open;
        });
      });
    });
  }

  /* ---------- 7. Back-to-top button ---------- */
  function initBackToTop() {
    if (doc.querySelector('.to-top')) return;    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.title = 'Back to top';
    btn.textContent = '↑';
    btn.hidden = true;
    doc.body.appendChild(btn);
    var ticking = false;
    function update() {
      ticking = false;
      btn.hidden = window.scrollY < 600;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
