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
    && "Notification" in window;

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

      const registration = await ensureServiceWorker();
      const { publicKey } = await requestJson("/api/push/public-key");
      let subscription = await registration.pushManager.getSubscription();
      const savedPublicKey = readSavedPublicKey();

      // A PushSubscription is permanently bound to the applicationServerKey
      // used to create it. Recreate an old or unverified subscription whenever
      // the server publishes a different VAPID public key.
      if (subscription && savedPublicKey !== publicKey) {
        await subscription.unsubscribe();
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        });
      }

      await requestJson("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      await requestJson("/api/push/test", {
        method: "POST",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      savePublicKey(publicKey);
      setButtonState("on");
      window.alert("Đã bật thông báo cho Hey Joy! Một thông báo thử sẽ xuất hiện trên iPhone.");
    } catch (error) {
      console.error("Hey Joy push setup failed", error);
      setButtonState("off");
      if (error.status === 401) {
        window.alert("Hãy kết nối tài khoản Google trên iPhone trước, sau đó nhấn chuông thêm một lần nữa.");
        window.location.assign("/auth/start");
      } else if (error.message === "TEST_PUSH_NOT_DELIVERED") {
        window.alert("Máy đã đăng ký nhận thông báo, nhưng khóa gửi của Hey Joy! chưa được Apple chấp nhận. Hãy cập nhật lại cặp khóa VAPID rồi thử lại.");
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
        await requestJson("/api/push/subscribe", {
          method: "POST",
          body: JSON.stringify(subscription.toJSON()),
        }).catch(() => {});
      }
    } catch {
      setButtonState("off");
    }
  }

  function ensureServiceWorker() {
    return navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).then(() => navigator.serviceWorker.ready);
  }

  function setButtonState(state) {
    const states = {
      on: ["✓", "Thông báo mưa đã bật", true],
      off: ["🔔", isIos && !isStandalone() ? "Thêm Hey Joy! vào Home Screen để bật thông báo" : "Bật thông báo mưa", false],
      busy: ["…", "Đang bật thông báo", false],
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