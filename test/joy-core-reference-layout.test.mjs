import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("12-week TurtleBot overview receives the shared Joy Core panel", async () => {
  const [extensionApi, bridge, referenceUi] = await Promise.all([
    readFile(new URL("../src/features/project-hub/project-hub-extension-api.js", import.meta.url), "utf8"),
    readFile(new URL("../project-data/turtlebot4/joy-core-reference-layout.js", import.meta.url), "utf8"),
    readFile(new URL("../project-data/turtlebot4/project-plan-v3-reference-ui.js", import.meta.url), "utf8"),
  ]);

  assert.match(referenceUi, /class=\"rp-overview\"/);
  assert.match(referenceUi, /class=\"rp-info-grid\"/);
  assert.match(extensionApi, /joy-core-reference-layout\.js\?v=joy-stage-c-reference-v1/);
  assert.match(extensionApi, /addEventListener\("load", loadJoyCoreReferenceLayout/);
  assert.match(bridge, /querySelector\("\.rp-overview"\)/);
  assert.match(bridge, /overview\.classList\.add\("ps-wrap"\)/);
  assert.match(bridge, /querySelector\("\[data-joy-core-panel\]"\)/);
  assert.match(bridge, /infoGrid\.insertAdjacentElement\("afterend", panel\)/);
  assert.doesNotThrow(() => new Function(bridge));
});
