/* Hamasaki Construction LLC — hcllc.biz */
(function () {
  'use strict';

  try {
    main();
  } catch (err) {
    // if anything fails, fall back to the fully static experience
    document.documentElement.classList.remove('js');
    var b = document.getElementById('build');
    if (b) b.classList.add('no-scrub');
    if (window.console && console.error) console.error(err);
  }

  function main() {
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ====================================================================
       Header + mobile nav
       ==================================================================== */
    var header = document.querySelector('.site-header');
    var navToggle = document.querySelector('.nav-toggle');
    var navMenu = document.getElementById('nav-menu');

    function onHeaderScroll() {
      header.classList.toggle('scrolled', window.scrollY > 40);
    }
    window.addEventListener('scroll', onHeaderScroll, { passive: true });
    onHeaderScroll();

    if (navToggle) {
      navToggle.addEventListener('click', function () {
        var open = navMenu.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', String(open));
      });
      navMenu.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') {
          navMenu.classList.remove('open');
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    /* ====================================================================
       Reveal-on-scroll
       ==================================================================== */
    var reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && !prefersReducedMotion) {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            ro.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      reveals.forEach(function (el) { ro.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('in'); });
    }

    /* ====================================================================
       Hero: scroll-scrubbed construction sequence
       ==================================================================== */
    var FRAME_COUNT = 96;
    var build = document.getElementById('build');
    var track = document.getElementById('build-track');
    var canvas = document.getElementById('build-canvas');
    var intro = document.getElementById('build-intro');
    var outro = document.getElementById('build-outro');
    var meter = document.getElementById('build-meter');
    var meterItems = document.querySelectorAll('#build-meter li');

    // Stage boundaries as fractions of scrub progress (matched to the
    // pacing of the source timelapse).
    var STAGES = [0, 0.16, 0.42, 0.62, 0.85];

    if (!canvas || !canvas.getContext || prefersReducedMotion) {
      return; // .no-scrub stays on: static finished-house hero
    }
    var ctx = canvas.getContext('2d');
    if (!ctx) {
      return; // canvas exists but 2d context unavailable: stay static
    }

    var desktopMQ = window.matchMedia('(min-width: 760px)');
    var isSmall = !desktopMQ.matches;
    var frameDir = isSmall ? 'assets/frames/m/' : 'assets/frames/d/';
    var frames = new Array(FRAME_COUNT);
    var currentDrawn = -1;
    var targetFrame = 0;   // float: exact frame position for the scroll offset
    var shownFrame = 0;    // float: eased position actually rendered
    var rafPending = false;
    var scrubbing = false; // flips true once the first frame is on screen
    var lastPaintKey = ''; // skip redundant redraws of the same blend
    var lastTs = 0;

    function frameSrc(i) {
      return frameDir + 'f-' + String(i).padStart(3, '0') + '.webp';
    }

    function nearestLoaded(ideal) {
      if (frames[ideal] && frames[ideal].ready) return ideal;
      for (var d = 1; d < FRAME_COUNT; d++) {
        var lo = ideal - d, hi = ideal + d;
        if (lo >= 0 && frames[lo] && frames[lo].ready) return lo;
        if (hi < FRAME_COUNT && frames[hi] && frames[hi].ready) return hi;
      }
      return -1;
    }

    function sizeCanvas() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
    }

    function drawCover(img) {
      var cw = canvas.width, ch = canvas.height;
      var iw = img.naturalWidth, ih = img.naturalHeight;
      var scale = Math.max(cw / iw, ch / ih);
      var dw = iw * scale, dh = ih * scale;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }

    // Render a fractional frame position by crossfading the two adjacent
    // frames — motion reads as continuous rather than stepped.
    function paintAt(pos) {
      var i0 = Math.floor(pos);
      var frac = pos - i0;
      var base = (frames[i0] && frames[i0].ready) ? i0 : nearestLoaded(Math.round(pos));
      if (base < 0) return;
      var i1 = Math.min(i0 + 1, FRAME_COUNT - 1);
      var blend = (base === i0 && frac > 0.01 && i1 !== i0 &&
                   frames[i1] && frames[i1].ready) ? i1 : -1;
      var key = base + '/' + (blend < 0 ? 'x' : blend + '@' + frac.toFixed(2));
      if (key === lastPaintKey) return;
      if (!scrubbing) {
        // swap static fallback for live canvas BEFORE sizing: while
        // .no-scrub is on, the canvas is display:none and measures 0x0
        scrubbing = true;
        build.classList.remove('no-scrub');
      }
      sizeCanvas();
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
      drawCover(frames[base].img);
      if (blend >= 0) {
        ctx.globalAlpha = frac;
        drawCover(frames[blend].img);
        ctx.globalAlpha = 1;
      }
      lastPaintKey = key;
      currentDrawn = base;
    }

    function loadFrame(i, cb) {
      if (frames[i]) return;
      var img = new Image();
      img.decoding = 'async';
      var entry = { img: img, ready: false, tried: 0 };
      frames[i] = entry;
      img.onload = function () {
        entry.ready = true;
        if (cb) cb(i);
        // paint if the canvas is empty or this frame beats the one on screen
        if (currentDrawn === -1 ||
            Math.abs(i - targetFrame) < Math.abs(currentDrawn - targetFrame)) {
          requestPaint();
        }
      };
      img.onerror = function () {
        entry.tried++;
        if (entry.tried < 3) {
          // retry with backoff; keep the pass moving either way
          setTimeout(function () { img.src = frameSrc(i) + '?r=' + entry.tried; }, 800 * entry.tried);
        } else {
          frames[i] = undefined; // give a later pass a chance to re-request
        }
        if (cb) cb(i);
      };
      img.src = frameSrc(i);
    }

    function requestPaint() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function (ts) {
        rafPending = false;
        // frame-rate-independent glide toward the exact scroll position
        var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
        lastTs = ts;
        var k = 1 - Math.exp(-dt * 7);
        shownFrame += (targetFrame - shownFrame) * k;
        if (Math.abs(targetFrame - shownFrame) < 0.02) shownFrame = targetFrame;
        paintAt(shownFrame);
        if (shownFrame !== targetFrame) requestPaint();
        else lastTs = 0;
      });
    }

    // Progressive loading. A coarse pass (every 6th frame, ~1 MB) starts
    // immediately; the full-quality passes wait for the first user
    // interaction or a few idle seconds so a visitor who never scrolls
    // doesn't pay for all 96 frames.
    function loadPass(step, then) {
      var remaining = 0, done = false;
      function settle() {
        remaining--;
        if (remaining === 0 && !done && then) { done = true; then(); }
      }
      for (var i = 0; i < FRAME_COUNT; i += step) {
        if (!frames[i]) {
          remaining++;
          loadFrame(i, settle);
        }
      }
      if (remaining === 0 && then && !done) { done = true; then(); }
    }

    var deepLoadStarted = false;
    function startDeepLoad() {
      if (deepLoadStarted) return;
      deepLoadStarted = true;
      loadPass(2, function () { loadPass(1, null); });
    }

    loadFrame(0, function () { requestPaint(); });
    loadPass(6, null);
    window.addEventListener('scroll', startDeepLoad, { passive: true, once: true });
    window.addEventListener('touchstart', startDeepLoad, { passive: true, once: true });
    setTimeout(startDeepLoad, 3500);

    // If the 760px breakpoint flips (tablet rotation, window resize),
    // switch frame sets and reload.
    function onBreakpointChange() {
      var nowSmall = !desktopMQ.matches;
      if (nowSmall === isSmall) return;
      isSmall = nowSmall;
      frameDir = isSmall ? 'assets/frames/m/' : 'assets/frames/d/';
      frames = new Array(FRAME_COUNT);
      currentDrawn = -1;
      lastPaintKey = '';
      loadFrame(Math.round(targetFrame), function () { requestPaint(); });
      loadPass(6, null);
      if (deepLoadStarted) { deepLoadStarted = false; startDeepLoad(); }
    }
    if (desktopMQ.addEventListener) desktopMQ.addEventListener('change', onBreakpointChange);

    var progress = 0;

    function onScrub() {
      var rect = track.getBoundingClientRect();
      var vh = window.innerHeight;
      var total = rect.height - vh;
      progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

      targetFrame = Math.min(FRAME_COUNT - 1, progress * (FRAME_COUNT - 1));
      requestPaint();

      // intro fades out over the first 12% of the scrub
      var introOpacity = Math.max(0, 1 - progress / 0.12);
      intro.style.opacity = introOpacity.toFixed(3);
      intro.style.visibility = introOpacity <= 0 ? 'hidden' : 'visible';

      // outro appears at the end; meter steps aside for it
      outro.classList.toggle('visible', progress > 0.94);
      meter.classList.toggle('faded', progress > 0.92);

      // stage meter
      var stage = 0;
      for (var s = STAGES.length - 1; s >= 0; s--) {
        if (progress >= STAGES[s]) { stage = s; break; }
      }
      meterItems.forEach(function (li, i) {
        li.classList.toggle('active', i === stage);
        li.classList.toggle('done', i < stage);
      });
    }

    window.addEventListener('scroll', onScrub, { passive: true });
    window.addEventListener('resize', function () {
      currentDrawn = -1;
      lastPaintKey = '';
      onScrub();
    });
    onScrub();
  }
})();
