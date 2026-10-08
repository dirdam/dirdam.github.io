/* "Squadro board" effect for the Squadro page hero: a faint lattice of
   lanes, like the board's, with small white pieces running along them.
   It borrows the real game's rules instead of just looking like it:

   - Every lane has its own piece and starts/ends in a "trough" (the
     hollow circle at each end) that lies outside the other direction's
     lanes, exactly like the real board — so two pieces of different
     direction can only ever meet on an interior crossing, never at a base.
   - The cells of a horizontal lane are exactly the vertical lanes that
     carry a piece (there are no empty vertical lanes), and the cells of a
     vertical lane are the horizontal lanes, so a hop of n cells moves past
     n lanes, landing only on lanes where an enemy could be.
   - Turns alternate: first some horizontal pieces move, then some vertical
     ones. Pieces of the same direction never interact (they're on parallel
     lanes), so they may move together; the two directions never move at
     the same time, so two pieces can never share a crossing.
   - A piece moves in hops of 1, 2 or 3 cells, like the speed marks on the
     board. Out and back speeds mirror each other (1<->3, 2<->2), as in the
     box's printed numbers. At the end of its lane it turns around, and
     when it gets home it leaves the board and a new one starts later.
   - If a hop passes over an enemy piece (one of the other direction
     resting on the crossing), the hopper jumps over it in a small arc and
     lands one cell further (repeating if there is yet another enemy
     there); the enemy is sent back to its starting trough — it vanishes,
     its lane lights up as a streak back to the trough, and a ring pulses
     where it respawns.

   Performance constraints mirror network-bg.js: only runs where a
   <canvas class="hero-squadro-board"> exists, skips entirely under
   prefers-reduced-motion, pauses when the hero is off-screen or the tab is
   hidden, caps devicePixelRatio at 2, and debounces resize. */
