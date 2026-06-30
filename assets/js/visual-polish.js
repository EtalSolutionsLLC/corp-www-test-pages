(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  root.classList.add("has-visual-polish");

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "Not exposed";
    if (bytes < 1024) return String(Math.round(bytes)) + " B";
    if (bytes < 1024 * 1024) return String(Math.round(bytes / 1024)) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function transferredSize(entry) {
    return Number(entry && entry.transferSize) || 0;
  }

  function updatePerformanceProof() {
    var proof = document.querySelector("[data-performance-proof]");
    if (!proof || !window.performance || typeof window.performance.getEntriesByType !== "function") return;

    var navigation = window.performance.getEntriesByType("navigation");
    var resources = window.performance.getEntriesByType("resource");
    var total = navigation.concat(resources).reduce(function (sum, entry) { return sum + transferredSize(entry); }, 0);
    var scripts = resources.filter(function (entry) { return entry.initiatorType === "script"; });
    var scriptTotal = scripts.reduce(function (sum, entry) { return sum + transferredSize(entry); }, 0);

    var transfer = proof.querySelector("[data-performance-transfer]");
    var javascript = proof.querySelector("[data-performance-js]");
    var resourceCount = proof.querySelector("[data-performance-resources]");

    if (transfer) transfer.textContent = formatBytes(total);
    if (javascript) javascript.textContent = formatBytes(scriptTotal);
    if (resourceCount) resourceCount.textContent = String(resources.length);
  }

  function updateHeader() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 16);
  }

  function enableReveal() {
    var elements = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    if (!elements.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      elements.forEach(function (element) { element.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    elements.forEach(function (element) { observer.observe(element); });
  }

  function enableKineticWord() {
    var word = document.querySelector("[data-kinetic-word]");
    if (!word || !window.setInterval || reduceMotion) return;

    var words = ["light", "clear", "responsive", "maintainable"];
    var index = 0;

    window.setInterval(function () {
      word.classList.add("is-changing");
      window.setTimeout(function () {
        index = (index + 1) % words.length;
        word.textContent = words[index];
        word.classList.remove("is-changing");
      }, 170);
    }, 2600);
  }

  function catalogPages(track) {
    return track ? Array.prototype.slice.call(track.querySelectorAll(":scope > [data-collection-page]")) : [];
  }

  function activeCatalogPageIndex(track, pages) {
    if (!track || !pages.length) return 0;
    var left = track.scrollLeft;
    var bestIndex = 0;
    var bestDistance = Infinity;

    pages.forEach(function (page, index) {
      var distance = Math.abs(page.offsetLeft - left);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  function enableCarouselKeyboardRefinement() {
    document.querySelectorAll("[data-collection-carousel]").forEach(function (carousel) {
      var track = carousel.querySelector("[data-collection-track]");
      if (!track || track.hasAttribute("data-keyboard-refined")) return;

      track.setAttribute("data-keyboard-refined", "");
      track.setAttribute("tabindex", "0");
      track.setAttribute("role", "region");
      track.setAttribute("aria-roledescription", "carousel");
      track.setAttribute("aria-label", "Catalog cards. Use left and right arrow keys to move between pages.");

      var status = document.createElement("p");
      status.className = "catalog-keyboard-status visually-hidden";
      status.setAttribute("aria-live", "polite");
      carousel.appendChild(status);

      track.addEventListener("keydown", function (event) {
        if (event.target !== track || (window.matchMedia && window.matchMedia("(max-width: 760px)").matches)) return;
        var pages = catalogPages(track);
        if (pages.length < 2) return;

        var current = activeCatalogPageIndex(track, pages);
        var target = current;
        if (event.key === "ArrowLeft") target = Math.max(0, current - 1);
        if (event.key === "ArrowRight") target = Math.min(pages.length - 1, current + 1);
        if (event.key === "Home") target = 0;
        if (event.key === "End") target = pages.length - 1;
        if (target === current && event.key !== "Home" && event.key !== "End") return;
        if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) === -1) return;

        event.preventDefault();
        track.scrollTo({ left: pages[target].offsetLeft, behavior: reduceMotion ? "auto" : "smooth" });
        status.textContent = "Catalog page " + String(target + 1) + " of " + String(pages.length);
      });
    });
  }

  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("load", function () {
    updateHeader();
    updatePerformanceProof();
    window.setTimeout(updatePerformanceProof, 700);
  });

  document.addEventListener("DOMContentLoaded", function () {
    enableCarouselKeyboardRefinement();
  });

  updateHeader();
  enableReveal();
  enableKineticWord();
}());
