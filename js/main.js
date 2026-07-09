/* =============================================================
   GROUNDUP — page behaviors
   nav state · mobile menu · reveals · counters · testimonials
   · config-driven text
   ============================================================= */
(function () {
  "use strict";

  /* ---- config-driven text (brand name, phone, email, address) ---- */
  var cfg = window.SITE_CONFIG || {};
  document.querySelectorAll("[data-config-text]").forEach(function (el) {
    var key = el.getAttribute("data-config-text");
    if (cfg[key]) el.textContent = cfg[key];
  });
  if (cfg.brandName) {
    document.title = document.title.replace(/^[^—|]+/, cfg.brandName + " ");
  }
  var tel = document.querySelector('a[href^="tel:"]');
  var mail = document.querySelector('a[href^="mailto:"]');
  if (tel && cfg.phone) tel.href = "tel:" + cfg.phone.replace(/[^+\d]/g, "");
  if (mail && cfg.email) mail.href = "mailto:" + cfg.email;

  /* ---- nav scrolled state ---- */
  var nav = document.getElementById("nav");
  function navState() { nav.classList.toggle("is-scrolled", window.scrollY > 24); }
  window.addEventListener("scroll", navState, { passive: true });
  navState();

  /* ---- mobile menu ---- */
  var burger = document.getElementById("navBurger");
  var links = document.getElementById("navLinks");
  if (burger && links) {
    burger.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---- reveal on scroll ---- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- animated counters ---- */
  var counters = document.querySelectorAll("[data-count]");
  function runCounter(el) {
    var end = parseFloat(el.dataset.count);
    var decimals = parseInt(el.dataset.decimals || "0", 10);
    var suffix = el.dataset.suffix || "";
    var t0 = null, DUR = 1400;
    function step(ts) {
      if (!t0) t0 = ts;
      var t = Math.min((ts - t0) / DUR, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (end * eased).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { runCounter(en.target); cio.unobserve(en.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(runCounter);
  }

  /* ---- testimonial rotator ---- */
  var quotesWrap = document.getElementById("quotes");
  if (quotesWrap) {
    var quotes = quotesWrap.querySelectorAll(".quote");
    var dots = quotesWrap.querySelectorAll(".quotes__dot");
    var active = 0, timer = null;
    function show(i) {
      active = (i + quotes.length) % quotes.length;
      quotes.forEach(function (q, j) { q.classList.toggle("is-active", j === active); });
      dots.forEach(function (d, j) { d.classList.toggle("is-active", j === active); });
    }
    function auto() { timer = setInterval(function () { show(active + 1); }, 6500); }
    dots.forEach(function (d, i) {
      d.addEventListener("click", function () {
        clearInterval(timer);
        show(i);
        auto();
      });
    });
    auto();
  }

  /* ---- footer year ---- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
