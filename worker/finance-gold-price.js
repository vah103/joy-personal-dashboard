import { json } from "./shared/http.js";
import { getSession } from "./shared/session.js";

export const FINANCE_GOLD_PRICE_ROUTE = "/api/finance/gold-price";
export const GOLD_PRICE_SOURCE_URL = "https://baotinmanhhai.vn/vi/bang-gia-vang";
export const GOLD_PRICE_PRODUCT = "Đồng vàng Kim Gia Bảo hoa sen";

const CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;

let cachedQuote = null;
let cachedAt = 0;

function decodeHtmlEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function htmlToVisibleText(html) {
  return decodeHtmlEntities(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>|<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function parseVnd(value) {
  const amount = Number(String(value || "").replace(/\D/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

export function extractBaoTinManhHaiGoldQuote(html) {
  const text = htmlToVisibleText(html);
  const haystack = text.normalize("NFC").toLocaleLowerCase("vi-VN");
  const needle = GOLD_PRICE_PRODUCT.normalize("NFC").toLocaleLowerCase("vi-VN");

  let cursor = 0;
  while (cursor < haystack.length) {
    const productIndex = haystack.indexOf(needle, cursor);
    if (productIndex === -1) break;

    const segment = text.slice(productIndex + GOLD_PRICE_PRODUCT.length, productIndex + GOLD_PRICE_PRODUCT.length + 700);
    const prices = [...segment.matchAll(/\b\d{1,3}(?:\.\d{3}){2,3}\b/g)]
      .map((match) => parseVnd(match[0]))
      .filter((amount) => amount >= 1_000_000 && amount <= 100_000_000);

    if (prices.length >= 2) {
      const updatedMatch = text.match(/Cập nhật lúc\s*([^\n]+?)(?=\s*(?:Đơn vị|$))/i);
      return {
        product: GOLD_PRICE_PRODUCT,
        sellPricePerChi: prices[0],
        buyPricePerChi: prices[1],
        updatedAtSource: updatedMatch?.[1]?.trim() || "",
        unit: "VND_PER_CHI",
        priceType: "buy",
      };
    }

    cursor = productIndex + needle.length;
  }

  throw new Error("BTMH_GOLD_PRICE_NOT_FOUND");
}

export function isFinanceGoldPriceRoute(pathname) {
  return pathname === FINANCE_GOLD_PRICE_ROUTE;
}

async function fetchLiveQuote() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GOLD_PRICE_SOURCE_URL, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.7",
        "User-Agent": "Mozilla/5.0 (compatible; JoyFinance/1.0; +https://app.hey-joy.workers.dev)",
      },
      signal: controller.signal,
      cf: {
        cacheEverything: true,
        cacheTtl: Math.floor(CACHE_TTL_MS / 1000),
      },
    });

    if (!response.ok) throw new Error(`BTMH_HTTP_${response.status}`);
    const quote = extractBaoTinManhHaiGoldQuote(await response.text());
    return {
      ...quote,
      source: "Bảo Tín Mạnh Hải",
      sourceUrl: GOLD_PRICE_SOURCE_URL,
      fetchedAt: Date.now(),
      stale: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getGoldQuote() {
  const now = Date.now();
  if (cachedQuote && now - cachedAt < CACHE_TTL_MS) return cachedQuote;

  try {
    cachedQuote = await fetchLiveQuote();
    cachedAt = now;
    return cachedQuote;
  } catch (error) {
    if (cachedQuote && now - cachedAt < STALE_TTL_MS) {
      return { ...cachedQuote, stale: true };
    }
    throw error;
  }
}

export async function handleFinanceGoldPriceRequest(request, env) {
  if (request.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    return json(await getGoldQuote());
  } catch (error) {
    console.error("Joy Finance gold price fetch failed", error);
    return json({ error: "GOLD_PRICE_UNAVAILABLE" }, 502);
  }
}
