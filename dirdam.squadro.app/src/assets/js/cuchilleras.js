/* Cuchilleras page: live font tester (size/weight/width sliders + serif/
   sans toggle). Ported from the standalone dirdam.github.io cuchilleras.html
   — the old page's full-bleed photo slideshow and manual scroll-fade
   overlay are dropped, since this site already fades sections in on scroll
   (see reveal.js) and doesn't use full-bleed photo backgrounds. */
(function () {
  var fontTest = document.getElementById('font-test');
  if (!fontTest) return;

  var sliders = [
    { input: document.getElementById('font-size'), value: document.getElementById('font-size-value'), apply: function (v) { fontTest.style.fontSize = v + 'px'; } },
    { input: document.getElementById('font-weight'), value: document.getElementById('font-weight-value'), apply: function (v) { fontTest.style.fontWeight = v; } },
    { input: document.getElementById('font-width'), value: document.getElementById('font-width-value'), apply: function (v) { fontTest.style.fontStretch = v + '%'; } },
  ];

  function positionValue(slider) {
    // Measured against the input's own offsetLeft/offsetWidth (not
    // getBoundingClientRect, which is relative to the viewport) so this
    // lines up with the bubble's absolute positioning, which is relative to
    // their shared offsetParent (.cuchilleras-slider-bar). The track is
    // inset by the bubble's own half-width on each side (see the CSS), so
    // the bubble's center never travels past the track's own ends and the
    // bubble itself never overhangs past the container's edges.
    var percentage = (slider.input.value - slider.input.min) / (slider.input.max - slider.input.min);
    var bubbleWidth = slider.value.offsetWidth;
    var left = slider.input.offsetLeft + percentage * slider.input.offsetWidth - bubbleWidth / 2;
    slider.value.style.left = left + 'px';
    slider.value.textContent = slider.input.value + (slider.input === sliders[2].input ? '%' : '');
  }

  sliders.forEach(function (slider) {
    slider.input.addEventListener('input', function () {
      slider.apply(slider.input.value);
      positionValue(slider);
    });
    positionValue(slider);
  });

  // Each value bubble also acts as the slider's own draggable thumb (the
  // native thumb is made transparent in CSS) so dragging works from the
  // number itself, not just the thin track underneath it.
  var dragging = null;

  function updateFromClientX(slider, clientX) {
    var rect = slider.input.getBoundingClientRect();
    var ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    var raw = ratio * (slider.input.max - slider.input.min) + Number(slider.input.min);
    var step = Number(slider.input.step) || 1;
    slider.input.value = Math.round(raw / step) * step;
    slider.input.dispatchEvent(new Event('input'));
  }

  sliders.forEach(function (slider) {
    ['mousedown', 'touchstart'].forEach(function (type) {
      slider.value.addEventListener(type, function () { dragging = slider; });
    });
  });

  ['mouseup', 'touchend'].forEach(function (type) {
    document.addEventListener(type, function () { dragging = null; });
  });

  ['mousemove', 'touchmove'].forEach(function (type) {
    document.addEventListener(type, function (event) {
      if (!dragging) return;
      var point = event.touches ? event.touches[0] : event;
      updateFromClientX(dragging, point.clientX);
    });
  });

  window.addEventListener('resize', function () {
    sliders.forEach(positionValue);
  });

  // Serif/sans segmented toggle (two pressed-pill buttons, matching the
  // site's own language switcher rather than an on/off switch).
  var serifBtn = document.getElementById('font-toggle-serif');
  var sansBtn = document.getElementById('font-toggle-sans');
  if (serifBtn && sansBtn) {
    var selectFont = function (isSans) {
      serifBtn.setAttribute('aria-pressed', String(!isSans));
      sansBtn.setAttribute('aria-pressed', String(isSans));
      fontTest.style.fontFamily = isSans ? "'CuchillerasSans'" : "'Cuchilleras'";
    };
    serifBtn.addEventListener('click', function () { selectFont(false); });
    sansBtn.addEventListener('click', function () { selectFont(true); });
  }
})();
