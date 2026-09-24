/* Stand-ins for the Squarespace component scripts stripped from these pages.
   Each block only touches its own component, so pages without it are unaffected. */
(function () {
  function props(el, attr) {
    try { return JSON.parse(el.getAttribute(attr) || '{}'); } catch (e) { return {}; }
  }

  // ── Section dividers ──
  // Squarespace computes the divider clip path in JS; the saved markup only has
  // an empty placeholder path, which hides the whole section background.
  document.querySelectorAll('.section-border[data-controller~="SectionDivider"]').forEach(function (border) {
    var section = border.closest('section');
    var divider = (props(section, 'data-current-context').divider) || {};
    var h = divider.height ? divider.height.value + divider.height.unit : '0px';
    if (divider.enabled && divider.type === 'soft-corners') {
      var radii = divider.isFlipY ? h + ' ' + h + ' 0 0' : '0 0 ' + h + ' ' + h;
      border.style.clipPath = 'inset(0 round ' + radii + ')';
    } else {
      border.style.clipPath = 'none';
    }
  });

  // ── Gallery reel ── arrows scroll the strip one slide at a time.
  document.querySelectorAll('.gallery-reel').forEach(function (reel) {
    var list = reel.querySelector('.gallery-reel-list');
    var items = reel.querySelectorAll('.gallery-reel-item');
    if (!list || !items.length) return;
    function step(dir) {
      var mid = list.scrollLeft + list.clientWidth / 2;
      var current = 0;
      items.forEach(function (item, i) {
        if (item.offsetLeft <= mid) current = i;
      });
      var next = (current + dir + items.length) % items.length;
      var target = items[next];
      list.scrollLeft = target.offsetLeft - (list.clientWidth - target.offsetWidth) / 2;
    }
    var prev = reel.querySelector('[data-previous]');
    var nextBtn = reel.querySelector('[data-next]');
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
  });

  // ── Masonry gallery ── column count and gutter come from the gallery's settings.
  document.querySelectorAll('.gallery-masonry').forEach(function (g) {
    var p = props(g, 'data-props');
    var wrapper = g.querySelector('.gallery-masonry-wrapper');
    if (!wrapper) return;
    if (p.numColumns) wrapper.style.setProperty('--shim-cols', p.numColumns);
    if (p.gutter != null) wrapper.style.setProperty('--shim-gutter', Math.min(p.gutter, 40) + 'px');
  });

  // ── List section banner slideshow ──
  document.querySelectorAll('.user-items-list-banner-slideshow').forEach(function (show) {
    var slides = show.querySelectorAll('.slide');
    if (!slides.length) return;
    var index = 0;
    function go(i) {
      slides[index].classList.remove('shim-active');
      index = (i + slides.length) % slides.length;
      slides[index].classList.add('shim-active');
    }
    slides[0].classList.add('shim-active');
    show.querySelectorAll('[class*="arrow-button--left"]').forEach(function (b) {
      b.addEventListener('click', function () { go(index - 1); });
    });
    show.querySelectorAll('[class*="arrow-button--right"]').forEach(function (b) {
      b.addEventListener('click', function () { go(index + 1); });
    });
  });

  // ── Lightbox ── galleries that had Squarespace's lightbox turned on.
  document.querySelectorAll('.gallery-reel, .gallery-masonry, .gallery-grid').forEach(function (g) {
    var p = props(g, 'data-props');
    if (!p.lightboxEnabled && !g.hasAttribute('data-lightbox-enabled')) return;
    g.querySelectorAll('img').forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () {
        var box = document.createElement('div');
        box.className = 'shim-lightbox';
        var big = document.createElement('img');
        big.src = img.currentSrc || img.src;
        big.alt = img.alt;
        box.appendChild(big);
        function close() { box.remove(); document.removeEventListener('keydown', onKey); }
        function onKey(e) { if (e.key === 'Escape') close(); }
        box.addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        document.body.appendChild(box);
      });
    });
  });
})();
