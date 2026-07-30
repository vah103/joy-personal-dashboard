function renderHeader() {
  const now = new Date();
  const hour = now.getHours();
  const daypart = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  elements.todayLabel.textContent = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  elements.greeting.textContent = `Good ${daypart}, Vanh.`;
}

function weatherDetails(code) {
  if (code === 0) return { label: "Clear sky", icon: "☀" };
  if (code === 1) return { label: "Mostly clear", icon: "☀" };
  if (code === 2) return { label: "Partly cloudy", icon: "☁" };
  if (code === 3) return { label: "Overcast", icon: "☁" };
  if ([45, 48].includes(code)) return { label: "Foggy", icon: "≋" };
  if (code >= 51 && code <= 57) return { label: "Light drizzle", icon: "☂" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", icon: "☂" };
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return { label: "Snow", icon: "❄" };
  if (code >= 95) return { label: "Thunderstorm", icon: "ϟ" };
  return { label: "Current weather", icon: "◌" };
}

async function loadWeather() {
  try {
    const response = await window.fetch(WEATHER_ENDPOINT, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
    const payload = await response.json();
    const current = payload?.current;
    const temperature = Number(current?.temperature_2m);
    const apparent = Number(current?.apparent_temperature);
    const code = Number(current?.weather_code);
    if (!Number.isFinite(temperature) || !Number.isFinite(code)) throw new Error("Weather data is incomplete");

    const details = weatherDetails(code);
    elements.weatherTemperature.textContent = `${Math.round(temperature)}°`;
    elements.weatherIcon.textContent = details.icon;
    elements.weatherCondition.textContent = Number.isFinite(apparent)
      ? `${details.label} · Feels ${Math.round(apparent)}°`
      : details.label;

    const rainSummary = window.JoyWeather?.summarizeRainForecast(
      payload?.hourly,
      new Date(),
    ) || {
      state: "unavailable",
      text: "Rain forecast unavailable",
    };

    const showRainNotice = rainSummary.state === "rain";

    elements.weatherRainNotice.hidden = !showRainNotice;
    elements.weatherRainNotice.textContent = rainSummary.text;
    elements.weatherRainNotice.dataset.state = rainSummary.state;
  } catch {
    elements.weatherTemperature.textContent = "—";
    elements.weatherIcon.textContent = "◌";
    elements.weatherCondition.textContent = "Weather unavailable";
    elements.weatherRainNotice.hidden = true;
    elements.weatherRainNotice.textContent = "";
    elements.weatherRainNotice.dataset.state = "unavailable";
  }
}

function isEmailPinned(id) {
  return state.gmailPinnedIds.includes(String(id));
}

function sortGmailMessages(messages) {
  return [...messages].sort((a, b) => {
    const aIndex = state.gmailPinnedIds.indexOf(String(a.id));
    const bIndex = state.gmailPinnedIds.indexOf(String(b.id));
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    return 0;
  });
}

function renderBrief() {
  const dueCount = state.tasks.filter((task) => !task.done).length;
  const taskLabel = `${dueCount} open ${dueCount === 1 ? "task" : "tasks"}`;
  let emailLabel = "Gmail not connected";
  if (["authorizing", "loading-messages"].includes(gmail.status)) emailLabel = "checking Gmail";
  if (gmail.status === "connected") {
    const count = gmail.messages.filter((message) => message.unread).length;
    emailLabel = count ? `${count} new ${count === 1 ? "email" : "emails"}` : "no new email";
  }
  const viewingCount = sales.status === "ready" ? sales.viewings.length : 0;
  const viewingLabel = sales.status === "ready"
    ? `${viewingCount} upcoming ${viewingCount === 1 ? "viewing" : "viewings"}`
    : "sales awaiting sync";
  elements.brief.innerHTML = `You have <strong>${viewingLabel}</strong>, <strong>${taskLabel}</strong>, and <strong>${emailLabel}</strong>.`;
}

function makeButton(label, action, className = "secondary-button") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function renderGmailNotice({ icon = "G", title, copy, buttonLabel, action, error = false }) {
  const card = document.createElement("div");
  card.className = `gmail-connect${error ? " gmail-connect-error" : ""}`;

  const badge = document.createElement("span");
  badge.className = "gmail-brand";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = icon;

  const heading = document.createElement("h3");
  heading.textContent = title;

  const description = document.createElement("p");
  description.textContent = copy;

  card.append(badge, heading, description);
  if (buttonLabel && action) card.append(makeButton(buttonLabel, action, "primary-button gmail-connect-button"));

  const privacy = document.createElement("small");
  privacy.textContent = "Read-only access · Joy cannot send or delete email";
  card.append(privacy);
  elements.email.replaceChildren(card);
}

function senderName(from) {
  const withoutAddress = String(from || "Unknown sender").replace(/\s*<[^>]+>\s*$/, "").replace(/^"|"$/g, "").trim();
  return withoutAddress || String(from || "Unknown sender").split("@")[0];
}

function senderInitials(name) {
  const words = String(name).split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)[0]}` : words[0]?.slice(0, 2) || "?").toUpperCase();
}

function formatEmailDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
  return new Intl.DateTimeFormat("en-US", sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric" }).format(date);
}

function renderGmailMessage(message) {
  const article = document.createElement("article");
  article.className = "gmail-message";
  article.classList.toggle("pinned", isEmailPinned(message.id));

  const avatar = document.createElement("div");
  avatar.className = "sender-avatar";
  avatar.textContent = senderInitials(message.sender);

  const copy = document.createElement("div");
  copy.className = "email-copy";

  const meta = document.createElement("div");
  meta.className = "email-meta";
  const sender = document.createElement("strong");
  sender.textContent = message.sender;
  const time = document.createElement("time");
  time.dateTime = message.date || "";
  time.textContent = formatEmailDate(message.date);
  meta.append(sender, time);

  const subject = document.createElement("h3");
  subject.textContent = message.subject || "(No subject)";
  const snippet = document.createElement("p");
  snippet.textContent = message.snippet || "No preview available.";

  const open = document.createElement("a");
  open.className = "gmail-message-link";
  open.href = `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(message.threadId)}`;
  open.target = "_blank";
  open.rel = "noopener noreferrer";
  open.textContent = "Open ↗";

  const messageActions = document.createElement("div");
  messageActions.className = "gmail-message-actions";

  const pinned = isEmailPinned(message.id);
  const pin = makeButton("", "toggle-email-pin", "gmail-square-button gmail-pin-button");
  pin.dataset.emailId = message.id;
  pin.setAttribute("aria-pressed", String(pinned));
  pin.setAttribute("aria-label", pinned ? "Unpin email" : "Pin email");
  pin.title = pinned ? "Remove pin" : "Keep this email at the top";
  pin.innerHTML = `<svg class="gmail-pin-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path class="gmail-pin-head" d="M9 3.5h6v4l2.5 2.5v1.5h-11V10L9 7.5Z"></path>
    <path d="M12 11.5V21"></path>
  </svg>`;

  const read = makeButton("", "dismiss-email", "gmail-square-button gmail-read-button");
  read.dataset.emailId = message.id;
  read.setAttribute("aria-label", "Done with this email");
  read.title = "Đã đọc · remove from Joy";

  messageActions.append(open, pin, read);

  copy.append(meta, subject, snippet, messageActions);
  article.append(avatar, copy);
  return article;
}

function renderEmail() {
  if (gmail.status === "sdk-loading") {
    renderGmailNotice({ icon: "…", title: "Loading Gmail", copy: "Joy is checking the secure connection." });
    return;
  }

  if (gmail.status === "authorizing") {
    renderGmailNotice({ icon: "…", title: "Waiting for Google", copy: "Choose the Gmail account you want Joy to read." });
    return;
  }

  if (gmail.status === "loading-messages") {
    renderGmailNotice({ icon: "↻", title: "Checking for new mail", copy: "Joy is looking only for email received after tracking started." });
    return;
  }

  if (gmail.status === "error") {
    renderGmailNotice({
      icon: "!",
      title: "Gmail could not connect",
      copy: gmail.error || "Please try connecting again.",
      buttonLabel: "Try again",
      action: "connect-gmail",
      error: true,
    });
    return;
  }

  if (gmail.status !== "connected") {
    renderGmailNotice({
      title: CLOUD_BACKEND ? "Connect Gmail once" : "Connect your Gmail",
      copy: CLOUD_BACKEND
        ? "Joy will only surface email that arrives after tracking starts."
        : "Joy will show up to five new inbox messages received from now on.",
      buttonLabel: CLOUD_BACKEND ? "Connect once" : "Connect Gmail",
      action: "connect-gmail",
    });
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "gmail-inbox";
  const toolbar = document.createElement("div");
  toolbar.className = "gmail-toolbar";
  const status = document.createElement("div");
  status.className = "gmail-status";
  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  const statusCopy = document.createElement("strong");
  statusCopy.textContent = gmail.messages.length
    ? `${CLOUD_BACKEND ? "Auto · " : ""}${gmail.messages.length} new ${gmail.messages.length === 1 ? "message" : "messages"}`
    : `${CLOUD_BACKEND ? "Auto · " : ""}No new mail`;
  status.append(dot, statusCopy);

  const actions = document.createElement("div");
  actions.className = "gmail-actions";
  actions.append(makeButton("Refresh", "refresh-gmail", "gmail-action"));
  actions.append(makeButton("Disconnect", "disconnect-gmail", "gmail-action"));
  toolbar.append(status, actions);
  wrapper.append(toolbar);

  if (gmail.messages.length) {
    const list = document.createElement("div");
    list.className = "gmail-list";
    sortGmailMessages(gmail.messages).forEach((message) => list.append(renderGmailMessage(message)));
    wrapper.append(list);
  } else {
    const empty = document.createElement("div");
    empty.className = "empty-state gmail-empty";
    const check = document.createElement("span");
    check.textContent = "✓";
    const title = document.createElement("strong");
    title.textContent = "No new mail";
    const copy = document.createElement("p");
    copy.textContent = "Joy will show only email received after tracking started.";
    empty.append(check, title, copy);
    wrapper.append(empty);
  }

  elements.email.replaceChildren(wrapper);
}
