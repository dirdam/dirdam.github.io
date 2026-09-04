/* Lightweight "network" particle effect for the landing-page hero: white
   dots drift slowly and draw a line to any neighbor within range, which
   fades as they separate — a nod to a live/working network, not just
   decoration.

   Performance is the whole design constraint here:
   - Only runs where a <canvas class="hero-network"> actually exists (only
     the landing page's hero gets one — see build.py/header.html).
   - Skips entirely under prefers-reduced-motion.
   - Pauses via IntersectionObserver whenever the hero scrolls off-screen,
     and via visibilitychange whenever the tab isn't active — most of a
     visit, this canvas is doing nothing at all.
   - Particle count is capped and scales with the hero's actual area, not a
     fixed number that could get expensive on a huge display.
   - devicePixelRatio is capped at 2 to avoid needless overdraw on very
     high-density screens.
   - Resize handling is debounced. */
(function () {
  var canvas = document.querySelector('.hero-network');
  if (!canvas || !canvas.getContext) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hero = canvas.closest('.hero');
  if (!hero) return;

  var ctx = canvas.getContext('2d');
  var width = 0;
  var height = 0;
  var particles = [];
  var rafId = null;
  var running = false;
  var visible = false;

  var MAX_PARTICLES = 60;
  var AREA_PER_PARTICLE = 16000; // px^2 of hero per dot — keeps density sane on huge screens
  var LINK_DIST = 130;
  var SPEED = 0.56;

  function makeParticle() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
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

    var target = Math.min(MAX_PARTICLES, Math.max(18, Math.round((width * height) / AREA_PER_PARTICLE)));
    if (particles.length > target) {
      particles.length = target;
    } else {
      while (particles.length < target) particles.push(makeParticle());
    }
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x <= 0 || p.x >= width) { p.vx *= -1; p.x = Math.max(0, Math.min(width, p.x)); }
      if (p.y <= 0 || p.y >= height) { p.vy *= -1; p.y = Math.max(0, Math.min(height, p.y)); }
    }

    ctx.lineWidth = 1;
    for (var i = 0; i < particles.length; i++) {
      for (var j = i + 1; j < particles.length; j++) {
        var a = particles[i];
        var b = particles[j];
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          var alpha = (1 - dist / LINK_DIST) * 0.45;
          ctx.strokeStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (var i = 0; i < particles.length; i++) {
      ctx.beginPath();
      ctx.arc(particles[i].x, particles[i].y, 1.6, 0, Math.PI * 2);
      ctx.fill();
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
