(() => {
  const canWriteHead = typeof document?.createElement === "function" && document?.head?.append;
  if (canWriteHead && !document.querySelector('link[data-joy-i18n-style="true"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/i18n/i18n.css?v=joy-i18n-v1";
    link.dataset.joyI18nStyle = "true";
    document.head.append(link);
  }
  if (typeof document?.createElement === "function") {
    void import("/i18n/index.js?v=joy-i18n-v1");
  }
})();

// Keep the locked Notes wolf launcher isolated from dashboard configuration.
if (typeof document !== "undefined") {
  void import("/notes-launcher.js?v=joy-notes-launcher-v1");
}

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
