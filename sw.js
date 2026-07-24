self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Thông báo mới", body: event.data?.text() || "Bạn có thông báo mới." };
  }

  const kind = String(data.data?.kind || "");
  const payloadTitle = typeof data.title === "string" ? data.title.trim() : "";
  let notificationTitle = payloadTitle
    .replace(/^Hey Joy!\s*(?:·|-)??\s*/i, "")
    .trim();

  if (kind === "test") notificationTitle = "Đã hoạt động";
  if (kind === "rain") notificationTitle = "Dự báo mưa mới";
  if (!notificationTitle) notificationTitle = "Thông báo mới";

  const notificationBody = kind === "test"
    ? "Thông báo trên iPhone đã hoạt động, hahahaa"
    : (data.body || "");

  event.waitUntil(self.registration.showNotification(notificationTitle, {
    body: notificationBody,
    icon: data.icon || "/app-icon-192.png",
    badge: data.badge || "/app-icon-64.png",
    tag: data.tag || "hey-joy-notification",
    renotify: Boolean(data.renotify),
    data: data.data || { url: "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing && "focus" in existing) {
      if ("navigate" in existing) existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  }));
});
