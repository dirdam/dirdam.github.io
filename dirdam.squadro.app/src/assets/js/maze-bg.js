/* Lightweight "maze" effect for the Games page hero: a self-avoiding random
   walk on a coarse grid draws itself in as a right-angled corridor, holds
   fully drawn for a moment, then fades — an abstract stand-in for puzzle-
   solving (the maze itself) and exploration (a path being found through
   it), fitting a page recommending thinky/adventure games. A soft glowing
   dot marks the walk's leading edge while it's still being drawn, like a
   light finding its way through the corridor, then rests at the exit for
   the hold/fade.

   Concurrent walks never overlap — but `hero--compact` is a short, wide
   banner, and a single walk's random corridor can easily span nearly half
   its width, so generic "keep retrying random spots until one doesn't
   overlap" rejection sampling (as ripple-bg.js does for its much smaller
   ripples) fails too often here to keep a steady spawn rate: most of the
   canvas is often already claimed by 1-2 existing walks. Instead the hero
   is divided into MAX_WALKS equal vertical zones, and each walk is built
   confined to one currently-unclaimed zone — non-overlap is then
   guaranteed by construction, and "is a zone free" is a cheap, reliable
   check that succeeds as soon as any single walk expires, rather than a
   probabilistic one that can keep failing even when there's technically
   room somewhere.

   Performance constraints mirror ripple-bg.js/trail-bg.js:
   - Only runs where a <canvas class="hero-maze"> exists (Games page only).
   - Skips entirely under prefers-reduced-motion.
   - Pauses via IntersectionObserver when the hero is off-screen, and via
     visibilitychange when the tab isn't active.
   - Only MAX_WALKS walks are ever alive at once (one per zone), each a
     short (<=18 point) polyline recomputed once at spawn time, not per
     frame — no O(n^2) work. Every walk that spawns always lives out its
     full grow/hold/fade lifecycle rather than being cut short to make
     room for a new one.
   - devicePixelRatio capped at 2. Resize is watched via ResizeObserver on
     the hero itself, same as the other hero canvases. */
