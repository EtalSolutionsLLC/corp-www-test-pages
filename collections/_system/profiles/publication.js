/* Portmason Collections™: publication profile. */
(function () {
  "use strict";

  var api = window.PortmasonCollections;
  if (!api) throw new Error("Portmason Collections core must load before the publication profile");

  function initPublication(root) {
    var modal = root.querySelector("[data-collection-modal]");
    var closeButton = root.querySelector("[data-collection-modal-close]");
    var title = root.querySelector("[data-collection-modal-title]");
    var meta = root.querySelector("[data-collection-modal-meta]");
    var article = root.querySelector("[data-collection-modal-body]");
    var templates = Array.prototype.slice.call(
      root.querySelectorAll("[data-collection-article-template]")
    );

    function findTemplate(itemId) {
      return templates.find(function (template) {
        return Number(template.getAttribute("data-collection-item-id")) === itemId;
      });
    }

    function copyChildren(source, target) {
      target.replaceChildren();
      Array.prototype.forEach.call(source.childNodes, function (node) {
        target.appendChild(node.cloneNode(true));
      });
    }

    function openItem(itemId) {
      if (!modal || !title || !meta || !article) return false;
      var template = findTemplate(itemId);
      if (!template || !template.content) return false;

      var sourceTitle = template.content.querySelector("[data-collection-article-title]");
      var sourceMeta = template.content.querySelector("[data-collection-article-meta]");
      var sourceArticle = template.content.querySelector("[data-collection-article-body]");
      if (!sourceTitle || !sourceMeta || !sourceArticle) return false;

      copyChildren(sourceTitle, title);
      meta.textContent = sourceMeta.textContent;
      copyChildren(sourceArticle, article);
      if (typeof modal.showModal === "function") modal.showModal();
      else modal.setAttribute("open", "");
      return true;
    }

    function closeItem() {
      if (!modal) return;
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }

    root.addEventListener("click", function (event) {
      var trigger = event.target.closest("[data-collection-open-item]");
      if (trigger) {
        var itemId = Number(trigger.getAttribute("data-collection-open-item"));
        if (openItem(itemId)) event.preventDefault();
        return;
      }
      if (event.target === modal) closeItem();
    });

    if (closeButton) closeButton.addEventListener("click", closeItem);
  }

  api.registerProfile("publication", { initialize: initPublication });
}());
