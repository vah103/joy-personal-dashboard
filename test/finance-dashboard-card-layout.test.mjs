import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("outer Finance card keeps canonical layout ownership and OpenAI Sans amounts", () => {
  const theme = read("src/features/theme/dashboard-openai-headings.css");

  assert.doesNotMatch(theme, /finance-dashboard-card-v1\.css/);
  assert.match(theme, /OpenAISans-Regular\.woff2/);
  assert.match(theme, /OpenAISans-Medium\.woff2/);
  assert.match(
    theme,
    /\.finance-panel \.finance-overview \[data-finance-field\][\s\S]*font-family:\s*"OpenAI Sans"/,
  );
  assert.match(theme, /\.finance-panel \.finance-overview \[data-finance-field\][\s\S]*font-weight:\s*400/);
  assert.match(theme, /\.finance-panel \.finance-available \[data-finance-field\][\s\S]*font-weight:\s*500/);
  assert.doesNotMatch(theme, /grid-template-columns|grid-template-rows|nth-child\(/);
  assert.match(theme, /font-synthesis:\s*none/);
});
