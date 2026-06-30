/* Portmason Collections™: workspace profile. */
(function () {
  "use strict";

  var api = window.PortmasonCollections;
  if (!api) throw new Error("Portmason Collections core must load before the workspace profile");

  function focusableElements(container) {
    if (!container) return [];
    return Array.prototype.slice.call(container.querySelectorAll([
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ].join(","))).filter(function (element) {
      return !element.hidden
        && !element.closest("[hidden]")
        && element.getAttribute("aria-hidden") !== "true";
    });
  }

  function setText(root, selector, value) {
    var element = root.querySelector(selector);
    if (element) element.textContent = value || "";
  }

  function renderList(container, values) {
    if (!container) return;
    container.replaceChildren();
    (values || []).forEach(function (value) {
      var item = document.createElement("li");
      item.textContent = String(value || "");
      container.appendChild(item);
    });
  }

  function queryValue(parameterName) {
    try {
      return new URL(window.location.href).searchParams.get(parameterName) || "";
    } catch (error) {
      return "";
    }
  }

  function updateQuery(parameterName, value) {
    if (!window.history || typeof window.history.replaceState !== "function") return;
    var url = new URL(window.location.href);
    if (value) url.searchParams.set(parameterName, value);
    else url.searchParams.delete(parameterName);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }

  function initializeWorkspace(root, runtimeContext) {
    var modal = root.querySelector("[data-workspace-modal]");
    var closeButton = root.querySelector("[data-workspace-close]");
    var title = root.querySelector("[data-workspace-title]");
    var summary = root.querySelector("[data-workspace-summary]");
    var demonstrates = root.querySelector("[data-workspace-demonstrates]");
    var proof = root.querySelector("[data-workspace-proof]");
    var instructions = root.querySelector("[data-workspace-instructions]");
    var inputs = root.querySelector("[data-workspace-inputs]");
    var outputs = root.querySelector("[data-workspace-outputs]");
    var panels = Array.prototype.slice.call(root.querySelectorAll("[data-workspace-panel]"));
    var queryParameter = root.getAttribute("data-workspace-query-parameter") || "workspace";
    var adapter = runtimeContext.getInstance();
    var opener = null;
    var activeItem = null;
    var contextPromise = runtimeContext.load();

    if (!modal || !closeButton || !title || !summary || !demonstrates || !proof || !panels.length) {
      throw new Error("Portmason Collections: workspace shell is incomplete for " + runtimeContext.id);
    }

    if (adapter && typeof adapter.initialize === "function") {
      adapter.initialize(root, runtimeContext);
    }

    function itemBySlug(slug) {
      return contextPromise.then(function (context) {
        var item = context.items.find(function (candidate) {
          return String(candidate.slug || candidate.id || "") === String(slug || "");
        }) || null;
        return { context: context, item: item };
      });
    }

    function platformLayerNames(context, item) {
      var presentation = context && context.manifest && context.manifest.presentation;
      var platformModel = presentation && presentation.platformModel;
      var layers = platformModel && Array.isArray(platformModel.layers) ? platformModel.layers : [];
      var lookup = Object.create(null);
      layers.forEach(function (layer) {
        lookup[String(layer.id || "")] = String(layer.name || layer.label || layer.id || "");
      });
      return (item.demonstrates || []).map(function (layerId) {
        return lookup[String(layerId)] || String(layerId || "");
      }).filter(Boolean);
    }

    function panelBySlug(slug) {
      return panels.find(function (panel) {
        return panel.getAttribute("data-workspace-panel") === String(slug || "");
      }) || null;
    }

    function showModal() {
      if (typeof modal.showModal === "function") modal.showModal();
      else modal.setAttribute("open", "");
    }

    function hideModal() {
      if (typeof modal.close === "function" && modal.open) modal.close();
      else modal.removeAttribute("open");
    }

    function selectPanel(slug) {
      var selected = null;
      panels.forEach(function (panel) {
        var isSelected = panel.getAttribute("data-workspace-panel") === slug;
        panel.hidden = !isSelected;
        panel.setAttribute("aria-hidden", isSelected ? "false" : "true");
        if (isSelected) selected = panel;
      });
      return selected;
    }

    function populateGuide(item, context) {
      var layerNames = platformLayerNames(context, item);
      setText(root, "[data-workspace-demonstrates]", "Demonstrates " + (layerNames.join(" + ") || "Portmason Platform™"));
      setText(root, "[data-workspace-title]", item.title || item.shortTitle || item.slug);
      setText(root, "[data-workspace-summary]", item.detailSummary || item.summary || "");
      setText(root, "[data-workspace-proof]", item.proof || "");
      renderList(instructions, item.instructions || []);
      renderList(inputs, item.inputs || []);
      renderList(outputs, item.outputs || []);
    }

    function openItem(slug, trigger, shouldUpdateQuery) {
      return itemBySlug(slug).then(function (selection) {
        var context = selection.context;
        var item = selection.item;
        var panel = panelBySlug(slug);
        if (!item || !panel) throw new Error("Workspace item not found: " + slug);

        opener = trigger || document.activeElement;
        activeItem = item;
        populateGuide(item, context);
        selectPanel(slug);
        showModal();
        document.documentElement.classList.add("workspace-modal-open");
        if (shouldUpdateQuery !== false) updateQuery(queryParameter, slug);

        if (adapter && typeof adapter.activate === "function") {
          adapter.activate(slug, panel, item, runtimeContext);
        }

        window.requestAnimationFrame(function () {
          var focusables = focusableElements(panel);
          (focusables[0] || closeButton).focus({ preventScroll: true });
        });
      });
    }

    function closeItem(shouldRestoreFocus) {
      var priorItem = activeItem;
      var priorPanel = priorItem ? panelBySlug(priorItem.slug || priorItem.id) : null;
      if (adapter && typeof adapter.deactivate === "function" && priorItem) {
        adapter.deactivate(String(priorItem.slug || priorItem.id), priorPanel, priorItem, runtimeContext);
      }
      activeItem = null;
      hideModal();
      document.documentElement.classList.remove("workspace-modal-open");
      updateQuery(queryParameter, "");
      panels.forEach(function (panel) {
        panel.hidden = true;
        panel.setAttribute("aria-hidden", "true");
      });
      if (shouldRestoreFocus !== false && opener && typeof opener.focus === "function") {
        opener.focus({ preventScroll: true });
      }
      opener = null;
    }

    root.addEventListener("click", function (event) {
      var trigger = event.target.closest ? event.target.closest("[data-workspace-open]") : null;
      if (!trigger || !root.contains(trigger)) return;
      event.preventDefault();
      openItem(trigger.getAttribute("data-workspace-open"), trigger, true).catch(function (error) {
        console.error(error);
      });
    });

    closeButton.addEventListener("click", function () { closeItem(true); });

    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeItem(true);
    });

    modal.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeItem(true);
    });

    modal.addEventListener("close", function () {
      document.documentElement.classList.remove("workspace-modal-open");
    });

    modal.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") return;
      var focusables = focusableElements(modal);
      if (!focusables.length) {
        event.preventDefault();
        closeButton.focus();
        return;
      }
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    var requested = queryValue(queryParameter);
    if (requested) {
      openItem(requested, null, false).catch(function () {
        updateQuery(queryParameter, "");
      });
    }
  }

  api.registerProfile("workspace", { initialize: initializeWorkspace });
}());
