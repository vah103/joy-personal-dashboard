import { json } from "./shared/http.js";

const DAILY_BRIEF_PATH = "/api/daily-brief";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const SOURCE_LOOKBACK_MS = 36 * 60 * 60 * 1000;
const MAX_AI_CANDIDATES = 24;
const MAX_ACTIVE_STORIES = 18;
const DEFAULT_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const FEEDS = [
  {
    name: "VnExpress",
    scope: "VN",
    category: "GENERAL",
    url: "https://vnexpress.net/rss/tin-moi-nhat.rss",
    priority: 22,
  },
  {
    name: "VnExpress Kinh doanh",
    scope: "VN",
    category: "ECONOMY",
    url: "https://vnexpress.net/rss/kinh-doanh.rss",
    priority: 24,
  },
  {
    name: "VnExpress Thế giới",
    scope: "WORLD",
    category: "POLITICS",
    url: "https://vnexpress.net/rss/the-gioi.rss",
    priority: 23,
  },
  {
    name: "VnExpress Công nghệ",
    scope: "VN",
    category: "TECH",
    url: "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss",
    priority: 23,
  },
  {
    name: "BBC World",
    scope: "WORLD",
    category: "POLITICS",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    priority: 25,
  },
  {
    name: "BBC Business",
    scope: "WORLD",
    category: "ECONOMY",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    priority: 25,
  },
  {
    name: "BBC Technology",
    scope: "WORLD",
    category: "TECH",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    priority: 25,
  },
];

const HIGH_IMPACT_TERMS = [
  "government", "parliament", "president", "prime minister", "election", "central bank",
  "interest rate", "inflation", "gdp", "recession", "sanction", "war", "ceasefire",
  "cyberattack", "data breach", "artificial intelligence", "ai model", "semiconductor",
  "regulation", "law", "policy", "tariff", "trade deal", "merger", "acquisition",
  "chính phủ", "quốc hội", "chủ tịch nước", "thủ tướng", "bầu cử", "ngân hàng trung ương",
  "lãi suất", "lạm phát", "tăng trưởng", "suy thoái", "trừng phạt", "chiến tranh", "ngừng bắn",
  "tấn công mạng", "rò rỉ dữ liệu", "trí tuệ nhân tạo", "bán dẫn", "quy định", "luật",
  "chính sách", "thuế quan", "hiệp định", "sáp nhập", "mua lại",
];

const MEDIUM_IMPACT_TERMS = [
  "market", "stock", "currency", "oil", "gold", "jobs", "unemployment", "budget",
  "startup", "cloud", "robot", "chip", "privacy", "platform", "launches", "releases",
  "thị trường", "chứng khoán", "tỷ giá", "dầu", "vàng", "việc làm", "thất nghiệp", "ngân sách",
  "khởi nghiệp", "đám mây", "robot", "chip", "quyền riêng tư", "nền tảng", "ra mắt",
];

const LOW_VALUE_TERMS = [
  "football", "tennis", "celebrity", "movie", "music", "recipe", "travel tips", "horoscope",
  "review", "deal", "discount", "shopping", "lottery", "viral", "fashion", "beauty",
  "bóng đá", "quần vợt", "ngôi sao", "ca sĩ", "diễn viên", "phim", "âm nhạc", "công thức",
  "du lịch", "tử vi", "đánh giá", "khuyến mãi", "mua sắm", "xổ số", "thời trang", "làm đẹp",
];

export function isDailyBriefRoute(pathname) {
  return pathname === DAILY_BRIEF_PATH;
}

export async function handleDailyBriefRequest(request, env, ctx) {
  if (request.method !== "GET") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET" });
  }

  const now = Date.now();
  let lastRefresh = await getLastRefresh(env);
  let stale = now - lastRefresh >= REFRESH_INTERVAL_MS;
  let stories = await listActiveStories(env, now);

  if (!stories.length) {
    try {
      await refreshDailyBrief(env, { force: true });
      lastRefresh = await getLastRefresh(env);
      stale = Date.now() - lastRefresh >= REFRESH_INTERVAL_MS;
      stories = await listActiveStories(env, Date.now());
    } catch (error) {
      console.error("Joy Daily Brief first refresh failed", error);
    }
  } else if (stale && ctx) {
    ctx.waitUntil(refreshDailyBrief(env).catch((error) => {
      console.error("Joy Daily Brief background refresh failed", error);
    }));
  }

  return json({
    stories,
    updatedAt: lastRefresh || now,
    expiresAfterHours: 24,
    stale,
  }, 200, {
    "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
  });
}

