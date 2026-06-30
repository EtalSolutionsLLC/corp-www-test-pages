/* Portmason Collections™: catalog profile. */
(function () {
  "use strict";

  var api = window.PortmasonCollections;
  if (!api) throw new Error("Portmason Collections core must load before the catalog profile");
  var initialized = false;

  function htmlEscape(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }


  function normalizeModalCloseControl(control) {
    if (!control || !control.classList) return;
    control.classList.add("modal-close-circle");
    if (control.matches("[data-collection-overview-close]")) {
      control.setAttribute("aria-label", "Close overview");
    } else if (control.matches("[data-collection-detail-close]")) {
      control.setAttribute("aria-label", "Close details");
    }
    control.textContent = "×";
  }

  function normalizeCatalogModalCloseControls(scope) {
    var root = scope && scope.querySelectorAll ? scope : document;
    if (root.matches && root.matches("[data-collection-detail-close], [data-collection-overview-close]")) {
      normalizeModalCloseControl(root);
    }
    root.querySelectorAll("[data-collection-detail-close], [data-collection-overview-close]").forEach(normalizeModalCloseControl);
  }

  function catalogItems(carousel) {
    return Array.prototype.slice.call(carousel.querySelectorAll("[data-collection-item]"));
  }

  function itemSlug(item) {
    return item ? item.getAttribute("data-collection-slug") || "" : "";
  }

  function itemTitle(item) {
    if (!item) return "";
    var titleElement = item.querySelector("h2, h3");
    return item.getAttribute("data-collection-title") || (titleElement ? titleElement.textContent : "");
  }

  var CATALOG_PAGE_SIZE = 3;

  function catalogPages(carousel) {
    if (!carousel) return [];
    var track = carousel.querySelector("[data-collection-track]");
    if (!track) return [];
    return Array.prototype.slice.call(track.querySelectorAll(":scope > [data-collection-page]"));
  }

  function ensureCatalogPages(carousel) {
    if (!carousel) return [];
    var track = carousel.querySelector("[data-collection-track]");
    if (!track) return [];

    var existingPages = catalogPages(carousel);
    if (existingPages.length) return existingPages;

    var items = Array.prototype.slice.call(track.querySelectorAll(":scope > [data-collection-item]"));
    if (!items.length) return [];

    var page = null;
    items.forEach(function (item, index) {
      if (index % CATALOG_PAGE_SIZE === 0) {
        page = document.createElement("div");
        page.className = "catalog-carousel-page";
        page.setAttribute("data-collection-page", String(Math.floor(index / CATALOG_PAGE_SIZE)));
        page.setAttribute("aria-label", "Catalog page " + String(Math.floor(index / CATALOG_PAGE_SIZE) + 1));
        track.appendChild(page);
      }

      var slot = document.createElement("div");
      slot.className = "catalog-carousel-slot";
      page.appendChild(slot);
      slot.appendChild(item);
    });

    var pages = catalogPages(carousel);
    if (pages.length) {
      var finalPage = pages[pages.length - 1];
      while (finalPage.children.length < CATALOG_PAGE_SIZE) {
        var emptySlot = document.createElement("div");
        emptySlot.className = "catalog-carousel-slot is-empty";
        emptySlot.setAttribute("aria-hidden", "true");
        finalPage.appendChild(emptySlot);
      }
    }

    return pages;
  }

  function pageForItem(item) {
    return item ? item.closest("[data-collection-page]") : null;
  }

  function activePageIndexForTrack(track, pages) {
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

  function pageDirectionLabel(carousel, direction) {
    var section = catalogSectionForCarousel(carousel);
    if (section && section.id === "promotions") {
      return direction === "newer" ? "Newer promotions" : "Older promotions";
    }
    if (section && section.id === "brands") {
      return direction === "newer" ? "Previous brands" : "Next brands";
    }
    return direction === "newer" ? "Previous page" : "Next page";
  }

  function pageControlHtml(carousel, pageIndex, direction) {
    var label = pageDirectionLabel(carousel, direction);
    if (direction === "newer") {
      return '<button class="catalog-direction-link catalog-direction-button" type="button" data-collection-page-target="' + String(pageIndex) + '"><span>←</span> ' + htmlEscape(label) + '</button>';
    }
    return '<button class="catalog-direction-link catalog-direction-button" type="button" data-collection-page-target="' + String(pageIndex) + '">' + htmlEscape(label) + ' <span>→</span></button>';
  }

  function scrollTrackToPage(carousel, pageIndex, instant) {
    if (!carousel) return;
    var track = carousel.querySelector("[data-collection-track]");
    var pages = ensureCatalogPages(carousel);
    if (!track || !pages.length) return;

    var safeIndex = Math.max(0, Math.min(Number(pageIndex) || 0, pages.length - 1));
    track.scrollTo({ left: pages[safeIndex].offsetLeft, behavior: instant ? "auto" : "smooth" });
    window.setTimeout(function () {
      syncCarouselControlPosition(carousel);
      updateCarouselNav(carousel);
      updateCatalogDots(carousel);
    }, instant ? 0 : 180);

    if (!instant) {
      window.setTimeout(function () {
        updateCarouselNav(carousel);
        updateCatalogDots(carousel);
      }, 760);
    }
  }

  function findCatalogItemBySlug(slug) {
    if (!slug) return null;
    return document.querySelector('[data-collection-item][data-collection-slug="' + cssEscape(slug) + '"]');
  }

  function findOverviewPanelById(id) {
    if (!id) return null;
    return document.querySelector('[data-collection-overview-panel="' + cssEscape(id) + '"]');
  }

  function linkHtml(label, item, direction) {
    var href = "#" + itemSlug(item);
    var title = itemTitle(item);
    var slug = itemSlug(item);

    if (direction === "newer") {
      return '<a class="catalog-direction-link" data-collection-target="' + htmlEscape(slug) + '" href="' + htmlEscape(href) + '"><span>←</span> ' + htmlEscape(label) + ': <strong>' + htmlEscape(title) + '</strong></a>';
    }

    return '<a class="catalog-direction-link" data-collection-target="' + htmlEscape(slug) + '" href="' + htmlEscape(href) + '">' + htmlEscape(label) + ': <strong>' + htmlEscape(title) + '</strong> <span>→</span></a>';
  }

  function panelLinkHtml(label, item, panelType, direction) {
    var slug = itemSlug(item);
    var href = "#" + slug;

    if (direction === "newer") {
      return '<a class="catalog-direction-link" data-collection-target="' + htmlEscape(slug) + '" data-collection-panel-target="' + htmlEscape(panelType) + '" href="' + htmlEscape(href) + '"><span>←</span> ' + htmlEscape(label) + '</a>';
    }

    return '<a class="catalog-direction-link" data-collection-target="' + htmlEscape(slug) + '" data-collection-panel-target="' + htmlEscape(panelType) + '" href="' + htmlEscape(href) + '">' + htmlEscape(label) + ' <span>→</span></a>';
  }

  function elementLeftWithinTrack(element, track) {
    if (!element || !track) return 0;
    var elementRect = element.getBoundingClientRect();
    var trackRect = track.getBoundingClientRect();
    return elementRect.left - trackRect.left + track.scrollLeft;
  }

  function scrollTrackToPanel(item, panelType, instant) {
    if (!item) return;

    var carousel = carouselForItem(item);
    var track = carousel ? carousel.querySelector("[data-collection-track]") : null;
    var panel = item.querySelector(panelType === "detail" ? ".catalog-panel-detail" : ".catalog-panel-summary");
    if (!track || !panel) return;

    var left = elementLeftWithinTrack(panel, track) - Math.max(0, (track.clientWidth - panel.offsetWidth) / 2);
    track.scrollTo({ left: left, behavior: instant ? "auto" : "smooth" });
    updateCarouselNav(carousel);
  }

  function hasSplitPanels(item) {
    return !!(item && item.querySelector(".catalog-panel-summary") && item.querySelector(".catalog-panel-detail"));
  }

  function activePanelStateForTrack(track, items) {
    if (!track || !items.length) return null;

    var trackCenter = track.scrollLeft + (track.clientWidth / 2);
    var best = null;
    var bestDistance = Infinity;

    items.forEach(function (item, index) {
      ["summary", "detail"].forEach(function (panelType) {
        var panel = item.querySelector(panelType === "detail" ? ".catalog-panel-detail" : ".catalog-panel-summary");
        if (!panel) return;

        var panelLeft = elementLeftWithinTrack(panel, track);
        var panelCenter = panelLeft + (panel.offsetWidth / 2);
        var distance = Math.abs(panelCenter - trackCenter);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { item: item, index: index, panelType: panelType };
        }
      });
    });

    return best;
  }

  function usesMobilePanelHints(carousel, items) {
    if (!carousel || !items.length || !hasSplitPanels(items[0])) return false;
    if (!window.matchMedia || !window.matchMedia("(max-width: 760px)").matches) return false;
    var section = catalogSectionForCarousel(carousel);
    return !!(section && section.id === "promotions");
  }

  function activeIndexForTrack(track, items) {
    if (!track || !items.length) return 0;

    var left = track.scrollLeft;
    var bestIndex = 0;
    var bestDistance = Infinity;

    items.forEach(function (item, index) {
      var distance = Math.abs(item.offsetLeft - left);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  function ensureCarouselControl(carousel, direction) {
    if (!carousel) return null;
    var selector = '[data-collection-arrow="' + direction + '"]';
    var control = carousel.querySelector(selector);
    if (control) return control;

    control = document.createElement("button");
    control.type = "button";
    control.className = "catalog-carousel-control catalog-carousel-control-" + direction;
    control.setAttribute("data-collection-arrow", direction);
    control.setAttribute("aria-label", direction === "previous" ? "Previous catalog page" : "Next catalog page");
    control.innerHTML = direction === "previous"
      ? '<svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M15 6l-6 6 6 6"></path></svg>'
      : '<svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M9 6l6 6-6 6"></path></svg>';

    var track = carousel.querySelector("[data-collection-track]");
    if (track) {
      track.insertAdjacentElement("beforebegin", control);
    } else {
      carousel.appendChild(control);
    }

    return control;
  }

  function updateCarouselControl(control, pageIndex, enabled, label) {
    if (!control) return;
    control.hidden = !enabled;
    control.disabled = !enabled;
    control.setAttribute("aria-hidden", enabled ? "false" : "true");

    if (!enabled) {
      control.removeAttribute("data-collection-page-target");
      return;
    }

    control.setAttribute("data-collection-page-target", String(pageIndex));
    control.setAttribute("aria-label", label);
  }


  function syncCarouselControlPosition(carousel) {
    if (!carousel) return;
    var track = carousel.querySelector("[data-collection-track]");
    if (!track) return;

    var carouselRect = carousel.getBoundingClientRect();
    var trackRect = track.getBoundingClientRect();
    var midpoint = (trackRect.top - carouselRect.top) + (trackRect.height / 2);

    if (Number.isFinite(midpoint) && midpoint > 0) {
      carousel.style.setProperty("--carousel-control-top", midpoint.toFixed(2) + "px");
    }
  }

  function updateCarouselNav(carousel) {
    if (!carousel) return;

    var nav = carousel.querySelector("[data-collection-nav]");
    var track = carousel.querySelector("[data-collection-track]");
    var newerSlot = carousel.querySelector("[data-collection-newer-slot]");
    var previousSlot = carousel.querySelector("[data-collection-previous-slot]");
    var hint = carousel.querySelector(".catalog-scroll-hint");
    var pages = ensureCatalogPages(carousel);
    var previousControl = ensureCarouselControl(carousel, "previous");
    var nextControl = ensureCarouselControl(carousel, "next");

    if (!nav || !track || !pages.length) return;

    syncCarouselControlPosition(carousel);

    var endLabel = nav.getAttribute("data-end-label") || "End of catalog";
    var pageIndex = activePageIndexForTrack(track, pages);
    var newerLabel = pageDirectionLabel(carousel, "newer");
    var previousLabel = pageDirectionLabel(carousel, "previous");

    if (newerSlot) {
      newerSlot.innerHTML = pageIndex > 0
        ? pageControlHtml(carousel, pageIndex - 1, "newer")
        : '<span class="catalog-direction-empty"></span>';
    }

    if (previousSlot) {
      previousSlot.innerHTML = pageIndex < pages.length - 1
        ? pageControlHtml(carousel, pageIndex + 1, "previous")
        : '<span class="catalog-direction-empty">' + htmlEscape(endLabel) + '</span>';
    }

    updateCarouselControl(
      previousControl,
      pageIndex - 1,
      pageIndex > 0,
      newerLabel + ": page " + String(pageIndex) + " of " + String(pages.length)
    );

    updateCarouselControl(
      nextControl,
      pageIndex + 1,
      pageIndex < pages.length - 1,
      previousLabel + ": page " + String(pageIndex + 2) + " of " + String(pages.length)
    );

    if (hint) {
      hint.textContent = "Page " + String(pageIndex + 1) + " of " + String(pages.length);
    }
  }

  function carouselForItem(item) {
    return item ? item.closest("[data-collection-carousel]") : null;
  }

  function catalogSectionForCarousel(carousel) {
    return carousel ? carousel.closest(".panel[id], section[id]") : null;
  }

  function catalogSectionForItem(item) {
    return catalogSectionForCarousel(carouselForItem(item));
  }

  function catalogSectionForOverview(panel) {
    return panel ? panel.closest(".panel[id], section[id]") : null;
  }

  function itemLeftWithinTrack(item, track) {
    if (!item || !track) return 0;
    var itemRect = item.getBoundingClientRect();
    var trackRect = track.getBoundingClientRect();
    return itemRect.left - trackRect.left + track.scrollLeft;
  }

  function scrollTrackToItem(item, instant) {
    if (!item) return;

    var carousel = carouselForItem(item);
    var page = pageForItem(item);
    var pages = ensureCatalogPages(carousel);
    var pageIndex = page ? pages.indexOf(page) : 0;
    scrollTrackToPage(carousel, pageIndex, instant);

    item.classList.add("is-targeted");
    window.setTimeout(function () {
      item.classList.remove("is-targeted");
    }, 1200);
  }

  function repeatHorizontalAlignment(item, instant) {
    if (!item) return;
    scrollTrackToItem(item, instant);
    window.requestAnimationFrame(function () {
      scrollTrackToItem(item, true);
      window.setTimeout(function () { scrollTrackToItem(item, true); }, 120);
      window.setTimeout(function () { scrollTrackToItem(item, true); }, 320);
    });
  }

  function defaultItemForCarousel(carousel) {
    if (!carousel) return null;
    var defaultSlug = carousel.getAttribute("data-collection-default") || "";
    if (defaultSlug) {
      var defaultItem = carousel.querySelector('[data-collection-item][data-collection-slug="' + cssEscape(defaultSlug) + '"]');
      if (defaultItem) return defaultItem;
    }
    return carousel.querySelector("[data-collection-item]");
  }

  function defaultItemForSectionId(sectionId) {
    if (!sectionId) return null;
    var section = document.getElementById(sectionId);
    var carousel = section ? section.querySelector("[data-collection-carousel]") : null;
    return defaultItemForCarousel(carousel);
  }

  function catalogTargetForHash(hash) {
    var slug = hash ? hash.replace(/^#/, "") : "";
    if (!slug) return null;

    var item = findCatalogItemBySlug(slug);
    if (item) {
      return { item: item, section: catalogSectionForItem(item), isSectionDefault: false };
    }

    item = defaultItemForSectionId(slug);
    if (item) {
      return { item: item, section: document.getElementById(slug), isSectionDefault: true };
    }

    return null;
  }

  function closeOverviewPanels() {
    document.querySelectorAll("[data-collection-overview-panel]").forEach(function (panel) {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
    });
    if (typeof syncCatalogModalBackdrop === "function") syncCatalogModalBackdrop();
  }

  function openOverviewPanel(panel, instant, updateHash) {
    if (!panel) return;

    closeOverviewPanels();
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    if (typeof syncCatalogModalBackdrop === "function") syncCatalogModalBackdrop();

    var id = panel.getAttribute("data-collection-overview-panel") || "";
    if (updateHash && id) {
      updateHashWithoutJump("#" + id);
    }

    normalizeCatalogModalCloseControls(panel);
    var closeButton = panel.querySelector("[data-collection-overview-close]");
    if (closeButton) {
      window.setTimeout(function () { closeButton.focus({ preventScroll: true }); }, 50);
    }
  }

  function closeOverviewAndReturn(panel) {
    var section = catalogSectionForOverview(panel);
    closeOverviewPanels();

    if (section && section.id) {
      var defaultItem = defaultItemForSectionId(section.id);
      if (defaultItem) {
        activateCatalogTarget({ item: defaultItem, section: section, isSectionDefault: true }, false);
      }
      updateHashWithoutJump("#" + section.id);
    }
  }

  function isMobileViewport() {
    return !!(window.matchMedia && window.matchMedia("(max-width: 760px)").matches);
  }

  function activateCatalogTarget(target, instant) {
    if (!target || !target.item) return;

    closeOverviewPanels();
    repeatHorizontalAlignment(target.item, instant);
  }

  function updateSelectedNavOption(slug) {
    document.querySelectorAll(".nav-dropdown-menu a").forEach(function (link) {
      var target = link.getAttribute("data-collection-target") || samePageHashFromLink(link);
      var isSelected = !!(slug && target && target === slug);
      link.classList.toggle("is-selected", isSelected);
      if (isSelected) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function updateHashWithoutJump(hash, selectedSlug, state) {
    if (!hash || hash === "#") return;
    var selection = selectedSlug || hash.replace(/^#/, "");
    updateSelectedNavOption(selection);
    if (window.history && window.history.pushState) {
      window.history.pushState(state || null, "", hash);
      return;
    }
    window.location.hash = hash;
  }

  function replaceHashWithoutJump(hash, selectedSlug, state) {
    if (!hash || hash === "#") return;
    var selection = selectedSlug || hash.replace(/^#/, "");
    updateSelectedNavOption(selection);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(state || null, "", hash);
      return;
    }
    window.location.hash = hash;
  }

  function handleHash(instant) {
    closeAllNavDropdowns(null);
    var hashSlug = window.location.hash ? window.location.hash.slice(1) : "";
    var slug = hashSlug;
    updateSelectedNavOption(slug);
    if (!slug) return;

    var overviewPanel = findOverviewPanelById(slug);
    if (overviewPanel) {
      openOverviewPanel(overviewPanel, instant, false);
      return;
    }

    var target = catalogTargetForHash(slug);
    if (!target) {
      closeOverviewPanels();
      return;
    }

    activateCatalogTarget(target, instant);

  }

  function hashFromHref(href) {
    if (!href) return "";
    var hashIndex = href.indexOf("#");
    if (hashIndex < 0) return "";
    return href.slice(hashIndex + 1);
  }

  function samePageHashFromLink(link) {
    var raw = link.getAttribute("href") || "";
    if (!raw || raw === "#") return "";

    try {
      var url = new URL(raw, window.location.href);
      if (url.origin !== window.location.origin) return "";
      var currentPath = window.location.pathname.replace(/\/index\.html$/, "/");
      var linkPath = url.pathname.replace(/\/index\.html$/, "/");
      if (currentPath !== linkPath) return "";
      return url.hash ? url.hash.slice(1) : "";
    } catch (error) {
      return raw.charAt(0) === "#" ? raw.slice(1) : hashFromHref(raw);
    }
  }


  function setNavDropdownOpen(dropdown, isOpen) {
    if (!dropdown) return;

    var menu = dropdown.querySelector(".nav-dropdown-menu");
    var trigger = dropdown.querySelector(".nav-dropdown-trigger");

    dropdown.classList.toggle("is-open", !!isOpen);
    dropdown.classList.remove("is-closing");

    if (menu) {
      if (isOpen) {
        menu.hidden = false;
        menu.setAttribute("aria-hidden", "false");
      } else {
        menu.hidden = true;
        menu.setAttribute("aria-hidden", "true");
      }
    }

    if (trigger) {
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (!isOpen && typeof trigger.blur === "function") {
        trigger.blur();
      }
    }
  }

  function closeNavDropdown(dropdown) {
    if (!dropdown) return;

    var focusedElement = dropdown.querySelector(":focus");
    if (focusedElement && typeof focusedElement.blur === "function") {
      focusedElement.blur();
    }

    setNavDropdownOpen(dropdown, false);
  }

  function closeAllNavDropdowns(exceptDropdown) {
    document.querySelectorAll(".nav-dropdown").forEach(function (dropdown) {
      if (dropdown !== exceptDropdown) {
        closeNavDropdown(dropdown);
      }
    });
  }

  function openNavDropdown(dropdown) {
    if (!dropdown) return;
    closeAllNavDropdowns(dropdown);
    setNavDropdownOpen(dropdown, true);
  }

  function toggleNavDropdown(dropdown) {
    if (!dropdown) return;
    if (dropdown.classList.contains("is-open")) {
      closeNavDropdown(dropdown);
      return;
    }
    openNavDropdown(dropdown);
  }

  function wireNavDropdowns() {
    document.querySelectorAll(".nav-dropdown").forEach(function (dropdown) {
      setNavDropdownOpen(dropdown, false);
    });

    document.addEventListener("click", function (event) {
      var trigger = event.target.closest ? event.target.closest(".nav-dropdown-trigger") : null;
      if (trigger) {
        var triggerDropdown = trigger.closest(".nav-dropdown");
        if (triggerDropdown) {
          event.preventDefault();
          toggleNavDropdown(triggerDropdown);
          return;
        }
      }

      var menuLink = event.target.closest ? event.target.closest(".nav-dropdown-menu a") : null;
      if (menuLink) {
        closeAllNavDropdowns(null);
        return;
      }

      if (!event.target.closest || !event.target.closest(".nav-dropdown")) {
        closeAllNavDropdowns(null);
      }
    }, true);

    document.addEventListener("pointerdown", function (event) {
      if (!event.target.closest || !event.target.closest(".nav-dropdown")) {
        closeAllNavDropdowns(null);
      }
    }, true);

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      closeAllNavDropdowns(null);
    });

    window.addEventListener("scroll", function () {
      closeAllNavDropdowns(null);
    }, { passive: true, capture: true });
  }

  var catalogModalBackdrop = null;
  var openCatalogDetailPanel = null;

  function ensureCatalogModalBackdrop() {
    if (catalogModalBackdrop) return catalogModalBackdrop;
    catalogModalBackdrop = document.querySelector("[data-collection-modal-backdrop]");
    if (!catalogModalBackdrop) {
      catalogModalBackdrop = document.createElement("div");
      catalogModalBackdrop.className = "catalog-modal-backdrop";
      catalogModalBackdrop.setAttribute("data-collection-modal-backdrop", "");
      catalogModalBackdrop.hidden = true;
      document.body.appendChild(catalogModalBackdrop);
    }
    return catalogModalBackdrop;
  }

  function syncCatalogModalBackdrop() {
    var overviewOpen = !!document.querySelector("[data-collection-overview-panel]:not([hidden])");
    var detailOpen = !!document.querySelector("[data-collection-detail-panel]:not([hidden])");
    var isOpen = overviewOpen || detailOpen;
    var backdrop = ensureCatalogModalBackdrop();
    backdrop.hidden = !isOpen;
    document.body.classList.toggle("has-catalog-modal-open", isOpen);
  }

  function closeCatalogDetailPanels() {
    document.querySelectorAll("[data-collection-detail-panel]").forEach(function (panel) {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
      panel.classList.remove("is-open");
      panel.style.removeProperty("--catalog-modal-left");
      panel.style.removeProperty("--catalog-modal-top");
    });
    openCatalogDetailPanel = null;
    syncCatalogModalBackdrop();
  }

  function positionCatalogDetailPanel(panel) {
    if (!panel || panel.hidden) return;
    var carousel = panel._catalogCarousel || panel.closest("[data-collection-carousel]");
    var rect = carousel ? carousel.getBoundingClientRect() : document.documentElement.getBoundingClientRect();
    var modalWidth = Math.min(panel.offsetWidth || 620, Math.max(280, window.innerWidth - 32));
    var minCenter = 16 + (modalWidth / 2);
    var maxCenter = window.innerWidth - 16 - (modalWidth / 2);
    var desiredCenter = rect.left + (rect.width / 2);
    var center = Math.max(minCenter, Math.min(maxCenter, desiredCenter));
    panel.style.setProperty("--catalog-modal-left", center + "px");
    panel.style.setProperty("--catalog-modal-top", Math.max(88, window.innerHeight / 2) + "px");
  }

  function openCatalogDetail(panelId, opener) {
    var panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;
    closeCatalogDetailPanels();
    closeOverviewPanels();
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    panel.classList.add("is-open");
    openCatalogDetailPanel = panel;
    positionCatalogDetailPanel(panel);
    syncCatalogModalBackdrop();
    var closeButton = panel.querySelector("[data-collection-detail-close]");
    if (closeButton) {
      window.setTimeout(function () { closeButton.focus({ preventScroll: true }); }, 25);
    }
    if (opener) panel._catalogReturnFocus = opener;
  }

  function closeCatalogDetailAndReturn(panel) {
    var returnFocus = panel && panel._catalogReturnFocus;
    closeCatalogDetailPanels();
    if (returnFocus && typeof returnFocus.focus === "function") {
      window.setTimeout(function () { returnFocus.focus({ preventScroll: true }); }, 25);
    }
  }

  function prepareCatalogDetailModals() {
    document.querySelectorAll("[data-collection-carousel] [data-collection-item]").forEach(function (item) {
      var summary = item.querySelector(".catalog-panel-summary");
      var detail = item.querySelector(".catalog-panel-detail");
      if (!summary || !detail || !detail.id) return;

      detail.classList.add("catalog-detail-modal");
      var sourceSection = catalogSectionForItem(item);
      detail.classList.toggle("brand-catalog-detail-modal", !!(sourceSection && sourceSection.id === "brands"));
      detail.setAttribute("data-collection-detail-panel", "");
      detail.setAttribute("role", "dialog");
      detail.setAttribute("aria-modal", "true");
      detail.setAttribute("aria-hidden", "true");
      detail.hidden = true;

      // Modal panels must live at the document root. Keeping a panel inside a
      // card allows ancestor stacking contexts to place it underneath the
      // shared backdrop, which made Brand details appear empty even though the
      // content was present. Preserve the originating carousel for positioning.
      detail._catalogCarousel = item.closest("[data-collection-carousel]");
      if (detail.parentElement !== document.body) {
        document.body.appendChild(detail);
      }

      if (!detail.querySelector("[data-collection-detail-close]")) {
        var closeButton = document.createElement("button");
        closeButton.className = "catalog-detail-close modal-close-circle";
        closeButton.type = "button";
        closeButton.setAttribute("data-collection-detail-close", "");
        closeButton.setAttribute("aria-label", "Close details");
        closeButton.textContent = "×";
        detail.insertBefore(closeButton, detail.firstChild);
      }
      normalizeCatalogModalCloseControls(detail);

      if (!summary.querySelector("[data-collection-detail-open]")) {
        var openButton = document.createElement("button");
        openButton.className = "catalog-details-toggle";
        openButton.type = "button";
        openButton.setAttribute("data-collection-detail-open", detail.id);
        openButton.setAttribute("aria-controls", detail.id);
        openButton.textContent = "View details →";
        summary.appendChild(openButton);
      }
    });
  }

  function catalogNeedsNavigation(carousel) {
    if (!carousel) return false;
    return ensureCatalogPages(carousel).length > 1;
  }

  function syncCatalogNavigationVisibility(carousel) {
    if (!carousel) return false;
    var needsNavigation = catalogNeedsNavigation(carousel);
    var nav = carousel.querySelector("[data-collection-nav]");
    var dots = carousel.querySelector("[data-collection-dots]");
    carousel.classList.toggle("is-static-catalog", !needsNavigation);
    if (nav) nav.hidden = !needsNavigation;
    if (dots) dots.hidden = !needsNavigation;
    return needsNavigation;
  }

  function ensureCatalogDots(carousel) {
    if (!carousel) return null;
    var track = carousel.querySelector("[data-collection-track]");
    var pages = ensureCatalogPages(carousel);
    if (!track || !pages.length) return null;

    var dots = carousel.querySelector("[data-collection-dots]");
    if (!dots) {
      dots = document.createElement("div");
      dots.className = "catalog-position-dots";
      dots.setAttribute("data-collection-dots", "");
      dots.setAttribute("aria-label", "Catalog pages");
      track.insertAdjacentElement("afterend", dots);
    }

    if (dots.children.length !== pages.length) {
      dots.innerHTML = "";
      pages.forEach(function (page, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "catalog-position-dot";
        button.setAttribute("data-collection-dot-index", String(index));
        button.setAttribute("aria-label", "Show catalog page " + String(index + 1));
        dots.appendChild(button);
      });
    }

    var nav = carousel.querySelector("[data-collection-nav]");
    if (nav && dots.parentElement === carousel && nav.nextElementSibling !== dots) {
      dots.insertAdjacentElement("beforebegin", nav);
    }

    syncCatalogNavigationVisibility(carousel);
    return dots;
  }

  function updateCatalogDots(carousel) {
    if (!carousel) return;
    var track = carousel.querySelector("[data-collection-track]");
    var pages = ensureCatalogPages(carousel);
    var dots = ensureCatalogDots(carousel);
    if (!track || !pages.length || !dots) return;
    if (!syncCatalogNavigationVisibility(carousel)) return;

    var pageIndex = activePageIndexForTrack(track, pages);
    pages.forEach(function (page, index) {
      page.classList.toggle("is-selected", index === pageIndex);
    });
    Array.prototype.slice.call(dots.children).forEach(function (dot, index) {
      var active = index === pageIndex;
      dot.classList.toggle("is-selected", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  function wireCatalogDots() {
    document.querySelectorAll("[data-collection-carousel]").forEach(function (carousel) {
      ensureCatalogPages(carousel);
      ensureCatalogDots(carousel);
      updateCatalogDots(carousel);
    });

    document.addEventListener("click", function (event) {
      var dot = event.target.closest ? event.target.closest("[data-collection-dot-index]") : null;
      if (!dot) return;
      var carousel = dot.closest("[data-collection-carousel]");
      var index = Number(dot.getAttribute("data-collection-dot-index"));
      if (!Number.isInteger(index)) return;
      event.preventDefault();
      scrollTrackToPage(carousel, index, false);
    });
  }

  function usesModalDetailHints(carousel, items) {
    if (!carousel || !items.length || !isMobileViewport()) return false;
    var section = catalogSectionForCarousel(carousel);
    return !!(section && section.id === "promotions" && items[0].querySelector("[data-collection-detail-panel]"));
  }

  function wireCatalogLinks() {
    document.addEventListener("click", function (event) {
      var pageControl = event.target.closest ? event.target.closest("[data-collection-page-target]") : null;
      if (pageControl) {
        var pageCarousel = pageControl.closest("[data-collection-carousel]");
        var pageIndex = Number(pageControl.getAttribute("data-collection-page-target"));
        if (pageCarousel && Number.isInteger(pageIndex)) {
          event.preventDefault();
          scrollTrackToPage(pageCarousel, pageIndex, false);
        }
        return;
      }

      var detailOpen = event.target.closest ? event.target.closest("[data-collection-detail-open]") : null;
      if (detailOpen) {
        event.preventDefault();
        openCatalogDetail(detailOpen.getAttribute("data-collection-detail-open") || "", detailOpen);
        return;
      }

      var link = event.target.closest ? event.target.closest("a[href]") : null;
      if (!link) return;

      var overviewId = link.getAttribute("data-collection-overview-open") || "";
      if (overviewId) {
        var overviewPanel = findOverviewPanelById(overviewId);
        if (overviewPanel) {
          event.preventDefault();
          openOverviewPanel(overviewPanel, false, true);
        }
        return;
      }

      var explicitTarget = link.getAttribute("data-collection-target") || "";
      var panelTarget = link.getAttribute("data-collection-panel-target") || "";
      var hrefHash = samePageHashFromLink(link);
      var slug = explicitTarget || hrefHash;
      if (!slug) return;

      var target = catalogTargetForHash(slug);

      if (panelTarget && target && target.item) {
        event.preventDefault();
        closeOverviewPanels();
        scrollTrackToPanel(target.item, panelTarget, false);
        updateHashWithoutJump("#" + slug);
        return;
      }

      if (explicitTarget && !target) {
        if (!hrefHash) return;
        event.preventDefault();
        link.setAttribute("aria-disabled", "true");
        return;
      }

      if (target && target.item) {
        // Section-level catalog links use the browser's native hash navigation,
        // exactly like Home, Services, About, and Contact. The catalog script
        // owns horizontal carousel state only.
        if (target.isSectionDefault && !explicitTarget) return;

        event.preventDefault();
        var hashToSet = explicitTarget || hrefHash;
        activateCatalogTarget(target, false);
        updateHashWithoutJump("#" + hashToSet);
      }
    }, true);

    document.addEventListener("click", function (event) {
      var detailClose = event.target.closest ? event.target.closest("[data-collection-detail-close]") : null;
      if (!detailClose) return;
      event.preventDefault();
      closeCatalogDetailAndReturn(detailClose.closest("[data-collection-detail-panel]"));
    }, true);

    document.addEventListener("click", function (event) {
      if (!event.target.matches || !event.target.matches("[data-collection-modal-backdrop]")) return;
      event.preventDefault();
      closeCatalogDetailPanels();
      closeOverviewPanels();
    }, true);

    document.addEventListener("click", function (event) {
      var closeButton = event.target.closest ? event.target.closest("[data-collection-overview-close]") : null;
      if (!closeButton) return;
      event.preventDefault();
      closeOverviewAndReturn(closeButton.closest("[data-collection-overview-panel]"));
    }, true);

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var detailPanel = document.querySelector("[data-collection-detail-panel]:not([hidden])");
      if (detailPanel) {
        event.preventDefault();
        closeCatalogDetailAndReturn(detailPanel);
        return;
      }
      var openPanel = document.querySelector("[data-collection-overview-panel]:not([hidden])");
      if (openPanel) {
        event.preventDefault();
        closeOverviewAndReturn(openPanel);
      }
    });
  }

  function wireCarousels() {
    document.querySelectorAll("[data-collection-carousel]").forEach(function (carousel) {
      ensureCatalogPages(carousel);
      var track = carousel.querySelector("[data-collection-track]");
      var updateTimer = null;
      if (!track) return;

      track.addEventListener("scroll", function () {
        if (updateTimer) window.clearTimeout(updateTimer);
        updateTimer = window.setTimeout(function () {
          syncCarouselControlPosition(carousel);
          updateCarouselNav(carousel);
          updateCatalogDots(carousel);
        }, 80);
      }, { passive: true });

      syncCarouselControlPosition(carousel);
      updateCarouselNav(carousel);
      updateCatalogDots(carousel);
      window.requestAnimationFrame(function () {
        syncCatalogNavigationVisibility(carousel);
      });
    });
  }

  function initializeCatalogProfile() {
    if (initialized) return;
    initialized = true;
    ensureCatalogModalBackdrop();
    normalizeCatalogModalCloseControls(document);
    document.querySelectorAll("[data-collection-carousel]").forEach(function (carousel) {
      ensureCatalogPages(carousel);
    });
    prepareCatalogDetailModals();
    wireCatalogDots();
    wireCarousels();
    wireNavDropdowns();
    wireCatalogLinks();
    handleHash(true);
    window.addEventListener("hashchange", function () {
      handleHash(false);
    });
    window.addEventListener("popstate", function () {
      handleHash(false);
    });
    window.addEventListener("resize", function () {
      if (openCatalogDetailPanel) positionCatalogDetailPanel(openCatalogDetailPanel);
      document.querySelectorAll("[data-collection-carousel]").forEach(function (carousel) {
        syncCarouselControlPosition(carousel);
        updateCarouselNav(carousel);
        updateCatalogDots(carousel);
        syncCatalogNavigationVisibility(carousel);
      });
    }, { passive: true });
  }

  api.registerProfile("catalog", { initialize: initializeCatalogProfile });
}());
