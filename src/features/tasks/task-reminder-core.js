(function registerJoyTaskReminderCore(root) {
  const TIME_ZONE = "Asia/Ho_Chi_Minh";
  const TASK_STORAGE_KEY = "joy-dashboard-todos-v1";
  const REMINDER_STORAGE_KEY = "joy-dashboard-task-reminders-v1";

  function create({ weekdays = [] } = {}) {
    function parseNaturalTask(rawText) {
      const original = String(rawText || "").trim();
      const plain = removeTones(original.toLowerCase());
      const reminderWords = /\b(nhac|remind|reminder)\b/.test(plain);
      const daily = /\b(hang ngay|moi ngay|ngay nao cung|every day|daily)\b/.test(plain);
      const weekly = /\b(hang tuan|moi tuan|tuan nao cung|every week|weekly)\b/.test(plain);
      const repeatType = daily ? "daily" : weekly ? "weekly" : "once";
      const repeatDays = parseWeekdays(plain);

      const relative = parseRelativeMinutes(plain);
      let dueAt = Number.isFinite(relative) ? Date.now() + relative * 60_000 : NaN;
      let dateKey = parseNaturalDate(plain);
      const time = parseNaturalTime(plain);
      if (!Number.isFinite(dueAt) && time) {
        if (!dateKey) {
          const candidate = scheduleTimestamp(vietnamDateKey(), time);
          dateKey = candidate > Date.now() ? vietnamDateKey() : addVietnamDays(vietnamDateKey(), 1);
        }
        dueAt = scheduleTimestamp(dateKey, time);
      }

      if (!Number.isFinite(dueAt) && repeatType !== "once" && time) {
        dueAt = scheduleTimestamp(dateKey || vietnamDateKey(), time);
        if (dueAt <= Date.now()) dueAt += 24 * 60 * 60 * 1000;
      }

      const vagueTime = /\b(ti nua|lat nua|chieu|toi nay|this evening|later)\b/.test(plain) && !time && !Number.isFinite(relative);
      const intent = reminderWords
        || daily
        || weekly
        || Number.isFinite(relative)
        || Boolean(time && (dateKey || /\b(hom nay|mai|mot|today|tomorrow|thu|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(plain)))
        || vagueTime;

      return {
        intent,
        complete: intent && Number.isFinite(dueAt),
        dueAt,
        repeatType,
        repeatDays,
        title: cleanNaturalTitle(original),
      };
    }

    function parseRelativeMinutes(text) {
      if (/\b(nua tieng|half an hour)\b/.test(text)) return 30;
      let match = text.match(/(\d+(?:[.,]\d+)?)\s*(phut|p|min|mins|minute|minutes)\s*(nua|later|from now)?/);
      if (match && /\b(nua|later|from now)\b/.test(match[0])) return Math.round(Number(match[1].replace(",", ".")));
      match = text.match(/(\d+(?:[.,]\d+)?)\s*(tieng|gio|hour|hours|h)\s*(ruoi)?\s*(nua|later|from now)?/);
      if (match && /\b(nua|later|from now)\b/.test(match[0])) {
        return Math.round(Number(match[1].replace(",", ".")) * 60 + (match[3] ? 30 : 0));
      }
      return NaN;
    }

    function parseNaturalTime(text) {
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

    function parseNaturalDate(text) {
      if (/\b(hom nay|today)\b/.test(text)) return vietnamDateKey();
      if (/\b(ngay mai|mai|tomorrow)\b/.test(text)) return addVietnamDays(vietnamDateKey(), 1);
      if (/\b(ngay kia|mot|day after tomorrow)\b/.test(text)) return addVietnamDays(vietnamDateKey(), 2);

      const explicit = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
      if (explicit) {
        const nowYear = Number(vietnamDateKey().slice(0, 4));
        let year = Number(explicit[3] || nowYear);
        if (year < 100) year += 2000;
        return `${year}-${String(Number(explicit[2])).padStart(2, "0")}-${String(Number(explicit[1])).padStart(2, "0")}`;
      }

      const weekdayPatterns = [
        [1, /\b(thu 2|thu hai|monday)\b/],
        [2, /\b(thu 3|thu ba|tuesday)\b/],
        [3, /\b(thu 4|thu tu|wednesday)\b/],
        [4, /\b(thu 5|thu nam|thursday)\b/],
        [5, /\b(thu 6|thu sau|friday)\b/],
        [6, /\b(thu 7|thu bay|saturday)\b/],
        [7, /\b(chu nhat|sunday)\b/],
      ];
      const matched = weekdayPatterns.find(([, pattern]) => pattern.test(text));
      return matched ? nextWeekdayDate(matched[0]) : "";
    }

    function parseWeekdays(text) {
      const result = [];
      const patterns = [
        [1, /\b(thu 2|thu hai|monday)\b/],
        [2, /\b(thu 3|thu ba|tuesday)\b/],
        [3, /\b(thu 4|thu tu|wednesday)\b/],
        [4, /\b(thu 5|thu nam|thursday)\b/],
        [5, /\b(thu 6|thu sau|friday)\b/],
        [6, /\b(thu 7|thu bay|saturday)\b/],
        [7, /\b(chu nhat|sunday)\b/],
      ];
      patterns.forEach(([day, pattern]) => { if (pattern.test(text)) result.push(day); });
      return result;
    }

    function cleanNaturalTitle(text) {
      let title = String(text || "")
        .replace(/\b(nhắc|nhac|remind)\s+(tôi|toi|me)\s*/gi, "")
        .replace(/\b(hằng ngày|hang ngay|mỗi ngày|moi ngay|every day|daily|hằng tuần|hang tuan|mỗi tuần|moi tuan|every week|weekly)\b/gi, "")
        .replace(/\b(hôm nay|hom nay|ngày mai|ngay mai|mai|ngày kia|ngay kia|mốt|mot|today|tomorrow)\b/gi, "")
        .replace(/\b(thứ\s*[2-7]|thu\s*[2-7]|thứ hai|thu hai|thứ ba|thu ba|thứ tư|thu tu|thứ năm|thu nam|thứ sáu|thu sau|thứ bảy|thu bay|chủ nhật|chu nhat|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
        .replace(/\b\d+(?:[.,]\d+)?\s*(phút|phut|p|min|mins|minute|minutes|tiếng|tieng|giờ|gio|hour|hours|h)(?:\s*rưỡi|\s*ruoi)?\s*(nữa|nua|later|from now)?\b/gi, "")
        .replace(/\b([01]?\d|2[0-3])\s*(h|giờ|gio|:)(?:\s*[0-5]?\d)?\s*(sáng|sang|chiều|chieu|tối|toi|am|pm)?\b/gi, "")
        .replace(/\b([1-9]|1[0-2])\s*(sáng|sang|chiều|chieu|tối|toi|am|pm)\b/gi, "")
        .replace(/\b(vào|vao|lúc|luc|at|on)\b/gi, " ")
        .replace(/\s+/g, " ")
        .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "")
        .trim();
      return title || String(text || "").trim();
    }

    function reminderLabel(meta) {
      const due = effectiveDue(meta);
      const state = reminderState(meta);
      const time = formatTime(due);
      if (meta.snoozedUntil && Date.parse(meta.snoozedUntil) > Date.now()) return `⏰ Snoozed until ${formatFullDateTime(due)}`;
      if (meta.repeatType === "daily") return `↻ Every day · ${time}`;
      if (meta.repeatType === "weekly") {
        const days = (meta.repeatDays || []).map((day) => weekdays[day - 1]?.label.slice(0, 3)).filter(Boolean).join(", ");
        return `↻ ${days || "Every week"} · ${time}`;
      }
      if (state === "overdue") return `⚠ Overdue · ${formatFullDateTime(due)}`;
      return `🔔 ${friendlyDate(due)} · ${time}`;
    }

    function reminderState(meta) {
      if (meta.snoozedUntil && Date.parse(meta.snoozedUntil) > Date.now()) return "snoozed";
      if (meta.repeatType === "once" && effectiveDue(meta) < Date.now()) return "overdue";
      if (meta.repeatType !== "once") return "repeating";
      return "scheduled";
    }

    function effectiveDue(meta) {
      const snoozed = Date.parse(meta?.snoozedUntil || "");
      return Number.isFinite(snoozed) && snoozed > Date.now() ? snoozed : Date.parse(meta?.dueAt || "");
    }

    function normalizeLocalReminder(value) {
      return {
        taskId: String(value?.taskId || ""),
        dueAt: new Date(Date.parse(value?.dueAt || "") || Date.now()).toISOString(),
        repeatType: ["daily", "weekly"].includes(value?.repeatType) ? value.repeatType : "once",
        repeatDays: [...new Set((value?.repeatDays || []).map(Number).filter((day) => day >= 1 && day <= 7))].sort((a, b) => a - b),
        notificationEnabled: value?.notificationEnabled !== false,
        snoozedUntil: value?.snoozedUntil || null,
        lastNotifiedAt: value?.lastNotifiedAt || null,
        status: String(value?.status || "scheduled"),
        dirty: Boolean(value?.dirty),
        updatedAt: value?.updatedAt || new Date().toISOString(),
      };
    }

    function reminderToRequest(meta) {
      return {
        taskId: meta.taskId,
        dueAt: meta.dueAt,
        repeatType: meta.repeatType,
        repeatDays: meta.repeatDays,
        notificationEnabled: meta.notificationEnabled,
      };
    }

    function readReminderStore() {
      try {
        const value = JSON.parse(root.localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
        const list = Array.isArray(value) ? value : Object.values(value || {});
        return new Map(list.map(normalizeLocalReminder).filter((item) => item.taskId).map((item) => [item.taskId, item]));
      } catch {
        return new Map();
      }
    }

    function writeReminderStore(store) {
      root.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify([...store.values()]));
    }

    function saveLocalReminder(store, value) {
      const meta = normalizeLocalReminder(value);
      store.set(meta.taskId, meta);
      writeReminderStore(store);
      return meta;
    }

    function readTasks() {
      try {
        const tasks = JSON.parse(root.localStorage.getItem(TASK_STORAGE_KEY) || "[]");
        return Array.isArray(tasks) ? tasks : [];
      } catch {
        return [];
      }
    }

    function saveTasks(tasks) {
      root.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
    }

    function findTask(taskId) {
      return readTasks().find((task) => String(task?.id) === String(taskId));
    }

    function updateLocalTask(taskId, patch) {
      saveTasks(readTasks().map((task) => String(task?.id) === String(taskId) ? { ...task, ...patch } : task));
    }

    async function request(path, options = {}) {
      const headers = new Headers(options.headers || {});
      if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      const response = await root.fetch(path, { ...options, headers, credentials: "same-origin" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || `REQUEST_FAILED_${response.status}`);
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    function defaultSchedule() {
      const now = Date.now();
      const next = new Date(Math.ceil((now + 10 * 60_000) / (30 * 60_000)) * 30 * 60_000);
      return vietnamInputParts(next.getTime());
    }

    function scheduleTimestamp(date, time) {
      const parsed = Date.parse(`${date}T${time}:00+07:00`);
      return Number.isFinite(parsed) ? parsed : NaN;
    }

    function vietnamInputParts(timestamp) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date(timestamp)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
      return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
    }

    function vietnamDateKey(value = new Date()) {
      return vietnamInputParts(value instanceof Date ? value.getTime() : value).date;
    }

    function addVietnamDays(dateKey, days) {
      const timestamp = Date.parse(`${dateKey}T12:00:00+07:00`) + Number(days) * 24 * 60 * 60 * 1000;
      return vietnamDateKey(timestamp);
    }

    function nextWeekdayDate(targetDay) {
      const today = vietnamDateKey();
      const current = new Date(`${today}T12:00:00+07:00`).getUTCDay();
      const currentIso = current === 0 ? 7 : current;
      let delta = targetDay - currentIso;
      if (delta < 0) delta += 7;
      return addVietnamDays(today, delta);
    }

    function endOfVietnamDay(timestamp) {
      const date = vietnamDateKey(timestamp);
      return Date.parse(`${date}T23:59:59.999+07:00`);
    }

    function friendlyDate(timestamp) {
      const date = vietnamDateKey(timestamp);
      const today = vietnamDateKey();
      if (date === today) return "Today";
      if (date === addVietnamDays(today, 1)) return "Tomorrow";
      return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "2-digit", month: "short" }).format(new Date(timestamp));
    }

    function formatTime(timestamp) {
      return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(timestamp));
    }

    function formatFullDateTime(timestamp) {
      return `${friendlyDate(timestamp)} · ${formatTime(timestamp)}`;
    }

    function removeTones(value) {
      return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
    }

    function createId() {
      return root.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    return Object.freeze({
      parseNaturalTask,
      reminderLabel,
      reminderState,
      effectiveDue,
      normalizeLocalReminder,
      reminderToRequest,
      readReminderStore,
      writeReminderStore,
      saveLocalReminder,
      readTasks,
      saveTasks,
      findTask,
      updateLocalTask,
      request,
      defaultSchedule,
      scheduleTimestamp,
      vietnamInputParts,
      vietnamDateKey,
      endOfVietnamDay,
      formatFullDateTime,
      createId,
    });
  }

  root.JoyTaskReminderCore = Object.freeze({ create });
})(window);
