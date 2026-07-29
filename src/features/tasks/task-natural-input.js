(function installJoyNaturalReminderPreview(root) {
  const TIME_ZONE = "Asia/Ho_Chi_Minh";

  function removeTones(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  }

  function vietnamParts(timestamp) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]));

    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`,
    };
  }

  function dateAtVietnamTime(dateKey, time) {
    const parsed = Date.parse(`${dateKey}T${time}:00+07:00`);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function addDays(dateKey, days) {
    const midday = Date.parse(`${dateKey}T12:00:00+07:00`);
    return vietnamParts(midday + Number(days || 0) * 86_400_000).date;
  }

  function vietnamToday() {
    return vietnamParts(Date.now()).date;
  }

  function parseRelative(text, now) {
    const units = [
      { pattern: "phut|p|min|mins|minute|minutes", multiplier: 60_000, supportsHalf: false },
      { pattern: "tieng|gio|hour|hours|h", multiplier: 3_600_000, supportsHalf: true },
      { pattern: "ngay|day|days", multiplier: 86_400_000, supportsHalf: false },
    ];

    if (/\b(nua tieng|half an hour)\b/.test(text)) return now + 30 * 60_000;

    for (const unit of units) {
      const halfPattern = unit.supportsHalf ? "(?:\\s*(ruoi|and a half))?" : "";
      const after = new RegExp(`\\b(?:sau|in)\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:${unit.pattern})${halfPattern}\\b`);
      const before = new RegExp(`\\b(\\d+(?:[.,]\\d+)?)\\s*(?:${unit.pattern})${halfPattern}\\s*(?:nua|later|from now)\\b`);
      const match = text.match(after) || text.match(before);
      if (!match) continue;
      const amount = Number(String(match[1]).replace(",", "."));
      const halfUnit = unit.supportsHalf && Boolean(match[2]) ? 30 * 60_000 : 0;
      if (Number.isFinite(amount) && amount > 0) return now + amount * unit.multiplier + halfUnit;
    }

    return NaN;
  }

  function parseTime(text) {
    let match = text.match(/\b([01]?\d|2[0-3])\s*(?:h|gio|:)(?:\s*([0-5]?\d))?\s*(sang|chieu|toi|am|pm)?\b/);
    if (!match) match = text.match(/\b([1-9]|1[0-2])\s*(sang|chieu|toi|am|pm)\b/);
    if (!match) return "";

    let hour = Number(match[1]);
    let minute = 0;
    let daypart = "";
    if (match.length >= 4) {
      minute = match[2] && /^\d+$/.test(match[2]) ? Number(match[2]) : 0;
      daypart = match[3] || (match[2] && !/^\d+$/.test(match[2]) ? match[2] : "");
    } else {
      daypart = match[2] || "";
    }
    if (["chieu", "toi", "pm"].includes(daypart) && hour < 12) hour += 12;
    if (["sang", "am"].includes(daypart) && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return "";
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function parseDate(text) {
    const today = vietnamToday();
    if (/\b(hom nay|today)\b/.test(text)) return today;
    if (/\b(ngay mai|mai|tomorrow)\b/.test(text)) return addDays(today, 1);
    if (/\b(ngay kia|mot|day after tomorrow)\b/.test(text)) return addDays(today, 2);

    const explicit = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    if (explicit) {
      let year = Number(explicit[3] || today.slice(0, 4));
      if (year < 100) year += 2000;
      return `${year}-${String(Number(explicit[2])).padStart(2, "0")}-${String(Number(explicit[1])).padStart(2, "0")}`;
    }
    return "";
  }

  function parseWeekdays(text) {
    const patterns = [
      [1, /\b(thu 2|thu hai|monday)\b/],
      [2, /\b(thu 3|thu ba|tuesday)\b/],
      [3, /\b(thu 4|thu tu|wednesday)\b/],
      [4, /\b(thu 5|thu nam|thursday)\b/],
      [5, /\b(thu 6|thu sau|friday)\b/],
      [6, /\b(thu 7|thu bay|saturday)\b/],
      [7, /\b(chu nhat|sunday)\b/],
    ];
    return patterns.filter(([, pattern]) => pattern.test(text)).map(([day]) => day);
  }

  function parseNaturalPreview(rawText) {
    const original = String(rawText || "").trim();
    const text = removeTones(original.toLowerCase());
    if (!text) return null;

    const now = Date.now();
    const relativeDueAt = parseRelative(text, now);
    const daily = /\b(hang ngay|moi ngay|ngay nao cung|every day|daily)\b/.test(text);
    const weeklyWords = /\b(hang tuan|moi tuan|tuan nao cung|every week|weekly)\b/.test(text);
    const repeatDays = parseWeekdays(text);
    const weekly = weeklyWords || (/\b(moi|hang)\s+thu\b/.test(text) && repeatDays.length > 0);
    const repeatType = daily ? "daily" : weekly ? "weekly" : "once";

    let dueAt = relativeDueAt;
    if (!Number.isFinite(dueAt)) {
      const time = parseTime(text);
      let date = parseDate(text);
      if (time) {
        if (!date) {
          const todayCandidate = dateAtVietnamTime(vietnamToday(), time);
          date = todayCandidate > now ? vietnamToday() : addDays(vietnamToday(), 1);
        }
        dueAt = dateAtVietnamTime(date, time);
      }
    }

    const reminderIntent = /\b(nhac|remind|reminder)\b/.test(text)
      || Number.isFinite(relativeDueAt)
      || daily
      || weekly
      || (Boolean(parseTime(text)) && Boolean(parseDate(text)));

    if (!reminderIntent || !Number.isFinite(dueAt)) return null;
    return { dueAt, repeatType, repeatDays };
  }

  function setWeekdays(container, values) {
    const selected = new Set(values.map(Number));
    container?.querySelectorAll("[data-weekday]").forEach((button) => {
      const active = selected.has(Number(button.dataset.weekday));
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("active", active);
    });
  }

  function start() {
    const input = document.querySelector("#quick-task");
    const bell = document.querySelector("#joy-reminder-toggle");
    const composer = document.querySelector("#joy-reminder-composer");
    const dateInput = document.querySelector("#joy-reminder-date");
    const timeInput = document.querySelector("#joy-reminder-time");
    const repeatInput = document.querySelector("#joy-reminder-repeat");
    const weekdays = document.querySelector("#joy-reminder-weekdays");
    const hint = document.querySelector("#joy-reminder-hint");
    if (!input || !bell || !composer || !dateInput || !timeInput || !repeatInput || !hint) return;

    let timer = 0;
    let latest = null;

    const applyPreview = () => {
      latest = parseNaturalPreview(input.value);
      bell.classList.toggle("joy-natural-ready", Boolean(latest));
      bell.title = latest ? "Joy understood the reminder time" : "Add a reminder";
      if (!latest || composer.hidden) return;

      const values = vietnamParts(latest.dueAt);
      dateInput.value = values.date;
      timeInput.value = values.time;
      repeatInput.value = latest.repeatType;
      weekdays.hidden = latest.repeatType !== "weekly";
      setWeekdays(weekdays, latest.repeatDays);
      const repeatText = latest.repeatType === "daily"
        ? " · repeats every day"
        : latest.repeatType === "weekly" ? " · repeats weekly" : "";
      hint.textContent = `Joy understood: ${values.date.split("-").reverse().join("/")} · ${values.time}${repeatText}`;
    };

    input.addEventListener("input", () => {
      root.clearTimeout(timer);
      timer = root.setTimeout(applyPreview, 120);
    });

    bell.addEventListener("click", () => root.setTimeout(applyPreview, 0));
    applyPreview();
  }

  root.JoyNaturalReminderPreview = { parseNaturalPreview, parseRelative };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window);