export async function runDailyBriefSchedule(env) {
  await refreshDailyBrief(env);
}

export async function refreshDailyBrief(env, { force = false } = {}) {
  const now = Date.now();
  const lastRefresh = await getLastRefresh(env);
  if (!force && now - lastRefresh < REFRESH_INTERVAL_MS) return { skipped: true };

  await env.DB.prepare("DELETE FROM daily_brief_stories WHERE expires_at <= ?")
    .bind(now)
    .run();

  const feedResults = await Promise.allSettled(FEEDS.map(fetchFeed));
  const candidates = feedResults
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((story) => story.publishedAt >= now - SOURCE_LOOKBACK_MS)
    .filter((story) => story.heuristicScore >= 42);

  const clustered = clusterCandidates(candidates)
    .sort((a, b) => b.heuristicScore - a.heuristicScore || b.publishedAt - a.publishedAt)
    .slice(0, MAX_AI_CANDIDATES);

  const reviewed = await reviewWithAi(clustered, env);
  const approved = reviewed
    .filter((story) => story.approved && story.score >= 70)
    .sort((a, b) => b.score - a.score || b.publishedAt - a.publishedAt)
    .slice(0, MAX_ACTIVE_STORIES);

  if (approved.length) {
    const statements = approved.map((story) => env.DB.prepare(`
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
      story.sourceCount,
      story.score,
      story.publishedAt,
      now,
      Math.max(now, story.publishedAt) + STORY_TTL_MS,
    ));
    await env.DB.batch(statements);
  }

  await setLastRefresh(env, now);
  return { skipped: false, fetched: candidates.length, approved: approved.length };
}

async function getLastRefresh(env) {
  const row = await env.DB.prepare(
    "SELECT value FROM daily_brief_meta WHERE key = 'last_refresh'",
  ).first();
  return Number(row?.value || 0);
}

async function setLastRefresh(env, value) {
  await env.DB.prepare(`
    INSERT INTO daily_brief_meta (key, value, updated_at)
    VALUES ('last_refresh', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).bind(String(value), value).run();
}

async function listActiveStories(env, now) {
  const result = await env.DB.prepare(`
    SELECT id, title, summary, why_it_matters, key_points_json, category, scope,
      source_name, article_url, source_count, score, published_at, expires_at
    FROM daily_brief_stories
    WHERE expires_at > ?
    ORDER BY score DESC, published_at DESC
    LIMIT ?
  `).bind(now, MAX_ACTIVE_STORIES).all();

  return (result.results || []).map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    whyItMatters: row.why_it_matters,
    keyPoints: safeJsonArray(row.key_points_json),
    category: row.category,
    scope: row.scope,
    sourceName: row.source_name,
    articleUrl: row.article_url,
    sourceCount: Number(row.source_count || 1),
    score: Number(row.score || 0),
    publishedAt: Number(row.published_at || 0),
    expiresAt: Number(row.expires_at || 0),
  }));
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
      "User-Agent": "Hey Joy Daily Brief/1.0",
    },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!response.ok) throw new Error(`${feed.name} returned ${response.status}`);
  const xml = await response.text();
  return parseFeed(xml, feed);
}

function parseFeed(xml, feed) {
  const blocks = [
    ...String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...String(xml).matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ].map((match) => match[0]);

  return blocks.slice(0, 30).map((block) => {
    const title = cleanText(extractTag(block, "title"));
    const description = cleanText(
      extractTag(block, "description")
      || extractTag(block, "summary")
      || extractTag(block, "content:encoded")
      || extractTag(block, "content"),
    );
    const link = extractLink(block);
    const publishedAt = parseDate(
      extractTag(block, "pubDate")
      || extractTag(block, "published")
      || extractTag(block, "updated")
      || extractTag(block, "dc:date"),
    );
    const combined = `${title} ${description}`.toLowerCase();
    return {
      id: "",
      title,
      description: description.slice(0, 520),
      articleUrl: link,
      sourceName: feed.name,
      sourceCount: 1,
      relatedSources: [feed.name],
      category: inferCategory(combined, feed.category),
      scope: feed.scope,
      publishedAt,
      heuristicScore: heuristicScore({ title, description, publishedAt }, feed),
    };
  }).filter((story) => story.title && story.articleUrl && Number.isFinite(story.publishedAt));
}

