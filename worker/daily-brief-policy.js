import {
  handleDailyBriefRequest as handleStoredDailyBriefRequest,
  isDailyBriefRoute,
  runDailyBriefSchedule as runStoredDailyBriefSchedule,
} from "./daily-brief.js";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_ENRICHMENT_STORIES = 12;

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
  payload.stories = enriched.stories;

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

  const richerInstruction = `You are the senior editor for a tiny personal daily brief. Select only genuinely important, consequential news in technology, politics, and economics, covering Vietnam and the world. Reject entertainment, sport, lifestyle, routine corporate promotion, minor product launches, opinion-only pieces, and clickbait. Do not approve a story merely to fill space.

Base every word strictly on the supplied title and description. Never invent facts, motives, numbers, reactions, or consequences. If the supplied information is insufficient to explain the event safely, reject it.

Write clear, natural Vietnamese for a busy reader:
- Summary: two compact sentences, normally 28-42 words total. Sentence one states exactly what happened. Sentence two adds the most useful actor, decision, timing, location, or immediate context available in the supplied material.
- WhyItMatters: one or two compact sentences, normally 22-38 words total. Explain the likely practical, economic, political, technological, or diplomatic significance. Clearly frame uncertain effects as possibilities, not facts.
- KeyPoints: two or three short factual bullets, normally 8-18 words each. Add concrete details instead of repeating the headline or summary.

Keep each field self-contained, neutral, easy to understand, and free of sensational language. Score 70+ only for stories worth interrupting a busy reader for.`;

  return {
    ...options,
    messages: messages.map((message) => (
      message?.role === "system"
      && String(message?.content || "").includes("senior editor for a tiny personal daily brief")
        ? { ...message, content: richerInstruction }
        : message
    )),
    max_tokens: Math.max(Number(options.max_tokens || 0), 3600),
  };
}

async function enrichWeakSummaries(stories, env) {
  if (!Array.isArray(stories) || !stories.length || !env?.AI?.run) {
    return { stories, changed: [] };
  }

  const candidates = stories
    .filter(needsEnrichment)
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
      content: `You improve short Vietnamese news briefs using only the supplied title and existing notes. Do not add any fact that is not already present. Make the brief clearer, not more speculative.

For each story return:
- summary: two concise sentences, about 30-50 Vietnamese words total. Explain what happened and the immediate context.
- whyItMatters: one or two concise sentences, about 22-40 words total. Explain the practical significance and identify uncertainty when needed.
- keyPoints: two or three factual bullets, each about 8-18 words, with no repetition.

Use neutral, natural Vietnamese. Preserve names and numbers exactly. If the source notes are limited, stay general rather than guessing.`,
    },
    { role: "user", content: source },
  ];

  try {
    const result = await env.AI.run(env.DAILY_BRIEF_AI_MODEL || DEFAULT_AI_MODEL, {
      messages,
      temperature: 0.1,
      max_tokens: 3000,
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
        whyItMatters: cleanAndLimit(decision.whyItMatters, 360) || story.whyItMatters,
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

function needsEnrichment(story) {
  const summaryLength = cleanAndLimit(story?.summary, 1000).length;
  const analysisLength = cleanAndLimit(story?.whyItMatters, 1000).length;
  const keyPoints = Array.isArray(story?.keyPoints)
    ? story.keyPoints.filter((item) => cleanAndLimit(item, 1000))
    : [];
  return summaryLength < 105 || analysisLength < 75 || keyPoints.length < 2;
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
  return afterText.length >= beforeText.length + 25 || afterPoints > beforePoints;
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

function cleanAndLimit(value, maxLength) {
  const text = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/[\s,.;:!?-]+\S*$/, "").trim()}…`;
}
