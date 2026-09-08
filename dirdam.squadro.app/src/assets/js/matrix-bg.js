/* "Digital rain" effect for the My Apps page hero: columns of falling
   glyphs (katakana, digits, a few latin letters), each with a bright
   near-white head and a green tail that fades out over a fixed number of
   cells behind it — the classic Matrix code-rain look, fitting for a page
   of hobby programming projects.

   Unlike network-bg.js's persistent particle canvas, this redraws from a
   fully transparent clearRect every tick and gives each glyph its own
   explicit alpha (head bright, tail decaying exponentially) rather than
   smearing a translucent fill over the whole canvas — that keeps the
   page's own gradient hero background visible in the gaps between and
   around the falling columns instead of the canvas slowly painting itself
   solid black.

   Performance constraints mirror the other hero canvases (network-bg.js,
   trail-bg.js):
   - Only runs where a <canvas class="hero-matrix"> exists (My Apps page
     only).
   - Skips entirely under prefers-reduced-motion.
   - Pauses via IntersectionObserver when the hero is off-screen, and via
     visibilitychange when the tab isn't active.
   - Column count scales with the hero's width (one per glyph cell) but is
     capped so an ultra-wide monitor doesn't multiply the per-frame text
     draws unbounded.
   - The rain advances on its own throttled tick (~18/s) decoupled from the
     animation frame rate, so it reads as a deliberate cascade rather than
     a 60fps blur.
   - devicePixelRatio capped at 2. Resize is watched via ResizeObserver on
     the hero itself, debounced, matching the other hero scripts. */
(function () {
  var canvas = document.querySelector('.hero-matrix');
  if (!canvas || !canvas.getContext) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hero = canvas.closest('.hero');
  if (!hero) return;

  var ctx = canvas.getContext('2d');
  var width = 0;
  var height = 0;
  var columns = [];
  var rafId = null;
  var running = false;
  var visible = false;
  var lastTick = 0;

  var FONT_SIZE = 16;
  var MAX_COLUMNS = 160;
  var TRAIL_LENGTH = 16; // cells behind the head before a glyph has faded to nothing
  var TRAIL_DECAY = 0.82; // per-cell alpha multiplier behind the head
  var TICK_INTERVAL = 80; // ms between rain steps — decoupled from rAF's own rate
  var CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function randomChar() {
    return CHARS[(Math.random() * CHARS.length) | 0];
  }

  function makeColumn(x, seeded) {
    return {
      x: x,
      headY: seeded ? Math.random() * height : -Math.random() * height,
      speed: FONT_SIZE * (0.4 + Math.random() * 0.55),
    };
  }

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

    var count = Math.min(MAX_COLUMNS, Math.ceil(width / FONT_SIZE));
    columns = [];
    for (var i = 0; i < count; i++) columns.push(makeColumn(i * FONT_SIZE, true));

    ctx.font = FONT_SIZE + 'px monospace';
    ctx.textBaseline = 'top';
  }

  function tick() {
    ctx.clearRect(0, 0, width, height);

    for (var i = 0; i < columns.length; i++) {
      var col = columns[i];

      for (var j = 0; j < TRAIL_LENGTH; j++) {
        var y = col.headY - j * FONT_SIZE;
        if (y < -FONT_SIZE) break;
        if (y > height) continue;

        if (j === 0) {
          ctx.fillStyle = 'rgba(214, 255, 224, 0.95)';
        } else {
          var alpha = 0.85 * Math.pow(TRAIL_DECAY, j - 1);
          if (alpha < 0.03) break;
          ctx.fillStyle = 'rgba(0, 255, 65, ' + alpha.toFixed(3) + ')';
        }
        ctx.fillText(randomChar(), col.x, y);
      }

      col.headY += col.speed;
      if (col.headY - TRAIL_LENGTH * FONT_SIZE > height) {
        col.headY = -Math.random() * 200;
        col.speed = FONT_SIZE * (0.6 + Math.random() * 0.8);
      }
    }
  }

  function step(timestamp) {
    if (timestamp - lastTick >= TICK_INTERVAL) {
      lastTick = timestamp;
      tick();
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
    resizeTimer = setTimeout(resize, 150);
  }
  if ('ResizeObserver' in window) {
    new ResizeObserver(scheduleResize).observe(hero);
  } else {
    window.addEventListener('resize', scheduleResize);
  }
})();
