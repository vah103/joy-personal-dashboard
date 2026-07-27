(function installJoyTaskEnglish(root) {
  const CACHE_KEY = "joy-task-english-cache-v2";
  const REQUEST_TIMEOUT_MS = 12_000;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function looksVietnamese(value) {
    const text = ` ${clean(value).toLowerCase()} `;
    return /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i.test(text)
      || /\b(?:ăn|uống|mua|học|làm|gọi|đi|đọc|viết|hoàn thành|nhắc|giặt|phơi|quần áo|nước giặt|kem đánh răng|hôm nay|ngày mai)\b/i.test(text);
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
        return original;
      }

      const payload = await response.json();
      const title = clean(payload?.title);
      if (!title || title.length > 500) return original;

      const changed = payload?.changed === true || title !== original;
      if (changed || !looksVietnamese(original)) {
        cache[original] = title;
        writeCache(cache);
      }
      return title;
    } catch (error) {
      console.warn("Joy task English rewrite was unavailable", error);
      return original;
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

      form.setAttribute("aria-busy", "true");
      input.readOnly = true;
      if (submitter) {
        submitter.disabled = true;
        submitter.textContent = "…";
        submitter.title = "Joy is writing this task in natural English";
      }

      const title = await rewrite(original);

      input.value = title || original;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.readOnly = wasReadOnly;
      form.removeAttribute("aria-busy");
      if (submitter) {
        submitter.disabled = false;
        submitter.textContent = originalButtonText;
        submitter.removeAttribute("title");
      }
      busy = false;

      bypassNextSubmit = true;
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit(submitter || undefined);
      } else {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    }, true);
  }

  root.JoyTaskEnglish = { rewrite };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window);
