function loadScratchpadMeta() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SCRATCHPAD_META_KEY));
    return saved && typeof saved === "object"
      ? {
          version: Number(saved.version || 0),
          updatedAt: Number(saved.updatedAt || 0),
        }
      : { version: 0, updatedAt: 0 };
  } catch {
    return { version: 0, updatedAt: 0 };
  }
}

function saveScratchpadMeta(scratchpad) {
  const meta = {
    version: Number(scratchpad?.version || 0),
    updatedAt: Number(scratchpad?.updatedAt || 0),
  };
  accountSync.scratchpadVersion = meta.version;
  accountSync.scratchpadUpdatedAt = meta.updatedAt;
  window.localStorage.setItem(SCRATCHPAD_META_KEY, JSON.stringify(meta));
}

function loadScratchpad() {
  try {
    elements.scratchpad.value = window.localStorage.getItem(SCRATCHPAD_KEY) || "";
    const meta = loadScratchpadMeta();
    accountSync.scratchpadVersion = meta.version;
    accountSync.scratchpadUpdatedAt = meta.updatedAt;
    elements.scratchpadStatus.textContent = CLOUD_BACKEND ? "Local" : "Saved";
  } catch {
    elements.scratchpadStatus.textContent = "Unavailable";
  }
}

function saveScratchpadLocally(content) {
  window.localStorage.setItem(SCRATCHPAD_KEY, content);
}

async function saveCloudScratchpad() {
  if (!CLOUD_BACKEND || !accountSync.connected || accountSync.scratchpadSaving) return;
  accountSync.scratchpadSaving = true;
  elements.scratchpadStatus.textContent = "Syncing";

  try {
    const content = elements.scratchpad.value;
    const payload = await backendRequest("/api/scratchpad", {
      method: "PUT",
      body: JSON.stringify({
        content,
        baseVersion: accountSync.scratchpadVersion,
      }),
    });
    saveScratchpadMeta(payload.scratchpad);
    saveScratchpadLocally(payload.scratchpad.content);
    elements.scratchpadStatus.textContent = "Synced";
  } catch (error) {
    if (error.status === 409) {
      try {
        window.localStorage.setItem(SCRATCHPAD_CONFLICT_BACKUP_KEY, elements.scratchpad.value);
        const latest = await backendRequest("/api/scratchpad");
        const cloud = latest.scratchpad;
        elements.scratchpad.value = cloud.content || "";
        saveScratchpadLocally(elements.scratchpad.value);
        saveScratchpadMeta(cloud);
        elements.scratchpadStatus.textContent = "Updated";
        showToast("Scratchpad changed on another device · local draft backed up");
      } catch {
        elements.scratchpadStatus.textContent = "Offline";
      }
    } else {
      elements.scratchpadStatus.textContent = error.status === 401 ? "Local" : "Offline";
    }
  } finally {
    accountSync.scratchpadSaving = false;
  }
}

function queueScratchpadSave() {
  elements.scratchpadStatus.textContent = accountSync.connected ? "Saving" : "Local";
  window.clearTimeout(scratchSaveTimer);
  scratchSaveTimer = window.setTimeout(async () => {
    try {
      saveScratchpadLocally(elements.scratchpad.value);
      if (accountSync.connected) {
        await saveCloudScratchpad();
      } else {
        elements.scratchpadStatus.textContent = "Local";
      }
    } catch {
      elements.scratchpadStatus.textContent = "Not saved";
    }
  }, 700);
}

async function syncCloudScratchpad({ silent = false } = {}) {
  if (!CLOUD_BACKEND || !accountSync.connected) return false;
  if (!silent) elements.scratchpadStatus.textContent = "Syncing";

  try {
    const localContent = window.localStorage.getItem(SCRATCHPAD_KEY) || "";
    const localMeta = loadScratchpadMeta();
    const payload = await backendRequest("/api/scratchpad");
    const cloud = payload.scratchpad;

    if (!cloud.exists) {
      if (localContent) {
        accountSync.scratchpadVersion = 0;
        elements.scratchpad.value = localContent;
        await saveCloudScratchpad();
      } else {
        saveScratchpadMeta(cloud);
        elements.scratchpadStatus.textContent = "Synced";
      }
      accountSync.scratchpadReady = true;
      return true;
    }

    if (localContent && localContent !== cloud.content && localMeta.version === cloud.version) {
      accountSync.scratchpadVersion = cloud.version;
      elements.scratchpad.value = localContent;
      await saveCloudScratchpad();
      accountSync.scratchpadReady = true;
      return true;
    }

    if (localContent && localContent !== cloud.content && localMeta.version === 0) {
      window.localStorage.setItem(SCRATCHPAD_CONFLICT_BACKUP_KEY, localContent);
    }

    elements.scratchpad.value = cloud.content || "";
    saveScratchpadLocally(elements.scratchpad.value);
    saveScratchpadMeta(cloud);
    accountSync.scratchpadReady = true;
    elements.scratchpadStatus.textContent = "Synced";
    return true;
  } catch (error) {
    if (!silent) {
      elements.scratchpadStatus.textContent = error.status === 401 ? "Local" : "Offline";
    }
    return false;
  }
}
