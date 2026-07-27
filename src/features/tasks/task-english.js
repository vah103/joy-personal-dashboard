(function installJoyTaskEnglish(root) {
  const CACHE_KEY = "joy-task-english-cache-v3";
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
    if (exact[normalized]) return exact[normalized];

    const toothpaste = normalized.match(/^mua kem danh rang\s+(.+)$/);
    if (toothpaste) {
      const originalBrand = original.split(/\s+/).slice(4).join(" ");
      return `Buy ${titleCase(originalBrand || toothpaste[1])} toothpaste.`;
    }

    const study = normalized.match(/^(?:hoc|on)\s+(.+)$/);
    if (study) {
      const tail = original.replace(/^\s*(?:học|ôn)\s+/i, "");
      if (tail && !looksVietnamese(tail)) return sentence(`Study ${tail}`);
    }

    return original;
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

      form.setAttribute("aria-busy", "true");
      input.readOnly = true;
      if (submitter) {
        submitter.disabled = true;
        submitter.textContent = "…";
        submitter.title = "Joy is writing this task in natural English";
      }

      const title = await rewrite(original);

      input.readOnly = wasReadOnly;
      form.removeAttribute("aria-busy");
      if (submitter) {
        submitter.disabled = false;
        submitter.textContent = originalButtonText;
        submitter.removeAttribute("title");
      }
      busy = false;

      if (looksVietnamese(title)) {
        input.value = original;
        input.focus();
        showStatus("Joy could not translate this task yet · it was not added");
        return;
      }

      input.value = title || original;
      input.dispatchEvent(new Event("input", { bubbles: true }));

      bypassNextSubmit = true;
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit(submitter || undefined);
      } else {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    }, true);
  }

  root.JoyTaskEnglish = { rewrite, fallbackEnglish };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window);