(function () {
  var canvas = document.querySelector('.hero-squadro-board');
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
  var lastTime = 0;

  var CELL = 30;
  var COLS = 0;        // cells per horizontal lane: left trough, one per vertical lane, right trough
  var ROWS = 0;        // cells per vertical lane: top trough, one per horizontal lane, bottom trough
  var xs = [];         // x of each horizontal cell (0 and COLS - 1 are the troughs)
  var Y0 = 0;
  var hPieces = [];    // lanes are rows 1 .. ROWS - 2
  var vPieces = [];    // lanes are columns 1 .. COLS - 2, one piece each
  var all = [];

  // turn state
  var turnAxis = 'h';
  var turnPhase = 'gap';   // 'play' while the chosen pieces move, 'gap' between turns
  var turnTimer = 0.6;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function ease(t) { return t * t * (3 - 2 * t); }

  function newSpeeds(p) {
    p.speedOut = 1 + Math.floor(Math.random() * 3);
    p.speedBack = 4 - p.speedOut;
  }

  function makePiece(axis, lane, len) {
    var p = {
      axis: axis,         // 'h' travels along a row, 'v' along a column
      lane: lane,         // row index (h) or column index (v)
      len: len,           // cells in the lane (first and last are troughs)
      cell: 0,            // resting / destination cell
      from: 0,
      to: 0,
      t: 1,
      dur: 0.4,
      dir: 1,
      state: 'wait',      // wait | hop | rewind | fade | gone
      go: false,          // chosen to move this turn
      timer: 0,
      alpha: 1,
      arc: 0,
      angle: 0,
      victims: [],
      trail: null,        // {a, b, life} — last hop's glow along the lane
      streak: null,       // {a, b, life} — rewind line
      ring: 0,            // respawn pulse life 1 -> 0
      rewindTo: 0,
    };
    newSpeeds(p);
    p.angle = targetAngle(p);
    return p;
  }

  function targetAngle(p) {
    if (p.axis === 'h') return p.dir > 0 ? 0 : Math.PI;
    return p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  function pos(p) {
    if (p.state === 'hop') return p.from + (p.to - p.from) * ease(p.t);
    return p.cell;
  }

  // x of a (possibly fractional, mid-hop) horizontal cell
  function cellX(c) {
    var i = Math.max(0, Math.min(COLS - 1, Math.floor(c)));
    var j = Math.min(COLS - 1, i + 1);
    return xs[i] + (xs[j] - xs[i]) * (c - i);
  }

  function xy(p, c, off) {
    if (p.axis === 'h') return { x: cellX(c), y: Y0 + p.lane * CELL + (off || 0) };
    return { x: xs[p.lane] + (off || 0), y: Y0 + c * CELL };
  }

  function build() {
    CELL = Math.max(20, Math.min(30, Math.floor(height / 6.6)));
    ROWS = Math.max(5, Math.min(7, Math.floor(height / CELL)));
    Y0 = (height - (ROWS - 1) * CELL) / 2;

    var vCount = width < 600 ? 3 : Math.max(3, Math.min(9, Math.round(width / 130)));
    COLS = vCount + 2;
    var margin = 16;
    xs = [];
    for (var i = 0; i < COLS; i++) xs.push(margin + i * (width - 2 * margin) / (COLS - 1));

    hPieces = [];
    for (var r = 1; r <= ROWS - 2; r++) hPieces.push(makePiece('h', r, COLS));
    vPieces = [];
    for (var c = 1; c <= COLS - 2; c++) vPieces.push(makePiece('v', c, ROWS));
    all = hPieces.concat(vPieces);
    turnAxis = 'h';
    turnPhase = 'gap';
    turnTimer = 0.6;
  }

  // Enemy of `p` resting on the crossing at cell `k` of p's lane, if any.
  // (Troughs never host a crossing, so k is always an interior cell here.)
  function enemyAt(p, k) {
    var list = p.axis === 'h' ? vPieces : hPieces;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.state === 'wait' && e.alpha > 0.5 && e.lane === k && e.cell === p.lane) return e;
    }
    return null;
  }

  function startHop(p) {
    var speed = p.dir > 0 ? p.speedOut : p.speedBack;
    var target = Math.max(0, Math.min(p.len - 1, p.cell + p.dir * speed));
    if (target === p.cell) return;

    var victims = [];
    var k = p.cell + p.dir;
    for (;;) {
      var e = enemyAt(p, k);
      if (e) {
        victims.push({ piece: e, cell: k });
        // jump over it and land one cell further; repeat if that cell is
        // occupied too (the real rule)
        target = k + p.dir;
      }
      if (p.dir > 0 ? k >= target : k <= target) break;
      k += p.dir;
    }
    target = Math.max(0, Math.min(p.len - 1, target));

    var cells = Math.abs(target - p.cell);
    p.from = p.cell;
    p.to = target;
    p.t = 0;
    p.dur = 0.3 + 0.13 * cells + (victims.length ? 0.12 : 0);
    p.arc = victims.length ? 9 : 0;
    p.state = 'hop';
    p.victims = victims.map(function (v) {
      v.at = Math.abs(v.cell - p.from) / Math.abs(p.to - p.from);
      v.done = false;
      return v;
    });
  }

  function sendBack(e) {
    var base = e.dir > 0 ? 0 : e.len - 1;
    e.streak = { a: e.cell, b: e.cell, life: 1 };
    e.from = e.cell;
    e.to = base;
    e.rewindTo = base;
    e.t = 0;
    e.state = 'rewind';
  }

  function updatePiece(p, dt) {
    // heading follows direction smoothly (the U-turn)
    var diff = targetAngle(p) - p.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    p.angle += diff * Math.min(1, dt * 12);

    if (p.trail) { p.trail.life -= dt * 1.3; if (p.trail.life <= 0) p.trail = null; }
    if (p.streak && p.state !== 'rewind') { p.streak.life -= dt * 1.6; if (p.streak.life <= 0) p.streak = null; }
    if (p.ring > 0) p.ring = Math.max(0, p.ring - dt * 1.6);

    if (p.state !== 'fade' && p.state !== 'gone' && p.state !== 'rewind' && p.alpha < 1) {
      p.alpha = Math.min(1, p.alpha + dt * 2);
    }

    var i;
    switch (p.state) {
      case 'wait':
        if (p.go) {
          p.timer -= dt;
          if (p.timer <= 0) { p.go = false; startHop(p); }
        }
        break;

      case 'hop':
        p.t = Math.min(1, p.t + dt / p.dur);
        for (i = 0; i < p.victims.length; i++) {
          var v = p.victims[i];
          if (!v.done && p.t >= v.at) { v.done = true; sendBack(v.piece); }
        }
        if (p.t >= 1) {
          p.cell = p.to;
          p.trail = { a: p.from, b: p.to, life: 1 };
          p.state = 'wait';
          if (p.dir > 0 && p.cell >= p.len - 1) {
            p.dir = -1;            // end of the lane: turn around
          } else if (p.dir < 0 && p.cell <= 0) {
            p.state = 'fade';      // back home: leaves the board
          }
        }
        break;

      case 'rewind':
        // the piece vanishes where it stood, a streak runs back to the
        // trough, and it reappears there — it never slides over other pieces
        p.t = Math.min(1, p.t + dt / 0.32);
        if (p.t < 0.25) p.alpha = 1 - p.t / 0.25; else p.alpha = 0;
        p.streak.b = p.from + (p.to - p.from) * p.t;
        p.streak.life = 1 - p.t * 0.4;
        if (p.t >= 1) {
          p.cell = p.rewindTo;
          p.ring = 1;
          p.alpha = 0;
          p.state = 'wait';
        }
        break;

      case 'fade':
        p.alpha -= dt * 1.5;
        if (p.alpha <= 0) { p.alpha = 0; p.state = 'gone'; p.timer = rand(1.2, 2.8); }
        break;

      case 'gone':
        p.timer -= dt;
        if (p.timer <= 0) {
          p.cell = 0; p.from = 0; p.to = 0; p.dir = 1;
          newSpeeds(p);
          p.angle = targetAngle(p);
          p.state = 'wait';
        }
        break;
    }
  }

  function busy(list) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.go || p.state === 'hop' || p.state === 'rewind') return true;
    }
    return false;
  }

  function updateTurns(dt) {
    if (turnPhase === 'gap') {
      turnTimer -= dt;
      if (turnTimer > 0) return;
      // start a turn: a random part of this direction's pieces will move
      var side = turnAxis === 'h' ? hPieces : vPieces;
      var ready = side.filter(function (p) { return p.state === 'wait' && p.alpha > 0.5; });
      var count = Math.max(1, Math.round(ready.length * rand(0.4, 0.75)));
      // Fisher-Yates: every ready piece is equally likely to be picked.
      // (A random-comparator sort is biased towards the front of the list.)
      for (var j = ready.length - 1; j > 0; j--) {
        var m = Math.floor(Math.random() * (j + 1));
        var tmp = ready[j]; ready[j] = ready[m]; ready[m] = tmp;
      }
      for (var i = 0; i < Math.min(count, ready.length); i++) {
        ready[i].go = true;
        ready[i].timer = rand(0, 0.6);
      }
      turnPhase = 'play';
    } else if (!busy(all)) {
      // everyone has finished (including pieces sent back): next direction
      turnAxis = turnAxis === 'h' ? 'v' : 'h';
      turnPhase = 'gap';
      turnTimer = rand(0.35, 0.7);
    }
  }

  function drawLanes() {
    var firstX = xs[0];
    var lastX = xs[COLS - 1];
    var lastY = Y0 + (ROWS - 1) * CELL;
    var i, r;

    // lanes: every vertical lane carries a piece, so there are no empty ones
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    for (r = 1; r <= ROWS - 2; r++) {
      ctx.moveTo(firstX, Y0 + r * CELL);
      ctx.lineTo(lastX, Y0 + r * CELL);
    }
    for (i = 1; i <= COLS - 2; i++) {
      ctx.moveTo(xs[i], Y0);
      ctx.lineTo(xs[i], lastY);
    }
    ctx.stroke();

    // crossings
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (i = 1; i <= COLS - 2; i++) {
      for (r = 1; r <= ROWS - 2; r++) {
        ctx.beginPath();
        ctx.arc(xs[i], Y0 + r * CELL, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // troughs: the hollow circle each lane starts and ends in
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    for (r = 1; r <= ROWS - 2; r++) {
      ctx.moveTo(firstX + 4, Y0 + r * CELL);
      ctx.arc(firstX, Y0 + r * CELL, 4, 0, Math.PI * 2);
      ctx.moveTo(lastX + 4, Y0 + r * CELL);
      ctx.arc(lastX, Y0 + r * CELL, 4, 0, Math.PI * 2);
    }
    for (i = 1; i <= COLS - 2; i++) {
      ctx.moveTo(xs[i] + 4, Y0);
      ctx.arc(xs[i], Y0, 4, 0, Math.PI * 2);
      ctx.moveTo(xs[i] + 4, lastY);
      ctx.arc(xs[i], lastY, 4, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  function seg(p, a, b, alpha) {
    var s = xy(p, a);
    var e = xy(p, b);
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
  }

  function drawPiece(p) {
    if (p.trail) seg(p, p.trail.a, p.trail.b, 0.5 * p.trail.life);
    if (p.streak) seg(p, p.streak.a, p.streak.b, 0.6 * p.streak.life);

    if (p.ring > 0) {
      var c = xy(p, p.cell);
      ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.65 * p.ring).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3 + 11 * (1 - p.ring), 0, Math.PI * 2);
      ctx.stroke();
    }

    if (p.state === 'gone' || p.alpha <= 0) return;

    var off = 0;
    if (p.state === 'hop' && p.arc) off = -Math.sin(Math.PI * p.t) * p.arc;
    // a piece being sent back is drawn fading where it stood
    var at = xy(p, p.state === 'rewind' ? p.from : pos(p), off);

    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.92 * p.alpha).toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    var dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
    lastTime = now;

    updateTurns(dt);
    for (var i = 0; i < all.length; i++) updatePiece(all[i], dt);

    ctx.clearRect(0, 0, width, height);
    drawLanes();
    for (var j = 0; j < all.length; j++) drawPiece(all[j]);

    rafId = requestAnimationFrame(frame);
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
    build();
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = 0;
    rafId = requestAnimationFrame(frame);
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
