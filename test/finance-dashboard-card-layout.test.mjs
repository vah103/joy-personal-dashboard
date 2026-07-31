import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("outer Finance card uses a flat balanced strip and lighter OpenAI Sans amounts", () => {
  const theme = read("src/features/theme/dashboard-openai-headings.css");
  const layout = read("project-data/finance/finance-dashboard-card-v1.css");

  assert.match(
    theme,
    /^@import url\("\/project-data\/finance\/finance-dashboard-card-v1\.css\?v=finance-dashboard-stats-v3"\);/,
  );
  assert.match(theme, /OpenAISans-Regular\.woff2/);
  assert.match(theme, /OpenAISans-Medium\.woff2/);

  assert.match(layout, /grid-template-columns:\s*minmax\(250px, 1\.9fr\)\s+minmax\(116px, \.8fr\)\s+minmax\(142px, 1fr\)/);
  assert.match(layout, /\.finance-available[\s\S]*grid-row:\s*1 \/ 3/);
  assert.match(layout, /nth-child\(2\)[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*1/);
  assert.match(layout, /nth-child\(3\)[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*2/);
  assert.match(layout, /nth-child\(4\)[\s\S]*grid-column:\s*3[\s\S]*grid-row:\s*1 \/ 3/);
  assert.match(layout, /\.finance-overview-stat[\s\S]*border-radius:\s*0[\s\S]*background:\s*transparent/);
  assert.match(layout, /nth-child\(4\)[\s\S]*border-radius:\s*12px/);
  assert.match(layout, /nth-child\(2\)[\s\S]*\.finance-stat-icon,[\s\S]*nth-child\(3\)[\s\S]*\.finance-stat-icon,[\s\S]*nth-child\(4\)[\s\S]*\.finance-stat-icon[\s\S]*display:\s*none/);
  assert.match(layout, /\.finance-overview \[data-finance-field\][\s\S]*font-family:\s*"OpenAI Sans"/);
  assert.match(layout, /font-weight:\s*400/);
  assert.match(layout, /letter-spacing:\s*-\.008em/);
  assert.match(layout, /font-synthesis:\s*none/);
});
