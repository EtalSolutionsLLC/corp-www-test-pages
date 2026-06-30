(function () {
  "use strict";

  var modal = document.querySelector("[data-home-quick-modal]");
  var openButton = document.querySelector("[data-home-quick-open]");
  var closeButton = document.querySelector("[data-home-quick-close]");

  if (!modal || !openButton || !closeButton) return;

  function openSummary() {
    if (typeof modal.showModal === "function") {
      modal.showModal();
      return;
    }
    modal.setAttribute("open", "");
  }

  function closeSummary() {
    if (typeof modal.close === "function") {
      modal.close();
      return;
    }
    modal.removeAttribute("open");
  }

  openButton.addEventListener("click", openSummary);
  closeButton.addEventListener("click", closeSummary);

  modal.addEventListener("click", function (event) {
    if (event.target === modal) closeSummary();
  });

  modal.querySelectorAll("[data-home-quick-modal-action]").forEach(function (action) {
    action.addEventListener("click", closeSummary);
  });
}());
