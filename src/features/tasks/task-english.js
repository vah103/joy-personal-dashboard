(function installJoyTaskEnglish(root) {
  const CACHE_KEY = "joy-task-english-cache-v4";
  const REQUEST_TIMEOUT_MS = 15_000;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function removeTones(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  }

  function looksVietnamese(value) {
    const text = ` ${clean(value).toLowerCase()} `;
    return /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i.test(text)
      || /\b(?:ăn|uống|mua|học|làm|gọi|đi|đọc|viết|hoàn thành|nhắc|giặt|phơi|quần áo|nước giặt|kem đánh răng|hôm nay|ngày mai)\b/i.test(text);
  }

  function sentence(value) {
    const text = clean(value).replace(/[.!?]+$/, "");
    return text ? `${text[0].toUpperCase()}${text.slice(1)}.` : "";
  }

  function titleCase(value) {
    const text = clean(value);
    return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
  }

  function fallbackEnglish(value) {
    const original = clean(value);
    const normalized = removeTones(original.toLowerCase()).replace(/[.!?]+$/, "");
    const actionOnly = normalized
      .replace(/\d+(?:[.,]\d+)?\s*(?:phut|p|min|mins|minute|minutes|tieng|gio|hour|hours|h)(?:\s*ruoi)?\s*(?:nua|later|from now)?/gi, " ")
      .replace(/(?:nhac\s+(?:toi|me)|hang ngay|moi ngay|every day|daily|hang tuan|moi tuan|every week|weekly)/gi, " ")
      .replace(/(?:hom nay|ngay mai|mai|ngay kia|mot|today|tomorrow)/gi, " ")
      .replace(/\b(?:vao|luc|at|on)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const exact = {
      "an com": "Eat a meal.",
      "uong nuoc": "Drink water.",
      "phoi quan ao": "Hang the clothes out to dry.",
      "giat quan ao": "Do the laundry.",
      "mua nuoc giat": "Buy laundry detergent.",
      "mua kem danh rang": "Buy toothpaste.",
      "di ngu": "Go to sleep.",
      "don phong": "Clean the room.",
      "don nha": "Clean the house.",
      "tap gym": "Work out at the gym.",
      "tap the duc": "Exercise.",
    };
    if (exact[actionOnly] || exact[normalized]) return exact[actionOnly] || exact[normalized];

    const toothpaste = actionOnly.match(/^mua kem danh rang\s+(.+)$/);
    if (toothpaste) {
      const originalBrand = cleanReminderTitle(original).split(/\s+/).slice(4).join(" ");
      return `Buy ${titleCase(originalBrand || toothpaste[1])} toothpaste.`;
    }

    const study = actionOnly.match(/^(?:hoc|on)\s+(.+)$/);
    if (study) {
      const cleanedOriginal = cleanReminderTitle(original);
      const tail = cleanedOriginal.replace(/^\s*(?:học|ôn)\s+/i, "");
      if (tail && !looksVietnamese(tail)) return sentence(`Study ${tail}`);
    }

    return original;
  }

  function cleanReminderTitle(text) {
    const title = String(text || "")
      .replace(/\d+(?:[.,]\d+)?\s*(?:phút|phut|p|min|mins|minute|minutes|tiếng|tieng|giờ|gio|hour|hours|h)(?:\s*(?:rưỡi|ruoi))?\s*(?:nữa|nua|later|from now)?/gi, " ")
      .replace(/(?:nhắc|nhac|remind)\s+(?:tôi|toi|me)\s*/gi, " ")
      .replace(/(?:hằng ngày|hang ngay|mỗi ngày|moi ngay|every day|daily|hằng tuần|hang tuan|mỗi tuần|moi tuan|every week|weekly)/gi, " ")
      .replace(/(?:hôm nay|hom nay|ngày mai|ngay mai|mai|ngày kia|ngay kia|mốt|mot|today|tomorrow)/gi, " ")
      .replace(/(?:thứ\s*[2-7]|thu\s*[2-7]|thứ hai|thu hai|thứ ba|thu ba|thứ tư|thu tu|thứ năm|thu nam|thứ sáu|thu sau|thứ bảy|thu bay|chủ nhật|chu nhat|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi, " ")
      .replace(/([01]?\d|2[0-3])\s*(?:h|giờ|gio|:)(?:\s*[0-5]?\d)?\s*(?:sáng|sang|chiều|chieu|tối|toi|am|pm)?/gi, " ")
      .replace(/([1-9]|1[0-2])\s*(?:sáng|sang|chiều|chieu|tối|toi|am|pm)/gi, " ")
      .replace(/(?:^|\s)(?:vào|vao|lúc|luc|at|on)(?=\s|$)/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "")
      .trim();
    return title || clean(text);
  }

  function hasReminderIntent(text) {
    const plain = removeTones(String(text || "").toLowerCase());
    return /\b(nhac|remind|reminder|hang ngay|moi ngay|every day|daily|hang tuan|moi tuan|every week|weekly)\b/.test(plain)
      || /\b\d+(?:[.,]\d+)?\s*(?:phut|p|min|mins|minute|minutes|tieng|gio|hour|hours|h)(?:\s*ruoi)?\s*(?:nua|later|from now)\b/.test(plain)
      || /\b(?:hom nay|ngay mai|mai|ngay kia|today|tomorrow|thu [2-7]|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(plain)
      || /\b(?:[01]?\d|2[0-3])\s*(?:h|gio|:)(?:\s*[0-5]?\d)?\s*(?:sang|chieu|toi|am|pm)?\b/.test(plain);
  }

  function replaceAction(original, action, translated) {
    const source = String(original || "");
    const target = String(action || "");
    const index = source.toLocaleLowerCase("vi").indexOf(target.toLocaleLowerCase("vi"));
    if (index < 0) return translated;
    return `${source.slice(0, index)}${translated}${source.slice(index + target.length)}`
      .replace(/\s+/g, " ")
      .trim();
  }

  function prepareSubmission(original) {
    const composerOpen = document.querySelector("#joy-reminder-toggle")?.getAttribute("aria-expanded") === "true";
    const reminderIntent = composerOpen || hasReminderIntent(original);
    if (!reminderIntent) {
      return { taskText: original, rebuild: (translated) => translated };
    }

    const taskText = cleanReminderTitle(original);
    return {
      taskText,
      rebuild: composerOpen
        ? (translated) => translated
        : (translated) => replaceAction(original, taskText, translated),
    };
  }

  function readCache() {
    try {
      const parsed = JSON.parse(root.sessionStorage.getItem(CACHE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeCache(cache) {
    try {
      const entries = Object.entries(cache).slice(-60);
      root.sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Translation still works when storage is unavailable.
    }
  }

  function showStatus(message) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    root.setTimeout(() => {
      if (toast.textContent === message) toast.hidden = true;
    }, 3200);
  }

  async function rewrite(text) {
    const original = clean(text);
    if (!original) return original;

    const cache = readCache();
    if (cache[original]) return cache[original];

    const controller = new AbortController();
    const timeout = root.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await root.fetch("/api/tasks/english", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: original }),
        signal: controller.signal,
      });
      if (!response.ok) {
        console.warn("Joy task English request failed", response.status);
        return fallbackEnglish(original);
      }

      const payload = await response.json();
      const aiTitle = clean(payload?.title);
      const title = aiTitle && aiTitle.length <= 500 ? aiTitle : fallbackEnglish(original);
      const finalTitle = looksVietnamese(title) ? fallbackEnglish(original) : title;

      if (finalTitle && !looksVietnamese(finalTitle)) {
        cache[original] = finalTitle;
        writeCache(cache);
      }
      return finalTitle || original;
    } catch (error) {
      console.warn("Joy task English rewrite was unavailable", error);
      return fallbackEnglish(original);
    } finally {
      root.clearTimeout(timeout);
    }
  }

  function start() {
    const form = document.querySelector("#quick-add-form");
    const input = document.querySelector("#quick-task");
    if (!form || !input) return;

    let busy = false;
    let bypassNextSubmit = false;

    form.addEventListener("submit", async (event) => {
      if (bypassNextSubmit) {
        bypassNextSubmit = false;
        return;
      }

      const original = clean(input.value);
      if (!original || busy) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      busy = true;

      const submitter = event.submitter || form.querySelector('button[type="submit"]');
      const originalButtonText = submitter?.textContent || "";
      const wasReadOnly = input.readOnly;
      const plan = prepareSubmission(original);

      form.setAttribute("aria-busy", "true");
      input.readOnly = true;
      if (submitter) {
        submitter.disabled = true;
        submitter.textContent = "…";
        submitter.title = "Joy is writing this task in natural English";
      }

      const translatedTask = await rewrite(plan.taskText);

      input.readOnly = wasReadOnly;
      form.removeAttribute("aria-busy");
      if (submitter) {
        submitter.disabled = false;
        submitter.textContent = originalButtonText;
        submitter.removeAttribute("title");
      }
      busy = false;

      if (looksVietnamese(translatedTask)) {
        input.value = original;
        input.focus();
        showStatus("Joy could not translate this task yet · it was not added");
        return;
      }

      input.value = plan.rebuild(translatedTask);
      input.dispatchEvent(new Event("input", { bubbles: true }));

      bypassNextSubmit = true;
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit(submitter || undefined);
      } else {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    }, true);
  }

  root.JoyTaskEnglish = { rewrite, fallbackEnglish, prepareSubmission };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window);
