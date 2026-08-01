import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routerSource = await readFile(new URL("../worker/router.js", import.meta.url), "utf8");
const headingStylesSource = await readFile(
  new URL("../src/features/theme/dashboard-openai-headings.css", import.meta.url),
  "utf8",
);

test("dashboard heading stylesheet is served with a fresh cache key", () => {
  assert.match(
    routerSource,
    /dashboard-openai-headings\.css\?v=joy-openai-headings-v2/,
  );
  assert.match(routerSource, /withDashboardHeadingAssetVersion/);
  assert.match(routerSource, /no-store, max-age=0/);
  assert.match(routerSource, /pathname === "\/dashboard-openai-headings\.css"/);
});

test("main dashboard panel headings remain 18px", () => {
  assert.match(
    headingStylesSource,
    /\.dashboard-shell \.panel-heading h2,[\s\S]*\.dashboard-shell \.panel-title-button h2 \{[\s\S]*font-size: 18px;/,
  );
});
