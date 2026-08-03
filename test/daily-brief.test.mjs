import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleDailyBriefRequest } from "../worker/daily-brief.js";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Daily Brief is wired into the Worker and dashboard", async () => {
  const [service, policy, budget, router, wrangler, dashboard, script, baseStyles, dailyStyles, build] = await Promise.all([
    source("worker/daily-brief.js"),
    source("worker/daily-brief-policy.js"),
    source("worker/daily-brief-budget.js"),
    source("worker/router.js"),
    source("wrangler.jsonc"),
    source("src/pages/dashboard/index.html"),
    source("src/features/greeting/greeting-layout.js"),
    source("src/features/greeting/greeting-layout.css"),
    source("src/features/greeting/daily-brief.css"),
    source("scripts/build.mjs"),
  ]);

  assert.match(service, /const DAILY_BRIEF_PATH = "\/api\/daily-brief"/);
  assert.match(service, /score >= 70/);
  assert.match(service, /env\.AI\.run/);
  assert.match(service, /VnExpress/);
  assert.match(service, /BBC Technology/);
  assert.match(policy, /24 \* 60 \* 60 \* 1000/);
  assert.match(policy, /publishedAt \+ STORY_TTL_MS > now/);
  assert.match(budget, /from "\.\/daily-brief-policy\.js"/);
  assert.match(router, /daily-brief-budget\.js/);
  assert.match(router, /runDailyBriefSchedule/);
  assert.match(wrangler, /"ai"\s*:\s*\{\s*"binding"\s*:\s*"AI"/s);
  assert.match(dashboard, /greeting-layout\.css\?v=joy-daily-brief-v4/);
  assert.match(dashboard, /daily-brief\.css\?v=joy-daily-brief-v5/);
  assert.match(dashboard, /greeting-layout\.js\?v=joy-daily-brief-v4/);
  assert.doesNotMatch(dashboard, /daily-brief-polish\.js/);
  assert.match(script, /window\.fetch\("\/api\/daily-brief"/);
  assert.match(script, /daily-brief-drawer/);
  assert.match(script, /const ROTATION_MS = 20_000/);
  assert.match(script, /daily-brief-personal/);
  assert.match(script, /data-brief-next/);
  assert.doesNotMatch(script, /data-brief-prev/);
  assert.doesNotMatch(script, /data-brief-counter/);
  assert.doesNotMatch(script, /installStyles/);
  assert.doesNotMatch(script, /createElement\("style"\)/);
  assert.match(script, /Money, opportunity &amp; risk/);
  assert.match(script, /What to watch/);
  assert.match(dailyStyles, /font-size: 8\.25px/);
  assert.match(dailyStyles, /position: static/);
  assert.match(dailyStyles, /margin: 5px 0 0/);
  assert.match(dailyStyles, /padding: 4px 0 0/);
  assert.match(dailyStyles, /data-category="ai"/);
  assert.match(build, /"daily-brief\.css"/);
  assert.doesNotMatch(build, /daily-brief-polish\.js/);
  assert.match(baseStyles, /\.joy-brief\.daily-brief-enabled/);
  assert.match(baseStyles, /\.daily-brief-drawer-backdrop/);
});

function createDailyBriefDb() {
  const state = { lastRefresh: 0, stories: [] };

  return {
    state,
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (sql.includes("FROM daily_brief_meta")) {
            return state.lastRefresh ? { value: String(state.lastRefresh) } : null;
          }
          return null;
        },
        async all() {
          if (sql.includes("FROM daily_brief_stories")) {
            const now = Number(this.args[0]);
            return { results: state.stories.filter((story) => story.expires_at > now) };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes("DELETE FROM daily_brief_stories")) {
            const cutoff = Number(this.args[0]);
            state.stories = state.stories.filter((story) => story.expires_at > cutoff);
          }
          if (sql.includes("INSERT INTO daily_brief_meta")) {
            state.lastRefresh = Number(this.args[0]);
          }
          return { success: true };
        },
      };
      return statement;
    },
    async batch(statements) {
      for (const statement of statements) {
        const [id, title, summary, whyItMatters, keyPointsJson, category, scope, sourceName, articleUrl, sourceCount, score, publishedAt, createdAt, expiresAt] = statement.args;
        state.stories.push({
          id,
          title,
          summary,
          why_it_matters: whyItMatters,
          key_points_json: keyPointsJson,
          category,
          scope,
          source_name: sourceName,
          article_url: articleUrl,
          source_count: sourceCount,
          score,
          published_at: publishedAt,
          created_at: createdAt,
          expires_at: expiresAt,
        });
      }
      return statements.map(() => ({ success: true }));
    },
  };
}

test("initial synchronous refresh returns fresh metadata", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const db = createDailyBriefDb();
  let nowCalls = 0;

  Date.now = () => (++nowCalls === 1 ? 1_000 : 2_000);
  globalThis.fetch = async () => new Response(`<?xml version="1.0"?>
    <rss><channel><item>
      <title>Government central bank interest rate inflation policy update</title>
      <description>Major government and central bank policy changes affect inflation, markets, trade and the economy.</description>
      <link>https://example.com/important-policy-update</link>
      <pubDate>Thu, 01 Jan 1970 00:00:01 GMT</pubDate>
    </item></channel></rss>`, { status: 200 });

  try {
    const response = await handleDailyBriefRequest(
      new Request("https://joy.test/api/daily-brief"),
      { DB: db },
      { waitUntil() {} },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(db.state.lastRefresh, 2_000);
    assert.equal(payload.updatedAt, 2_000);
    assert.equal(payload.stale, false);
    assert.ok(payload.stories.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
