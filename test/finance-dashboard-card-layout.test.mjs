import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("outer Finance card uses balanced cards and softer OpenAI Sans amounts", () => {
  const theme = read("src/features/theme/dashboard-openai-headings.css");
  const layout = read("project-data/finance/finance-dashboard-card-v1.css");

  assert.match(
    theme,
    /^@import url\("\/project-data\/finance\/finance-dashboard-card-v1\.css\?v=finance-dashboard-stats-v2"\);/,
  );
  assert.match(theme, /OpenAISans-Medium\.woff2/);

  assert.match(layout, /grid-template-columns:\s*minmax\(220px, 1\.55fr\)\s+minmax\(138px, \.9fr\)\s+minmax\(165px, 1\.08fr\)/);
  assert.match(layout, /\.finance-available[\s\S]*grid-row:\s*1 \/ 3/);
  assert.match(layout, /nth-child\(2\)[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*1/);
  assert.match(layout, /nth-child\(3\)[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*2/);
  assert.match(layout, /nth-child\(4\)[\s\S]*grid-column:\s*3[\s\S]*grid-row:\s*1 \/ 3/);
  assert.match(layout, /\.finance-overview-stat[\s\S]*border-radius:\s*14px[\s\S]*background:/);
  assert.match(layout, /nth-child\(2\)[\s\S]*\.finance-stat-icon,[\s\S]*nth-child\(3\)[\s\S]*\.finance-stat-icon[\s\S]*display:\s*none/);
  assert.match(layout, /\.finance-overview \[data-finance-field\][\s\S]*font-family:\s*"OpenAI Sans"/);
  assert.match(layout, /font-variant-numeric:\s*proportional-nums lining-nums/);
  assert.match(layout, /letter-spacing:\s*-\.018em/);
  assert.match(layout, /font-synthesis:\s*none/);
});
