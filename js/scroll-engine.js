/* =============================================================
   GROUNDUP — scroll-build engine
   Pins the hero stage and maps scroll position → build progress,
   then hands progress to whichever renderer is active:

     FrameSequenceRenderer — photoreal frames (Higgsfield workflow)
     VideoScrubRenderer    — scrub an MP4's currentTime
     ProceduralRenderer    — code-drawn SVG house (zero assets)

   Renderers self-report failure and the engine falls back down the
   chain (frames → video → procedural), so the hero never breaks.
   ============================================================= */
(function () {
  "use strict";

  var cfg = (window.SITE_CONFIG && window.SITE_CONFIG.buildAnimation) || {};
  var section = document.getElementById("buildScroll");
  var stage = document.getElementById("buildStage");
  if (!section || !stage) return;

  /* set by the engine once it starts; renderers call this when their
     assets arrive so the first frame paints without waiting for a scroll */
  var repaint = null;
  function notifyReady() { if (repaint) repaint(); }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* scroll length (in viewport-heights) comes from config; the CSS
     height uses calc(var(--build-len, 5.6) * 100vh) so the
     reduced-motion height:auto override still wins */
  if (cfg.scrollLength > 0) section.style.setProperty("--build-len", cfg.scrollLength);

  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  /* progress of p through the window [a, b], clamped 0..1 */
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };
  var easeInOut = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

  /* ----------------------------------------------------------
     Renderer: photoreal frame sequence on a canvas
     ---------------------------------------------------------- */
  function FrameSequenceRenderer(opts, onFail) {
    var canvas = document.getElementById("buildCanvas");
    var loadingEl = document.getElementById("buildLoading");
    var loadingFill = document.getElementById("buildLoadingFill");
    if (!canvas) { onFail(); return null; }

    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var frames = [];
    var loaded = 0, failed = 0, ready = false, lastDrawn = -1;
    /* frames can be an explicit list of URLs (opts.list) or a
       numbered pattern (path/prefix/pad/ext/first/count) */
    var total = opts.list ? opts.list.length : (opts.count || 0);
    if (!total) { onFail(); return null; }

    function src(i) {
      if (opts.list) return opts.list[i];
      var n = String(opts.first + i);
      while (n.length < (opts.pad || 4)) n = "0" + n;
      return opts.path + (opts.prefix || "frame_") + n + "." + (opts.ext || "jpg");
    }

    if (loadingEl) loadingEl.hidden = false;
    stage.classList.add("is-loading");

    for (var i = 0; i < total; i++) {
      (function (i) {
        var img = new Image();
        img.decoding = "async";
        img.onload = function () { tick(); };
        img.onerror = function () { failed++; tick(); };
        img.src = src(i);
        frames[i] = img;
      })(i);
    }

    function tick() {
      loaded++;
      if (loadingFill) loadingFill.style.width = Math.round((loaded / total) * 100) + "%";
      if (loaded >= total) {
        if (loadingEl) loadingEl.hidden = true;
        stage.classList.remove("is-loading");
        /* tolerate a stray missing frame, but a broken sequence = fall back:
           release the images and the resize listener before handing off */
        if (failed > Math.max(2, total * 0.05)) {
          window.removeEventListener("resize", resize);
          for (var j = 0; j < frames.length; j++) {
            if (frames[j]) { frames[j].onload = frames[j].onerror = null; frames[j].src = ""; }
          }
          frames.length = 0;
          onFail();
          return;
        }
        ready = true;
        stage.classList.add("mode-frames");
        lastDrawn = -1;
        resize();
        notifyReady();
      }
    }

    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      lastDrawn = -1;
    }
    window.addEventListener("resize", resize);

    function draw(p) {
      if (!ready) return;
      var idx = clamp(Math.round(p * (total - 1)), 0, total - 1);
      /* skip past any frame that individually failed — search forward,
         then backward; never wrap (a missing final frame must resolve to
         the finished house, not the empty lot) */
      if (frames[idx] && !frames[idx].naturalWidth) {
        var j = idx;
        while (j < total && frames[j] && !frames[j].naturalWidth) j++;
        if (j >= total) {
          j = idx;
          while (j >= 0 && frames[j] && !frames[j].naturalWidth) j--;
        }
        if (j < 0 || j >= total) return;
        idx = j;
      }
      if (idx === lastDrawn) return;
      var img = frames[idx];
      if (!img || !img.naturalWidth) return;
      lastDrawn = idx;

      /* cover-fit */
      var cw = canvas.width, ch = canvas.height;
      var s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }

    return { render: draw };
  }

  /* ----------------------------------------------------------
     Renderer: direct <video> scrubbing
     ---------------------------------------------------------- */
  function VideoScrubRenderer(opts, onFail) {
    var video = document.getElementById("buildVideo");
    if (!video || !opts.src) { onFail(); return null; }

    var ready = false;
    video.src = opts.src;
    stage.classList.add("is-loading");
    video.addEventListener("loadedmetadata", function () {
      ready = true;
      stage.classList.remove("is-loading");
      stage.classList.add("mode-video");
      notifyReady();
    });
    video.addEventListener("error", function () {
      stage.classList.remove("is-loading");
      onFail();
    });
    video.load();

    var target = 0, applied = -1;
    function draw(p) {
      if (!ready || !video.duration) return;
      target = clamp(p, 0, 1) * Math.max(video.duration - 0.05, 0);
      if (Math.abs(target - applied) < 0.02) return;
      applied = target;
      try { video.currentTime = target; } catch (e) { /* seek in flight */ }
    }
    return { render: draw };
  }

  /* ----------------------------------------------------------
     Renderer: procedural SVG house build
     ---------------------------------------------------------- */
  function ProceduralRenderer() {
    var $ = function (id) { return document.getElementById(id); };
    var svg = $("houseSvg");
    if (!svg) return null;
    stage.classList.remove("mode-frames", "mode-video", "is-loading");

    /* prep stroke-draw elements */
    function prepDraw(el) {
      if (!el) return null;
      var len;
      try { len = el.getTotalLength(); } catch (e) { return null; }
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
      return { el: el, len: len };
    }
    var ground = prepDraw($("groundLine"));
    var trussEls = [].slice.call(svg.querySelectorAll(".truss")).map(prepDraw);
    var roofLine = prepDraw($("roofLine"));

    var studs = [].slice.call(svg.querySelectorAll("#studs line"));
    var el = {
      bp: $("bp"), glow: $("glow"), stakes: $("stakes"),
      foundation: $("foundation"), framing: $("framing"),
      plateTop: $("plateTop"), plateBottom: $("plateBottom"),
      wallFill: $("wallFill"), gableFill: $("gableFill"), sidingLines: $("sidingLines"),
      chimney: $("chimney"), roofTrim: $("roofTrim"),
      door: $("door"), winL: $("winL"), winR: $("winR"), winGable: $("winGable"),
      lights: $("lights"), steps: $("steps"), path: $("path"),
      treeL: $("treeL"), bushR: $("bushR"), bushL: $("bushL")
    };

    /* transforms via attribute so we don't fight CSS */
    function riseIn(node, t, dist) {
      if (!node) return;
      node.setAttribute("opacity", t);
      node.setAttribute("transform", "translate(0 " + ((1 - easeOut(t)) * (dist || 26)) + ")");
    }
    function popIn(node, t) {
      if (!node) return;
      var s = 0.6 + 0.4 * easeOut(t);
      var b = node.getBBox();
      var cx = b.x + b.width / 2, cy = b.y + b.height;
      node.setAttribute("opacity", t);
      node.setAttribute("transform", "translate(" + cx + " " + cy + ") scale(" + s + ") translate(" + -cx + " " + -cy + ")");
    }
    function drawStroke(d, t) {
      if (!d) return;
      d.el.style.strokeDashoffset = d.len * (1 - t);
      d.el.setAttribute("opacity", t > 0 ? 1 : 0);
    }
    function fade(node, o) { if (node) node.setAttribute("opacity", o); }

    function draw(p) {
      /* blueprint fades as the real build takes over */
      fade(el.bp, 1 - 0.88 * seg(p, 0.45, 0.75));

      /* 1 · site */
      drawStroke(ground, easeOut(seg(p, 0.0, 0.07)));
      fade(el.stakes, seg(p, 0.04, 0.09));

      /* 2 · foundation */
      riseIn(el.foundation, easeInOut(seg(p, 0.1, 0.2)), 30);

      /* 3 · framing: studs rise one by one */
      var ft = seg(p, 0.2, 0.42);
      studs.forEach(function (s, i) {
        var t = easeOut(seg(ft, i / studs.length * 0.75, i / studs.length * 0.75 + 0.25));
        s.setAttribute("opacity", t);
        s.setAttribute("transform", "translate(0 " + (1 - t) * 40 + ")");
      });
      fade(el.plateBottom, seg(ft, 0.05, 0.25));
      fade(el.plateTop, seg(ft, 0.75, 1));

      /* 4 · trusses draw on */
      trussEls.forEach(function (t, i) {
        drawStroke(t, easeInOut(seg(p, 0.42 + i * 0.03, 0.52 + i * 0.03)));
      });

      /* 5 · walls close in */
      fade(el.wallFill, easeInOut(seg(p, 0.55, 0.64)));
      fade(el.gableFill, easeInOut(seg(p, 0.58, 0.67)));
      fade(el.sidingLines, seg(p, 0.62, 0.68) * 0.9);

      /* 6 · roof */
      drawStroke(roofLine, easeInOut(seg(p, 0.64, 0.73)));
      fade(el.roofTrim, seg(p, 0.71, 0.75) * 0.9);
      riseIn(el.chimney, easeOut(seg(p, 0.7, 0.76)), 20);

      /* 7 · openings */
      popIn(el.winL, seg(p, 0.74, 0.79));
      popIn(el.winR, seg(p, 0.76, 0.81));
      popIn(el.winGable, seg(p, 0.78, 0.83));
      popIn(el.door, seg(p, 0.79, 0.85));

      /* 8 · entry + landscaping */
      fade(el.steps, seg(p, 0.83, 0.87));
      fade(el.path, seg(p, 0.84, 0.89) * 0.5);
      popIn(el.treeL, seg(p, 0.86, 0.92));
      popIn(el.bushR, seg(p, 0.88, 0.93));
      popIn(el.bushL, seg(p, 0.9, 0.95));

      /* 9 · the lights come on */
      fade(el.lights, easeInOut(seg(p, 0.93, 1)));
      fade(el.glow, 0.85 * easeInOut(seg(p, 0.92, 1)));
    }

    return { render: draw };
  }

  /* ----------------------------------------------------------
     Overlay UI shared by all modes: chapters + tracker + cue
     ---------------------------------------------------------- */
  var chapters = [].slice.call(document.querySelectorAll(".chapter")).map(function (c) {
    return { el: c, from: parseFloat(c.dataset.from), to: parseFloat(c.dataset.to) };
  });
  var trackerItems = [].slice.call(document.querySelectorAll("#tracker li")).map(function (li) {
    return { el: li, at: parseFloat(li.dataset.at) };
  });
  var cue = document.getElementById("scrollCue");

  function renderUI(p) {
    chapters.forEach(function (c) {
      var FADE = 0.045;
      var vis = p >= c.from - FADE && p <= c.to + FADE;
      var o = 0;
      if (vis) {
        o = Math.min(seg(p, c.from - FADE, c.from), 1 - seg(p, c.to, c.to + FADE));
        /* first chapter is already visible at p=0, last stays at p=1 */
        if (c.from <= 0) o = 1 - seg(p, c.to, c.to + FADE);
        if (c.to >= 1) o = seg(p, c.from - FADE, c.from);
      }
      c.el.style.opacity = o;
      c.el.style.visibility = o > 0.01 ? "visible" : "hidden";
      var lift = (1 - o) * 14;
      c.el.style.translate = "0 " + (p > c.to ? -lift : lift) + "px";
    });
    trackerItems.forEach(function (t) { t.el.classList.toggle("is-done", p >= t.at); });
    if (cue) cue.classList.toggle("is-hidden", p > 0.03);
  }

  /* ----------------------------------------------------------
     Engine: scroll → progress with inertial smoothing
     ---------------------------------------------------------- */
  var renderer = null;

  function useProcedural() {
    renderer = ProceduralRenderer();
    /* async fallbacks land after the engine has started; paint right away */
    notifyReady();
  }
  function useVideo() {
    renderer = VideoScrubRenderer(cfg.video || {}, function () {
      console.warn("[groundup] video failed to load — falling back to procedural build");
      useProcedural();
    });
    if (!renderer) useProcedural();
  }
  function useFrames() {
    renderer = FrameSequenceRenderer(cfg.frames || {}, function () {
      var loadingEl = document.getElementById("buildLoading");
      if (loadingEl) loadingEl.hidden = true;
      console.warn("[groundup] frame sequence unavailable — falling back");
      useVideo();
    });
    if (!renderer) useVideo();
  }

  if (cfg.mode === "frames") useFrames();
  else if (cfg.mode === "video") useVideo();
  else useProcedural();

  /* Reduced motion: show the finished house, skip the scrub. The hero
     chapter (the page's h1 + primary CTAs) stays visible instead of the
     scroll-position fades, which would hide it at p=1. */
  if (reduceMotion) {
    var park = function () {
      if (renderer) renderer.render(1);
      trackerItems.forEach(function (t) { t.el.classList.add("is-done"); });
      if (cue) cue.classList.add("is-hidden");
      chapters.forEach(function (c) {
        var isHero = c.from <= 0;
        c.el.style.opacity = isHero ? 1 : 0;
        c.el.style.visibility = isHero ? "visible" : "hidden";
        c.el.style.translate = "0 0";
      });
    };
    repaint = park;
    park();
    return;
  }

  var current = 0, target = 0, raf = null, idle = 0;

  function measure() {
    var rect = section.getBoundingClientRect();
    var span = section.offsetHeight - window.innerHeight;
    target = span > 0 ? clamp(-rect.top / span, 0, 1) : 1;
  }

  function frame() {
    /* inertial smoothing — the build eases toward the scroll position */
    current = lerp(current, target, 0.16);
    if (Math.abs(current - target) < 0.0005) { current = target; idle++; }
    else idle = 0;

    if (renderer) renderer.render(current);
    renderUI(current);

    if (idle > 30) { raf = null; return; }   /* sleep when settled */
    raf = requestAnimationFrame(frame);
  }

  function wake() {
    measure();
    idle = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", wake);
  /* first paint */
  current = target = 0;
  repaint = wake;
  wake();
})();
