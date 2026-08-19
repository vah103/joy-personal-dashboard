const APP_SHELL_VERSION = "__JOY_BUILD_VERSION__";
const UI_LOCALE_CACHE = "joy-ui-locale-v1";
const UI_LOCALE_REQUEST = "/__joy/ui-locale";
const UI_LOCALE_MESSAGE = "JOY_UI_LOCALE";

const NOTIFICATION_COPY = Object.freeze({
  en: Object.freeze({
    notification: "New notification",
    test: "Working",
    testBody: "iPhone notifications are working, hahahaa",
    weather: "Weather update",
    task: "Task reminder",
    focus: "Focus reminder",
    saleReminder: "Upcoming room viewing",
    saleFollowup: "Room viewing follow-up",
    complete: "Complete",
    tenMinutes: "10 min",
    oneHour: "1 hour",
  }),
  vi: Object.freeze({
    notification: "Thông báo mới",
    test: "Đã hoạt động",
    testBody: "Thông báo trên iPhone đã hoạt động, hahahaa",
    weather: "Cập nhật thời tiết",
    task: "Nhắc công việc",
    focus: "Nhắc tập trung",
    saleReminder: "Lịch xem phòng sắp tới",
    saleFollowup: "Theo dõi khách xem phòng",
    complete: "Hoàn thành",
    tenMinutes: "10 phút",
    oneHour: "1 giờ",
  }),
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(windows.map(async (client) => {
      if (!("navigate" in client)) return;
      try {
        const url = new URL(client.url);
        if (url.origin !== self.location.origin) return;
        if (url.searchParams.get("joy-app-version") === APP_SHELL_VERSION) return;
        url.searchParams.set("joy-app-version", APP_SHELL_VERSION);
        await client.navigate(url.href);
      } catch (error) {
        console.warn("Hey Joy could not refresh an older app window", error);
      }
    }));
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== UI_LOCALE_MESSAGE) return;
  const locale = ["en", "vi"].includes(event.data?.locale) ? event.data.locale : "en";
  event.waitUntil?.(storeUiLocale(locale));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "", body: event.data?.text() || "" };
  }

  event.waitUntil(showPushNotification(data));
});

async function storeUiLocale(locale) {
  try {
    const cache = await caches.open(UI_LOCALE_CACHE);
    await cache.put(UI_LOCALE_REQUEST, new Response(locale, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }));
  } catch (error) {
    console.warn("Hey Joy could not persist notification locale", error);
  }
}

async function readUiLocale() {
  try {
    const cache = await caches.open(UI_LOCALE_CACHE);
    const response = await cache.match(UI_LOCALE_REQUEST);
    const locale = String(await response?.text() || "").trim();
    if (["en", "vi"].includes(locale)) return locale;
  } catch {
    // English is the repository-wide fallback when no saved locale is available.
  }
  return "en";
}

function localizedTitle(kind, payloadTitle, copy) {
  if (kind === "test") return copy.test;
  if (["rain", "dry", "chill", "sunny"].includes(kind)) return copy.weather;
  if (kind === "task-reminder") return copy.task;
  if (kind === "focus-reminder") return copy.focus;
  if (kind === "sale-viewing-reminder") return copy.saleReminder;
  if (kind === "sale-viewing-followup") return copy.saleFollowup;

  const cleaned = String(payloadTitle || "")
    .trim()
    .replace(/^Hey Joy!\s*(?:·|-)??\s*/i, "")
    .trim();
  return cleaned || copy.notification;
}

function localizeSaleFollowupBody(body, locale) {
  const source = String(body || "").trim();
  const vi = source.match(/^(.+?) đã xem phòng tại (.+?)\. Bạn đã follow-up khách chưa\?$/u);
  if (vi) {
    return locale === "en"
      ? `${vi[1]} viewed the room at ${vi[2]}. Have you followed up with the customer?`
      : source;
  }

  const en = source.match(/^(.+?) viewed the room at (.+?)\. Have you followed up with the customer\?$/u);
  if (en) {
    return locale === "vi"
      ? `${en[1]} đã xem phòng tại ${en[2]}. Bạn đã follow-up khách chưa?`
      : source;
  }
  return source;
}

function localizeActions(actions, copy) {
  return (Array.isArray(actions) ? actions : []).map((action) => {
    const next = { ...action };
    if (next.action === "complete") next.title = copy.complete;
    if (next.action === "snooze10") next.title = copy.tenMinutes;
    if (next.action === "snooze60") next.title = copy.oneHour;
    return next;
  });
}

async function showPushNotification(data) {
  const locale = await readUiLocale();
  const copy = NOTIFICATION_COPY[locale] || NOTIFICATION_COPY.en;
  const kind = String(data.data?.kind || "");
  const notificationTitle = localizedTitle(kind, data.title, copy);

  let notificationBody = kind === "test"
    ? copy.testBody
    : String(data.body || "");
  if (kind === "sale-viewing-followup") {
    notificationBody = localizeSaleFollowupBody(notificationBody, locale);
  }

  const options = {
    body: notificationBody,
    icon: data.icon || "/joy-blue-icon.png?v=joy-topographic-blue-v1",
    badge: data.badge || "/joy-blue-icon.png?v=joy-topographic-blue-v1",
    tag: data.tag || "hey-joy-notification",
    renotify: Boolean(data.renotify),
    silent: false,
    data: data.data || { url: "/" },
  };

  // iOS currently exposes no notification action buttons. Passing actions there can
  // make showNotification reject entirely, so only include them when supported.
  const maxActions = Number(self.Notification?.maxActions || 0);
  if (maxActions > 0 && Array.isArray(data.actions) && data.actions.length) {
    options.actions = localizeActions(data.actions, copy).slice(0, maxActions);
  }

  try {
    await self.registration.showNotification(notificationTitle, options);
  } catch (error) {
    console.warn("Hey Joy notification options were not fully supported", error);
    delete options.actions;
    await self.registration.showNotification(notificationTitle, options);
  }

  if (!["task-reminder", "focus-reminder"].includes(kind)) return;
  const deliveryAttemptAt = Number(data.data?.deliveryAttemptAt);
  if (!Number.isFinite(deliveryAttemptAt) || deliveryAttemptAt <= 0) return;

  await fetch("/api/task-reminders/delivery-ack", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      deliveryAttemptAt,
      ...(data.data?.taskId ? { taskId: String(data.data.taskId) } : {}),
    }),
  }).catch((error) => {
    console.warn("Hey Joy could not confirm reminder delivery", error);
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
