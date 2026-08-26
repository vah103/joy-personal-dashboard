(() => {
  window.addEventListener("pageshow", () => {
    const modal = document.querySelector("#turtlebot-hub-modal");
    if (!modal || modal.hidden) document.body.classList.remove("hub-modal-open");
  });
})();
