import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
