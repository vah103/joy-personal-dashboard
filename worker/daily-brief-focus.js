import {
  GOLD_PRICE_PRODUCT,
  GOLD_PRICE_SOURCE_URL,
  extractBaoTinManhHaiGoldQuote,
} from "./finance-gold-price.js";

const MARKET_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const SOURCE_LOOKBACK_MS = 36 * 60 * 60 * 1000;
const MAX_FOCUSED_STORIES = 12;
const GOLD_CHANGE_MIN_VND_PER_CHI = 100_000;
const GOLD_CHANGE_MIN_PERCENT = 0.6;
const BITCOIN_CHANGE_MIN_PERCENT = 3;
const MARKET_REFRESH_KEY = "last_focused_market_refresh";
const GOLD_SNAPSHOT_KEY = "focused_gold_snapshot";
const BITCOIN_SNAPSHOT_KEY = "focused_bitcoin_snapshot";
const BITCOIN_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_last_updated_at=true";
const BITCOIN_PAGE_URL = "https://www.coingecko.com/en/coins/bitcoin";

const GOLD_TOPIC = /\b(?:gold|bullion)\b|giá vàng|vàng miếng|vàng nhẫn|kim gia bảo/i;
const BITCOIN_TOPIC = /\b(?:bitcoin|btc)\b/i;
const PRICE_MOVEMENT = /\b(?:price|prices|rises?|rose|jumps?|jumped|gains?|gained|falls?|fell|drops?|dropped|slides?|slid|surges?|surged|plunges?|plunged|up|down|high|low|record)\b|giá|tăng|giảm|lên|xuống|biến động|kỷ lục|đỉnh|đáy/i;
const AI_TOPIC = /\b(?:ai|openai|chatgpt|gpt(?:-[a-z0-9.]+)?|llm|large language model|generative ai|anthropic|claude|gemini|deepseek|copilot|artificial intelligence|machine learning)\b|trí tuệ nhân tạo|mô hình ai|ai tạo sinh|học máy/i;
const AI_RELEASE = /\b(?:launch(?:es|ed)?|release(?:s|d)?|unveil(?:s|ed)?|introduc(?:es|ed|ing)|announce(?:s|d)?|rolls? out|update(?:s|d)?|upgrade(?:s|d)?|new model|new feature|new capability|api|multimodal|reasoning model|available now|open source)\b|ra mắt|phát hành|công bố|giới thiệu|triển khai|mô hình mới|tính năng mới|khả năng mới|cập nhật|nâng cấp|mã nguồn mở/i;
const ROBOT_TOPIC = /\b(?:robot|robotics|humanoid|android|cobot|drone|uav|autonomous mobile robot|amr|warehouse robot|industrial robot|robot dog|rover)\b|robot hình người|robot tự hành|robot công nghiệp|robot kho|chó robot|thiết bị bay không người lái/i;
const ROBOT_RELEASE = /\b(?:launch(?:es|ed)?|release(?:s|d)?|unveil(?:s|ed)?|introduc(?:es|ed|ing)|announce(?:s|d)?|prototype|new robot|new feature|new capability|can now|learns? to|open source|foundation stack|begins? testing|deployment|commercially available)\b|ra mắt|phát hành|công bố|giới thiệu|nguyên mẫu|robot mới|tính năng mới|khả năng mới|có thể|học được|mã nguồn mở|thử nghiệm|triển khai thương mại/i;

export function classifyFocusedStory(story) {
  const explicitCategory = String(story?.category || "").trim().toUpperCase();
  if (explicitCategory === "GOLD" || explicitCategory === "BITCOIN") {
    return explicitCategory;
  }

  const text = storyText(story);
  if (GOLD_TOPIC.test(text) && PRICE_MOVEMENT.test(text)) return "GOLD";
  if (BITCOIN_TOPIC.test(text) && PRICE_MOVEMENT.test(text)) return "BITCOIN";
  if (ROBOT_TOPIC.test(text) && ROBOT_RELEASE.test(text)) return "ROBOTICS";
  if (AI_TOPIC.test(text) && AI_RELEASE.test(text)) return "AI";
  return "";
}

