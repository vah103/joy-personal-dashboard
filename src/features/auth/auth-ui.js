(function registerJoyAccountUi(root) {
  const CLOUD_BACKEND = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
  if (!CLOUD_BACKEND) return;

  let currentSession = null;

  async function request(path, options = {}) {
    const response = await root.fetch(path, {
      ...options,
      credentials: "same-origin",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `REQUEST_FAILED_${response.status}`);
    return payload;
  }

  function ensureAccountCard() {
    const card = document.querySelector(".sidebar-footer .profile-card");
    if (!card) return;
    card.classList.add("joy-account-card");
    card.innerHTML = `
      <button class="joy-account-copy" type="button" data-action="open-account" aria-haspopup="dialog">
        <strong>Vanh</strong>
        <small id="account-email">Checking account…</small>
        <em id="account-google-status">Google account</em>
      </button>
      <button class="joy-signout-button" type="button" data-action="sign-out" aria-label="Sign out of Joy" title="Sign out">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>
          <path d="M14 8l4 4-4 4"/>
          <path d="M9 12h9"/>
        </svg>
      </button>
    `;

    const avatar = document.querySelector(".header-avatar");
    if (avatar) {
      avatar.setAttribute("role", "button");
      avatar.setAttribute("tabindex", "0");
      avatar.setAttribute("aria-label", "Open Google account settings");
      avatar.setAttribute("aria-haspopup", "dialog");
      avatar.dataset.action = "open-account";
    }
  }

  function moveNotificationControl() {
    const button = document.querySelector('[data-action="notifications"]');
    const slot = document.querySelector("[data-notification-slot]");
    if (!button || !slot || slot.contains(button)) return;
    button.classList.remove("icon-button");
    button.classList.add("joy-notification-button");
    slot.replaceChildren(button);
  }

  function ensureAccountModal() {
    if (document.querySelector("#joy-account-modal")) {
      moveNotificationControl();
      return;
    }
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.id = "joy-account-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="modal joy-account-modal" role="dialog" aria-modal="true" aria-labelledby="joy-account-title">
        <div class="modal-heading">
          <div><p class="section-kicker">Google account</p><h2 id="joy-account-title">Joy account</h2></div>
          <button type="button" aria-label="Close account settings" data-action="close-account">×</button>
        </div>
        <div class="joy-account-identity">
          <span class="joy-account-wolf"><img src="wolf-mark.svg?v=joy-summit-wolf" alt=""></span>
          <span><strong>Vanh</strong><small id="account-modal-email">Google account</small></span>
        </div>
        <div class="joy-integration-list">
          <div class="joy-integration-row">
            <span><strong>Gmail</strong><small>Priority email inside Joy</small></span>
            <button type="button" data-integration-action="gmail">Checking…</button>
          </div>
          <div class="joy-integration-row">
            <span><strong>Google Sheets</strong><small>Sales and finance data</small></span>
            <button type="button" data-integration-action="sheets">Checking…</button>
          </div>
          <div class="joy-integration-row joy-notification-row">
            <span><strong>Notifications</strong><small>Weather alerts on this device</small></span>
            <span class="joy-notification-slot" data-notification-slot></span>
          </div>
        </div>
        <button class="joy-account-signout" type="button" data-action="sign-out">Sign out of Joy</button>
      </section>
    `;
    document.body.append(modal);
    moveNotificationControl();
  }

  function integrationSummary(session) {
    const services = [];
    if (session?.integrations?.gmail) services.push("Gmail");
    if (session?.integrations?.sheets) services.push("Sheets");
    return services.length ? services.join(" + ") : "No apps connected";
  }

  function updateIntegrationButton(service, connected) {
    const button = document.querySelector(`[data-integration-action="${service}"]`);
    if (!button) return;
    button.textContent = connected ? "Disconnect" : "Connect";
    button.dataset.action = connected ? `disconnect-${service}` : `connect-${service}`;
    button.classList.toggle("connected", connected);
  }

  function updateProfile(session) {
    currentSession = session;
    const email = document.querySelector("#account-email");
    const modalEmail = document.querySelector("#account-modal-email");
    const google = document.querySelector("#account-google-status");
    if (email) email.textContent = session?.email || "Google account";
    if (modalEmail) modalEmail.textContent = session?.email || "Google account";
    if (google) google.textContent = integrationSummary(session);
    updateIntegrationButton("gmail", Boolean(session?.integrations?.gmail));
    updateIntegrationButton("sheets", Boolean(session?.integrations?.sheets));
  }

  function openAccount() {
    ensureAccountModal();
    updateProfile(currentSession);
    const modal = document.querySelector("#joy-account-modal");
    modal.hidden = false;
    document.body.classList.add("modal-open");
    root.setTimeout(() => modal.querySelector("[data-action='close-account']")?.focus(), 0);
  }

  function closeAccount() {
    const modal = document.querySelector("#joy-account-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  async function loadAccount() {
    ensureAccountCard();
    ensureAccountModal();
    try {
      const session = await request("/api/session");
      if (!session.signedIn) {
        root.location.replace("/login");
        return;
      }
      updateProfile(session);
    } catch {
      const email = document.querySelector("#account-email");
      if (email) email.textContent = "Account unavailable";
    }
  }

  async function disconnect(service) {
    await request(`/api/integrations/${service}/disconnect`, { method: "POST" });
    root.location.reload();
  }

  async function signOut() {
    try {
      await request("/api/signout", { method: "POST" });
    } finally {
      root.location.replace("/login");
    }
  }

  document.addEventListener("click", (event) => {
    const control = event.target.closest?.("[data-action]");
    if (!control) {
      if (event.target.id === "joy-account-modal") closeAccount();
      return;
    }
    const action = control.dataset.action;

    if (action === "open-account") {
      event.preventDefault();
      event.stopImmediatePropagation();
      openAccount();
    }
    if (action === "close-account") {
      event.preventDefault();
      closeAccount();
    }
    if (action === "connect-gmail") {
      event.preventDefault();
      event.stopImmediatePropagation();
      root.location.assign("/auth/connect/gmail");
    }
    if (action === "connect-sheets" || action === "connect-sales") {
      event.preventDefault();
      event.stopImmediatePropagation();
      root.location.assign("/auth/connect/sheets");
    }
    if (action === "disconnect-gmail" || action === "disconnect-sheets") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const service = action.endsWith("sheets") ? "sheets" : "gmail";
      control.disabled = true;
      void disconnect(service).catch(() => {
        control.disabled = false;
      });
    }
    if (action === "sign-out") {
      event.preventDefault();
      event.stopImmediatePropagation();
      control.disabled = true;
      void signOut();
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.querySelector("#joy-account-modal")?.hidden) closeAccount();
    if ((event.key === "Enter" || event.key === " ") && event.target?.dataset?.action === "open-account") {
      event.preventDefault();
      openAccount();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAccount, { once: true });
  } else {
    void loadAccount();
  }
})(window);