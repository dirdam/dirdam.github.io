/* "Quill" effect for the Reflections page hero: three fixed lines, each
   traced out left-to-right in a handwriting-like wave as if by a stylus,
   then held fully visible, then wiped away again from the start at the
   same pace — a relay where, at any moment, one line is being written,
   one sits finished, and one is being erased:
     line A writes -> line B starts writing (A now holds)
     line C starts writing -> A starts erasing (from its own start)
     A finishes erasing (clear again, ready to write) exactly as C
       finishes writing -> A starts a fresh line -> B starts erasing
     ...and so on, forever.
   All three lines share one write/hold/erase phase duration, offset from
   each other by exactly that duration, which is what keeps the three
   phases permanently staggered one apart instead of drifting in and out
   of sync.

   Performance constraints mirror the other hero canvases:
   - Only runs where a <canvas class="hero-quill"> exists (Reflections page
     only).
   - Skips entirely under prefers-reduced-motion.
   - Pauses via IntersectionObserver when the hero is off-screen, and via
     visibilitychange when the tab isn't active.
   - Exactly 3 lines ever exist, each just a sampled polyline (at most ~60
     points) redrawn per frame — no per-frame allocation beyond that.
   - devicePixelRatio capped at 2. Resize is watched via ResizeObserver on
     the hero itself, debounced, matching the other hero scripts. */
(function () {
  var canvas = document.querySelector('.hero-quill');
  if (!canvas || !canvas.getContext) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hero = canvas.closest('.hero');
  if (!hero) return;

  var ctx = canvas.getContext('2d');
  var width = 0;
  var height = 0;
  var rafId = null;
  var running = false;
  var visible = false;
  var startTime = null;
  var rows = [];

  var ROW_FRACTIONS = [0.28, 0.5, 0.72]; // fixed baseline positions, top to bottom
  var STEP_DURATION = 2600; // ms for each of the write/hold/erase phases
  var PATH_SAMPLES = 60; // points sampled along a full line
  var INK = '200, 196, 188'; // even lighter warm grey, like faint graphite on the parchment gradient

  function resize() {
    var rect = hero.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // A gently undulating "handwritten" line: a slow primary wave (the
  // cursive up-down bounce of a baseline) plus a faster, smaller secondary
  // wave (finer per-letter jitter) layered on top, with a slight overall
  // slant like writing on unruled paper.
  function pointAt(row, u) {
    return {
      x: row.x0 + row.dx * u,
      y: row.yBase
        + row.slant * u
        + row.ampMain * Math.sin(row.freqMain * u * Math.PI * 2 + row.phaseMain)
        + row.ampJit * Math.sin(row.freqJit * u * Math.PI * 2 + row.phaseJit),
    };
  }

  function newContent(row) {
    row.x0 = width * (0.06 + Math.random() * 0.04);
    row.dx = width * (0.5 + Math.random() * 0.35);
    row.slant = height * (Math.random() - 0.5) * 0.04;
    row.ampMain = height * (0.015 + Math.random() * 0.02);
    row.freqMain = 2 + Math.random() * 2.5;
    row.phaseMain = Math.random() * Math.PI * 2;
    row.ampJit = height * 0.005;
    row.freqJit = 9 + Math.random() * 6;
    row.phaseJit = Math.random() * Math.PI * 2;
  }

  function makeRow(index) {
    var row = { yBase: 0, lastCycle: -1 };
    newContent(row);
    return row;
  }

  function initRows() {
    rows = ROW_FRACTIONS.map(makeRow);
  }

  function layoutRows() {
    for (var i = 0; i < rows.length; i++) rows[i].yBase = height * ROW_FRACTIONS[i];
  }

  function drawSegment(row, uStart, uEnd, withNib) {
    if (uEnd <= uStart) return;
    ctx.strokeStyle = 'rgba(' + INK + ', 0.92)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    var samples = Math.max(2, Math.round(PATH_SAMPLES * (uEnd - uStart)));
    for (var s = 0; s <= samples; s++) {
      var u = uStart + (uEnd - uStart) * (s / samples);
      var pt = pointAt(row, u);
      if (s === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    if (withNib) {
      var head = pointAt(row, uEnd);
      ctx.fillStyle = 'rgba(' + INK + ', 0.92)';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function step(timestamp) {
    if (startTime === null) startTime = timestamp;

    ctx.clearRect(0, 0, width, height);

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var localT = timestamp - startTime - i * STEP_DURATION;
      if (localT < 0) continue; // this row's relay slot hasn't started yet

      var cycleLength = STEP_DURATION * 3;
      var cycleIndex = Math.floor(localT / cycleLength);
      var phaseT = localT - cycleIndex * cycleLength;

      if (row.lastCycle !== cycleIndex) {
        row.lastCycle = cycleIndex;
        newContent(row);
      }

      if (phaseT < STEP_DURATION) {
        // Writing: reveal from the start up to the current head position.
        drawSegment(row, 0, phaseT / STEP_DURATION, true);
      } else if (phaseT < STEP_DURATION * 2) {
        // Holding: the full line stays visible, pen lifted.
        drawSegment(row, 0, 1, false);
      } else {
        // Erasing: the drawn portion shrinks away from its own start,
        // leaving the tail visible until it too is consumed.
        var e = (phaseT - STEP_DURATION * 2) / STEP_DURATION;
        drawSegment(row, e, 1, false);
      }
    }

    rafId = requestAnimationFrame(step);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function syncRunning() {
    if (visible && !document.hidden) start();
    else stop();
  }

  resize();
  initRows();
  layoutRows();

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      visible = entries[entries.length - 1].isIntersecting;
      syncRunning();
    });
    io.observe(hero);
  } else {
    visible = true;
    syncRunning();
  }

  document.addEventListener('visibilitychange', syncRunning);

  var resizeTimer = null;
  function scheduleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resize();
      layoutRows();
    }, 150);
  }
  if ('ResizeObserver' in window) {
    new ResizeObserver(scheduleResize).observe(hero);
  } else {
    window.addEventListener('resize', scheduleResize);
  }
})();
