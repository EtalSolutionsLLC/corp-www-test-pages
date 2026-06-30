(function () {
  "use strict";

  var trigger = document.querySelector("[data-site-build-open]");
  var modal = document.querySelector("[data-site-build-modal]");

  if (!trigger || !modal || typeof modal.showModal !== "function") {
    return;
  }

  var closeButton = modal.querySelector("[data-site-build-close]");
  var fields = {
    releaseVersion: modal.querySelector("[data-site-release-version]"),
    buildVersion: modal.querySelector("[data-site-build-version]"),
    sourceCommit: modal.querySelector("[data-site-build-commit]"),
    builtAt: modal.querySelector("[data-site-build-time]"),
    artifactSha256: modal.querySelector("[data-site-artifact-sha]"),
    environment: modal.querySelector("[data-site-deploy-environment]"),
    deploymentId: modal.querySelector("[data-site-deployment-id]"),
    deployedAt: modal.querySelector("[data-site-deployed-time]"),
    verification: modal.querySelector("[data-site-deployment-verification]")
  };
  var warning = modal.querySelector("[data-site-build-warning]");
  var loaded = false;

  function text(field, value) {
    if (fields[field]) {
      fields[field].textContent = value || "Unavailable";
    }
  }

  function metaValue(name, fallback) {
    var meta = document.querySelector('meta[name="' + name + '"]');
    return meta ? meta.getAttribute("content") : fallback;
  }

  function endpoint(name, fallback) {
    return metaValue(name, fallback);
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Metadata was not available: " + url);
      }
      return response.json();
    });
  }

  function buildDisplay(info) {
    if (!info) {
      return metaValue("etal-site-build", "Unavailable");
    }
    return info.buildId || info.buildNumber || metaValue("etal-site-build", "Unavailable");
  }

  function verify(build, deployment) {
    var comparable = [
      "releaseVersion",
      "buildNumber",
      "buildId",
      "sourceCommit",
      "artifactSha256"
    ];
    var mismatches = comparable.filter(function (field) {
      return !build || !deployment || build[field] !== deployment[field];
    });

    if (mismatches.length === 0) {
      text("verification", "Verified");
      if (warning) {
        warning.hidden = true;
        warning.textContent = "";
      }
      return;
    }

    text("verification", "Mismatch");
    if (warning) {
      warning.hidden = false;
      warning.textContent = "Build and deployment metadata disagree: " + mismatches.join(", ") + ".";
    }
  }

  function applyBuild(info) {
    text("releaseVersion", info && info.releaseVersion || metaValue("etal-site-release", "Unavailable"));
    text("buildVersion", buildDisplay(info));
    text("sourceCommit", info && info.sourceCommit);
    text("builtAt", info && info.builtAt);
    text("artifactSha256", info && info.artifactSha256);
  }

  function applyDeployment(info) {
    text("environment", info && info.environment || window.location.hostname || "Unavailable");
    text("deploymentId", info && info.deploymentId);
    text("deployedAt", info && info.deployedAt);
  }

  function loadBuildInfo() {
    if (loaded) {
      return Promise.resolve();
    }

    var buildEndpoint = endpoint("etal-site-build-info", "/build-info.json");
    var deployEndpoint = endpoint("etal-site-deploy-info", "/deploy-info.json");

    return Promise.allSettled([
      fetchJson(buildEndpoint),
      fetchJson(deployEndpoint)
    ]).then(function (results) {
      var build = results[0].status === "fulfilled" ? results[0].value : null;
      var deployment = results[1].status === "fulfilled" ? results[1].value : null;

      applyBuild(build);
      applyDeployment(deployment);

      if (build && deployment) {
        verify(build, deployment);
      } else {
        text("verification", "Metadata incomplete");
        if (warning) {
          warning.hidden = false;
          warning.textContent = "The served build or deployment record could not be loaded.";
        }
      }
      loaded = true;
    });
  }

  trigger.addEventListener("click", function () {
    loadBuildInfo().finally(function () {
      modal.showModal();
    });
  });

  if (closeButton) {
    closeButton.addEventListener("click", function () {
      modal.close();
    });
  }

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      modal.close();
    }
  });
})();
