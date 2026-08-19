(() => {
  const button = document.querySelector('[data-action="notifications"]');
  if (!button) return;

  const VAPID_KEY_STORAGE = "hey-joy-vapid-public-key-v1";
  const isIos = /iP(hone|ad|od)/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  const isSupported = "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
    && "showNotification" in ServiceWorkerRegistration.prototype;

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isSupported) {
      window.alert("Thiết bị hoặc trình duyệt này chưa hỗ trợ Web Push.");
      return;
    }
    if (isIos && !isStandalone()) {
      window.alert("Trên iPhone, hãy mở Hey Joy! bằng Safari, chọn Share → Add to Home Screen, rồi mở Hey Joy! từ biểu tượng ngoài màn hình chính.");
      return;
    }
    if (Notification.permission === "denied") {
      window.alert("Thông báo đang bị chặn. Vào Settings → Notifications → Hey Joy! và bật Allow Notifications.");
      return;
    }

    setButtonState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setButtonState("off");
        return;
      }

      const registration = await ensureServiceWorker({ forceUpdate: true });
      const { publicKey } = await requestJson("/api/push/public-key");
      const subscription = await rebuildSubscription(registration, publicKey);

      const cleanupResult = await registerCurrentSubscription(subscription);
      const localResult = await showLocalDiagnostic(registration);
      const remoteResult = await requestJson("/api/push/test", {
        method: "POST",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      savePublicKey(publicKey);
      setButtonState("on");
      window.alert([
        "Joy đã làm mới kết nối thông báo trên iPhone.",
        cleanupResult.removed > 0
          ? `Đã xóa ${cleanupResult.removed} kết nối cũ của thiết bị này.`
          : "Không còn kết nối cũ trên thiết bị này.",
        localResult
          ? "Kiểm tra hiển thị trực tiếp: đã tạo."
          : "Kiểm tra hiển thị trực tiếp: iPhone không xác nhận.",
        `Push từ server: Apple đã nhận ${Number(remoteResult.sent || 0)} thông báo.`,
        "Hãy đóng Joy và kiểm tra Notification Center. Nếu vẫn không thấy, vào Settings → Notifications → Hey Joy! và bật Allow Notifications, Lock Screen, Notification Center và Banners.",
      ].join("\n\n"));
    } catch (error) {
      console.error("Hey Joy push setup failed", error);
      setButtonState("off");
      if (error.status === 401) {
        window.alert("Hãy kết nối tài khoản Google trên iPhone trước, sau đó nhấn chuông thêm một lần nữa.");
        window.location.assign("/auth/start");
      } else if (error.message === "TEST_PUSH_NOT_DELIVERED") {
        window.alert("Máy đã đăng ký nhận thông báo nhưng server chưa gửi được đến Apple. Joy sẽ cần kiểm tra lại subscription hoặc khóa VAPID.");
      } else {
        window.alert(`Chưa bật được thông báo: ${error.message || "Unknown error"}`);
      }
    }
  });

  initialize();

  async function initialize() {
    if (!isSupported) {
      setButtonState("unsupported");
      return;
    }
    try {
      const registration = await ensureServiceWorker();
      const subscription = await registration.pushManager.getSubscription();
      const verifiedHere = Boolean(readSavedPublicKey());
      const enabled = Notification.permission === "granted" && Boolean(subscription) && verifiedHere;
      setButtonState(enabled ? "on" : "off");
      if (enabled) {
        await registerCurrentSubscription(subscription).catch(() => {});
      }
    } catch {
      setButtonState("off");
    }
  }

  async function registerCurrentSubscription(subscription) {
    await requestJson("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription.toJSON()),
    });

    return requestJson("/api/push/cleanup-current", {
      method: "POST",
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  }

  async function ensureServiceWorker({ forceUpdate = false } = {}) {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    if (forceUpdate) {
      await registration.update().catch(() => null);
      await waitForActiveWorker(registration);
    }

    return navigator.serviceWorker.ready;
  }

  async function waitForActiveWorker(registration) {
    const candidate = registration.installing || registration.waiting;
    if (!candidate || candidate.state === "activated") return;

    await new Promise((resolve) => {
      const timeout = window.setTimeout(resolve, 5000);
      candidate.addEventListener("statechange", () => {
        if (candidate.state !== "activated") return;
        window.clearTimeout(timeout);
        resolve();
      });
    });
  }

  async function rebuildSubscription(registration, publicKey) {
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      try {
        await existing.unsubscribe();
      } catch (error) {
        console.warn("Hey Joy could not remove the old push subscription", error);
      }
    }

    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    });
  }

  async function showLocalDiagnostic(registration) {
    try {
      await registration.showNotification("Đã hoạt động", {
        body: "Joy có thể hiển thị thông báo trực tiếp trên iPhone.",
        icon: "/joy-blue-icon.png?v=joy-topographic-blue-v1",
        badge: "/joy-blue-icon.png?v=joy-topographic-blue-v1",
        tag: "hey-joy-local-check",
        renotify: true,
        silent: false,
        data: { url: "/", kind: "test" },
      });
      return true;
    } catch (error) {
      console.warn("Hey Joy local notification check failed", error);
      return false;
    }
  }

  function setButtonState(state) {
    const states = {
      on: ["✓", "Thông báo Joy đã bật", true],
      off: ["🔔", isIos && !isStandalone() ? "Thêm Hey Joy! vào Home Screen để bật thông báo" : "Bật hoặc sửa thông báo Joy", false],
      busy: ["…", "Đang sửa kết nối thông báo", false],
      unsupported: ["–", "Trình duyệt chưa hỗ trợ thông báo", false],
    };
    const [label, title, pressed] = states[state] || states.off;
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.setAttribute("aria-pressed", String(pressed));
  }

  function readSavedPublicKey() {
    try {
      return window.localStorage.getItem(VAPID_KEY_STORAGE) || "";
    } catch {
      return "";
    }
  }

  function savePublicKey(value) {
    try {
      window.localStorage.setItem(VAPID_KEY_STORAGE, value);
    } catch {
      // The active subscription still works even when localStorage is unavailable.
    }
  }

  async function requestJson(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function base64UrlToUint8Array(value) {
    const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
})();
