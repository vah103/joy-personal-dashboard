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

  const notesWolfSrc = "data:image/webp;base64,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...TRUNCATED_FOR_BREVITY...";

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
    image.src = notesWolfSrc;
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