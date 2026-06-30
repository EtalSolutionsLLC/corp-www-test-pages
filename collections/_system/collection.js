/* Portmason Collections™: shared browser runtime and profile registry. */
(function (global) {
  "use strict";

  var profiles = Object.create(null);
  var instances = Object.create(null);
  var contextPromises = new Map();

  function requireName(value, label) {
    var name = String(value || "").trim();
    if (!name) throw new Error("Portmason Collections: " + label + " is required");
    return name;
  }

  function registerProfile(mode, profile) {
    var name = requireName(mode, "profile mode");
    if (!profile || typeof profile.initialize !== "function") {
      throw new Error("Portmason Collections: profile " + name + " must expose initialize(root, context)");
    }
    if (profiles[name]) {
      throw new Error("Portmason Collections: profile already registered: " + name);
    }
    profiles[name] = profile;
    return profile;
  }

  function registerInstance(collectionId, adapter) {
    var id = requireName(collectionId, "collection id");
    if (!adapter || typeof adapter !== "object") {
      throw new Error("Portmason Collections: instance adapter must be an object: " + id);
    }
    if (instances[id]) {
      throw new Error("Portmason Collections: instance adapter already registered: " + id);
    }
    instances[id] = adapter;
    return adapter;
  }

  function getInstance(collectionId) {
    return instances[String(collectionId || "")] || null;
  }

  function fetchJson(url, label) {
    if (typeof global.fetch !== "function") {
      return Promise.reject(new Error("Portmason Collections: fetch is unavailable"));
    }
    return global.fetch(url, { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Portmason Collections: " + label + " returned HTTP " + response.status);
      }
      return response.json();
    });
  }

  function loadCollectionContext(root) {
    var configSource = root.getAttribute("data-collection-config");
    if (!configSource) {
      return Promise.reject(new Error("Portmason Collections: data-collection-config is missing"));
    }

    var manifestUrl = new URL(configSource, global.location.href);
    var cacheKey = manifestUrl.href;
    if (contextPromises.has(cacheKey)) return contextPromises.get(cacheKey);

    var promise = fetchJson(manifestUrl, "manifest")
      .then(function (manifest) {
        if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
          throw new Error("Portmason Collections: manifest must be an object");
        }
        var itemsUrl = new URL(requireName(manifest.dataFile, "manifest dataFile"), manifestUrl);
        return fetchJson(itemsUrl, "items").then(function (items) {
          if (!Array.isArray(items)) {
            throw new Error("Portmason Collections: items must be an array");
          }
          return {
            root: root,
            id: String(manifest.id || root.getAttribute("data-collection-id") || ""),
            mode: String(manifest.mode || root.getAttribute("data-collection-mode") || ""),
            manifest: manifest,
            items: items,
            manifestUrl: manifestUrl,
            baseUrl: new URL(".", manifestUrl)
          };
        });
      });

    contextPromises.set(cacheKey, promise);
    return promise;
  }

  function buildRuntimeContext(root, collectionId, mode) {
    return {
      root: root,
      id: collectionId,
      mode: mode,
      load: function () { return loadCollectionContext(root); },
      getInstance: function () { return getInstance(collectionId); },
      api: api
    };
  }

  function initCollection(root) {
    if (!root || !root.getAttribute) return Promise.resolve(null);
    if (root.getAttribute("data-collection-runtime") === "initialized") {
      return Promise.resolve(root);
    }
    if (root.getAttribute("data-collection-runtime") === "initializing" && root.__portmasonCollectionPromise) {
      return root.__portmasonCollectionPromise;
    }

    var collectionId = requireName(root.getAttribute("data-collection-id"), "data-collection-id");
    var mode = requireName(root.getAttribute("data-collection-mode"), "data-collection-mode");
    var profile = profiles[mode];
    if (!profile) {
      return Promise.reject(new Error("Portmason Collections: no profile registered for mode: " + mode));
    }

    root.setAttribute("data-collection-runtime", "initializing");
    var runtimeContext = buildRuntimeContext(root, collectionId, mode);
    var promise = Promise.resolve(profile.initialize(root, runtimeContext))
      .then(function () {
        root.setAttribute("data-collection-runtime", "initialized");
        root.dispatchEvent(new CustomEvent("portmason:collection-ready", {
          bubbles: true,
          detail: { id: collectionId, mode: mode }
        }));
        return root;
      })
      .catch(function (error) {
        root.setAttribute("data-collection-runtime", "failed");
        root.dispatchEvent(new CustomEvent("portmason:collection-error", {
          bubbles: true,
          detail: { id: collectionId, mode: mode, error: error }
        }));
        throw error;
      });

    root.__portmasonCollectionPromise = promise;
    return promise;
  }

  function initAll(scope) {
    var container = scope && scope.querySelectorAll ? scope : document;
    var roots = [];
    if (container.matches && container.matches("[data-collection]")) roots.push(container);
    roots = roots.concat(Array.prototype.slice.call(container.querySelectorAll("[data-collection]")));
    return Promise.allSettled(roots.map(initCollection));
  }

  var api = {
    registerProfile: registerProfile,
    registerInstance: registerInstance,
    getInstance: getInstance,
    loadCollectionContext: loadCollectionContext,
    initCollection: initCollection,
    initAll: initAll,
    profiles: profiles
  };

  global.PortmasonCollections = api;

  document.addEventListener("DOMContentLoaded", function () {
    initAll(document).then(function (results) {
      results.forEach(function (result) {
        if (result.status === "rejected") {
          console.error(result.reason);
        }
      });
    });
  });
}(window));