function extractTag(block, tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(block).match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match?.[1] || "";
}

function extractLink(block) {
  const textLink = extractTag(block, "link");
  if (textLink) return decodeXml(textLink.trim());
  const href = String(block).match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
  return href ? decodeXml(href) : "";
}

function cleanText(value) {
  return decodeXml(String(value || "")
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function decodeXml(value) {
  const entities = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  };
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);
}

function parseDate(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function heuristicScore(story, feed) {
  const now = Date.now();
  const ageHours = Math.max(0, (now - story.publishedAt) / 3_600_000);
  const text = `${story.title} ${story.description}`.toLowerCase();
  let score = feed.priority;
  score += Math.max(0, 22 - ageHours * 1.2);
  score += termHits(text, HIGH_IMPACT_TERMS) * 9;
  score += Math.min(12, termHits(text, MEDIUM_IMPACT_TERMS) * 4);
  score -= termHits(text, LOW_VALUE_TERMS) * 18;
  if (story.title.length < 25) score -= 5;
  if (story.description.length >= 90) score += 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function termHits(text, terms) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function inferCategory(text, fallback) {
  if (/\b(ai|artificial intelligence|technology|tech|software|cyber|chip|semiconductor|robot|cloud)\b|công nghệ|trí tuệ nhân tạo|bán dẫn|tấn công mạng|robot/i.test(text)) return "TECH";
  if (/\b(economy|business|market|inflation|interest rate|bank|trade|tariff|stock|currency|oil|gold)\b|kinh tế|kinh doanh|lạm phát|lãi suất|ngân hàng|chứng khoán|tỷ giá|thuế quan/i.test(text)) return "ECONOMY";
  if (/\b(government|election|president|prime minister|parliament|war|sanction|diplomatic)\b|chính phủ|bầu cử|tổng thống|thủ tướng|quốc hội|chiến tranh|ngoại giao/i.test(text)) return "POLITICS";
  return ["TECH", "ECONOMY", "POLITICS"].includes(fallback) ? fallback : "GENERAL";
}

function clusterCandidates(candidates) {
  const sorted = [...candidates].sort((a, b) => b.heuristicScore - a.heuristicScore || b.publishedAt - a.publishedAt);
  const clusters = [];

  for (const candidate of sorted) {
    const tokens = titleTokens(candidate.title);
    const existing = clusters.find((cluster) => similarity(tokens, cluster.tokens) >= 0.52);
    if (!existing) {
      clusters.push({ ...candidate, tokens, relatedSources: [candidate.sourceName], sourceCount: 1 });
      continue;
    }
    existing.relatedSources = [...new Set([...existing.relatedSources, candidate.sourceName])];
    existing.sourceCount = existing.relatedSources.length;
    existing.heuristicScore = Math.min(100, existing.heuristicScore + (candidate.sourceName !== existing.sourceName ? 6 : 1));
    if (candidate.description.length > existing.description.length) existing.description = candidate.description;
  }

  return clusters.map(({ tokens, ...story }) => story);
}

function titleTokens(title) {
  const stop = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are", "và", "của", "cho", "trong", "với", "tại", "là", "có", "một"]);
  return new Set(String(title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((token) => token.length > 2 && !stop.has(token)));
}

function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach((token) => { if (b.has(token)) intersection += 1; });
  return intersection / Math.min(a.size, b.size);
}

async function reviewWithAi(candidates, env) {
  if (!candidates.length) return [];
  if (!env.AI) return candidates.map(fallbackReview);

  const schema = {
    type: "object",
    properties: {
      stories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            approved: { type: "boolean" },
            score: { type: "integer", minimum: 0, maximum: 100 },
            category: { type: "string", enum: ["TECH", "POLITICS", "ECONOMY", "GENERAL"] },
            scope: { type: "string", enum: ["VN", "WORLD"] },
            summary: { type: "string" },
            whyItMatters: { type: "string" },
            keyPoints: { type: "array", items: { type: "string" }, maxItems: 3 },
          },
          required: ["index", "approved", "score", "category", "scope", "summary", "whyItMatters", "keyPoints"],
        },
      },
    },
    required: ["stories"],
  };

  const candidateText = candidates.map((story, index) => [
    `[${index}]`,
    `SOURCE: ${story.sourceName}`,
    `SCOPE: ${story.scope}`,
    `CATEGORY_HINT: ${story.category}`,
    `PUBLISHED: ${new Date(story.publishedAt).toISOString()}`,
    `TITLE: ${story.title}`,
    `DESCRIPTION: ${story.description || "(none)"}`,
    `CORROBORATING_SOURCES: ${story.sourceCount}`,
  ].join("\n")).join("\n\n");

  const messages = [
    {
      role: "system",
      content: `You are the senior editor for a tiny personal daily brief. Select only genuinely important, consequential news in technology, politics, and economics, covering Vietnam and the world. Reject entertainment, sport, lifestyle, routine corporate promotion, minor product launches, opinion-only pieces, and clickbait. Do not approve a story merely to fill space. Base every word strictly on the supplied title and description. If the supplied information is insufficient to summarize safely, reject it. Write concise natural Vietnamese. Summary: one sentence, ideally 14-24 words. WhyItMatters: one sentence, ideally 12-22 words. Key points: zero to three short factual bullets. Score 70+ only for stories worth interrupting a busy reader for.`,
    },
    {
      role: "user",
      content: candidateText,
    },
  ];

  try {
    const result = await env.AI.run(env.DAILY_BRIEF_AI_MODEL || DEFAULT_AI_MODEL, {
      messages,
      temperature: 0.1,
      max_tokens: 2600,
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
    });
    const payload = typeof result?.response === "string" ? JSON.parse(result.response) : result?.response;
    const decisions = new Map((payload?.stories || []).map((item) => [Number(item.index), item]));
    return candidates.map((story, index) => mergeReview(story, decisions.get(index)));
  } catch (error) {
    console.error("Joy Daily Brief AI review failed", error);
    return candidates.map(fallbackReview);
  }
}

