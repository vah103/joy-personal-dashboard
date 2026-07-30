import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("TurtleBot Project State uses the Project Hub extension API", () => {
  const api = read("src/features/project-hub/project-hub-extension-api.js");
  const projectState = read("project-data/turtlebot4/project-state-v2.js");

  assert.match(api, /root\.JoyProjectHub = Object\.freeze/);
  assert.match(api, /registerExtension/);
  assert.match(projectState, /api\.registerExtension\(Object\.freeze/);
  assert.doesNotMatch(projectState, /\bhubState\b|\bhubElements\b/);
  assert.doesNotMatch(
    projectState,
    /\b(?:normalizeOverrides|projectProgress|updateTurtleBotCard|renderHub|renderPlan|answerProjectQuestion|effectivePlan)\s*=/,
  );
  assert.doesNotThrow(() => new Function(api));
  assert.doesNotThrow(() => new Function(projectState));
});

test("Project Hub loads its extension API before Project State", () => {
  const build = read("scripts/build.mjs");
  const actionsIndex = build.indexOf("project-hub-actions.js");
  const apiIndex = build.indexOf("project-hub-extension-api.js");
  const stateIndex = build.indexOf("project-data/turtlebot4/project-state-v2.js");

  assert.ok(actionsIndex >= 0);
  assert.ok(apiIndex > actionsIndex);
  assert.ok(stateIndex > apiIndex);
  assert.match(build, /project-hub-extension-api\.js\?v=turtlebot-hub-extension-v1/);
  assert.match(build, /project-state-v2\.js\?v=turtlebot-progress-hooks-v2/);
  assert.match(
    build,
    /\[resolve\(features, "project-hub", "project-hub-extension-api\.js"\), "project-hub-extension-api\.js"\]/,
  );
});
