/* Lightweight "ripple" effect for the About page hero: faint white rings
   occasionally emanate from points within the visible hero and expand
   while fading out, like ink drops in water — an abstract nod to
   philosophy/thinking (ripples of an idea spreading outward). Each ripple
   draws several trailing concentric rings (like a real ripple's multiple
   wavefronts) rather than a single circle. Each ripple's own max radius is
   capped at its spawn point's actual distance to the nearest canvas edge,
   so rings never grow past the visible hero and get clipped.

   Performance constraints mirror network-bg.js:
   - Only runs where a <canvas class="hero-ripples"> exists (About page only).
   - Skips entirely under prefers-reduced-motion.
   - Pauses via IntersectionObserver when the hero is off-screen, and via
     visibilitychange when the tab isn't active.
   - At most a handful of ripples ever exist at once (oldest dropped once
     the cap is hit) — no per-frame allocation beyond that, no O(n^2) work.
   - devicePixelRatio capped at 2; resize handling debounced. */
(function () {
  var canvas = document.querySelector('.hero-ripples');
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
  var ripples = [];
  var lastSpawn = 0;
  var nextSpawnDelay = 0;

  var MAX_RIPPLES = 5;
  var SPAWN_INTERVAL_MIN = 1400; // ms between new ripples
  var SPAWN_INTERVAL_MAX = 2600;
  var DURATION = 4500; // ms for one ring to fully expand and fade
  var RING_COUNT = 3; // trailing wavefronts per ripple
  var RING_DELAY = 0.22; // fraction of DURATION between each trailing ring's start
  var MAX_RADIUS_RATIO = 0.5; // of the hero's shorter side
  var EDGE_MARGIN = 0.12; // keep spawn points this fraction away from each edge
  var MIN_SPAWN_DIST_RATIO = 0.45; // min distance between two ripple centers, as a fraction of the hero's shorter side
  var SPAWN_ATTEMPTS = 8; // candidate points tried before falling back to the most spread-out one

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

  function scheduleNextSpawn() {
    nextSpawnDelay = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
  }

  // Tries a few candidate points and keeps the one farthest from every
  // currently active ripple, so new ripples spawn spread out rather than
  // clustering near recent ones.
  function pickSpawnPoint() {
    var marginX = width * EDGE_MARGIN;
    var marginY = height * EDGE_MARGIN;
    var minDist = Math.min(width, height) * MIN_SPAWN_DIST_RATIO;
    var best = null;
    var bestNearest = -1;
    for (var attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      var x = marginX + Math.random() * (width - 2 * marginX);
      var y = marginY + Math.random() * (height - 2 * marginY);
      var nearest = Infinity;
      for (var i = 0; i < ripples.length; i++) {
        var dx = x - ripples[i].x;
        var dy = y - ripples[i].y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearest) nearest = d;
      }
      if (nearest >= minDist) return { x: x, y: y };
      if (nearest > bestNearest) {
        bestNearest = nearest;
        best = { x: x, y: y };
      }
    }
    return best;
  }

  function spawnRipple(timestamp) {
    var point = pickSpawnPoint();
    var x = point.x;
    var y = point.y;
    // Cap this ripple's radius at the actual distance to the nearest edge
    // (with a small pad) so it can never expand past the visible canvas —
    // rings near an edge simply stay smaller rather than getting clipped.
    var edgeDist = Math.min(x, y, width - x, height - y) * 0.92;
    var maxRadius = Math.min(edgeDist, Math.min(width, height) * MAX_RADIUS_RATIO);
    ripples.push({ x: x, y: y, start: timestamp, maxRadius: maxRadius });
    if (ripples.length > MAX_RIPPLES) ripples.shift();
    scheduleNextSpawn();
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function step(timestamp) {
    if (!lastSpawn) {
      lastSpawn = timestamp;
      spawnRipple(timestamp);
    } else if (timestamp - lastSpawn >= nextSpawnDelay) {
      lastSpawn = timestamp;
      spawnRipple(timestamp);
    }

    ctx.clearRect(0, 0, width, height);

    for (var i = ripples.length - 1; i >= 0; i--) {
      var ripple = ripples[i];
      var elapsedT = (timestamp - ripple.start) / DURATION;
      if (elapsedT >= 1 + (RING_COUNT - 1) * RING_DELAY) {
        ripples.splice(i, 1);
        continue;
      }
      for (var k = 0; k < RING_COUNT; k++) {
        var ringT = elapsedT - k * RING_DELAY;
        if (ringT < 0 || ringT > 1) continue;
        var radius = ripple.maxRadius * easeOutCubic(ringT);
        var alpha = 0.4 * (1 - ringT);
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        ctx.stroke();
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

  // Watches the hero element itself, not just the window — the hero's
  // height can change for reasons that aren't a window resize (a web font
  // swapping in and changing the heading's line height, for one), and the
  // canvas is given a fixed pixel height at resize() time, so it needs to
  // be re-measured whenever the hero's own box changes.
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
