/* Portmason Platform™ Systems Lab workspace adapter. */
(function () {
  "use strict";

  var api = window.PortmasonCollections;
  if (!api) throw new Error("Portmason Collections core must load before the Systems Lab adapter");

  var transformersUrl = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";
  var state = {
    root: null,
    configUrl: "config.generated.json",
    endpointConfigUrl: "api/endpoints.json",
    modelId: "Xenova/all-MiniLM-L6-v2",
    apiBasePromise: null,
    endpointConfigPromise: null,
    capabilitiesPromise: null,
    extractorPromise: null,
    initializedTools: Object.create(null)
  };

  function qs(selector, scope) { return (scope || state.root).querySelector(selector); }
  function setText(selector, value, scope) {
    var node = qs(selector, scope);
    if (node) node.textContent = value;
  }
  function pretty(value) { return JSON.stringify(value, null, 2); }
  function elapsed(start) { return Math.max(1, Math.round(performance.now() - start)) + " ms"; }

  function pickHostConfig(config) {
    var host = window.location.hostname || "";
    var withoutWww = host.replace(/^www\./, "");
    if (!config || typeof config !== "object") return {};
    if (config[host] && typeof config[host] === "object") return config[host];
    if (config[withoutWww] && typeof config[withoutWww] === "object") return config[withoutWww];
    return config;
  }

  function loadApiBase() {
    if (state.apiBasePromise) return state.apiBasePromise;
    state.apiBasePromise = Promise.resolve().then(function () {
      var existing = pickHostConfig(window.PORTMASON_CONFIG || {});
      if (existing.CAPABILITY_API_BASE_URL) {
        return String(existing.CAPABILITY_API_BASE_URL).replace(/\/$/, "");
      }
      return fetch(state.configUrl, { cache: "no-store" })
        .then(function (response) { return response.ok ? response.json() : {}; })
        .then(function (config) {
          var selected = pickHostConfig(config);
          return selected.CAPABILITY_API_BASE_URL
            ? String(selected.CAPABILITY_API_BASE_URL).replace(/\/$/, "")
            : "";
        })
        .catch(function () { return ""; });
    });
    return state.apiBasePromise;
  }

  function loadEndpointConfig() {
    if (state.endpointConfigPromise) return state.endpointConfigPromise;
    state.endpointConfigPromise = fetch(new URL(state.endpointConfigUrl, document.baseURI), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Endpoint contract returned HTTP " + response.status);
        return response.json();
      })
      .then(function (payload) {
        var endpoints = payload && Array.isArray(payload.endpoints) ? payload.endpoints : [];
        if (!endpoints.length) throw new Error("Endpoint contract contains no endpoints");
        endpoints.forEach(function (endpoint) {
          if (!endpoint || typeof endpoint.label !== "string" || typeof endpoint.route !== "string" || typeof endpoint.fallback !== "string") {
            throw new Error("Endpoint contract contains an invalid entry");
          }
        });
        return endpoints;
      });
    return state.endpointConfigPromise;
  }

  function populateEndpointSelect(panel) {
    var select = qs("[data-lab-api-endpoint]", panel);
    var button = qs("[data-lab-api-run]", panel);
    if (!select) return Promise.reject(new Error("Endpoint selector is unavailable"));
    return loadEndpointConfig().then(function (endpoints) {
      select.replaceChildren();
      endpoints.forEach(function (endpoint, index) {
        var option = document.createElement("option");
        option.value = endpoint.route;
        option.textContent = endpoint.label;
        option.setAttribute("data-fallback", endpoint.fallback);
        if (endpoint.default === true || index === 0) option.defaultSelected = true;
        select.appendChild(option);
      });
      select.disabled = false;
      if (button) button.disabled = false;
      setText("[data-lab-api-status]", "Ready", panel);
      return endpoints;
    }).catch(function (error) {
      select.innerHTML = '<option value="">Endpoint contract unavailable</option>';
      select.disabled = true;
      if (button) button.disabled = true;
      setText("[data-lab-api-status]", "Configuration unavailable", panel);
      setText("[data-lab-api-json]", pretty({ status: "unavailable", message: error.message }), panel);
      throw error;
    });
  }

  function runExternalStatus(panel) {
    var button = qs("[data-lab-status-refresh]", panel);
    var indicator = qs("[data-lab-status-indicator]", panel);
    var started = performance.now();
    if (button) button.disabled = true;
    if (indicator) {
      indicator.textContent = "Checking";
      indicator.classList.remove("is-error");
    }

    fetch("https://www.githubstatus.com/api/v2/status.json", { cache: "no-store", mode: "cors" })
      .then(function (response) {
        if (!response.ok) throw new Error("GitHub status returned HTTP " + response.status);
        return response.json();
      })
      .then(function (payload) {
        var source = payload && payload.page && payload.page.name || "GitHub";
        var status = payload && payload.status && payload.status.description || "Unknown";
        var normalized = {
          provider: source,
          service: "GitHub platform",
          status: status.toLowerCase(),
          checkedAt: new Date().toISOString(),
          source: "external-api",
          responseTimeMs: Math.max(1, Math.round(performance.now() - started))
        };
        setText("[data-lab-status-provider]", source, panel);
        setText("[data-lab-status-value]", status, panel);
        setText("[data-lab-status-time]", normalized.responseTimeMs + " ms", panel);
        setText("[data-lab-status-json]", pretty(normalized), panel);
        if (indicator) indicator.textContent = "Live";
      })
      .catch(function (error) {
        setText("[data-lab-status-value]", "Temporarily unavailable", panel);
        setText("[data-lab-status-time]", elapsed(started), panel);
        setText("[data-lab-status-json]", pretty({ status: "unavailable", message: error.message }), panel);
        if (indicator) {
          indicator.textContent = "Unavailable";
          indicator.classList.add("is-error");
        }
      })
      .finally(function () { if (button) button.disabled = false; });
  }

  function fallbackUrl(option) {
    return new URL(option.getAttribute("data-fallback"), document.baseURI).href;
  }

  function runPublishedRequest(panel, event) {
    if (event) event.preventDefault();
    var select = qs("[data-lab-api-endpoint]", panel);
    var button = qs("[data-lab-api-run]", panel);
    if (!select || !select.selectedOptions.length) return;
    var option = select.selectedOptions[0];
    var route = option.value;
    var started = performance.now();
    if (button) button.disabled = true;
    setText("[data-lab-api-status]", "Loading", panel);

    loadApiBase().then(function (base) {
      var url = base ? base + route : fallbackUrl(option);
      setText("[data-lab-api-mode]", base ? "Et al edge API" : "Pages contract", panel);
      return fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        setText("[data-lab-api-status]", String(response.status) + " " + response.statusText, panel);
        setText("[data-lab-api-time]", elapsed(started), panel);
        setText("[data-lab-api-json]", pretty(payload), panel);
        if (!response.ok) throw new Error("Request failed");
      });
    }).catch(function (error) {
      setText("[data-lab-api-status]", "Unavailable", panel);
      setText("[data-lab-api-time]", elapsed(started), panel);
      setText("[data-lab-api-json]", pretty({ status: "unavailable", message: error.message }), panel);
    }).finally(function () { if (button) button.disabled = false; });
  }

  function loadCapabilities() {
    if (!state.capabilitiesPromise) {
      state.capabilitiesPromise = fetch(new URL("api/v1/capabilities.json", document.baseURI), { cache: "no-store" })
        .then(function (response) {
          if (!response.ok) throw new Error("Capabilities contract unavailable");
          return response.json();
        })
        .then(function (payload) { return payload.capabilities || []; });
    }
    return state.capabilitiesPromise;
  }

  function loadExtractor(onProgress) {
    if (!state.extractorPromise) {
      state.extractorPromise = import(transformersUrl).then(function (module) {
        var options = { dtype: "q8", progress_callback: onProgress };
        if (navigator.gpu) {
          options.device = "webgpu";
          options.dtype = "fp16";
        }
        return module.pipeline("feature-extraction", state.modelId, options).catch(function () {
          return module.pipeline("feature-extraction", state.modelId, {
            dtype: "q8",
            progress_callback: onProgress
          });
        });
      });
    }
    return state.extractorPromise;
  }

  function vectorList(tensor) {
    var value = typeof tensor.tolist === "function" ? tensor.tolist() : tensor;
    return Array.isArray(value[0]) ? value : [value];
  }

  function keywordFallback(input, capabilities) {
    var words = String(input).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return capabilities.map(function (capability) {
      var haystack = [capability.title, capability.summary].concat(capability.signals || []).join(" ").toLowerCase();
      var score = words.reduce(function (total, word) {
        return total + (word.length > 3 && haystack.indexOf(word) >= 0 ? 1 : 0);
      }, 0);
      return { capability: capability, score: score / Math.max(1, words.length) };
    }).sort(function (a, b) { return b.score - a.score; })[0];
  }

  function showModelResult(match, panel, result, runtime) {
    if (!match || !match.capability) return;
    setText("[data-lab-model-title]", match.capability.title, panel);
    setText("[data-lab-model-summary]", match.capability.summary, panel);
    setText("[data-lab-model-score]", Math.max(0, Math.min(100, Math.round(match.score * 100))) + "%", panel);
    setText("[data-lab-model-runtime]", runtime, panel);
    if (result) result.hidden = false;
  }

  function runLocalModel(panel) {
    var input = qs("[data-lab-model-prompt]", panel);
    var button = qs("[data-lab-model-run]", panel);
    var result = qs("[data-lab-model-result]", panel);
    var text = input ? input.value.trim() : "";
    if (!text) {
      setText("[data-lab-model-status]", "Describe the problem first.", panel);
      return;
    }
    if (button) button.disabled = true;
    setText("[data-lab-model-status]", "Loading a quantized language model into this browser…", panel);

    var capabilities;
    loadCapabilities().then(function (items) {
      capabilities = items;
      return loadExtractor(function (progress) {
        if (progress && progress.status) {
          setText("[data-lab-model-status]", "Model: " + progress.status, panel);
        }
      });
    }).then(function (extractor) {
      var descriptions = capabilities.map(function (item) {
        return item.title + ". " + item.summary + ". " + (item.signals || []).join(", ");
      });
      return extractor([text].concat(descriptions), { pooling: "mean", normalize: true });
    }).then(function (tensor) {
      var vectors = vectorList(tensor);
      var query = vectors[0];
      var ranked = capabilities.map(function (capability, index) {
        var vector = vectors[index + 1];
        var score = query.reduce(function (total, value, i) { return total + value * vector[i]; }, 0);
        return { capability: capability, score: score };
      }).sort(function (a, b) { return b.score - a.score; });
      showModelResult(ranked[0], panel, result, navigator.gpu ? "WebGPU / browser" : "WASM / browser");
      setText("[data-lab-model-status]", "Complete. Your text was processed locally.", panel);
    }).catch(function (error) {
      loadCapabilities().then(function (items) {
        var fallback = keywordFallback(text, items);
        showModelResult(fallback, panel, result, "Local fallback");
        setText("[data-lab-model-status]", "The language model could not load; a local deterministic fallback was used.", panel);
      }).catch(function () {
        setText("[data-lab-model-status]", "The local model is temporarily unavailable.", panel);
      });
      console.warn("Portmason Systems Lab local model unavailable", error);
    }).finally(function () { if (button) button.disabled = false; });
  }

  function initPageSizeComparison(panel) {
    var root = qs("[data-site-size-compare]", panel);
    if (!root || root.getAttribute("data-portmason-initialized") === "true") return;
    root.setAttribute("data-portmason-initialized", "true");

    var endpoint = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";
    var medianDesktopBytes = 2.86 * 1024 * 1024;
    var standardBytesPerSecond = 125000000;
    var selfUrl = root.getAttribute("data-site-size-self-url") || "https://www.etal.solutions/";
    var configUrl = root.getAttribute("data-site-size-config-url") || "config.generated.json";
    var form = qs("[data-site-size-form]", root);
    var input = qs("[data-site-size-url]", root);
    var submit = qs("[data-site-size-submit]", root);
    var status = qs("[data-site-size-status]", root);
    var result = qs("[data-site-size-result]", root);
    var theirs = qs("[data-site-size-theirs]", root);
    var ours = qs("[data-site-size-ours]", root);
    var theirSpeed = qs("[data-site-speed-theirs]", root);
    var ourSpeed = qs("[data-site-speed-ours]", root);
    var summary = qs("[data-site-size-summary]", root);
    var speedSummary = qs("[data-site-speed-summary]", root);
    var context = qs("[data-site-size-context]", root);
    var apiKeyPromise = null;
    var defaultSubmitHtml = submit ? submit.innerHTML : 'Check both pages <span aria-hidden="true">→</span>';

    function text(element, value) { if (element) element.textContent = value; }
    function setBusy(isBusy) {
      if (!submit) return;
      submit.disabled = isBusy;
      submit.setAttribute("aria-busy", isBusy ? "true" : "false");
      submit.innerHTML = isBusy ? "Checking both pages…" : defaultSubmitHtml;
    }
    function normalizeUrl(raw) {
      var value = String(raw || "").trim();
      if (!value) throw new Error("Please enter your homepage address.");
      if (!/^https?:\/\//i.test(value)) value = "https://" + value;
      var parsed;
      try { parsed = new URL(value); }
      catch (error) { throw new Error("Please enter a valid public homepage address."); }
      if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname || parsed.hostname === "localhost" || parsed.hostname.endsWith(".local")) {
        throw new Error("Please enter a public http:// or https:// homepage address.");
      }
      return parsed.href;
    }
    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return "Not available";
      if (bytes < 1024) return String(Math.round(bytes)) + " B";
      if (bytes < 1024 * 1024) return String(Math.round(bytes / 1024)) + " KB";
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }
    function formatSeconds(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) return "Not available";
      var seconds = milliseconds / 1000;
      return (seconds < 10 ? seconds.toFixed(1) : seconds.toFixed(0)) + " s";
    }
    function formatMultiplier(value) {
      if (!Number.isFinite(value) || value <= 0) return "";
      if (value >= 10) return value.toFixed(0) + "×";
      return value.toFixed(1).replace(/\.0$/, "") + "×";
    }
    function describeComparedToOurs(theirBytes, ourBytes) {
      if (theirBytes === ourBytes) return "The two homepages downloaded about the same amount of data in this test.";
      if (theirBytes > ourBytes) return "Your homepage downloaded about " + formatMultiplier(theirBytes / ourBytes) + " more data than this homepage in the same PageSpeed desktop test.";
      return "Your homepage downloaded about " + formatMultiplier(ourBytes / theirBytes) + " less data than this homepage in the same PageSpeed desktop test.";
    }
    function describeVisualLoad(theirMeasurement, ourMeasurement) {
      var theirSeconds = theirMeasurement.bytes / standardBytesPerSecond;
      var ourSeconds = ourMeasurement.bytes / standardBytesPerSecond;

      var difference = Math.abs(theirSeconds - ourSeconds);

      var comparison = difference < 0.01
        ? "The two results were effectively the same."
        : (theirSeconds > ourSeconds
          ? "Your homepage would take about " + Math.round(difference*1000) + " milliseconds longer."
          : "Your homepage would be about " + Math.round(difference*1000) + " milliseconds faster.");

      return "Estimated download time: your homepage "
        + Math.round(theirSeconds*1000)
        + " ms; this homepage "
        + Math.round(ourSeconds*1000)
        + " ms.\n"
        + comparison;
    }
    function describeComparedToMedian(theirBytes) {
      if (Math.abs(theirBytes - medianDesktopBytes) < 0.05 * medianDesktopBytes) return "For context, that is close to the typical desktop homepage: about 2.86 MB.";
      if (theirBytes > medianDesktopBytes) return "For context, that is about " + formatMultiplier(theirBytes / medianDesktopBytes) + " the typical desktop homepage size of 2.86 MB.";
      return "For context, that is about " + formatMultiplier(medianDesktopBytes / theirBytes) + " lighter than the typical desktop homepage size of 2.86 MB.";
    }
    function extractApiKey(config) {
      var hostConfig = pickHostConfig(config);
      return String(hostConfig.PAGESPEED_APIKEY || hostConfig.pagespeedApiKey || "").trim();
    }
    function loadApiKey() {
      if (apiKeyPromise) return apiKeyPromise;
      apiKeyPromise = Promise.resolve().then(function () {
        var configured = extractApiKey(window.PORTMASON_CONFIG || {});
        if (configured) return configured;
        return fetch(configUrl, { cache: "no-store" }).then(function (response) {
          if (!response.ok) throw new Error("The PageSpeed comparison configuration could not be loaded.");
          return response.json();
        }).then(function (config) {
          var apiKey = extractApiKey(config);
          if (!apiKey) throw new Error("The PageSpeed comparison is not configured yet. pm-setup after adding PAGESPEED_APIKEY.");
          return apiKey;
        });
      });
      return apiKeyPromise;
    }
    function buildRequest(url, apiKey) {
      var query = new URLSearchParams({ url: url, strategy: "desktop", category: "performance", key: apiKey });
      return endpoint + "?" + query.toString();
    }
    function readApiMessage(payload) {
      return payload && payload.error && payload.error.message || payload && payload.lighthouseResult && payload.lighthouseResult.runtimeError && payload.lighthouseResult.runtimeError.message || "";
    }
    function extractAuditValue(payload, auditId, label, metricName) {
      var audits = payload && payload.lighthouseResult && payload.lighthouseResult.audits;
      var audit = audits && audits[auditId];
      var value = audit && Number(audit.numericValue);
      if (!Number.isFinite(value) || value < 0) throw new Error(label + " did not return a " + metricName + " measurement.");
      return value;
    }
    function extractPageSpeedMeasurement(payload, label) {
      var bytes = extractAuditValue(payload, "total-byte-weight", label, "page-size");
      if (bytes <= 0) throw new Error(label + " did not return a page-size measurement.");
      return {
        bytes: bytes,
        speedIndexMilliseconds: extractAuditValue(payload, "speed-index", label, "visual-load")
      };
    }
    function runPageSpeed(url, label, apiKey) {
      return fetch(buildRequest(url, apiKey), { method: "GET", mode: "cors" }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (payload) {
          if (!response.ok) throw new Error(label + " could not be checked. " + (readApiMessage(payload) || "Google PageSpeed returned an error."));
          var apiMessage = readApiMessage(payload);
          if (apiMessage) throw new Error(label + " could not be checked. " + apiMessage);
          return extractPageSpeedMeasurement(payload, label);
        });
      });
    }
    function showError(message) {
      text(status, message || "We could not complete the comparison. Please try again in a moment.");
      if (result) result.hidden = true;
    }
    function showResult(theirMeasurement, ourMeasurement) {
      text(theirs, formatBytes(theirMeasurement.bytes));
      text(ours, formatBytes(ourMeasurement.bytes));


      if (theirSpeed && theirSpeed.closest("small")) {
        theirSpeed.closest("small").style.display = "none";
      }

      if (ourSpeed && ourSpeed.closest("small")) {
        ourSpeed.closest("small").style.display = "none";
      }

/*      text(theirSpeed, formatSeconds(theirMeasurement.speedIndexMilliseconds));
      text(ourSpeed, formatSeconds(ourMeasurement.speedIndexMilliseconds)); */

      text(summary, describeComparedToOurs(theirMeasurement.bytes, ourMeasurement.bytes));
      text(context, describeComparedToMedian(theirMeasurement.bytes));
      text(speedSummary, describeVisualLoad(theirMeasurement, ourMeasurement));
      text(status, "Done. Both homepages were checked with the same desktop test.");
      if (result) result.hidden = false;
    }
    function submitComparison(event) {
      event.preventDefault();
      var theirUrl;
      try { theirUrl = normalizeUrl(input && input.value); }
      catch (error) { showError(error.message); return; }
      if (input) input.value = theirUrl;
      setBusy(true);
      text(status, "Checking both homepages with Google PageSpeed. This may take a few moments.");
      if (result) result.hidden = true;
      loadApiKey().then(function (apiKey) {
        return Promise.allSettled([
          runPageSpeed(theirUrl, "Your homepage", apiKey),
          runPageSpeed(selfUrl, "This homepage", apiKey)
        ]);
      }).then(function (measurements) {
        if (measurements[0].status === "rejected") throw measurements[0].reason;
        if (measurements[1].status === "rejected") throw measurements[1].reason;
        showResult(measurements[0].value, measurements[1].value);
      }).catch(function (error) {
        showError(error && error.message ? error.message : "The independent comparison is temporarily unavailable.");
      }).finally(function () { setBusy(false); });
    }
    if (form) form.addEventListener("submit", submitComparison);
  }

  function wireExternalSignal(panel) {
    var button = qs("[data-lab-status-refresh]", panel);
    if (button) button.addEventListener("click", function () { runExternalStatus(panel); });
    runExternalStatus(panel);
  }

  function wirePublishedInterface(panel) {
    var form = qs("[data-lab-api-form]", panel);
    if (form) form.addEventListener("submit", function (event) { runPublishedRequest(panel, event); });
    populateEndpointSelect(panel).then(function () {
      runPublishedRequest(panel);
    }).catch(function (error) {
      console.warn("Portmason Systems Lab endpoint contract unavailable", error);
    });
  }

  function wireLocalModel(panel) {
    var button = qs("[data-lab-model-run]", panel);
    if (button) button.addEventListener("click", function () { runLocalModel(panel); });
  }

  api.registerInstance("systems-lab", {
    initialize: function (root) {
      state.root = root;
      state.configUrl = root.getAttribute("data-api-config-url") || "config.generated.json";
      state.endpointConfigUrl = root.getAttribute("data-api-endpoints-url") || "api/endpoints.json";
      state.modelId = root.getAttribute("data-model-id") || "Xenova/all-MiniLM-L6-v2";
    },
    activate: function (slug, panel) {
      if (state.initializedTools[slug]) return;
      state.initializedTools[slug] = true;
      if (slug === "external-signal") wireExternalSignal(panel);
      else if (slug === "published-interface") wirePublishedInterface(panel);
      else if (slug === "local-capability-match") wireLocalModel(panel);
      else if (slug === "page-weight-evidence") initPageSizeComparison(panel);
    }
  });
}());
