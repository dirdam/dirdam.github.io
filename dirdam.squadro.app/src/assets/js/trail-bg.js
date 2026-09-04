/* Lightweight "trail" effect for the Background page hero: faint white
   streaks fly along a shallow parabolic arc from left to right — like a
   shooting star, or an airplane's climb-and-level trajectory (fitting for
   a page about a Spain-to-Japan academic move). Each trail grows out of a
   point, slides along its arc as a fading comet-style streak with a bright
   glowing head, then recedes and disappears — brightening in and dimming
   back out (an overall envelope independent of the streak's growing/
   shrinking length) so it appears and disappears silently rather than
   popping in or getting snipped off.

   Performance constraints mirror ripple-bg.js:
   - Only runs where a <canvas class="hero-trails"> exists (Background page
     only).
   - Skips entirely under prefers-reduced-motion.
   - Pauses via IntersectionObserver when the hero is off-screen, and via
     visibilitychange when the tab isn't active.
   - At most a handful of trails ever exist at once (oldest dropped once
     the cap is hit); each trail is just a short sampled polyline (12
     points) redrawn per frame — no per-frame allocation beyond that, no
     O(n^2) work.
   - devicePixelRatio capped at 2. Resize is watched via ResizeObserver on
     the hero itself (not just window resize) so the canvas stays correctly
     sized even if the hero's height changes for reasons other than a
     window resize (e.g. a web font swap changing the heading's height). */
(function () {
  var canvas = document.querySelector('.hero-trails');
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
  var trails = [];
  var lastSpawn = 0;
  var nextSpawnDelay = 0;

  var MAX_TRAILS = 3;
  var SPAWN_INTERVAL_MIN = 1800; // ms between new trails
  var SPAWN_INTERVAL_MAX = 3600;
  var DURATION = 3800; // ms for a trail to travel from its start point to its end point
  var TRAIL_FRACTION = 0.4; // visible streak length, as a fraction of the full arc's travel time
  var TRAIL_SAMPLES = 12; // points sampled along the visible streak per frame
  var FADE_IN = 0.15; // fraction of the trail's life spent brightening in from nothing
  var FADE_OUT = 0.4; // fraction of the trail's life, at the end, spent dimming to nothing —
                       // this reaches zero exactly as the head reaches its destination, so the
                       // trail vanishes on arrival instead of hitting the end point and only
                       // then shrinking away.

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

  // Quadratic bezier point at parameter u in [0,1] — p0/p1 are the arc's
  // start/end, pc is the control point that bows the path into a parabola.
  function bezierPoint(p0, pc, p1, u) {
    var mu = 1 - u;
    return {
      x: mu * mu * p0.x + 2 * mu * u * pc.x + u * u * p1.x,
      y: mu * mu * p0.y + 2 * mu * u * pc.y + u * u * p1.y,
    };
  }

  function spawnTrail(timestamp) {
    var x0 = Math.random() * width * 0.55;
    var y0 = height * (0.15 + Math.random() * 0.7);
    var dx = width * (0.35 + Math.random() * 0.4);
    var dy = height * (Math.random() - 0.5) * 0.5; // slight overall climb or descent
    var x1 = x0 + dx;
    var y1 = y0 + dy;
    // Bows the straight start->end line into a shallow parabola — the sign
    // varies randomly so some trails arc up, some down, per trail.
    var bend = height * (0.08 + Math.random() * 0.14) * (Math.random() < 0.5 ? -1 : 1);
    trails.push({
      p0: { x: x0, y: y0 },
      pc: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + bend },
      p1: { x: x1, y: y1 },
      start: timestamp,
    });
    if (trails.length > MAX_TRAILS) trails.shift();
    scheduleNextSpawn();
  }

  function step(timestamp) {
    if (!lastSpawn) {
      lastSpawn = timestamp;
      spawnTrail(timestamp);
    } else if (timestamp - lastSpawn >= nextSpawnDelay) {
      lastSpawn = timestamp;
      spawnTrail(timestamp);
    }

    ctx.clearRect(0, 0, width, height);

    for (var i = trails.length - 1; i >= 0; i--) {
      var trail = trails[i];
      var t = (timestamp - trail.start) / DURATION;
      if (t >= 1) {
        trails.splice(i, 1);
        continue;
      }

      var headT = t;
      var tailT = Math.max(0, t - TRAIL_FRACTION);
      if (headT <= tailT) continue;

      // Overall brightness envelope, independent of the streak's growing/
      // shrinking length — ramps up from nothing at spawn, and back down to
      // exactly nothing by t=1 (the moment the head reaches its
      // destination), so the trail vanishes as it arrives rather than
      // hitting the end point and only then shrinking away.
      var envelope = 1;
      if (t < FADE_IN) {
        envelope = t / FADE_IN;
      } else if (t > 1 - FADE_OUT) {
        envelope = Math.max(0, (1 - t) / FADE_OUT);
      }
      if (envelope <= 0) continue;

      var head = bezierPoint(trail.p0, trail.pc, trail.p1, headT);
      var tail = bezierPoint(trail.p0, trail.pc, trail.p1, tailT);

      var gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, ' + (0.85 * envelope).toFixed(3) + ')');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (var s = 0; s < TRAIL_SAMPLES; s++) {
        var u = tailT + (headT - tailT) * (s / (TRAIL_SAMPLES - 1));
        var pt = bezierPoint(trail.p0, trail.pc, trail.p1, u);
        if (s === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      ctx.shadowColor = 'rgba(255, 255, 255, ' + (0.9 * envelope).toFixed(3) + ')';
      ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.95 * envelope).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
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
