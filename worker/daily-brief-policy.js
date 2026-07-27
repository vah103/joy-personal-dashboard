import {
  handleDailyBriefRequest as handleStoredDailyBriefRequest,
  isDailyBriefRoute,
  runDailyBriefSchedule as runStoredDailyBriefSchedule,
} from "./daily-brief.js";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_ENRICHMENT_STORIES = 12;
const MIN_PERSONAL_PRIORITY = 38;

const AI_TERMS = [
  "artificial intelligence", "generative ai", "ai model", "ai agent", "agentic",
  "machine learning", "large language model", "llm", "openai", "chatgpt",
  "anthropic", "claude", "gemini", "deepseek", "trí tuệ nhân tạo", "mô hình ai",
  "tác nhân ai", "ai tạo sinh", "học máy",
];

const ROBOTICS_TERMS = [
  "robot", "robotics", "humanoid", "autonomous", "automation", "drone", "uav",
  "self-driving", "turtlebot", "warehouse robot", "industrial robot",
  "robot hình người", "robot tự hành", "tự động hóa", "xe tự lái", "thiết bị bay không người lái",
];

const FINANCE_TERMS = [
  "finance", "financial", "market", "stock", "bond", "bank", "interest rate",
  "inflation", "currency", "exchange rate", "gold", "oil", "bitcoin", "crypto",
  "earnings", "revenue", "profit", "investment", "funding", "valuation", "tariff",
  "supply chain", "semiconductor", "chip export", "tài chính", "thị trường", "chứng khoán",
  "cổ phiếu", "trái phiếu", "ngân hàng", "lãi suất", "lạm phát", "tỷ giá", "vàng",
  "dầu", "tiền số", "bitcoin", "doanh thu", "lợi nhuận", "đầu tư", "gọi vốn",
  "định giá", "thuế quan", "chuỗi cung ứng", "bán dẫn",
];

const PRICE_TERMS = [
  "price", "prices", "cost", "costs", "consumer", "rent", "housing", "food",
  "electricity", "fuel", "shipping", "freight", "commodity", "giá", "giá cả",
  "chi phí", "giá nhà", "tiền thuê", "thực phẩm", "điện", "xăng", "nhiên liệu",
  "vận tải", "cước", "hàng hóa",
];

const MARKET_IMPACT_TERMS = [
  "sanction", "war", "ceasefire", "trade", "tariff", "export control", "regulation",
  "policy", "law", "central bank", "election", "shipping route", "energy supply",
  "trừng phạt", "chiến tranh", "ngừng bắn", "thương mại", "thuế quan", "kiểm soát xuất khẩu",
  "quy định", "chính sách", "luật", "ngân hàng trung ương", "bầu cử", "tuyến vận tải",
  "nguồn cung năng lượng",
];

const STRATEGIC_LENS_TERMS = [
  "giá", "chi phí", "thị trường", "doanh nghiệp", "năng suất", "việc làm", "kỹ năng",
  "nhu cầu", "chuỗi cung ứng", "cơ hội", "rủi ro", "đầu tư", "doanh thu", "lợi nhuận",
  "lãi suất", "lạm phát", "tỷ giá", "adoption", "productivity", "jobs", "skills",
  "demand", "supply chain", "opportunity", "risk", "investment",
];

export { isDailyBriefRoute };

export async function runDailyBriefSchedule(env) {
  return runStoredDailyBriefSchedule(withDetailedEditorialAi(env));
}

export async function handleDailyBriefRequest(request, env, ctx) {
  const response = await handleStoredDailyBriefRequest(
    request,
    withDetailedEditorialAi(env),
    ctx,
  );
  if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) {
    return response;
  }

  const payload = await response.json();
  const now = Date.now();
  const stories = Array.isArray(payload.stories) ? payload.stories : [];

  payload.stories = stories
    .filter((story) => {
      const publishedAt = Number(story?.publishedAt || 0);
      return publishedAt > 0 && publishedAt + STORY_TTL_MS > now;
    })
    .map((story) => ({
      ...story,
      expiresAt: Number(story.publishedAt) + STORY_TTL_MS,
    }));

  const enriched = await enrichWeakSummaries(payload.stories, env);
  if (enriched.changed.length) {
    const persist = persistEnrichedStories(enriched.changed, env);
    if (ctx?.waitUntil) ctx.waitUntil(persist);
    else await persist;
  }

  payload.stories = personalizeAndRank(enriched.stories, now);

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), {
    status: response.status,
    headers,
  });
}

