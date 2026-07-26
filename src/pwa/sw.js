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
  if (["rain", "dry", "chill", "sunny"].includes(kind)) notificationTitle = "Weather update";
  if (kind === "task-reminder") notificationTitle = "Task reminder";
  if (kind === "focus-reminder") notificationTitle = "Focus reminder";
  if (!notificationTitle) notificationTitle = "Thông báo mới";

  const notificationBody = kind === "test"
    ? "Thông báo trên iPhone đã hoạt động, hahahaa"
    : (data.body || "");

  event.waitUntil(self.registration.showNotification(notificationTitle, {
    body: notificationBody,
    icon: data.icon || "/joy-blue-icon.png?v=joy-topographic-blue-v1",
    badge: data.badge || "/joy-blue-icon.png?v=joy-topographic-blue-v1",
    tag: data.tag || "hey-joy-notification",
    renotify: Boolean(data.renotify),
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 3) : [],
    data: data.data || { url: "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  const notificationData = event.notification.data || {};
  const kind = String(notificationData.kind || "");
  const action = String(event.action || "");
  event.notification.close();

  if (kind === "task-reminder" && action && notificationData.taskId) {
    event.waitUntil(fetch("/api/task-reminders/action", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: notificationData.taskId, action }),
    }).catch(() => null));
    return;
  }

  const targetUrl = new URL(notificationData.url || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing && "focus" in existing) {
      if ("navigate" in existing) existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  }));
});
