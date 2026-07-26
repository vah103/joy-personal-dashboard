self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    event.waitUntil(showPendingServerNotifications());
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Thông báo mới", body: event.data.text() || "Bạn có thông báo mới." };
  }

  event.waitUntil(showPayloadNotification(data));
});

async function showPendingServerNotifications() {
  try {
    const response = await fetch("/api/reminder-delivery/pending", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`PENDING_REMINDERS_${response.status}`);
    const payload = await response.json();
    const notifications = Array.isArray(payload.notifications) ? payload.notifications : [];

    if (!notifications.length) {
      await self.registration.showNotification("Push từ server đã hoạt động", {
        body: "Hey Joy! đã nhận được tín hiệu trực tiếp từ Cloudflare.",
        icon: "/joy-blue-icon.png?v=joy-topographic-blue-v1",
        badge: "/joy-blue-icon.png?v=joy-topographic-blue-v1",
        tag: `hey-joy-server-test-${Date.now()}`,
        data: { url: "/", kind: "test" },
      });
      return;
    }

    for (const notification of notifications) {
      const kind = String(notification.kind || "");
      const options = {
        body: String(notification.body || ""),
        icon: "/app-icon-192.png",
        badge: "/app-icon-64.png",
        tag: String(notification.tag || `hey-joy-${kind}`),
        renotify: kind === "task-reminder",
        data: {
          url: String(notification.url || "/"),
          kind,
          ...(notification.taskId ? { taskId: String(notification.taskId) } : {}),
        },
      };

      const maxActions = Number(self.Notification?.maxActions || 0);
      if (kind === "task-reminder" && maxActions > 0) {
        options.actions = [
          { action: "complete", title: "Complete" },
          { action: "snooze10", title: "10 min" },
          { action: "snooze60", title: "1 hour" },
        ].slice(0, maxActions);
      }

      await self.registration.showNotification(
        String(notification.title || (kind === "focus-reminder" ? "Focus reminder" : "Task reminder")),
        options,
      );

      await fetch("/api/reminder-delivery/ack", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          ...(notification.taskId ? { taskId: String(notification.taskId) } : {}),
        }),
      }).catch(() => null);
    }
  } catch (error) {
    console.warn("Hey Joy could not load pending reminders after a server wake", error);
    await self.registration.showNotification("Joy đã nhận tín hiệu từ server", {
      body: "Không tải được nội dung reminder. Hãy mở Joy để đồng bộ lại.",
      icon: "/joy-blue-icon.png?v=joy-topographic-blue-v1",
      badge: "/joy-blue-icon.png?v=joy-topographic-blue-v1",
      tag: `hey-joy-wake-error-${Date.now()}`,
      data: { url: "/#to-do", kind: "test" },
    });
  }
}

async function showPayloadNotification(data) {
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

  const options = {
    body: notificationBody,
    icon: data.icon || "/joy-blue-icon.png?v=joy-topographic-blue-v1",
    badge: data.badge || "/joy-blue-icon.png?v=joy-topographic-blue-v1",
    tag: data.tag || "hey-joy-notification",
    renotify: Boolean(data.renotify),
    data: data.data || { url: "/" },
  };

  const maxActions = Number(self.Notification?.maxActions || 0);
  if (maxActions > 0 && Array.isArray(data.actions) && data.actions.length) {
    options.actions = data.actions.slice(0, maxActions);
  }

  return self.registration.showNotification(notificationTitle, options).catch((error) => {
    console.warn("Hey Joy notification options were not fully supported", error);
    delete options.actions;
    return self.registration.showNotification(notificationTitle, options);
  });
}

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
