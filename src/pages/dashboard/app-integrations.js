async function backendRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await window.fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Joy server returned ${response.status}`);
    error.status = response.status;
    error.code = payload.error || "";
    throw error;
  }
  return payload;
}

async function fetchCloudSales({ silent = false } = {}) {
  if (!silent) {
    sales.status = "loading";
    renderBrief();
    renderSales();
  }

  try {
    const payload = await backendRequest("/api/sales/viewings");
    sales.viewings = Array.isArray(payload.viewings) ? payload.viewings : [];
    sales.fetchedAt = Number(payload.fetchedAt || Date.now());
    sales.errorCode = "";
    sales.status = "ready";
    startSalesAutoRefresh();
  } catch (error) {
    sales.viewings = [];
    sales.errorCode = error.code || "SALE_SYNC_FAILED";
    if (error.status === 401 || error.code === "SHEETS_AUTHORIZATION_REQUIRED") {
      sales.status = "authorization-required";
    } else {
      sales.status = "error";
    }
  }
  renderBrief();
  renderSales();
}

function startSalesAutoRefresh() {
  if (!CLOUD_BACKEND) return;
  window.clearInterval(salesAutoRefreshTimer);
  salesAutoRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") fetchCloudSales({ silent: true });
  }, SALES_AUTO_REFRESH_MS);
}

async function initializeCloudGmail() {
  gmail.status = "sdk-loading";
  renderBrief();
  renderEmail();
  try {
    const session = await backendRequest("/api/session");
    if (!session.connected) {
      accountSync.connected = false;
      accountSync.email = "";
      gmail.status = "disconnected";
      elements.scratchpadStatus.textContent = "Local";
      renderBrief();
      renderEmail();
      return;
    }
    accountSync.connected = true;
    accountSync.email = session.email || "";
    await syncCloudScratchpad();
    await syncCloudProjects();
    await fetchCloudEmails();
  } catch {
    gmail.status = "error";
    gmail.error = "Joy's secure Gmail service is not ready yet.";
    renderBrief();
    renderEmail();
  }
}

async function fetchCloudEmails({ silent = false } = {}) {
  if (!silent) {
    gmail.status = "loading-messages";
    renderBrief();
    renderEmail();
  }

  try {
    const payload = await backendRequest("/api/emails");
    gmail.messages = Array.isArray(payload.messages) ? payload.messages : [];
    gmail.hiddenCount = Number(payload.hiddenCount || 0);
    gmail.syncedAt = Number(payload.syncedAt || Date.now());
    state.gmailPinnedIds = gmail.messages.filter((message) => message.pinned).map((message) => String(message.id));
    gmail.status = "connected";
    gmail.error = "";
    saveState();
    renderBrief();
    renderEmail();
    startGmailAutoRefresh();
    if (payload.syncError && !gmail.messages.length && !silent) {
      showToast("Automatic Gmail sync is paused. Try Refresh, then reconnect if needed.");
    }
  } catch (error) {
    if (error.status === 401) {
      stopGmailAutoRefresh();
      gmail.status = "disconnected";
      gmail.error = "";
    } else if (!silent) {
      gmail.status = "error";
      gmail.error = "Joy could not reach the secure Gmail service. Please try again.";
    }
    renderBrief();
    renderEmail();
  }
}

function startGmailAutoRefresh() {
  if (!CLOUD_BACKEND) return;
  window.clearInterval(gmailAutoRefreshTimer);
  gmailAutoRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === "visible" && gmail.status === "connected") {
      fetchCloudEmails({ silent: true });
    }
  }, GMAIL_AUTO_REFRESH_MS);
}

function stopGmailAutoRefresh() {
  window.clearInterval(gmailAutoRefreshTimer);
  gmailAutoRefreshTimer = null;
}

function gmailErrorMessage(status) {
  if (status === 401) return "Your Google session expired. Connect again to refresh it.";
  if (status === 403) return "Google blocked access. Add this Gmail address as a test user, then try again.";
  return "Joy could not reach Gmail. Check your connection and try again.";
}

async function gmailApi(path) {
  const response = await window.fetch(`${GMAIL_API_ROOT}${path}`, {
    headers: { Authorization: `Bearer ${gmail.accessToken}` },
  });
  if (!response.ok) {
    const error = new Error(gmailErrorMessage(response.status));
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function gmailHeader(message, name) {
  const headers = message.payload?.headers || [];
  return headers.find((header) => String(header.name).toLowerCase() === name.toLowerCase())?.value || "";
}

async function fetchGmailMessage(id) {
  const params = new URLSearchParams({ format: "metadata" });
  ["From", "Subject", "Date"].forEach((name) => params.append("metadataHeaders", name));
  const message = await gmailApi(`/messages/${encodeURIComponent(id)}?${params}`);
  return {
    id: message.id,
    threadId: message.threadId || message.id,
    sender: senderName(gmailHeader(message, "From")),
    subject: gmailHeader(message, "Subject"),
    date: gmailHeader(message, "Date"),
    snippet: message.snippet || "",
    unread: Array.isArray(message.labelIds) ? message.labelIds.includes("UNREAD") : true,
  };
}

async function fetchGmailMessages() {
  if (CLOUD_BACKEND) return fetchCloudEmails();
  if (!gmail.accessToken) return;
  gmail.status = "loading-messages";
  gmail.error = "";
  renderBrief();
  renderEmail();

  try {
    const query = new URLSearchParams({ maxResults: "25", q: "is:unread in:inbox" });
    const list = await gmailApi(`/messages?${query}`);
    const messageRefs = Array.isArray(list.messages) ? list.messages : [];
    const dismissed = new Set(state.gmailDismissedIds);
    const unreadIds = messageRefs.map(({ id }) => String(id)).filter((id) => !dismissed.has(id)).slice(0, 5);
    const pinnedIds = state.gmailPinnedIds.filter((id) => !dismissed.has(id));
    const ids = [...new Set([...pinnedIds, ...unreadIds])];
    const missingIds = [];
    const messages = (await Promise.all(ids.map(async (id) => {
      try {
        return await fetchGmailMessage(id);
      } catch (error) {
        if (error.status === 404) {
          missingIds.push(id);
          return null;
        }
        throw error;
      }
    }))).filter(Boolean);

    if (missingIds.length) {
      state.gmailPinnedIds = state.gmailPinnedIds.filter((id) => !missingIds.includes(id));
      saveState();
    }

    gmail.messages = sortGmailMessages(messages);
    gmail.status = "connected";
    renderBrief();
    renderEmail();
  } catch (error) {
    if (error.status === 401) {
      gmail.accessToken = null;
      gmail.expiresAt = 0;
    }
    gmail.status = "error";
    gmail.error = error.message || gmailErrorMessage(error.status);
    renderBrief();
    renderEmail();
  }
}

function handleGoogleToken(response) {
  if (!response || response.error || !response.access_token) {
    gmail.status = "error";
    gmail.error = "Google did not grant access. Please choose your account and try again.";
    renderBrief();
    renderEmail();
    return;
  }

  const scopeChecker = window.google?.accounts?.oauth2?.hasGrantedAllScopes;
  if (scopeChecker && !scopeChecker(response, GMAIL_SCOPE)) {
    gmail.status = "error";
    gmail.error = "Read-only Gmail permission was not approved.";
    renderBrief();
    renderEmail();
    return;
  }

  gmail.accessToken = response.access_token;
  gmail.expiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
  fetchGmailMessages();
}

function initializeGoogleIdentity() {
  try {
    gmail.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GMAIL_SCOPE,
      callback: handleGoogleToken,
      error_callback: () => {
        gmail.status = "disconnected";
        gmail.error = "";
        renderBrief();
        renderEmail();
      },
    });
    gmail.status = "disconnected";
    renderBrief();
    renderEmail();
  } catch {
    gmail.status = "error";
    gmail.error = "Google sign-in could not start. Refresh the page and try again.";
    renderBrief();
    renderEmail();
  }
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) {
    initializeGoogleIdentity();
    return;
  }

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.onload = initializeGoogleIdentity;
  script.onerror = () => {
    gmail.status = "error";
    gmail.error = "Google sign-in was blocked. Disable any blocker for this page, then refresh.";
    renderBrief();
    renderEmail();
  };
  document.head.append(script);
}

function connectGmail() {
  if (CLOUD_BACKEND) {
    window.location.assign("/auth/start");
    return;
  }
  if (!gmail.tokenClient) {
    gmail.status = "error";
    gmail.error = "Google sign-in is not ready yet. Refresh the page and try again.";
    renderEmail();
    return;
  }
  gmail.status = "authorizing";
  gmail.error = "";
  renderBrief();
  renderEmail();
  gmail.tokenClient.requestAccessToken();
}

function refreshGmail() {
  if (CLOUD_BACKEND) {
    fetchCloudEmails();
    return;
  }
  if (!gmail.accessToken || Date.now() >= gmail.expiresAt - 60_000) {
    connectGmail();
    return;
  }
  fetchGmailMessages();
}

async function disconnectGmail() {
  if (CLOUD_BACKEND) {
    try {
      await backendRequest("/api/disconnect", { method: "POST" });
      stopGmailAutoRefresh();
      gmail.accessToken = null;
      gmail.messages = [];
      gmail.hiddenCount = 0;
      gmail.status = "disconnected";
      accountSync.connected = false;
      accountSync.email = "";
      accountSync.scratchpadReady = false;
      accountSync.projectsReady = false;
      elements.scratchpadStatus.textContent = "Local";
      state.gmailPinnedIds = [];
      saveState();
      renderBrief();
      renderEmail();
      showToast("Gmail disconnected");
    } catch {
      showToast("Joy could not disconnect Gmail");
    }
    return;
  }
  const token = gmail.accessToken;
  gmail.accessToken = null;
  gmail.expiresAt = 0;
  gmail.messages = [];
  gmail.status = "disconnected";
  gmail.error = "";
  renderBrief();
  renderEmail();

  if (token && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(token, () => showToast("Gmail disconnected"));
  } else {
    showToast("Gmail disconnected");
  }
}