function withDetailedEditorialAi(env) {
  if (!env?.AI?.run) return env;

  const detailedAi = {
    run(model, options = {}) {
      return env.AI.run(model, enhanceEditorialOptions(options));
    },
  };

  return new Proxy(env, {
    get(target, property, receiver) {
      if (property === "AI") return detailedAi;
      return Reflect.get(target, property, receiver);
    },
  });
}

function enhanceEditorialOptions(options) {
  const messages = Array.isArray(options?.messages) ? options.messages : [];
  const isDailyBriefReview = messages.some((message) =>
    message?.role === "system"
    && String(message?.content || "").includes("senior editor for a tiny personal daily brief")
  );
  if (!isDailyBriefReview) return options;

  const richerInstruction = `You are the senior editor for Vanh's tiny personal daily brief. The reader's priority order is:
1. AI, robotics, automation, semiconductors, autonomous systems, and technologies that change productivity, jobs, skills, or business models.
2. News that can affect prices, living costs, interest rates, currencies, energy, commodities, financial markets, company earnings, supply chains, or consumer demand.
3. Political and geopolitical news only when it has a credible direct effect on technology, trade, regulation, supply, prices, business, or finance.

Reject entertainment, sport, lifestyle, routine corporate promotion, minor product launches, opinion-only pieces, generic political theatre, and clickbait. Do not approve a story merely to fill space.

Base every factual statement strictly on the supplied title and description. Never invent numbers, motives, reactions, dates, or guaranteed consequences. You may explain a reasonable economic or business implication, but label uncertainty with language such as "có thể", "nếu", or "cần theo dõi".

Write clear, natural Vietnamese for a busy reader:
- Summary: two compact sentences, normally 28-45 words total. State what happened and the most useful immediate context.
- WhyItMatters: one or two compact sentences, normally 25-45 words total. Prioritize effects on prices, costs, markets, businesses, productivity, jobs, skills, demand, or supply. Include a cautious opportunity-and-risk angle when supported.
- KeyPoints: two or three short bullets, normally 8-18 words each. Prefer concrete signals the reader should watch next, such as adoption, regulation, funding, earnings, supply, demand, price movement, or implementation. Do not invent a scheduled event.

Do not tell the reader to buy, sell, or trade a specific asset. Do not promise profit or frame speculation as certainty. The goal is to improve economic awareness and identify themes worth researching further. Keep each field neutral, self-contained, and free of sensational language. Score 70+ only for stories worth interrupting a busy reader for.`;

  return {
    ...options,
    messages: messages.map((message) => (
      message?.role === "system"
      && String(message?.content || "").includes("senior editor for a tiny personal daily brief")
        ? { ...message, content: richerInstruction }
        : message
    )),
    max_tokens: Math.max(Number(options.max_tokens || 0), 3800),
  };
}

