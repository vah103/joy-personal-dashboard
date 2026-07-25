(function registerJoyAccountUi(root) {
  const CLOUD_BACKEND = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
  if (!CLOUD_BACKEND) return;

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
      <span class="joy-account-copy">
        <strong>Vanh</strong>
        <small id="account-email">Checking account…</small>
        <em id="account-google-status">Google account</em>
      </span>
      <button class="joy-signout-button" type="button" data-action="sign-out" aria-label="Sign out of Joy" title="Sign out">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>
          <path d="M14 8l4 4-4 4"/>
          <path d="M9 12h9"/>
        </svg>
      </button>
    `;
  }

  function updateProfile(session) {
    const email = document.querySelector("#account-email");
    const google = document.querySelector("#account-google-status");
    if (email) email.textContent = session?.email || "Google account";
    if (google) {
      const services = [];
      if (session?.integrations?.gmail) services.push("Gmail");
      if (session?.integrations?.sheets) services.push("Sheets");
      google.textContent = services.length ? services.join(" + ") : "No apps connected";
    }
  }

  async function loadAccount() {
    ensureAccountCard();
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
    if (!control) return;
    const action = control.dataset.action;

    if (action === "connect-gmail") {
      event.preventDefault();
      event.stopImmediatePropagation();
      root.location.assign("/auth/connect/gmail");
    }
    if (action === "connect-sales") {
      event.preventDefault();
      event.stopImmediatePropagation();
      root.location.assign("/auth/connect/sheets");
    }
    if (action === "disconnect-gmail") {
      event.preventDefault();
      event.stopImmediatePropagation();
      control.disabled = true;
      void disconnect("gmail").catch(() => {
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAccount, { once: true });
  } else {
    void loadAccount();
  }
})(window);
