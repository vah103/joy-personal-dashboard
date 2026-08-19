(() => {
  const canWriteHead = typeof document?.createElement === "function" && document?.head?.append;
  if (canWriteHead && !document.querySelector('link[data-joy-i18n-style="true"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/i18n/i18n.css?v=joy-i18n-v3";
    link.dataset.joyI18nStyle = "true";
    document.head.append(link);
  }
  if (typeof document?.createElement === "function") {
    void import("/i18n/index.js?v=joy-i18n-v3");
  }
})();

// The dashboard Settings control is created by the shared i18n layer. Keep that
// single control, but move it out of the cramped sidebar profile card and into
// the Joy account popup beside the notification and close controls.
(() => {
  const canRelocateSettings = typeof window !== "undefined"
    && typeof window.addEventListener === "function"
    && typeof document !== "undefined"
    && typeof document.addEventListener === "function"
    && typeof MutationObserver === "function";
  if (!canRelocateSettings) return;

  let observer = null;

  function moveSettingsIntoAccount() {
    const actions = document.querySelector("#joy-account-modal .joy-account-heading-actions");
    const button = document.querySelector(".sidebar-footer > [data-joy-settings-open]");
    if (!actions || !button) return false;

    button.classList.add("joy-settings-trigger-account");
    const notificationSlot = actions.querySelector("[data-notification-slot]");
    actions.insertBefore(button, notificationSlot || actions.firstChild);
    observer?.disconnect();
    observer = null;
    return true;
  }

  function watchForSettingsAndAccountPopup() {
    if (moveSettingsIntoAccount() || observer || !document.documentElement) return;
    observer = new MutationObserver(() => {
      moveSettingsIntoAccount();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener("joy:i18n-ready", watchForSettingsAndAccountPopup);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchForSettingsAndAccountPopup, { once: true });
  } else {
    watchForSettingsAndAccountPopup();
  }
})();

// Notes is currently a visual launcher only. Replace the legacy three-button
// desktop navigation with the obsidian wolf mark while the Notes workspace is
// being built. The button intentionally has no click handler yet.
(() => {
  const canMountNotes = typeof document !== "undefined"
    && typeof document.createElement === "function"
    && typeof document.querySelector === "function";
  if (!canMountNotes) return;

  function installNotesLauncherStyles() {
    if (document.querySelector('style[data-joy-notes-launcher-style="true"]') || !document.head?.append) return;
    const style = document.createElement("style");
    style.dataset.joyNotesLauncherStyle = "true";
    style.textContent = `
      .compact-nav.joy-notes-nav {
        margin-top: 28px !important;
        display: grid !important;
        place-items: center;
        gap: 0 !important;
      }
      .joy-notes-nav .notes-app-launcher {
        appearance: none;
        width: 100%;
        min-height: 132px;
        margin: 0;
        padding: 0 0 4px;
        border: 0;
        border-radius: 18px;
        background: transparent;
        color: rgba(249, 250, 248, .96);
        display: grid;
        place-items: center;
        align-content: start;
        gap: 6px;
        cursor: pointer;
      }
      .notes-app-logo-frame {
        position: relative;
        width: 112px;
        height: 104px;
        display: grid;
        place-items: center;
        isolation: isolate;
        transition: transform 220ms ease;
      }
      .notes-app-logo-frame::before {
        content: "";
        position: absolute;
        inset: 20px 14px 12px;
        z-index: -1;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(119, 104, 197, .20) 0%, rgba(92, 107, 166, .09) 40%, transparent 72%);
        filter: blur(12px);
        opacity: .62;
        animation: joy-notes-aura 5.8s ease-in-out infinite;
      }
      .notes-app-logo-frame::after {
        content: "";
        position: absolute;
        top: 16px;
        right: 16px;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #e8e4ff;
        box-shadow: 0 0 6px rgba(196, 188, 255, .9), 0 0 15px rgba(112, 96, 190, .55);
        opacity: 0;
        animation: joy-notes-spark 6.4s ease-in-out infinite;
      }
      .notes-app-logo {
        position: relative;
        z-index: 1;
        width: 94px;
        max-height: 98px;
        object-fit: contain;
        user-select: none;
        pointer-events: none;
        filter: drop-shadow(0 8px 12px rgba(29, 34, 43, .18)) drop-shadow(0 0 4px rgba(91, 80, 160, .10));
        animation: joy-notes-logo-float 6.2s ease-in-out infinite;
      }
      .notes-app-label {
        display: block;
        margin-top: -1px;
        font-size: 13px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: -.01em;
        text-shadow: 0 1px 2px rgba(30, 36, 38, .16);
      }
      .notes-app-launcher:hover .notes-app-logo-frame,
      .notes-app-launcher:focus-visible .notes-app-logo-frame {
        transform: translateY(-2px) scale(1.025);
      }
      .notes-app-launcher:focus-visible {
        outline: 2px solid rgba(213, 218, 232, .58);
        outline-offset: 2px;
      }
      @keyframes joy-notes-logo-float {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); filter: drop-shadow(0 8px 12px rgba(29, 34, 43, .18)) drop-shadow(0 0 4px rgba(91, 80, 160, .10)); }
        50% { transform: translate3d(0, -3px, 0) scale(1.012); filter: drop-shadow(0 10px 14px rgba(29, 34, 43, .20)) drop-shadow(0 0 7px rgba(103, 88, 181, .18)); }
      }
      @keyframes joy-notes-aura {
        0%, 100% { opacity: .45; transform: scale(.94); }
        50% { opacity: .76; transform: scale(1.06); }
      }
      @keyframes joy-notes-spark {
        0%, 68%, 100% { opacity: 0; transform: scale(.5); }
        74% { opacity: .95; transform: scale(1.15); }
        80% { opacity: 0; transform: scale(1.7); }
      }
      @media (prefers-reduced-motion: reduce) {
        .notes-app-logo,
        .notes-app-logo-frame::before,
        .notes-app-logo-frame::after { animation: none !important; }
        .notes-app-logo-frame { transition: none !important; }
      }
    `;
    document.head.append(style);
  }

  function mountNotesLauncher() {
    const nav = document.querySelector(".compact-nav");
    if (!nav || nav.dataset.joyNotesLauncher === "true") return;

    installNotesLauncherStyles();

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

window.JoyDashboardConfig = Object.freeze({
  profileName: "Vanh",
  timeZone: "Asia/Ho_Chi_Minh",
  google: Object.freeze({
    clientId: document.querySelector('meta[name="joy-google-client-id"]')?.content || "",
    gmailScope: "https://www.googleapis.com/auth/gmail.readonly",
    gmailApiRoot: "https://gmail.googleapis.com/gmail/v1/users/me",
    inboxUrl: "https://mail.google.com/mail/u/0/#inbox",
  }),
  weather: Object.freeze({
    location: "Hanoi",
    latitude: 21.0285,
    longitude: 105.8542,
    refreshMinutes: 15,
  }),
  refresh: Object.freeze({
    gmailMs: 60_000,
    salesMs: 60_000,
  }),
  seedProjects: Object.freeze([
    Object.freeze({
      id: 1,
      name: "TurtleBot 4",
      progress: 42,
      accent: "slate",
      focus: "Stage 5 · Frontier Detection",
      next: "Implement frontier detection and RViz markers",
    }),
    Object.freeze({
      id: 2,
      name: "IELTS",
      progress: 0,
      accent: "blue",
      focus: "Band 7.0 · December 2026",
      next: "Prepare the August baseline",
    }),
  ]),
});

// Automatic Gmail sync should stay invisible when the mailbox state is unchanged.
(() => {
  const originalFetchCloudEmails = fetchCloudEmails;
  const originalRenderBrief = renderBrief;
  const originalRenderEmail = renderEmail;
  let suppressGmailRefreshRender = false;

  function gmailRenderSignature() {
    return JSON.stringify({
      status: gmail.status,
      error: gmail.error || "",
      hiddenCount: Number(gmail.hiddenCount || 0),
      messages: (gmail.messages || []).map((message) => ({
        id: String(message.id || ""),
        threadId: String(message.threadId || ""),
        sender: String(message.sender || ""),
        subject: String(message.subject || ""),
        snippet: String(message.snippet || ""),
        date: String(message.date || ""),
        unread: Boolean(message.unread),
        pinned: Boolean(message.pinned),
      })),
    });
  }

  renderBrief = function renderBriefWithoutUnchangedGmailRefresh(...args) {
    if (suppressGmailRefreshRender) return;
    return originalRenderBrief(...args);
  };

  renderEmail = function renderEmailWithoutUnchangedGmailRefresh(...args) {
    if (suppressGmailRefreshRender) return;
    return originalRenderEmail(...args);
  };

  fetchCloudEmails = async function fetchCloudEmailsWithoutUnchangedRender(options = {}) {
    if (!options?.silent) return originalFetchCloudEmails(options);

    const before = gmailRenderSignature();
    suppressGmailRefreshRender = true;
    try {
      await originalFetchCloudEmails(options);
    } finally {
      suppressGmailRefreshRender = false;
    }

    if (gmailRenderSignature() !== before) {
      originalRenderBrief();
      originalRenderEmail();
    }
  };
})();