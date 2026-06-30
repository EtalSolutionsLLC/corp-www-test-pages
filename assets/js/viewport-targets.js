(() => {
  "use strict";

  const root = document.documentElement;
  const watchedSelectors = [".site-header", ".site-footer"];
  const alignmentDelays = [0, 32, 96, 220, 420];
  let frame = 0;
  let pendingHashAlignment = false;

  function px(value) {
    return `${Math.max(0, Math.ceil(value || 0))}px`;
  }

  function cssNumber(name, fallback) {
    const value = Number.parseFloat(getComputedStyle(root).getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function measuredHeight(selector, fallbackVariable) {
    const element = document.querySelector(selector);
    if (!element) {
      return cssNumber(fallbackVariable, 0);
    }

    const height = element.getBoundingClientRect().height;
    if (height > 0) {
      return height;
    }

    return cssNumber(fallbackVariable, 0);
  }

  function viewportHeight() {
    if (window.visualViewport && window.visualViewport.height) {
      return window.visualViewport.height;
    }

    return window.innerHeight || root.clientHeight || 0;
  }

  function hashTargetFromHash(hash) {
    if (!hash || hash === "#") {
      return null;
    }

    try {
      const id = decodeURIComponent(hash.slice(1));
      return id ? document.getElementById(id) : null;
    } catch (_error) {
      return null;
    }
  }

  function hashTarget() {
    return hashTargetFromHash(window.location.hash);
  }

  function updateMeasurements() {
    frame = 0;

    const headerHeight = measuredHeight(".site-header", "--header-h");
    const footerHeight = measuredHeight(".site-footer", "--footer-h");
    const visiblePanelHeight = Math.max(0, viewportHeight() - headerHeight - footerHeight);

    root.style.setProperty("--pm-header-height", px(headerHeight));
    root.style.setProperty("--pm-footer-height", px(footerHeight));
    root.style.setProperty("--pm-visible-panel-height", px(visiblePanelHeight));

    // Keep existing site CSS variables honest for older rules that still refer to them.
    root.style.setProperty("--header-h", px(headerHeight));
    root.style.setProperty("--footer-h", px(footerHeight));

    if (pendingHashAlignment) {
      pendingHashAlignment = false;
      window.setTimeout(alignCurrentHashTarget, 0);
    }
  }

  function requestMeasurement() {
    if (frame) {
      return;
    }

    frame = window.requestAnimationFrame(updateMeasurements);
  }

  function alignmentSubject(target) {
    if (!target || !target.querySelector) {
      return target;
    }

    return target.querySelector(":scope > .pm-viewport-target__inner") || target;
  }

  function visibleSlotBounds() {
    const liveViewportHeight = viewportHeight();
    const header = document.querySelector(".site-header");
    const footer = document.querySelector(".site-footer");
    const headerRect = header ? header.getBoundingClientRect() : null;
    const footerRect = footer ? footer.getBoundingClientRect() : null;
    const fallbackHeaderHeight = measuredHeight(".site-header", "--header-h");
    const fallbackFooterHeight = measuredHeight(".site-footer", "--footer-h");
    const top = Math.max(0, headerRect ? headerRect.bottom : fallbackHeaderHeight);
    const footerTop = footerRect ? footerRect.top : liveViewportHeight - fallbackFooterHeight;
    const bottom = Math.max(top, Math.min(liveViewportHeight, footerTop));

    return {
      top,
      bottom,
      height: Math.max(0, bottom - top),
      center: top + (Math.max(0, bottom - top) / 2),
    };
  }

  function alignmentMode(target) {
    return target && target.getAttribute
      ? (target.getAttribute("data-pm-viewport-align") || "auto")
      : "auto";
  }

  function alignmentTopForTarget(target) {
    // Recalculate from live viewport coordinates immediately before every pass.
    // Applying the current delta to pageYOffset is self-correcting when fonts,
    // fixed chrome, or generated collection content settle after native hash navigation.
    updateMeasurements();

    const slot = visibleSlotBounds();
    const targetRect = target.getBoundingClientRect();
    const subject = alignmentSubject(target);
    const subjectRect = subject.getBoundingClientRect();
    const mustStartAlign = alignmentMode(target) === "start";
    let delta = targetRect.top - slot.top;

    if (!mustStartAlign && slot.height > 0 && subjectRect.height > 0 && subjectRect.height <= slot.height) {
      const subjectCenter = subjectRect.top + (subjectRect.height / 2);
      delta = subjectCenter - slot.center;
    }

    return window.pageYOffset + delta;
  }

  function alignCurrentHashTarget() {
    const target = hashTarget();
    if (!target) {
      return;
    }

    const top = alignmentTopForTarget(target);
    window.scrollTo({ top: Math.max(0, Math.round(top)), left: window.pageXOffset, behavior: "auto" });
  }

  function runAlignmentPasses() {
    alignmentDelays.forEach((delay) => {
      window.setTimeout(() => {
        requestMeasurement();
        window.requestAnimationFrame(alignCurrentHashTarget);
      }, delay);
    });
  }

  function requestHashAlignment() {
    updatePrimaryNavigation();
    pendingHashAlignment = true;
    requestMeasurement();
    runAlignmentPasses();
  }

  function normalizedPath(pathname) {
    let normalized = pathname || "/";
    normalized = normalized.replace(/\/index\.html$/i, "/");
    normalized = normalized.replace(/\/+/g, "/");
    return normalized || "/";
  }


  function hashIdFromAnchor(anchor) {
    let url;
    try {
      url = new URL(anchor.getAttribute("href") || "", window.location.href);
    } catch (_error) {
      return "";
    }

    if (url.origin !== window.location.origin) {
      return "";
    }

    if (normalizedPath(url.pathname) !== normalizedPath(window.location.pathname)) {
      return "";
    }

    return url.hash ? decodeURIComponent(url.hash.slice(1)) : "";
  }

  function primaryTargetIdFromHash(hash) {
    const target = hashTargetFromHash(hash || "#home") || document.getElementById("home");
    if (!target || !target.closest) {
      return "home";
    }

    const primaryTarget = target.closest(".pm-scroll-target[id], .pm-viewport-target[id], section[id]");
    return primaryTarget && primaryTarget.id ? primaryTarget.id : (target.id || "home");
  }

  function updatePrimaryNavigation() {
    const activeId = primaryTargetIdFromHash(window.location.hash);
    const links = document.querySelectorAll(".site-header .nav a[href]");
    let hasActiveLink = false;

    links.forEach((link) => {
      const linkId = hashIdFromAnchor(link);
      const isActive = linkId === activeId;
      link.classList.toggle("is-current", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
        hasActiveLink = true;
      } else {
        link.removeAttribute("aria-current");
      }
    });

    document.body.classList.toggle("has-js-active-nav", hasActiveLink);
  }

  function sameDocumentHashLink(anchor) {
    const rawHref = anchor.getAttribute("href");
    if (!rawHref || rawHref.indexOf("#") === -1) {
      return null;
    }

    let url;
    try {
      url = new URL(rawHref, window.location.href);
    } catch (_error) {
      return null;
    }

    if (!url.hash || url.hash === "#") {
      return null;
    }

    if (url.origin !== window.location.origin) {
      return null;
    }

    if (normalizedPath(url.pathname) !== normalizedPath(window.location.pathname)) {
      return null;
    }

    const target = hashTargetFromHash(url.hash);
    if (!target) {
      return null;
    }

    return { url, target };
  }

  function enableControlledHashLinks() {
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) {
        return;
      }

      const link = sameDocumentHashLink(anchor);
      if (!link) {
        return;
      }

      event.preventDefault();

      const nextPath = normalizedPath(link.url.pathname);
      const currentPath = normalizedPath(window.location.pathname);
      const nextUrl = `${nextPath}${link.url.search}${link.url.hash}`;

      if (link.url.hash !== window.location.hash || nextPath !== currentPath || link.url.search !== window.location.search) {
        window.history.pushState(null, "", nextUrl);
      }

      requestHashAlignment();
    });
  }

  function requestChromeMeasurement() {
    pendingHashAlignment = Boolean(hashTarget());
    requestMeasurement();
  }

  function observeChrome() {
    if (!("ResizeObserver" in window)) {
      return;
    }

    const observer = new ResizeObserver(requestChromeMeasurement);
    watchedSelectors.forEach((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        observer.observe(element);
      }
    });
  }

  window.addEventListener("resize", requestMeasurement, { passive: true });
  window.addEventListener("orientationchange", requestHashAlignment, { passive: true });
  window.addEventListener("hashchange", requestHashAlignment);
  window.addEventListener("popstate", requestHashAlignment);
  window.addEventListener("load", requestHashAlignment, { once: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", requestMeasurement, { passive: true });
    window.visualViewport.addEventListener("scroll", requestMeasurement, { passive: true });
  }

  enableControlledHashLinks();
  observeChrome();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(requestHashAlignment).catch(() => {});
  }

  requestHashAlignment();
})();
