import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Daily Brief is wired into the Worker and dashboard", async () => {
  const [service, policy, budget, router, wrangler, dashboard, script, styles, polish] = await Promise.all([
    source("worker/daily-brief.js"),
    source("worker/daily-brief-policy.js"),
    source("worker/daily-brief-budget.js"),
    source("worker/router.js"),
    source("wrangler.jsonc"),
    source("src/pages/dashboard/index.html"),
    source("src/features/greeting/greeting-layout.js"),
    source("src/features/greeting/greeting-layout.css"),
    source("src/features/greeting/daily-brief-polish.js"),
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
  assert.match(dashboard, /greeting-layout\.js\?v=joy-daily-brief-v4/);
  assert.match(dashboard, /daily-brief-polish\.js\?v=joy-daily-brief-polish-v2/);
  assert.match(script, /window\.fetch\("\/api\/daily-brief"/);
  assert.match(script, /daily-brief-drawer/);
  assert.match(script, /const ROTATION_MS = 20_000/);
  assert.match(script, /daily-brief-personal/);
  assert.match(script, /data-brief-next/);
  assert.doesNotMatch(script, /data-brief-prev/);
  assert.doesNotMatch(script, /data-brief-counter/);
  assert.match(polish, /font-size: 8\.25px/);
  assert.match(polish, /position: static/);
  assert.match(polish, /margin: 5px 0 0/);
  assert.match(polish, /padding: 4px 0 0/);
  assert.match(styles, /\.joy-brief\.daily-brief-enabled/);
  assert.match(styles, /\.daily-brief-drawer-backdrop/);
});
