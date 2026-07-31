import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("outer Finance card uses a two-column summary with a stacked metric rail", () => {
  const theme = read("src/features/theme/dashboard-openai-headings.css");
  const layout = read("project-data/finance/finance-dashboard-card-v1.css");

  assert.match(
    theme,
    /^@import url\("\/project-data\/finance\/finance-dashboard-card-v1\.css\?v=finance-dashboard-stats-v4"\);/,
  );
  assert.match(theme, /OpenAISans-Regular\.woff2/);
  assert.match(theme, /OpenAISans-Medium\.woff2/);

  assert.match(layout, /grid-template-columns:\s*minmax\(0, 1\.45fr\)\s+minmax\(205px, \.95fr\)/);
  assert.match(layout, /grid-template-rows:\s*repeat\(3, minmax\(48px, 1fr\)\)/);
  assert.match(layout, /\.finance-available[\s\S]*grid-column:\s*1[\s\S]*grid-row:\s*1 \/ 4/);
  assert.match(layout, /nth-child\(2\)[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*1/);
  assert.match(layout, /nth-child\(3\)[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*2/);
  assert.match(layout, /nth-child\(4\)[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*3/);
  assert.match(layout, /\.finance-overview-stat > span:last-child[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(layout, /\.finance-overview-stat \.finance-stat-icon[\s\S]*display:\s*none/);
  assert.match(layout, /\.finance-overview \[data-finance-field\][\s\S]*font-family:\s*"OpenAI Sans"/);
  assert.match(layout, /font-weight:\s*400/);
  assert.match(layout, /letter-spacing:\s*0/);
  assert.match(layout, /font-synthesis:\s*none/);
});