export function focusDailyBriefPayload(payload) {
  const next = payload && typeof payload === "object" ? { ...payload } : {};
  const stories = Array.isArray(next.stories) ? next.stories : [];

  next.stories = stories
    .map((story) => {
      const category = classifyFocusedStory(story);
      if (!category) return null;
      return {
        ...story,
        editorialCategory: story.editorialCategory || story.category || "GENERAL",
        category,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (
      focusedPriority(right) - focusedPriority(left)
      || Number(right?.score || 0) - Number(left?.score || 0)
      || Number(right?.publishedAt || 0) - Number(left?.publishedAt || 0)
    ))
    .slice(0, MAX_FOCUSED_STORIES);

  next.focus = ["GOLD", "BITCOIN", "ROBOTICS", "AI"];
  return next;
}

export async function focusDailyBriefResponse(response) {
  const contentType = response?.headers?.get?.("Content-Type") || "";
  if (!response?.ok || !contentType.includes("application/json")) return response;

  const payload = focusDailyBriefPayload(await response.json());
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.delete("Content-Length");
  return new Response(JSON.stringify(payload), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function refreshFocusedMarketSignals(env, { force = false, useAi = false } = {}) {
  if (!env?.DB) return { skipped: true, reason: "storage-unavailable" };

  const now = Date.now();
  const lastRefresh = Number(await readMeta(env, MARKET_REFRESH_KEY) || 0);
  if (!force && now - lastRefresh < MARKET_REFRESH_INTERVAL_MS) {
    return { skipped: true, reason: "market-refresh-window" };
  }

  const [goldResult, bitcoinResult] = await Promise.allSettled([
    fetchGoldSnapshot(),
    fetchBitcoinSnapshot(),
  ]);
  const stories = [];
  const errors = [];

  if (goldResult.status === "fulfilled") {
    const previous = await readMetaJson(env, GOLD_SNAPSHOT_KEY);
    const current = goldResult.value;
    const story = buildGoldSignal(current, previous, now);
    await writeMetaJson(env, GOLD_SNAPSHOT_KEY, current, now);
    if (story) {
      await upsertStory(env, story, now);
      stories.push(story);
    }
  } else {
    errors.push("gold");
    console.error("Joy focused Daily Brief gold refresh failed", goldResult.reason);
  }

  if (bitcoinResult.status === "fulfilled") {
    const current = bitcoinResult.value;
    let cause = "";
    if (Math.abs(current.change24hPercent) >= BITCOIN_CHANGE_MIN_PERCENT && useAi) {
      cause = await inferBitcoinCause(env, current);
    }
    const story = buildBitcoinSignal(current, cause, now);
    await writeMetaJson(env, BITCOIN_SNAPSHOT_KEY, current, now);
    if (story) {
      await upsertStory(env, story, now);
      stories.push(story);
    }
  } else {
    errors.push("bitcoin");
    console.error("Joy focused Daily Brief Bitcoin refresh failed", bitcoinResult.reason);
  }

  await writeMeta(env, MARKET_REFRESH_KEY, String(now), now);
  return {
    skipped: false,
    stories: stories.map((story) => story.category),
    errors,
  };
}

export function buildGoldSignal(current, previous, now = Date.now()) {
  const currentBuy = Number(current?.buyPricePerChi || 0);
  const previousBuy = Number(previous?.buyPricePerChi || 0);
  if (!currentBuy || !previousBuy) return null;

  const delta = currentBuy - previousBuy;
  const percent = (delta / previousBuy) * 100;
  if (
    Math.abs(delta) < GOLD_CHANGE_MIN_VND_PER_CHI
    && Math.abs(percent) < GOLD_CHANGE_MIN_PERCENT
  ) return null;

  const direction = delta > 0 ? "tăng" : "giảm";
  const directionKey = delta > 0 ? "up" : "down";
  const publishedAt = Number(current.fetchedAt || now);
  const perLuongDelta = Math.abs(delta) * 10;

  return {
    id: `brief-gold-${localDay(publishedAt)}-${directionKey}`,
    title: `Giá vàng mua vào ${direction} ${formatVnd(Math.abs(delta))}/chỉ`,
    summary: `Giá mua vào ${GOLD_PRICE_PRODUCT} hiện ở ${formatVnd(currentBuy)}/chỉ, ${direction} ${formatPercent(Math.abs(percent))} so với lần ghi nhận trước.`,
    whyItMatters: `Mức thay đổi này tương đương khoảng ${formatVnd(perLuongDelta)} mỗi lượng, đủ lớn để theo dõi nhưng không phải khuyến nghị mua hoặc bán.`,
    keyPoints: [
      `Mua vào: ${formatVnd(currentBuy)}/chỉ`,
      `Bán ra: ${formatVnd(Number(current.sellPricePerChi || 0))}/chỉ`,
      current.updatedAtSource ? `Nguồn cập nhật: ${current.updatedAtSource}` : "Nguồn: Bảo Tín Mạnh Hải",
    ],
    category: "GOLD",
    scope: "VN",
    sourceName: "Bảo Tín Mạnh Hải",
    articleUrl: GOLD_PRICE_SOURCE_URL,
    sourceCount: 1,
    score: Math.min(100, Math.round(88 + Math.abs(percent) * 2)),
    publishedAt,
    expiresAt: publishedAt + STORY_TTL_MS,
  };
}

export function buildBitcoinSignal(snapshot, cause = "", now = Date.now()) {
  const priceUsd = Number(snapshot?.priceUsd || 0);
  const change = Number(snapshot?.change24hPercent);
  if (!priceUsd || !Number.isFinite(change) || Math.abs(change) < BITCOIN_CHANGE_MIN_PERCENT) {
    return null;
  }

  const direction = change > 0 ? "tăng" : "giảm";
  const directionKey = change > 0 ? "up" : "down";
  const publishedAt = Number(snapshot.updatedAt || now);
  const safeCause = cleanAndLimit(cause, 360);

  return {
    id: `brief-bitcoin-${localDay(publishedAt)}-${directionKey}`,
    title: `Bitcoin ${direction} ${formatPercent(Math.abs(change))} trong 24 giờ`,
    summary: `Bitcoin đang ở khoảng ${formatUsd(priceUsd)}, ${direction} ${formatPercent(Math.abs(change))} trong 24 giờ theo dữ liệu CoinGecko.`,
    whyItMatters: safeCause
      ? `Nguyên nhân khả dĩ: ${safeCause} Đây là suy luận từ các nguồn gần đây, không phải kết luận chắc chắn.`
      : "Chưa có đủ nguồn đáng tin cậy để xác định nguyên nhân; cần theo dõi dòng tiền, chính sách và tin thị trường liên quan.",
    keyPoints: [
      `Giá hiện tại: ${formatUsd(priceUsd)}`,
      `Biến động 24 giờ: ${change > 0 ? "+" : ""}${formatPercent(change)}`,
      safeCause ? "Nguyên nhân được ghi dưới dạng khả dĩ, không khẳng định." : "Chưa gán nguyên nhân khi thiếu bằng chứng nguồn.",
    ],
    category: "BITCOIN",
    scope: "WORLD",
    sourceName: "CoinGecko",
    articleUrl: BITCOIN_PAGE_URL,
    sourceCount: safeCause ? 2 : 1,
    score: Math.min(100, Math.round(90 + Math.abs(change))),
    publishedAt,
    expiresAt: publishedAt + STORY_TTL_MS,
  };
}

async function fetchGoldSnapshot() {
  const response = await fetchWithTimeout(GOLD_PRICE_SOURCE_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.7",
      "User-Agent": "Mozilla/5.0 (compatible; JoyDailyBrief/1.0; +https://app.hey-joy.workers.dev)",
    },
    cf: { cacheEverything: true, cacheTtl: 300 },
  });
  if (!response.ok) throw new Error(`BTMH_HTTP_${response.status}`);
  return {
    ...extractBaoTinManhHaiGoldQuote(await response.text()),
    fetchedAt: Date.now(),
  };
}

async function fetchBitcoinSnapshot() {
  const response = await fetchWithTimeout(BITCOIN_PRICE_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Hey Joy Daily Brief/1.0",
    },
    cf: { cacheEverything: true, cacheTtl: 300 },
  });
  if (!response.ok) throw new Error(`COINGECKO_HTTP_${response.status}`);
  const payload = await response.json();
  const bitcoin = payload?.bitcoin || {};
  const priceUsd = Number(bitcoin.usd || 0);
  const change24hPercent = Number(bitcoin.usd_24h_change);
  if (!priceUsd || !Number.isFinite(change24hPercent)) {
    throw new Error("COINGECKO_BITCOIN_INVALID");
  }
  return {
    priceUsd,
    change24hPercent,
    volume24hUsd: Number(bitcoin.usd_24h_vol || 0),
    updatedAt: Number(bitcoin.last_updated_at || 0) * 1000 || Date.now(),
  };
}

