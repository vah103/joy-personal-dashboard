import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const roadmapPath = resolve(root, "src/features/project-details/turtlebot-roadmap.js");
const languagePath = resolve(root, "src/features/project-details/turtlebot-roadmap-language.js");
const projectStatePath = resolve(root, "project-data/turtlebot4/project-state-v2.js");
const performancePath = resolve(root, "src/features/project-hub/project-hub-performance.js");
const removedVietnameseLayerPath = resolve(root, "project-data/turtlebot4/project-state-v2-vi.js");
const vietnameseCharacters = /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i;

test("TurtleBot roadmap source remains English-only", async () => {
  const [roadmap, language, projectState, performance] = await Promise.all([
    readFile(roadmapPath, "utf8"),
    readFile(languagePath, "utf8"),
    readFile(projectStatePath, "utf8"),
    readFile(performancePath, "utf8"),
  ]);

  assert.doesNotMatch(roadmap, vietnameseCharacters);
  assert.doesNotMatch(language, vietnameseCharacters);
  assert.doesNotMatch(projectState, vietnameseCharacters);
  assert.doesNotMatch(performance, /project-state-v2-vi|turtlebot-vietnamese|turtlebotVietnamese/i);
  assert.match(roadmap, /Main content/);
  assert.match(roadmap, /Objective/);
  assert.match(roadmap, /Completion gate/);
  assert.match(language, /Overall completion/);
  assert.match(language, /Next lab session/);
  assert.match(projectState, /10-week execution plan/);
  assert.match(projectState, /Project State unavailable/);
  await assert.rejects(access(removedVietnameseLayerPath, constants.F_OK));
});
