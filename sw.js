self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Hey Joy!", body: event.data?.text() || "Bạn có thông báo mới." };
  }

  event.waitUntil(self.registration.showNotification(data.title || "Hey Joy!", {
    body: data.body || "",
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
