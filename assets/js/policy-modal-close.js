(function () {
  "use strict";

  var enhancedClass = "policy-modal-close-enhanced";
  var hostClass = "policy-modal-close-host";
  var enhancedAttribute = "data-policy-modal-close-enhanced";
  var candidateSelector = 'button, [role="button"], a';
  var policyContainerSelector = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    '[data-policy-modal-dialog]',
    '[data-policy-modal]',
    '[class*="policy"]',
    '[id*="policy"]'
  ].join(', ');

  function text(value) {
    return String(value || "").trim().toLowerCase();
  }

  function identity(element) {
    if (!element) return "";
    return [
      element.id,
      element.className,
      element.getAttribute && element.getAttribute("aria-label"),
      element.getAttribute && element.getAttribute("title"),
      element.getAttribute && element.getAttribute("data-policy-modal-close"),
      element.textContent
    ].map(text).join(" ");
  }

  function isCloseControl(element) {
    if (!element || !element.matches || !element.matches(candidateSelector)) return false;
    var value = identity(element);
    return value.indexOf("close") !== -1 || value === "×" || value === "x";
  }

  function findCloseHost(element) {
    var parent = element && element.parentElement;
    if (!parent || !parent.closest) return null;
    return parent.closest('[role="dialog"], [aria-modal="true"], [data-policy-modal-dialog], [class*="policy"], [id*="policy"]');
  }

  function isPolicyCloseControl(element) {
    if (!isCloseControl(element)) return false;

    var ownIdentity = identity(element);
    if (ownIdentity.indexOf("policy") !== -1 || ownIdentity.indexOf("privacy") !== -1) {
      return true;
    }

    if (!element.closest) return false;
    var container = element.closest(policyContainerSelector);
    if (!container) return false;

    var containerIdentity = identity(container);
    return containerIdentity.indexOf("policy") !== -1 || containerIdentity.indexOf("privacy") !== -1;
  }

  function enhance(element) {
    if (!isPolicyCloseControl(element)) return;
    if (element.hasAttribute(enhancedAttribute)) return;

    /*
     * Set the guard before mutating any observed properties. This prevents the
     * observer from re-entering enhance() when the class or aria-label changes.
     */
    element.setAttribute(enhancedAttribute, "");
    var closeHost = findCloseHost(element);
    if (closeHost && closeHost !== element) {
      closeHost.classList.add(hostClass);
    }
    element.classList.add("modal-close-circle", enhancedClass);

    if (element.getAttribute("aria-label") !== "Close privacy policy") {
      element.setAttribute("aria-label", "Close privacy policy");
    }

    if (element.textContent !== "×") {
      element.textContent = "×";
    }
  }

  function upgrade(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(candidateSelector)) enhance(scope);
    scope.querySelectorAll(candidateSelector).forEach(enhance);
  }

  document.addEventListener("DOMContentLoaded", function () {
    upgrade(document);
    if (!document.body || typeof MutationObserver !== "function") return;

    /*
     * Observe newly inserted modal content only. Attribute observation is not
     * needed and can create feedback loops when an enhancement changes labels.
     */
    new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          upgrade(node);
        });
      });
    }).observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}());
