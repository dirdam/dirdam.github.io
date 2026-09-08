/* Wireframe rotating-globe effect for the Trips page hero: a big sphere
   (its silhouette circle spans most of the hero's width, cropped top/bottom
   by the hero's own overflow:hidden — a deliberate "world looms large"
   look) drawn as a Lucide-globe-style wireframe, but denser and actually
   spinning, fitting a page about places visited around the world.

   The illusion is pure 2D: a meridian (a line of longitude, pole to pole)
   viewed from the front is a vertical ellipse whose horizontal radius is
   R*cos(phase) — full width (a great circle coinciding with the sphere's
   own silhouette) when phase is 0, narrowing to a thin vertical sliver
   (edge-on, phase = 90°) as it "rotates" toward the side, then widening
   again as it swings to the back. Advancing every meridian's phase by the
   same steadily-increasing rotation angle each frame is what reads as the
   whole sphere spinning around a vertical axis — no 3D math needed, just
   that one cosine. Latitude lines (parallels) don't need any of this: with
   a vertical rotation axis, they're simply horizontal chords of the
   silhouette circle, unaffected by the spin.

   Performance constraints mirror the other hero canvases (maze-bg.js etc.):
   - Only runs where a <canvas class="hero-globe"> exists (Trips page only).
   - Skips entirely under prefers-reduced-motion.
   - Pauses via IntersectionObserver when the hero is off-screen, and via
     visibilitychange when the tab isn't active.
   - Fully re-derived from `timestamp` every frame (no accumulated state to
     manage, no per-frame allocation beyond the draw calls themselves) — a
     fixed, small number of strokes (one silhouette + latitude lines +
     meridian ellipses), not O(n^2) work.
   - devicePixelRatio capped at 2. Resize is watched via ResizeObserver on
     the hero itself, same as the other hero canvases. */
(function () {
  var canvas = document.querySelector('.hero-globe');
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

  var RADIUS_RATIO = 0.46; // of the hero's width — "screen width wide"
  var LATITUDE_LINES = 6; // interior parallels, not counting the poles
  var MERIDIAN_COUNT = 14; // distinct meridian great circles
  var ROTATION_PERIOD = 100000; // ms for one full rotation
  var LINE_COLOR = 'rgba(255, 255, 255, 0.4)';
  var OUTLINE_COLOR = 'rgba(255, 255, 255, 0.6)';

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

  function draw(timestamp) {
    ctx.clearRect(0, 0, width, height);

    var cx = width / 2;
    var cy = height / 2;
    var r = width * RADIUS_RATIO;

    // Silhouette — the sphere's outer edge, always a full circle regardless
    // of rotation.
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Latitude lines: horizontal chords at evenly spaced heights between
    // the poles (excluding the poles themselves, which are single points).
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    for (var i = 1; i <= LATITUDE_LINES; i++) {
      var dy = r * (-1 + (2 * i) / (LATITUDE_LINES + 1));
      var halfChord = Math.sqrt(Math.max(0, r * r - dy * dy));
      ctx.beginPath();
      ctx.moveTo(cx - halfChord, cy + dy);
      ctx.lineTo(cx + halfChord, cy + dy);
      ctx.stroke();
    }

    // Meridian lines: vertical ellipses, each a great circle of longitude,
    // spread evenly across 180° (each ellipse already represents both its
    // front- and back-facing half at once, since front/back are 180° apart
    // and produce an identical |cos| width) and animated by the same
    // shared rotation angle every frame.
    var rotation = (timestamp / ROTATION_PERIOD) * Math.PI * 2;
    for (var m = 0; m < MERIDIAN_COUNT; m++) {
      var phase = rotation + (Math.PI * m) / MERIDIAN_COUNT;
      var rx = Math.abs(r * Math.cos(phase));
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    rafId = requestAnimationFrame(draw);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(draw);
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
