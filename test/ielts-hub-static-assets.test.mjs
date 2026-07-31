import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("IELTS hub styles are statically owned and use OpenAI Sans Medium", () => {
  const card = read("src/features/ielts/card.js");
  const cardStyles = read("project-data/ielts/ielts-card.css");
  const hubStyles = read("project-data/ielts/ielts-hub.css");
  const turtlebotStyles = read("src/features/project-details/turtlebot-roadmap-font.css");

  assert.match(
    cardStyles,
    /^@import url\("\.\/ielts-hub\.css\?v=ielts-hub-v2"\);/,
  );
  assert.doesNotMatch(card, /ensureHubStyle|HUB_STYLE/);
  assert.doesNotMatch(card, /document\.createElement\("(?:link|style)"\)/);

  for (const styles of [hubStyles, turtlebotStyles]) {
    assert.match(styles, /font-family: "OpenAI Sans"/);
    assert.match(styles, /OpenAISans-Medium\.woff2/);
    assert.match(styles, /font-weight: 500/);
    assert.doesNotMatch(styles, /fonts\.googleapis\.com|font-family: "Open Sans"/);
  }
});
