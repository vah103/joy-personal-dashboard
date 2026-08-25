(() => {
  const button = document.querySelector("[data-vocab-library-add]");
  if (!button) return;

  const accessibleLabel = button.textContent.replace(/^\s*\+\s*/, "").trim() || "Add";
  button.textContent = "+";
  button.setAttribute("aria-label", accessibleLabel);
  button.setAttribute("title", accessibleLabel);
})();
