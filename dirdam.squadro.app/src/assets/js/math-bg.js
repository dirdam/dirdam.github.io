/* "Handwritten math" effect for the Work page hero: a bright dot traces
   out a math symbol or business icon — like chalk on a board — then the
   finished symbol holds for a beat and fades away, before a new one starts
   somewhere else, with up to three on screen together. A nod to a working
   mathematician's scratch work, in the same spirit as the landing page's
   network dots and the About/Background pages' ripples/trails, but drawing
   real symbols instead of an abstract pattern.

   Each symbol is built from actual Lucide icon geometry (paths/lines/
   circles) — ported verbatim, ISC license, https://lucide.dev — rather
   than hand-approximated, so it renders as the real glyph. The reveal
   itself needs no hand-rolled path-walking: every SVG shape here is an
   SVGGeometryElement, so the browser's own getTotalLength()/
   getPointAtLength() drive a standard stroke-dasharray/dashoffset "line
   drawing" animation, in the same stroke order Lucide defines the icon.

   Performance constraints mirror trail-bg.js:
   - Only runs where an <svg class="hero-math"> exists (Work page only).
   - Skips entirely under prefers-reduced-motion.
   - Pauses via IntersectionObserver when the hero is off-screen, and via
     visibilitychange when the tab isn't active.
   - At most a handful of glyphs exist at once (oldest dropped once the cap
     is hit); each is a few real DOM nodes updated per frame — no per-frame
     allocation, no canvas repaint of the whole surface.
   - The <svg> is sized purely by CSS (see .hero-math, position:absolute;
     inset:0) — no devicePixelRatio bookkeeping needed since it's vector,
     resolution-independent. Resize only needs to re-read the hero's
     current box to keep new glyphs spawning inside it; watched via
     ResizeObserver on the hero itself, matching the other hero effects. */
