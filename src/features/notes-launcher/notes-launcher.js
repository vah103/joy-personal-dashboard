// Locked visual-only Notes launcher. See test/fixtures/notes-wolf-v1.lock.json.
(() => {
  const canMountNotes = typeof document !== "undefined"
    && typeof document.createElement === "function"
    && typeof document.querySelector === "function";
  if (!canMountNotes) return;

  if (!document.querySelector('link[data-joy-notes-launcher-style="true"]') && document.head?.append) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/notes-launcher.css?v=joy-notes-launcher-v1";
    link.dataset.joyNotesLauncherStyle = "true";
    document.head.append(link);
  }

  function mountNotesLauncher() {
    const nav = document.querySelector(".compact-nav");
    if (!nav || nav.dataset.joyNotesLauncher === "true") return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "notes-app-launcher";
    button.dataset.notesLauncher = "true";
    button.setAttribute("aria-label", "Notes");
    button.setAttribute("title", "Notes");

    const frame = document.createElement("span");
    frame.className = "notes-app-logo-frame";
    frame.setAttribute("aria-hidden", "true");

    const image = document.createElement("img");
    image.className = "notes-app-logo";
    image.src = "/project-data/notes-wolf.svg?v=joy-notes-wolf-v1";
    image.alt = "";
    image.draggable = false;

    const label = document.createElement("span");
    label.className = "notes-app-label";
    label.textContent = "Notes";

    frame.append(image);
    button.append(frame, label);
    nav.classList.add("joy-notes-nav");
    nav.dataset.joyNotesLauncher = "true";
    nav.replaceChildren(button);
  }

  if (document.readyState === "loading" && typeof document.addEventListener === "function") {
    document.addEventListener("DOMContentLoaded", mountNotesLauncher, { once: true });
  } else {
    mountNotesLauncher();
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("joy:i18n-ready", mountNotesLauncher);
  }
})();
