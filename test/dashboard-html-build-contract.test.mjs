import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertOrder(source, before, after) {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);
  assert.notEqual(beforeIndex, -1, `Missing ${before}`);
  assert.notEqual(afterIndex, -1, `Missing ${after}`);
  assert.ok(beforeIndex < afterIndex, `${before} must load before ${after}`);
}

test("dashboard HTML is the canonical production asset owner", async () => {
  const [html, build] = await Promise.all([
    read("src/pages/dashboard/index.html"),
    read("scripts/build.mjs"),
  ]);

  assert.equal(html.match(/JOY_CLOUDFLARE_BACKEND/g)?.length, 1);
  assert.match(html, /<meta name="application-name" content="Hey Joy!">/);
  assert.match(html, /<title>Hey Joy! — Personal Dashboard<\/title>/);
  assert.match(html, /finance-demo\.css\?v=joy-finance-core-v4/);
  assert.match(html, /finance-demo\.js\?v=joy-finance-core-v9/);
  assert.match(html, /finance-p1008\.js\?v=joy-finance-p1008-v4/);
  assert.match(html, /weather-rain\.js\?v=joy-rain-notice-v6/);
  assert.match(html, /project-hub-core\.js\?v=turtlebot-hub-v4/);
  assert.match(html, /finance-p1008-shopping-tables-v1\.js\?v=joy-finance-p1008-shopping-tables-v2/);

  for (const legacy of [
    "joy-character-motion-v5",
    "joy-character-motion-v4",
    "joy-finance-p1008-v1",
    "joy-rain-notice-v2",
    "<title>Joy — Personal Dashboard</title>",
  ]) {
    assert.doesNotMatch(html, new RegExp(legacy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(build, /function replaceRequired\(/);
  assert.match(build, /Missing required build anchor/);
  assert.match(build, /Duplicate required build anchor/);
  assert.match(build, /dashboardBackendAnchor/);
  assert.doesNotMatch(build, /const projectHubHead =/);
  assert.doesNotMatch(build, /const dashboardFeatureScripts =/);
  assert.doesNotMatch(build, /\.replace\("<\/body>"/);
  assert.doesNotMatch(build, /\.replace\("<\/head>"/);

  assertOrder(html, "todo-visibility.js", "todo-display-policy.js");
  assertOrder(html, "todo-display-policy.js", "app.js");
  assertOrder(html, "project-hub-core.js", "project-hub-render.js");
  assertOrder(html, "project-hub-render.js", "project-hub-actions.js");
  assertOrder(html, "project-hub-extension-api.js", "project-state-v2.js");
  assertOrder(html, "finance-p1008-shopping-v1.js", "finance-p1008-shopping-tables-v1.js");
});
