/* Cuchilleras hero background: "digraph fusion" effect. Two separate
   CuchillerasSans letters — lowercase (c+h, l+l, r+r), all-caps (C+H,
   L+L, R+R), or title-case (C+h, L+l, R+r) — drift apart and together
   again like they're suspended in ether, converge, flash white at the
   instant they'd otherwise overlap, and settle into the real fused
   ligature glyph underneath the flash (see the alphabet table and digraph
   cards below, which show these same ligatures) — holds for a beat, then
   fades, and the cycle repeats with the next digraph/case combination.

   Every path below is real glyph outline geometry pulled straight out of
   CuchillerasSansVF.ttf via fontTools' SVGPathPen (the same technique
   glyph-bg.js uses for the Fonts page, and — like that page's Tunic
   case — these ligatures are the font's actual named GSUB "liga" glyphs,
   not two letters redrawn by hand). Confirmed directly in the font's GSUB
   table that title-case (e.g. "C"+"h") resolves to the same ligature glyph
   as all-caps ("C"+"H") — c_h.liga/l_l.liga/r_r.liga only exist as a
   lowercase shape, C_H.liga/L_L.liga/R_R.liga cover both the all-caps and
   title-case spellings — so there are 9 letter-pair stories but only 6
   distinct ligature shapes. Only CuchillerasSans is used here, never the
   serif Cuchilleras cut.

   All glyphs share one single scale factor (pixels per font unit) rather
   than each being independently normalized to its own bounding box —
   unlike glyph-bg.js's showcase glyphs, these have to keep each other's
   true relative proportions and advance widths, the same as if they were
   actually typed together, since the whole point is watching two real
   letters become the real ligature.

   One story plays at a time (not three concurrent, unlike glyph-bg.js) —
   the multi-phase float/fuse/flash/reveal sequence reads better without a
   second one competing for attention. Performance/accessibility
   conventions match every other hero effect: skips under
   prefers-reduced-motion, pauses via IntersectionObserver when the hero is
   off-screen and visibilitychange when the tab isn't active, and reads
   the hero's box via ResizeObserver rather than assuming a fixed size. */
