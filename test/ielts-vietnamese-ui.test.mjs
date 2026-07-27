import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("IELTS Vietnamese localization covers all 31 August days and preserves English exam prompts", () => {
  const days = ["01-09", "10-16", "17-23", "24-31"]
    .map((range) => read(`src/features/ielts/i18n-vi-days-${range}.js`))
    .join("\n");
  const ui = read("src/features/ielts/i18n-vi-ui-text.js");
  const hooks = read("src/features/ielts/i18n-vi-hooks.js");
  const diagnostic = read("src/features/ielts/core-diagnostic.js");
  const worker = read("worker/ielts-diagnostic-review.js");
  const dates = days.match(/"2026-08-\d{2}"/g) || [];

  assert.equal(new Set(dates).size, 31);
  assert.match(days, /"2026-08-01"/);
  assert.match(days, /"2026-08-31"/);
  assert.match(days, /Hàng đợi bù bài/);
  assert.match(days, /Đánh giá cuối tháng/);
  assert.match(ui, /Hồ sơ người học/);
  assert.match(ui, /Lộ trình tháng 8/);
  assert.match(hooks, /translateIeltsDom/);
  assert.match(diagnostic, /The table shows the average number of minutes/);
  assert.match(diagnostic, /Some people believe university students/);
  assert.match(worker, /Write every explanation, finding, pattern and uncertainty in clear Vietnamese/);
  assert.match(worker, /Keep every corrected English sentence/);
});