async function enrichWeakSummaries(stories, env) {
  if (!Array.isArray(stories) || !stories.length || !env?.AI?.run) {
    return { stories, changed: [] };
  }

  const candidates = stories
    .filter(needsEnrichment)
    .sort((a, b) => personalPriority(b, Date.now()) - personalPriority(a, Date.now()))
    .slice(0, MAX_ENRICHMENT_STORIES);
  if (!candidates.length) return { stories, changed: [] };

  const schema = {
    type: "object",
    properties: {
      stories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            summary: { type: "string" },
            whyItMatters: { type: "string" },
            keyPoints: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 3,
            },
          },
          required: ["id", "summary", "whyItMatters", "keyPoints"],
        },
      },
    },
    required: ["stories"],
  };

  const source = candidates.map((story) => [
    `ID: ${story.id}`,
    `TITLE: ${story.title || ""}`,
    `CURRENT_SUMMARY: ${story.summary || ""}`,
    `CURRENT_ANALYSIS: ${story.whyItMatters || ""}`,
    `CURRENT_KEY_POINTS: ${JSON.stringify(story.keyPoints || [])}`,
    `CATEGORY: ${story.category || "GENERAL"}`,
    `SCOPE: ${story.scope || "WORLD"}`,
  ].join("\n")).join("\n\n");

  const messages = [
    {
      role: "system",
      content: `You improve short Vietnamese news briefs for a reader focused on AI, robotics, automation, prices, finance, business, and economic opportunity. Use only the supplied title and existing notes. Do not add unsupported facts.

For each story return:
- summary: two concise sentences, about 30-50 Vietnamese words total, explaining what happened and the immediate context.
- whyItMatters: one or two concise sentences, about 25-45 words total. Explain the most relevant impact on prices, costs, markets, businesses, productivity, jobs, skills, demand, or supply. Add a cautious opportunity-and-risk angle when justified.
- keyPoints: two or three concise "what to watch" bullets, each about 8-18 words. Prefer observable signals such as adoption, regulation, funding, earnings, supply, demand, pricing, or implementation.

Never recommend a specific buy or sell, never promise returns, and clearly express uncertainty. Preserve names and numbers exactly. If source notes are limited, remain general rather than guessing.`,
    },
    { role: "user", content: source },
  ];

  try {
    const result = await env.AI.run(env.DAILY_BRIEF_AI_MODEL || DEFAULT_AI_MODEL, {
      messages,
      temperature: 0.1,
      max_tokens: 3200,
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
    });
    const payload = typeof result?.response === "string"
      ? JSON.parse(result.response)
      : result?.response;
    const decisions = new Map(
      (Array.isArray(payload?.stories) ? payload.stories : [])
        .map((item) => [String(item?.id || ""), item]),
    );

    const changed = [];
    const nextStories = stories.map((story) => {
      const decision = decisions.get(String(story.id || ""));
      if (!decision) return story;

      const next = {
        ...story,
        summary: cleanAndLimit(decision.summary, 420) || story.summary,
        whyItMatters: cleanAndLimit(decision.whyItMatters, 420) || story.whyItMatters,
        keyPoints: normalizeKeyPoints(decision.keyPoints, story.keyPoints),
      };
      if (!isMeaningfullyRicher(story, next)) return story;
      changed.push(next);
      return next;
    });

    return { stories: nextStories, changed };
  } catch (error) {
    console.error("Joy Daily Brief detail enrichment failed", error);
    return { stories, changed: [] };
  }
}

function personalizeAndRank(stories, now) {
  return (Array.isArray(stories) ? stories : [])
    .map((story) => {
      const focus = storyFocus(story);
      return {
        ...story,
        editorialCategory: story.category,
        category: focus.label,
        personalPriority: personalPriority(story, now, focus),
      };
    })
    .filter((story) => story.personalPriority >= MIN_PERSONAL_PRIORITY)
    .sort((a, b) =>
      b.personalPriority - a.personalPriority
      || Number(b.score || 0) - Number(a.score || 0)
      || Number(b.publishedAt || 0) - Number(a.publishedAt || 0)
    )
    .map(({ personalPriority: _personalPriority, ...story }) => story);
}

function personalPriority(story, now = Date.now(), precomputedFocus = null) {
  const focus = precomputedFocus || storyFocus(story);
  const score = Number(story?.score || 0);
  const ageHours = Math.max(0, (now - Number(story?.publishedAt || now)) / 3_600_000);
  const recency = Math.max(0, 18 - ageHours * 0.8);
  let base = 0;

  if (focus.kind === "AI") base = 105;
  else if (focus.kind === "ROBOTICS") base = 103;
  else if (focus.kind === "MONEY") base = 92;
  else if (focus.kind === "TECH") base = 62;
  else if (focus.kind === "MARKETS") base = 54;
  else if (String(story?.category || "").toUpperCase() === "POLITICS" && score >= 90) base = 28;

  return Math.round(base + score * 0.28 + recency);
}

