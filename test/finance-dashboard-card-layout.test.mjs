import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("outer Finance card owns layout in the canonical source and uses Nunito for money", () => {
  const theme = read("src/features/theme/dashboard-openai-headings.css");
  const dashboard = read("src/features/finance/finance-dashboard.js");

  assert.doesNotMatch(theme, /finance-dashboard-card-v1\.css/);
  assert.doesNotMatch(theme, /grid-template-columns|grid-template-rows|nth-child\(/);
  assert.match(theme, /OpenAISans-Regular\.woff2/);
  assert.match(theme, /OpenAISans-Medium\.woff2/);
  assert.match(theme, /OpenAISans-Bold\.woff2/);

  assert.match(
    dashboard,
    /grid-template-columns:minmax\(218px,1\.48fr\) minmax\(122px,\.82fr\) minmax\(150px,1fr\)/,
  );
  assert.match(dashboard, /grid-template-rows:repeat\(2,minmax\(68px,1fr\)\)/);
  assert.match(
    dashboard,
    /\.finance-available\{[\s\S]*grid-column:1;[\s\S]*grid-row:1 \/ 3;/,
  );
  assert.match(
    dashboard,
    /nth-child\(2\)\{[\s\S]*grid-column:2;[\s\S]*grid-row:1;/,
  );
  assert.match(
    dashboard,
    /nth-child\(3\)\{[\s\S]*grid-column:2;[\s\S]*grid-row:2;/,
  );
  assert.match(
    dashboard,
    /nth-child\(4\)\{[\s\S]*grid-column:3;[\s\S]*grid-row:1 \/ 3;/,
  );
  assert.match(dashboard, /@container \(max-width:540px\)/);

  assert.match(
    theme,
    /#finance\.finance-dashboard-polished \.finance-available > strong \{[\s\S]*font-family: "Nunito"[\s\S]*font-weight: 700;[\s\S]*letter-spacing: -\.022em;[\s\S]*line-height: 1\.04;/,
  );
  assert.match(
    theme,
    /#finance\.finance-dashboard-polished \.finance-overview-stat strong \{[\s\S]*font-family: "Nunito"[\s\S]*font-weight: 500;[\s\S]*letter-spacing: -\.016em;[\s\S]*line-height: 1\.08;/,
  );
  assert.match(theme, /font-synthesis: none/);
});