async function inferBitcoinCause(env, snapshot) {
  if (!env?.AI?.run) return "";
  const evidence = await readBitcoinEvidence(env);
  if (!evidence.length) return "";

  const schema = {
    type: "object",
    properties: {
      supported: { type: "boolean" },
      cause: { type: "string" },
    },
    required: ["supported", "cause"],
  };
  const notes = evidence.map((item, index) => [
    `[${index + 1}] ${item.sourceName}`,
    `TITLE: ${item.title}`,
    `SUMMARY: ${item.summary}`,
  ].join("\n")).join("\n\n");

  try {
    const result = await env.AI.run(env.DAILY_BRIEF_AI_MODEL || "@cf/meta/llama-3.2-3b-instruct", {
      messages: [
        {
          role: "system",
          content: `Explain one possible cause of a notable Bitcoin price movement using only the supplied recent news notes. Return supported=false and an empty cause when the notes do not support a cautious explanation. Never invent events, numbers, investor motives, or certainty. When supported, write one concise Vietnamese sentence and use cautious language such as "có thể liên quan đến" or "có khả năng phản ánh". Do not give trading advice.`,
        },
        {
          role: "user",
          content: `Bitcoin 24h change: ${snapshot.change24hPercent.toFixed(2)}%\nCurrent price: ${snapshot.priceUsd.toFixed(2)} USD\n\nRECENT NOTES:\n${notes}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 220,
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
    });
    const payload = typeof result?.response === "string"
      ? JSON.parse(result.response)
      : result?.response;
    return payload?.supported === true ? cleanAndLimit(payload.cause, 360) : "";
  } catch (error) {
    console.error("Joy focused Daily Brief Bitcoin cause inference failed", error);
    return "";
  }
}

async function readBitcoinEvidence(env) {
  const result = await env.DB.prepare(`
    SELECT title, summary, source_name, published_at
    FROM daily_brief_stories
    WHERE published_at >= ?
      AND COALESCE(category, '') <> 'BITCOIN'
      AND (
        lower(title) LIKE '%bitcoin%'
        OR lower(summary) LIKE '%bitcoin%'
        OR lower(title) LIKE '%crypto%'
        OR lower(summary) LIKE '%crypto%'
      )
    ORDER BY score DESC, published_at DESC
    LIMIT 6
  `).bind(Date.now() - SOURCE_LOOKBACK_MS).all();

  return (result.results || []).map((row) => ({
    title: String(row.title || ""),
    summary: String(row.summary || ""),
    sourceName: String(row.source_name || "Source"),
    publishedAt: Number(row.published_at || 0),
  })).filter((item) => item.title && item.summary);
}

async function upsertStory(env, story, now) {
  await env.DB.prepare(`
    INSERT INTO daily_brief_stories (
      id, title, summary, why_it_matters, key_points_json, category, scope,
      source_name, article_url, source_count, score, published_at, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      why_it_matters = excluded.why_it_matters,
      key_points_json = excluded.key_points_json,
      category = excluded.category,
      scope = excluded.scope,
      source_name = excluded.source_name,
      article_url = excluded.article_url,
      source_count = excluded.source_count,
      score = excluded.score,
      published_at = excluded.published_at,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at
  `).bind(
    story.id,
    story.title,
    story.summary,
    story.whyItMatters,
    JSON.stringify(story.keyPoints || []),
    story.category,
    story.scope,
    story.sourceName,
    story.articleUrl,
    Number(story.sourceCount || 1),
    Number(story.score || 0),
    Number(story.publishedAt || now),
    now,
    Number(story.expiresAt || now + STORY_TTL_MS),
  ).run();
}

async function readMeta(env, key) {
  const row = await env.DB.prepare(
    "SELECT value FROM daily_brief_meta WHERE key = ?",
  ).bind(key).first();
  return row?.value ?? "";
}

async function readMetaJson(env, key) {
  try {
    const value = await readMeta(env, key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

async function writeMetaJson(env, key, value, now) {
  await writeMeta(env, key, JSON.stringify(value), now);
}

async function writeMeta(env, key, value, now) {
  await env.DB.prepare(`
    INSERT INTO daily_brief_meta (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).bind(key, value, now).run();
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function focusedPriority(story) {
  const category = String(story?.category || "").toUpperCase();
  if (category === "GOLD") return 420;
  if (category === "BITCOIN") return 410;
  if (category === "AI") return 320;
  if (category === "ROBOTICS") return 310;
  return 0;
}

function storyText(story) {
  return [
    story?.title,
    story?.summary,
    story?.whyItMatters,
    ...(Array.isArray(story?.keyPoints) ? story.keyPoints : []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function formatVnd(value) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} ₫`;
}

function formatUsd(value) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0))} USD`;
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value || 0))}%`;
}

function localDay(timestamp) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function cleanAndLimit(value, maxLength) {
  const text = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/[\s,.;:!?-]+\S*$/, "").trim()}…`;
}