function storyFocus(story) {
  const text = storyText(story);
  const aiHits = termHits(text, AI_TERMS) + (/\bai\b/i.test(text) ? 1 : 0);
  const roboticsHits = termHits(text, ROBOTICS_TERMS);
  const financeHits = termHits(text, FINANCE_TERMS);
  const priceHits = termHits(text, PRICE_TERMS);
  const marketImpactHits = termHits(text, MARKET_IMPACT_TERMS);
  const originalCategory = String(story?.category || "").toUpperCase();

  if (aiHits > 0) return { kind: "AI", label: "AI" };
  if (roboticsHits > 0) return { kind: "ROBOTICS", label: "ROBOTICS" };
  if (financeHits + priceHits > 0) return { kind: "MONEY", label: "MONEY" };
  if (originalCategory === "TECH") return { kind: "TECH", label: "TECH" };
  if (marketImpactHits > 0) return { kind: "MARKETS", label: "MARKETS" };
  return { kind: "OTHER", label: originalCategory || "NEWS" };
}

function needsEnrichment(story) {
  const summaryLength = cleanAndLimit(story?.summary, 1000).length;
  const analysisLength = cleanAndLimit(story?.whyItMatters, 1000).length;
  const keyPoints = Array.isArray(story?.keyPoints)
    ? story.keyPoints.filter((item) => cleanAndLimit(item, 1000))
    : [];
  const lensText = `${story?.whyItMatters || ""} ${keyPoints.join(" ")}`.toLowerCase();
  const hasStrategicLens = STRATEGIC_LENS_TERMS.some((term) => lensText.includes(term));
  return summaryLength < 105
    || analysisLength < 85
    || keyPoints.length < 2
    || !hasStrategicLens;
}

function normalizeKeyPoints(value, fallback = []) {
  const points = Array.isArray(value)
    ? value.map((item) => cleanAndLimit(item, 180)).filter(Boolean).slice(0, 3)
    : [];
  if (points.length >= 2) return points;
  return Array.isArray(fallback) ? fallback.slice(0, 3) : [];
}

function isMeaningfullyRicher(before, after) {
  const beforeText = `${before?.summary || ""} ${before?.whyItMatters || ""}`.trim();
  const afterText = `${after?.summary || ""} ${after?.whyItMatters || ""}`.trim();
  const beforePoints = Array.isArray(before?.keyPoints) ? before.keyPoints.length : 0;
  const afterPoints = Array.isArray(after?.keyPoints) ? after.keyPoints.length : 0;
  const beforeLens = STRATEGIC_LENS_TERMS.filter((term) => beforeText.toLowerCase().includes(term)).length;
  const afterLens = STRATEGIC_LENS_TERMS.filter((term) => afterText.toLowerCase().includes(term)).length;
  return afterText.length >= beforeText.length + 20
    || afterPoints > beforePoints
    || afterLens > beforeLens;
}

async function persistEnrichedStories(stories, env) {
  if (!stories.length || !env?.DB?.batch) return;
  try {
    await env.DB.batch(stories.map((story) => env.DB.prepare(`
      UPDATE daily_brief_stories
      SET summary = ?, why_it_matters = ?, key_points_json = ?
      WHERE id = ?
    `).bind(
      story.summary,
      story.whyItMatters,
      JSON.stringify(story.keyPoints || []),
      story.id,
    )));
  } catch (error) {
    console.error("Joy Daily Brief could not save enriched summaries", error);
  }
}

function storyText(story) {
  return [
    story?.title,
    story?.summary,
    story?.whyItMatters,
    ...(Array.isArray(story?.keyPoints) ? story.keyPoints : []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function termHits(text, terms) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function cleanAndLimit(value, maxLength) {
  const text = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/[\s,.;:!?-]+\S*$/, "").trim()}…`;
}