(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var svg = document.querySelector('.hero-math');
  if (!svg || !(svg instanceof SVGElement)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hero = svg.closest('.hero');
  if (!hero) return;

  var width = 0;
  var height = 0;
  var rafId = null;
  var running = false;
  var visible = false;
  var glyphs = [];
  var lastSpawn = 0;
  var nextSpawnDelay = 0;
  var lastSymbol = null;
  var lastCenterX = null;

  var MAX_GLYPHS = 3;
  // Short enough, relative to a glyph's total lifetime (roughly 2.5-4.5s —
  // see writeDuration/HOLD_DURATION/FADE_DURATION below), that the cap is
  // reached and 3 glyphs are visible together most of the time rather than
  // as a rare overlap.
  var SPAWN_INTERVAL_MIN = 700;
  var SPAWN_INTERVAL_MAX = 1400;
  var MIN_SIZE = 23; // px footprint a glyph is scaled to (Lucide icons are defined in a 24-unit box)
  var MAX_SIZE = 48;
  var PEN_SPEED = 0.11; // on-screen px/ms — bigger symbols take proportionally longer to "write"
  var HOLD_DURATION = 850; // ms the finished symbol is held at full opacity
  var FADE_DURATION = 900; // ms to fade the finished symbol out
  var GLYPH_OPACITY = 0.85;
  var STROKE_WIDTH = 1.25; // in the 24-unit icon space (Lucide's own default is 2)
  var MIN_GAP = 14; // px buffer required between two glyphs' footprints so they never touch
  var MAX_PLACEMENT_ATTEMPTS = 12; // random retries to find a non-overlapping spot before giving up
  var TEXT_PADDING = 4; // px kept clear around the hero heading/subtitle — just enough to not sit behind it
  var MIN_SPAWN_DISTANCE_FRACTION = 0.25; // each new glyph's center must be at least this fraction of the hero's width from the previous glyph's center

  // Each symbol is a list of path "d" strings drawn in order — copied
  // straight out of Lucide icons: percent/pi/sigma/infinity/radical for the
  // math set; handshake/presentation/trending-up/briefcase-business/
  // factory/chart-pie/file-chart-column/plane/id-card-lanyard for the
  // business set; box/triangle-right/cylinder/variable/radius/diameter/
  // vector-square/circle-slash-2/x-line-top rounding out a broader
  // math-and-shapes set (fitting for a work-experience page). Lucide has
  // no "vector-polygon" or "angle" icon, so those two requested additions
  // aren't included.
  //
  // Every shape here is a <path>, even ones Lucide itself draws as
  // <circle>/<line>/<rect>/<ellipse> — done by hand-converting them to an
  // equivalent path below. That's not just style: getTotalLength()/
  // getPointAtLength(), which the write animation depends on, are
  // universally supported on <path> but have historically had gaps on
  // <circle>/<line>/<rect>/<ellipse> in some browsers (Safari lagged here
  // for years). A missing method throws, and since several glyphs animate
  // concurrently, one throwing glyph would freeze every glyph on screen —
  // see the try/catch in step() below for the second half of this
  // defense. Sticking to <path> avoids the problem at the source.
  var SYMBOLS = [
    ['M19 5L5 19',
     'M4 6.5A2.5 2.5 0 1 0 9 6.5A2.5 2.5 0 1 0 4 6.5', // % (top-left dot)
     'M15 17.5A2.5 2.5 0 1 0 20 17.5A2.5 2.5 0 1 0 15 17.5'], // % (bottom-right dot)
    ['M9 4L9 20',
     'M4 7c0-1.7 1.3-3 3-3h13',
     'M18 20c-1.7 0-3-1.3-3-3V4'], // π
    ['M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2'], // Σ
    ['M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8'], // ∞
    ['M3 12h3.28a1 1 0 0 1 .948.684l2.298 7.934a.5.5 0 0 0 .96-.044L13.82 4.771A1 1 0 0 1 14.792 4H21'], // √
    ['m11 17 2 2a1 1 0 1 0 3-3',
     'm14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4',
     'm21 3 1 11h-2',
     'M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3',
     'M3 4h8'], // handshake
    ['M2 3h20',
     'M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3',
     'm7 21 5-5 5 5'], // presentation
    ['M16 7h6v6', 'm22 7-8.5 8.5-5-5L2 17'], // trending-up
    ['M12 12h.01',
     'M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
     'M22 13a18.15 18.15 0 0 1-20 0',
     'M4 6H20A2 2 0 0 1 22 8V18A2 2 0 0 1 20 20H4A2 2 0 0 1 2 18V8A2 2 0 0 1 4 6Z'], // briefcase-business
    ['M12 16h.01',
     'M16 16h.01',
     'M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z',
     'M8 16h.01'], // factory
    ['M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z',
     'M21.21 15.89A10 10 0 1 1 8 2.83'], // chart-pie
    ['M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z',
     'M14 2v5a1 1 0 0 0 1 1h5',
     'M8 18v-1',
     'M12 18v-6',
     'M16 18v-3'], // file-chart-column
    ['M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'], // plane
    ['M13.5 8h-3',
     'm15 2-1 2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3',
     'M16.899 22A5 5 0 0 0 7.1 22',
     'm9 2 3 6',
     'M9 15A3 3 0 1 0 15 15A3 3 0 1 0 9 15'], // id-card-lanyard
    ['M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
     'm3.3 7 8.7 5 8.7-5',
     'M12 22V12'], // box
    ['M22 18a2 2 0 0 1-2 2H3c-1.1 0-1.3-.6-.4-1.3L20.4 4.3c.9-.7 1.6-.4 1.6.7Z'], // triangle-right
    ['M3 5A9 3 0 1 0 21 5A9 3 0 1 0 3 5', // cylinder (top ellipse)
     'M3 5v14a9 3 0 0 0 18 0V5'],
    ['M8 21s-4-3-4-9 4-9 4-9',
     'M16 3s4 3 4 9-4 9-4 9',
     'M15 9L9 15',
     'M9 9L15 15'], // variable
    ['M20.34 17.52a10 10 0 1 0-2.82 2.82',
     'M17 19A2 2 0 1 0 21 19A2 2 0 1 0 17 19',
     'm13.41 13.41 4.18 4.18',
     'M10 12A2 2 0 1 0 14 12A2 2 0 1 0 10 12'], // radius
    ['M17 19A2 2 0 1 0 21 19A2 2 0 1 0 17 19',
     'M3 5A2 2 0 1 0 7 5A2 2 0 1 0 3 5',
     'M6.48 3.66a10 10 0 0 1 13.86 13.86',
     'm6.41 6.41 11.18 11.18',
     'M3.66 6.48a10 10 0 0 0 13.86 13.86'], // diameter
    ['M19.5 7a24 24 0 0 1 0 10',
     'M4.5 7a24 24 0 0 0 0 10',
     'M7 19.5a24 24 0 0 0 10 0',
     'M7 4.5a24 24 0 0 1 10 0',
     'M18 17H21A1 1 0 0 1 22 18V21A1 1 0 0 1 21 22H18A1 1 0 0 1 17 21V18A1 1 0 0 1 18 17Z',
     'M18 2H21A1 1 0 0 1 22 3V6A1 1 0 0 1 21 7H18A1 1 0 0 1 17 6V3A1 1 0 0 1 18 2Z',
     'M3 17H6A1 1 0 0 1 7 18V21A1 1 0 0 1 6 22H3A1 1 0 0 1 2 21V18A1 1 0 0 1 3 17Z',
     'M3 2H6A1 1 0 0 1 7 3V6A1 1 0 0 1 6 7H3A1 1 0 0 1 2 6V3A1 1 0 0 1 3 2Z'], // vector-square
    ['M2 12A10 10 0 1 0 22 12A10 10 0 1 0 2 12', 'M22 2 2 22'], // circle-slash-2
    ['M18 4H6', 'M18 8 6 20', 'm6 8 12 12'], // x-line-top
    ['M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2',
     'M5 17A2 2 0 1 0 9 17A2 2 0 1 0 5 17',
     'M9 17h6',
     'M15 17A2 2 0 1 0 19 17A2 2 0 1 0 15 17'], // car
    ['M7 21A1 1 0 1 0 9 21A1 1 0 1 0 7 21',
     'M18 21A1 1 0 1 0 20 21A1 1 0 1 0 18 21',
     'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12'], // shopping-cart
    ['m15 11-1 9', 'm19 11-4-7', 'M2 11h20',
     'm3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4',
     'M4.5 15.5h15', 'm5 11 4-7', 'm9 11 1 9'], // shopping-basket
    ['m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12',
     'M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5',
     'M11 7A5 5 0 1 0 21 7A5 5 0 1 0 11 7'], // mic-vocal
    ['M12 8V4H8',
     'M6 8H18A2 2 0 0 1 20 10V18A2 2 0 0 1 18 20H6A2 2 0 0 1 4 18V10A2 2 0 0 1 6 8Z',
     'M2 14h2', 'M20 14h2', 'M15 13v2', 'M9 13v2'], // bot
    ['M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
     'M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1'], // messages-square
    ['M8 2v4', 'M16 2v4',
     'M5 4H19A2 2 0 0 1 21 6V20A2 2 0 0 1 19 22H5A2 2 0 0 1 3 20V6A2 2 0 0 1 5 4Z',
     'M3 10h18', 'M8 14h.01', 'M12 14h.01', 'M16 14h.01', 'M8 18h.01', 'M12 18h.01', 'M16 18h.01'], // calendar-days
    ['m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20',
     'M16 18h-5', 'M18 5a1 1 0 0 0-1 1v5.573',
     'M3 4h8.129a1 1 0 0 1 .99.863L13 11.246',
     'M4 11V4', 'M7 15h.01', 'M8 10.1V4',
     'M16 18A2 2 0 1 0 20 18A2 2 0 1 0 16 18',
     'M2 15A5 5 0 1 0 12 15A5 5 0 1 0 2 15'], // tractor
    ['M2 12A10 10 0 1 0 22 12A10 10 0 1 0 2 12',
     'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20',
     'M2 12h20'], // globe
    ['M8 3.1V7a4 4 0 0 0 8 0V3.1', 'm9 15-1-1', 'm15 15 1-1',
     'M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z',
     'm8 19-2 3', 'm16 19 2 3'], // train-front
    ['M12 12H5a2 2 0 0 0-2 2v5', 'M15 19h7', 'M16 19V2',
     'M6 12V7a2 2 0 0 1 2-2h2.172a2 2 0 0 1 1.414.586l3.828 3.828A2 2 0 0 1 16 10.828',
     'M7 19h4',
     'M11 19A2 2 0 1 0 15 19A2 2 0 1 0 11 19',
     'M3 19A2 2 0 1 0 7 19A2 2 0 1 0 3 19'], // forklift
    ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8',
     'M3 3v5h5', 'M12 7v5l4 2'], // history (visual match for "rotate-ccw-clock", which Lucide doesn't have)
    ['M4 3H20A2 2 0 0 1 22 5V15A2 2 0 0 1 20 17H4A2 2 0 0 1 2 15V5A2 2 0 0 1 4 3Z',
     'M8 21L16 21', 'M12 17L12 21'], // monitor
    ['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'], // cloud
    ['M4 2H20A2 2 0 0 1 22 4V8A2 2 0 0 1 20 10H4A2 2 0 0 1 2 8V4A2 2 0 0 1 4 2Z',
     'M4 14H20A2 2 0 0 1 22 16V20A2 2 0 0 1 20 22H4A2 2 0 0 1 2 20V16A2 2 0 0 1 4 14Z',
     'M6 6L6.01 6', 'M6 18L6.01 18'], // server
    ['M12 10h.01', 'M12 14h.01', 'M12 6h.01', 'M16 10h.01', 'M16 14h.01', 'M16 6h.01',
     'M8 10h.01', 'M8 14h.01', 'M8 6h.01',
     'M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3',
     'M6 2H18A2 2 0 0 1 20 4V20A2 2 0 0 1 18 22H6A2 2 0 0 1 4 20V4A2 2 0 0 1 6 2Z'], // building
  ];

  function resize() {
    var rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
  }

  function scheduleNextSpawn() {
    nextSpawnDelay = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
  }

  // Axis-aligned check (with a MIN_GAP buffer) against every glyph
  // currently on screen, not just the last one spawned — with up to 3
  // concurrent glyphs, a new one could otherwise land next to either of
  // the other two.
  function overlapsExisting(x0, y0, size) {
    for (var i = 0; i < glyphs.length; i++) {
      var other = glyphs[i];
      if (x0 < other.x0 + other.size + MIN_GAP &&
          x0 + size + MIN_GAP > other.x0 &&
          y0 < other.y0 + other.size + MIN_GAP &&
          y0 + size + MIN_GAP > other.y0) {
        return true;
      }
    }
    return false;
  }

  // Bounding box of the hero's own heading/subtitle, in hero-local
  // coordinates (the same space glyphs are positioned in), padded by
  // TEXT_PADDING — recomputed fresh on every spawn rather than cached,
  // since the text's actual size depends on the current language (i18n.js
  // can swap it at any time) and isn't tied to the hero's own box changing.
  function getTextRect() {
    var heroRect = hero.getBoundingClientRect();
    var textEls = hero.querySelectorAll('h1, .subtitle');
    var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (var i = 0; i < textEls.length; i++) {
      var r = textEls[i].getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    if (left === Infinity) return null;
    return {
      x0: left - heroRect.left - TEXT_PADDING,
      y0: top - heroRect.top - TEXT_PADDING,
      x1: right - heroRect.left + TEXT_PADDING,
      y1: bottom - heroRect.top + TEXT_PADDING,
    };
  }

  function overlapsTextRect(x0, y0, size, textRect) {
    if (!textRect) return false;
    return x0 < textRect.x1 && x0 + size > textRect.x0 &&
           y0 < textRect.y1 && y0 + size > textRect.y0;
  }

  // The previous glyph's center must be at least MIN_SPAWN_DISTANCE_FRACTION
  // of the hero's width away horizontally, so consecutive symbols can't land
  // right next to each other regardless of where in the hero that happens
  // to be.
  function tooCloseToPrevious(x0, size) {
    if (lastCenterX === null) return false;
    var centerX = x0 + size / 2;
    return Math.abs(centerX - lastCenterX) < width * MIN_SPAWN_DISTANCE_FRACTION;
  }

  function spawnGlyph(timestamp) {
    if (width < 10 || height < 10) return;

    var symbolIndex;
    do {
      symbolIndex = Math.floor(Math.random() * SYMBOLS.length);
    } while (SYMBOLS.length > 1 && symbolIndex === lastSymbol);
    lastSymbol = symbolIndex;

    var size = MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE);
    var scale = size / 24;
    var textRect = getTextRect();
    var x0, y0, attempts = 0;
    do {
      x0 = Math.random() * Math.max(1, width - size);
      y0 = Math.random() * Math.max(1, height - size);
      attempts++;
    } while (attempts < MAX_PLACEMENT_ATTEMPTS &&
             (overlapsExisting(x0, y0, size) || overlapsTextRect(x0, y0, size, textRect) ||
              tooCloseToPrevious(x0, size)));
    lastCenterX = x0 + size / 2;

    var g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', 'translate(' + x0 + ',' + y0 + ') scale(' + scale + ')');
    g.setAttribute('fill', 'none');
    g.setAttribute('stroke', '#fff');
    g.setAttribute('stroke-width', String(STROKE_WIDTH));
    g.setAttribute('stroke-linecap', 'round');
    g.setAttribute('stroke-linejoin', 'round');
    g.style.opacity = String(GLYPH_OPACITY);

    var elements = [];
    var totalLength = 0;
    var defs = SYMBOLS[symbolIndex];
    for (var i = 0; i < defs.length; i++) {
      var el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('d', defs[i]);
      g.appendChild(el);
      var len = el.getTotalLength();
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
      elements.push({ el: el, length: len });
      totalLength += len;
    }

    var pen = document.createElementNS(SVG_NS, 'circle');
    pen.setAttribute('r', '0.9');
    pen.setAttribute('fill', '#fff');
    pen.setAttribute('stroke', 'none');
    pen.style.filter = 'drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.95))';
    pen.style.display = 'none';
    g.appendChild(pen);

    svg.appendChild(g);

    var writeDuration = Math.max(500, (totalLength * scale) / PEN_SPEED);
    glyphs.push({
      g: g,
      elements: elements,
      pen: pen,
      totalLength: totalLength,
      writeDuration: writeDuration,
      lifetime: writeDuration + HOLD_DURATION + FADE_DURATION,
      start: timestamp,
      fullyDrawn: false,
      x0: x0,
      y0: y0,
      size: size,
    });
    if (glyphs.length > MAX_GLYPHS) {
      var old = glyphs.shift();
      old.g.remove();
    }
    scheduleNextSpawn();
  }

  function drawGlyph(glyph, elapsed) {
    if (elapsed <= glyph.writeDuration) {
      var target = (elapsed / glyph.writeDuration) * glyph.totalLength;
      var running = 0;
      var tip = null;
      for (var i = 0; i < glyph.elements.length; i++) {
        var item = glyph.elements[i];
        if (running + item.length <= target) {
          item.el.style.strokeDashoffset = '0';
          running += item.length;
        } else {
          var localTarget = Math.max(0, Math.min(item.length, target - running));
          item.el.style.strokeDashoffset = String(item.length - localTarget);
          tip = item.el.getPointAtLength(localTarget);
          break;
        }
      }
      if (tip) {
        glyph.pen.style.display = '';
        glyph.pen.setAttribute('cx', String(tip.x));
        glyph.pen.setAttribute('cy', String(tip.y));
      } else {
        glyph.pen.style.display = 'none';
      }
      return;
    }

    // The write phase's last frame almost never lands at exactly 100%
    // progress (frames are ~16ms apart, writeDuration rarely is a multiple
    // of that), so a sliver of the final stroke is typically still
    // undrawn the instant elapsed crosses writeDuration. Snap every
    // element fully drawn right away rather than holding/fading a symbol
    // that's still visibly incomplete.
    if (!glyph.fullyDrawn) {
      for (var i = 0; i < glyph.elements.length; i++) {
        glyph.elements[i].el.style.strokeDashoffset = '0';
      }
      glyph.fullyDrawn = true;
    }

    glyph.pen.style.display = 'none';
    var afterWrite = elapsed - glyph.writeDuration;
    var opacity = GLYPH_OPACITY;
    if (afterWrite > HOLD_DURATION) {
      opacity = Math.max(0, GLYPH_OPACITY * (1 - (afterWrite - HOLD_DURATION) / FADE_DURATION));
    }
    glyph.g.style.opacity = String(opacity);
  }

  // A single glyph erroring inside drawGlyph/spawnGlyph (whatever the
  // cause) must never take the whole rAF loop down with it — an uncaught
  // throw here would skip the requestAnimationFrame(step) call below and
  // freeze every glyph currently on screen exactly where it stood,
  // permanently, since nothing would ever call step() again. Catch and
  // drop just the offending glyph instead, and log it so a real bug is
  // still visible in the console rather than silently swallowed.
  function safeSpawnGlyph(timestamp) {
    try {
      spawnGlyph(timestamp);
    } catch (err) {
      console.error('math-bg: spawnGlyph failed', err);
    }
  }

  function step(timestamp) {
    if (!lastSpawn) {
      lastSpawn = timestamp;
      safeSpawnGlyph(timestamp);
    } else if (timestamp - lastSpawn >= nextSpawnDelay && glyphs.length < MAX_GLYPHS) {
      lastSpawn = timestamp;
      safeSpawnGlyph(timestamp);
    }

    for (var i = glyphs.length - 1; i >= 0; i--) {
      var glyph = glyphs[i];
      var elapsed = timestamp - glyph.start;
      if (elapsed >= glyph.lifetime) {
        glyph.g.remove();
        glyphs.splice(i, 1);
        continue;
      }
      try {
        drawGlyph(glyph, elapsed);
      } catch (err) {
        console.error('math-bg: drawGlyph failed, dropping this glyph', err);
        glyph.g.remove();
        glyphs.splice(i, 1);
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