function mergeReview(story, decision) {
  const reviewed = decision && typeof decision === "object" ? decision : {};
  const score = Math.max(0, Math.min(100, Math.round(Number(reviewed.score ?? story.heuristicScore))));
  return {
    ...story,
    id: storyId(story.articleUrl || story.title),
    approved: Boolean(reviewed.approved) && score >= 70,
    score,
    category: ["TECH", "POLITICS", "ECONOMY", "GENERAL"].includes(reviewed.category) ? reviewed.category : story.category,
    scope: reviewed.scope === "VN" ? "VN" : "WORLD",
    summary: concise(reviewed.summary || story.description || story.title, 180),
    whyItMatters: concise(reviewed.whyItMatters || defaultWhy(story.category), 180),
    keyPoints: Array.isArray(reviewed.keyPoints) ? reviewed.keyPoints.map((item) => concise(item, 150)).filter(Boolean).slice(0, 3) : [],
  };
}

function fallbackReview(story) {
  const approved = story.heuristicScore >= 72 && !LOW_VALUE_TERMS.some((term) => `${story.title} ${story.description}`.toLowerCase().includes(term));
  return {
    ...story,
    id: storyId(story.articleUrl || story.title),
    approved,
    score: story.heuristicScore,
    summary: concise(story.description || story.title, 180),
    whyItMatters: defaultWhy(story.category),
    keyPoints: [],
  };
}

function storyId(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `brief-${(hash >>> 0).toString(16)}`;
}

function concise(value, maxLength) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/[\s,.;:!?-]+\S*$/, "").trim()}…`;
}

function defaultWhy(category) {
  if (category === "TECH") return "Diễn biến này có thể ảnh hưởng đến cách công nghệ được phát triển, quản lý hoặc sử dụng.";
  if (category === "ECONOMY") return "Diễn biến này có thể tác động đến thị trường, doanh nghiệp hoặc chi phí trong thời gian tới.";
  if (category === "POLITICS") return "Diễn biến này có thể làm thay đổi chính sách, quan hệ quốc tế hoặc đời sống xã hội.";
  return "Đây là diễn biến có mức độ ảnh hưởng đủ lớn để theo dõi trong ngày.";
}

function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