(function () {
  var svg = document.querySelector('.hero-digraphs');
  if (!svg || !(svg instanceof SVGElement)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var UPM = 1000;

  // Glyph outlines extracted from CuchillerasSansVF.ttf (default
  // instance: weight 400, width 100). Font y-up coordinates, baseline at
  // y=0 — rendered via a scale(s, -s) transform at placement time.
  var GLYPHS = {
    c: { d: 'M55 265Q55 364 88.0 426.0Q121 488 177.5 517.0Q234 546 306 546Q347 546 385.0 537.5Q423 529 447 517L420 444Q396 453 364.0 461.0Q332 469 304 469Q250 469 215.0 446.0Q180 423 163.0 378.0Q146 333 146 266Q146 202 163.0 157.0Q180 112 214.0 89.0Q248 66 299 66Q343 66 376.5 75.0Q410 84 438 97V19Q411 5 378.5 -2.5Q346 -10 300 -10Q229 -10 173.5 19.0Q118 48 86.5 109.0Q55 170 55 265Z', advance: 480 },
    h: { d: 'M173 537Q173 518 171.5 498.0Q170 478 168 462H174Q191 490 217.0 508.0Q243 526 275.0 535.5Q307 545 341 545Q406 545 449.5 524.5Q493 504 515.0 461.0Q537 418 537 349V0H450V343Q450 408 421.0 440.0Q392 472 330 472Q270 472 236.0 449.5Q202 427 187.5 383.5Q173 340 173 277V0H85V760H173Z', advance: 618 },
    l: { d: 'M173 0H85V760H173Z', advance: 258 },
    r: { d: 'M398 540 387 459Q374 462 358.5 464.0Q343 466 329 466Q298 466 270.0 453.0Q242 440 220.0 416.5Q198 393 185.5 360.0Q173 327 173 286V0H85V536H157L167 438H171Q188 468 212.0 492.5Q236 517 267.0 531.5Q298 546 335 546Q350 546 367.5 544.5Q385 543 398 540Z', advance: 413 },
    ch: { d: 'M435 760V545Q558 537 626.0 469.5Q694 402 694 265V0H606V268Q606 362 564.5 412.5Q523 463 435 473V165Q435 79 391.5 34.5Q348 -10 271 -10Q207 -10 158.0 21.0Q109 52 82.0 107.5Q55 163 55 235Q55 372 130.5 455.0Q206 538 349 545V760ZM144 236Q144 150 174.5 106.5Q205 63 266 63Q307 63 328.0 86.5Q349 110 349 164V473Q246 464 195.0 402.5Q144 341 144 236Z', advance: 749 },
    ll: { d: 'M376 238Q377 267 381 298H375Q357 259 323.5 237.0Q290 215 250 215Q200 215 162.0 236.5Q124 258 102.5 302.0Q81 346 81 411V760H168V417Q168 351 190.0 319.5Q212 288 258 288Q302 288 328.0 310.0Q354 332 365.0 374.5Q376 417 376 483V760H464V0H376V223Q376 231 376 238Z', advance: 549 },
    rr: { d: 'M398 540 387 459Q374 462 358.5 464.0Q343 466 329 466Q298 466 270.0 453.0Q242 440 220.0 416.5Q198 393 185.5 360.0Q173 327 173 286V0H85V536H157L167 438H171Q188 468 212.0 492.5Q236 517 267.0 531.5Q298 546 335 546Q350 546 367.5 544.5Q385 543 398 540ZM58 606Q61 636 69.5 659.5Q78 683 92.0 699.5Q106 716 125.0 725.0Q144 734 168 734Q190 734 210.5 725.5Q231 717 250.0 705.5Q269 694 286.5 685.5Q304 677 320 677Q343 677 355.5 691.5Q368 706 375 735H425Q419 677 391.0 642.0Q363 607 316 607Q295 607 275.0 615.5Q255 624 235.5 635.5Q216 647 198.5 655.5Q181 664 164 664Q140 664 128.0 649.5Q116 635 109 606Z', advance: 413 },
    C: { d: 'M156 357Q156 269 183.5 204.0Q211 139 265.5 104.0Q320 69 402 69Q449 69 491.0 77.0Q533 85 573 97V19Q533 4 490.5 -3.0Q448 -10 389 -10Q280 -10 207.0 35.0Q134 80 97.5 163.0Q61 246 61 358Q61 439 83.5 506.0Q106 573 149.5 622.0Q193 671 257.0 697.5Q321 724 404 724Q459 724 510.0 713.0Q561 702 601 682L565 606Q532 621 491.5 633.0Q451 645 403 645Q346 645 300.0 625.5Q254 606 222.0 568.5Q190 531 173.0 477.5Q156 424 156 357Z', advance: 632 },
    H: { d: 'M643 0H553V333H187V0H97V714H187V412H553V714H643Z', advance: 741 },
    L: { d: 'M97 0V714H187V80H499V0Z', advance: 524 },
    R: { d: 'M294 714Q383 714 440.5 691.5Q498 669 526.0 624.0Q554 579 554 511Q554 454 533.0 416.0Q512 378 479.5 355.5Q447 333 411 320L607 0H502L329 295H187V0H97V714ZM187 636V371H294Q381 371 421.0 405.5Q461 440 461 507Q461 554 442.5 582.0Q424 610 386.0 623.0Q348 636 289 636Z', advance: 622 },
    CH: { d: 'M697 0H607V333H108V412H607V714H697ZM156 357Q156 265 177.5 200.5Q199 136 240.0 102.5Q281 69 341 69Q374 69 404.5 76.5Q435 84 469 97V19Q438 4 406.5 -3.0Q375 -10 331 -10Q251 -10 190.0 33.5Q129 77 95.0 160.0Q61 243 61 358Q61 464 96.5 547.5Q132 631 195.5 677.5Q259 724 342 724Q383 724 421.5 713.0Q460 702 490 682L463 606Q434 624 404.0 634.5Q374 645 341 645Q284 645 242.5 610.5Q201 576 178.5 511.5Q156 447 156 357Z', advance: 795 },
    LL: { d: 'M316 0V714H405V80H640V0ZM51 278V714H140V358H316V278Z', advance: 665 },
    RR: { d: 'M294 714Q383 714 440.5 691.5Q498 669 526.0 624.0Q554 579 554 511Q554 454 533.0 416.0Q512 378 479.5 355.5Q447 333 411 320L607 0H502L329 295H187V0H97V714ZM187 636V371H294Q381 371 421.0 405.5Q461 440 461 507Q461 554 442.5 582.0Q424 610 386.0 623.0Q348 636 289 636ZM142 784Q145 814 153.5 837.5Q162 861 176.0 877.5Q190 894 209.0 903.0Q228 912 252 912Q274 912 294.5 903.5Q315 895 334.0 883.5Q353 872 370.5 863.5Q388 855 404 855Q427 855 439.5 869.5Q452 884 459 913H509Q503 855 475.0 820.0Q447 785 400 785Q379 785 359.0 793.5Q339 802 319.5 813.5Q300 825 282.5 833.5Q265 842 248 842Q224 842 212.0 827.5Q200 813 193 784Z', advance: 622 },
  };

  var STORIES = [
    // lowercase
    { a: 'c', b: 'h', liga: 'ch' },
    { a: 'l', b: 'l', liga: 'll' },
    { a: 'r', b: 'r', liga: 'rr' },
    // all-caps
    { a: 'C', b: 'H', liga: 'CH' },
    { a: 'L', b: 'L', liga: 'LL' },
    { a: 'R', b: 'R', liga: 'RR' },
    // title-case (word-initial capital) — the font's GSUB maps this same
    // as all-caps, onto the same ligature glyph (verified directly in the
    // font: no separate "mixed-case" ligature shape exists).
    { a: 'C', b: 'h', liga: 'CH' },
    { a: 'L', b: 'l', liga: 'LL' },
    { a: 'R', b: 'r', liga: 'RR' },
  ];

  // Non-repeating shuffled cycle through the 9 stories (same idea as
  // glyph-bg.js's refillQueue), so no case/digraph combination repeats
  // twice in a row the way a flat random pick occasionally would.
  var queue = [];
  function refillQueue() {
    var pool = STORIES.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    queue = queue.concat(pool);
  }
  function nextStory() {
    if (!queue.length) refillQueue();
    return queue.shift();
  }

  var INK = '61, 54, 38'; // matches .hero--cuchilleras h1's dark ink

  var PHASE = {
    ENTER: 700,
    FLOAT: 2600,
    FUSE: 900,
    FLASH: 260,
    HOLD: 1400,
    FADE: 800,
    GAP: 700,
  };
  var TOTAL = PHASE.ENTER + PHASE.FLOAT + PHASE.FUSE + PHASE.FLASH + PHASE.HOLD + PHASE.FADE + PHASE.GAP;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  var groupA = document.createElementNS(SVG_NS, 'path');
  var groupB = document.createElementNS(SVG_NS, 'path');
  var groupLiga = document.createElementNS(SVG_NS, 'path');
  [groupA, groupB, groupLiga].forEach(function (el) {
    el.setAttribute('fill', 'rgba(' + INK + ', 0)');
  });
  // The fusion flash: a soft white burst masking the instant swap from two
  // letters to the fused ligature underneath it.
  var flash = document.createElementNS(SVG_NS, 'circle');
  flash.setAttribute('fill', 'rgba(255, 255, 255, 0)');
  flash.style.filter = 'blur(6px)';
  svg.appendChild(groupA);
  svg.appendChild(groupB);
  svg.appendChild(groupLiga);
  svg.appendChild(flash);

  var story = nextStory();
  var elapsed = 0; // ms into the current story's lifecycle
  var box = { w: 0, h: 0 };
  var anchor = { x: 0, y: 0 };
  var fontPx = 90;
  var gapPx = 14;

  function pickAnchor() {
    anchor.x = box.w * (0.18 + Math.random() * 0.64);
    // Baseline y kept well clear of the top edge — ascenders (h, l, the ll
    // ligature) reach up to ~0.76em above it, and the hero clips overflow.
    anchor.y = box.h * (0.42 + Math.random() * 0.4);
  }

  function measure() {
    var rect = svg.getBoundingClientRect();
    box.w = rect.width;
    box.h = rect.height;
    fontPx = Math.max(56, Math.min(120, box.h * 0.32));
    // Wide enough that the two letters read as genuinely floating apart —
    // FUSE then has real distance left to visibly close before they merge
    // (its target position is full overlap, see update() below).
    gapPx = fontPx * 1.1;
  }

  function startStory() {
    story = nextStory();
    elapsed = 0;
    pickAnchor();
    groupA.setAttribute('d', GLYPHS[story.a].d);
    groupB.setAttribute('d', GLYPHS[story.b].d);
    groupLiga.setAttribute('d', GLYPHS[story.liga].d);
  }

  function place(el, xPx, yPx, alpha, scaleMul) {
    var s = (fontPx / UPM) * (scaleMul || 1);
    el.setAttribute('transform', 'translate(' + xPx + ',' + yPx + ') scale(' + s + ',' + (-s) + ')');
    el.setAttribute('fill', 'rgba(' + INK + ', ' + alpha.toFixed(3) + ')');
  }
  function hide(el) {
    el.setAttribute('fill', 'rgba(' + INK + ', 0)');
  }

  function hideFlash() {
    flash.setAttribute('fill', 'rgba(255, 255, 255, 0)');
  }
  function placeFlash(xPx, yPx, alpha) {
    var r = fontPx * 0.7;
    flash.setAttribute('cx', xPx);
    flash.setAttribute('cy', yPx);
    flash.setAttribute('r', r);
    flash.setAttribute('fill', 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')');
  }

  var LIGA_ALPHA = 0.55;

  function update() {
    var s = fontPx / UPM;
    var advA = GLYPHS[story.a].advance * s;
    var advB = GLYPHS[story.b].advance * s;
    var pairWidth = advA + gapPx + advB;
    var baseAx = anchor.x - pairWidth / 2;
    var baseBx = baseAx + advA + gapPx;
    var baseY = anchor.y;
    // The flash/ligature sit roughly centered on the pair's typical cap
    // height, not on the baseline itself (letters/ligatures extend upward
    // from the baseline, not around it).
    var centerY = baseY - fontPx * 0.32;

    var t = elapsed;

    if (t < PHASE.ENTER) {
      var p = t / PHASE.ENTER;
      var alpha = 0.32 * easeOutBack(Math.min(1, p));
      place(groupA, baseAx, baseY, Math.max(0, alpha));
      place(groupB, baseBx, baseY, Math.max(0, alpha));
      hide(groupLiga);
      hideFlash();
    } else if (t < PHASE.ENTER + PHASE.FLOAT) {
      var floatMs = t - PHASE.ENTER;
      var ft = floatMs / 1000; // seconds into float
      // ENTER leaves both letters perfectly still at (baseAx/baseBx, baseY)
      // — every jitter term here uses sin() at a phase that's exactly 0 at
      // ft=0 (0 or π), so position is continuous at the ENTER→FLOAT
      // boundary, and the amplitude itself eases in from 0 over the first
      // ~0.9s (smoothstep) so the letters ease into bobbing motion rather
      // than snapping to full-speed drift the instant it starts.
      var ramp = Math.min(1, floatMs / 900);
      ramp = ramp * ramp * (3 - 2 * ramp);
      var ampX = fontPx * 0.08 * ramp;
      var ampY = fontPx * 0.06 * ramp;
      var jx = Math.sin(ft * 1.3) * ampX;
      var jy = Math.sin(ft * 1.7) * ampY;
      var jx2 = Math.sin(ft * 1.1 + Math.PI) * ampX;
      var jy2 = Math.sin(ft * 1.5 + Math.PI) * ampY;
      place(groupA, baseAx + jx, baseY + jy, 0.32);
      place(groupB, baseBx + jx2, baseY + jy2, 0.32);
      hide(groupLiga);
      hideFlash();
    } else if (t < PHASE.ENTER + PHASE.FLOAT + PHASE.FUSE) {
      var fp = (t - PHASE.ENTER - PHASE.FLOAT) / PHASE.FUSE;
      var e = easeInOutCubic(fp);
      var ax = baseAx + (anchor.x - advA / 2 - baseAx) * e;
      var bx = baseBx + (anchor.x - advB / 2 - baseBx) * e;
      var alpha = 0.32 + 0.28 * e;
      place(groupA, ax, baseY, alpha);
      place(groupB, bx, baseY, alpha);
      hide(groupLiga);
      // The flash starts building right at the tail end of the fuse, so it
      // has already begun brightening by the moment the letters meet.
      var preFlash = Math.max(0, (fp - 0.7) / 0.3);
      if (preFlash > 0) placeFlash(anchor.x, centerY, 0.6 * preFlash);
      else hideFlash();
    } else if (t < PHASE.ENTER + PHASE.FLOAT + PHASE.FUSE + PHASE.FLASH) {
      var xp = (t - PHASE.ENTER - PHASE.FLOAT - PHASE.FUSE) / PHASE.FLASH;
      hide(groupA);
      hide(groupB);
      // Flash brightens to a full white burst, then fades away — the
      // ligature underneath fades in starting partway through, so it's
      // revealed cleanly from behind the flash rather than popping in.
      var flashAlpha = xp < 0.35 ? (0.6 + 0.4 * (xp / 0.35)) : Math.max(0, 1 - (xp - 0.35) / 0.65);
      placeFlash(anchor.x, centerY, flashAlpha);
      var advLiga = GLYPHS[story.liga].advance * s;
      var ligAlpha = xp < 0.3 ? 0 : Math.min(1, (xp - 0.3) / 0.5);
      place(groupLiga, anchor.x - advLiga / 2, baseY, LIGA_ALPHA * ligAlpha);
    } else if (t < PHASE.ENTER + PHASE.FLOAT + PHASE.FUSE + PHASE.FLASH + PHASE.HOLD) {
      hide(groupA);
      hide(groupB);
      hideFlash();
      var advLiga2 = GLYPHS[story.liga].advance * s;
      place(groupLiga, anchor.x - advLiga2 / 2, baseY, LIGA_ALPHA);
    } else if (t < TOTAL - PHASE.GAP) {
      var fadeT = (t - (TOTAL - PHASE.GAP - PHASE.FADE)) / PHASE.FADE;
      hide(groupA);
      hide(groupB);
      hideFlash();
      var advLiga3 = GLYPHS[story.liga].advance * s;
      place(groupLiga, anchor.x - advLiga3 / 2, baseY, LIGA_ALPHA * (1 - Math.min(1, fadeT)));
    } else {
      hide(groupA);
      hide(groupB);
      hide(groupLiga);
      hideFlash();
    }

    if (t >= TOTAL) {
      startStory();
    }
  }

  var running = false;
  var lastFrame = 0;
  function frame(now) {
    if (!running) return;
    if (!lastFrame) lastFrame = now;
    var dt = now - lastFrame;
    lastFrame = now;
    elapsed += dt;
    update();
    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    lastFrame = 0;
    requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
  }

  measure();
  startStory();

  if ('ResizeObserver' in window) {
    var hero = svg.closest('.hero') || svg.parentElement;
    var ro = new ResizeObserver(function () { measure(); });
    if (hero) ro.observe(hero);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) start();
        else stop();
      });
    }, { threshold: 0.01 });
    io.observe(svg);
  } else {
    start();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });
})();