(function () {
  var canvas = document.querySelector('.hero-maze');
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
  var walks = [];
  var lastSpawn = 0;

  var MAX_WALKS = 3; // also the number of vertical zones the hero is split
                      // into — one walk per zone, at most
  var zoneOccupied = []; // indexed by zone 0..MAX_WALKS-1, filled just below;
                          // zone *width* is recomputed from the current
                          // canvas size at spawn time, so resizing doesn't
                          // need to touch this
  for (var zi = 0; zi < MAX_WALKS; zi++) zoneOccupied.push(false);
  var nextZone = 0; // cycles 0,1,2,0,1,... in lockstep with SPAWN_INTERVAL
                     // (see spawnWalk) instead of picking a random free
                     // zone — with only MAX_WALKS zones, spawning strictly
                     // every SPAWN_INTERVAL means a given zone is needed
                     // again exactly MAX_WALKS * SPAWN_INTERVAL after it was
                     // last used, which is also the hard ceiling DURATION_MAX
                     // is kept under below — so *this* zone is architecturally
                     // guaranteed to already be free every time it comes back
                     // around, and generation never has to wait on anything.
  var SPAWN_INTERVAL = 1500; // ms between spawns — with 3 zones, this is what
                             // keeps generation truly continuous (see above)
                             // rather than merely "usually" continuous
  var DURATION_MIN = 3600; // ms for one walk to draw in, hold, and fade.
  var DURATION_MAX = 4200; // Both kept safely under MAX_WALKS * SPAWN_INTERVAL
                            // (4500ms) — the budget a walk has to fully
                            // finish before round-robin needs its zone back.
                            // A single fixed duration was tried first, but a
                            // burst of walks born together (into an empty
                            // canvas, before the cap kicks in) also expired
                            // together, freeing a cluster of zones all at
                            // once and then sitting idle while spawning
                            // trickled in one replacement at a time — a
                            // self-reinforcing "batch, then a long gap"
                            // rhythm. Randomizing each walk's own lifetime
                            // (within the safe budget) desyncs expiries so
                            // they spread out instead of staying clustered.
  // Total duration is fixed by the zone-budget math above, so slowing the
  // head means giving growth a bigger slice of that same fixed time rather
  // than raising DURATION itself (which would break the continuous-spawn
  // guarantee). Grow now takes most of a walk's life, with a short hold
  // (the ~5% left over) before the same fade-out length as before.
  var GROW_FRACTION = 0.7; // fraction of a walk's own duration spent drawing the corridor in
  var FADE_FRACTION = 0.25; // fraction of a walk's own duration, at the end, spent fading out
  var MIN_STEPS = 10;
  var MAX_STEPS = 18;
  var STRAIGHT_BIAS = 0.6; // chance of continuing straight over turning, per step

  var DIRECTIONS = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

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

  // A self-avoiding random walk on a coarse grid confined to one vertical
  // zone (inset from that zone's edges), biased to continue straight
  // rather than zigzag every step (real maze corridors run a few cells
  // before turning). Stops early if it paints itself into a corner — a
  // shorter organic path is fine here.
  function buildWalk(zoneIndex) {
    var zoneWidth = width / MAX_WALKS;
    var cell = Math.min(zoneWidth, height) / 5;
    var cols = Math.max(3, Math.floor(zoneWidth / cell) - 1);
    var rows = Math.max(3, Math.floor(height / cell) - 1);
    var originX = zoneIndex * zoneWidth + (zoneWidth - cols * cell) / 2;
    var originY = (height - rows * cell) / 2;

    var col = Math.floor(Math.random() * cols);
    var row = Math.floor(Math.random() * rows);
    var visited = {};
    visited[col + ',' + row] = true;
    var cells = [{ col: col, row: row }];
    var dirIndex = Math.floor(Math.random() * DIRECTIONS.length);
    var targetSteps = MIN_STEPS + Math.floor(Math.random() * (MAX_STEPS - MIN_STEPS));

    for (var step = 0; step < targetSteps; step++) {
      var candidates = [];
      for (var i = 0; i < DIRECTIONS.length; i++) {
        var isStraight = i === dirIndex;
        var isReverse = DIRECTIONS[i].dx === -DIRECTIONS[dirIndex].dx && DIRECTIONS[i].dy === -DIRECTIONS[dirIndex].dy;
        if (isReverse && DIRECTIONS.length > 1) continue;
        var nc = col + DIRECTIONS[i].dx;
        var nr = row + DIRECTIONS[i].dy;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        if (visited[nc + ',' + nr]) continue;
        candidates.push({ index: i, col: nc, row: nr, straight: isStraight });
      }
      if (!candidates.length) break;

      var choice;
      var straightChoice = candidates.filter(function (c) { return c.straight; })[0];
      if (straightChoice && Math.random() < STRAIGHT_BIAS) {
        choice = straightChoice;
      } else {
        choice = candidates[Math.floor(Math.random() * candidates.length)];
      }

      col = choice.col;
      row = choice.row;
      dirIndex = choice.index;
      visited[col + ',' + row] = true;
      cells.push({ col: col, row: row });
    }

    if (cells.length < 2) return null;

    var points = cells.map(function (c) {
      return { x: originX + (c.col + 0.5) * cell, y: originY + (c.row + 0.5) * cell };
    });
    var lengths = [0];
    for (var p = 1; p < points.length; p++) {
      var dx = points[p].x - points[p - 1].x;
      var dy = points[p].y - points[p - 1].y;
      lengths.push(lengths[p - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    return { points: points, lengths: lengths, totalLength: lengths[lengths.length - 1] };
  }

  // Interpolated point at a given distance along the walk's polyline —
  // used to reveal the corridor smoothly rather than one whole segment at
  // a time.
  function pointAtLength(walk, targetLen) {
    var points = walk.points;
    var lengths = walk.lengths;
    var idx = points.length - 1;
    for (var i = 1; i < lengths.length; i++) {
      if (lengths[i] >= targetLen) {
        idx = i;
        break;
      }
    }
    var segStart = lengths[idx - 1];
    var segEnd = lengths[idx];
    var segT = segEnd > segStart ? (targetLen - segStart) / (segEnd - segStart) : 0;
    return {
      index: idx,
      point: {
        x: points[idx - 1].x + (points[idx].x - points[idx - 1].x) * segT,
        y: points[idx - 1].y + (points[idx].y - points[idx - 1].y) * segT,
      },
    };
  }

  // Advances the round-robin zone cursor and builds a walk confined to it —
  // non-overlap is guaranteed by construction, and (given DURATION_MAX's
  // budget above) that zone is architecturally guaranteed to already be
  // free, so generation never has to wait: this fires every single
  // SPAWN_INTERVAL, unconditionally. The zoneOccupied/some-still-occupied
  // branch below is a defensive fallback only — it shouldn't trigger in
  // normal operation, but skips that one spawn cleanly rather than forcing
  // an overlap if a frame stall or throttled background tab ever left a
  // walk alive past its budget. Existing walks are never truncated to make
  // room either way — every walk that does spawn always lives out its full
  // grow/hold/fade lifecycle and frees its own zone when it expires (see
  // step()).
  function spawnWalk(timestamp) {
    var zoneIndex = nextZone;
    nextZone = (nextZone + 1) % MAX_WALKS;
    if (zoneOccupied[zoneIndex]) return;
    var walk = buildWalk(zoneIndex);
    if (!walk) return;
    walk.zone = zoneIndex;
    walk.start = timestamp;
    walk.duration = DURATION_MIN + Math.random() * (DURATION_MAX - DURATION_MIN);
    zoneOccupied[zoneIndex] = true;
    walks.push(walk);
  }

  function step(timestamp) {
    if (!lastSpawn) {
      lastSpawn = timestamp;
      spawnWalk(timestamp);
    } else if (timestamp - lastSpawn >= SPAWN_INTERVAL) {
      lastSpawn = timestamp;
      spawnWalk(timestamp);
    }

    ctx.clearRect(0, 0, width, height);

    for (var i = walks.length - 1; i >= 0; i--) {
      var walk = walks[i];
      var t = (timestamp - walk.start) / walk.duration;
      if (t >= 1) {
        zoneOccupied[walk.zone] = false;
        walks.splice(i, 1);
        continue;
      }

      var growing = t < GROW_FRACTION;
      var revealLen = growing
        ? walk.totalLength * (t / GROW_FRACTION)
        : walk.totalLength;
      var alpha = 1;
      if (t > 1 - FADE_FRACTION) {
        alpha = Math.max(0, (1 - t) / FADE_FRACTION);
      }
      if (alpha <= 0) continue;

      var head = pointAtLength(walk, revealLen);

      ctx.strokeStyle = 'rgba(255, 250, 230, ' + (0.55 * alpha).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(walk.points[0].x, walk.points[0].y);
      for (var p = 1; p < head.index; p++) {
        ctx.lineTo(walk.points[p].x, walk.points[p].y);
      }
      ctx.lineTo(head.point.x, head.point.y);
      ctx.stroke();

      ctx.shadowColor = 'rgba(255, 250, 230, ' + (0.9 * alpha).toFixed(3) + ')';
      ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(255, 250, 230, ' + (0.95 * alpha).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(head.point.x, head.point.y, 2.2, 0, Math.PI * 2);
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
