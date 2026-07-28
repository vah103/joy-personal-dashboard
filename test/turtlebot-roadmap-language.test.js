import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const roadmapPath = resolve(root, "src/features/project-details/turtlebot-roadmap.js");
const languagePath = resolve(root, "src/features/project-details/turtlebot-roadmap-language.js");
const projectStatePath = resolve(root, "project-data/turtlebot4/project-state-v2.js");
const vietnameseCharacters = /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i;

test("TurtleBot roadmap source remains English-only", async () => {
  const [roadmap, language, projectState] = await Promise.all([
    readFile(roadmapPath, "utf8"),
    readFile(languagePath, "utf8"),
    readFile(projectStatePath, "utf8"),
  ]);

  assert.doesNotMatch(roadmap, vietnameseCharacters);
  assert.doesNotMatch(language, vietnameseCharacters);
  assert.doesNotMatch(projectState, vietnameseCharacters);
  assert.match(roadmap, /Main content/);
  assert.match(roadmap, /Objective/);
  assert.match(roadmap, /Completion gate/);
  assert.match(language, /Overall completion/);
  assert.match(language, /Next lab session/);
  assert.match(projectState, /10-week execution plan/);
  assert.match(projectState, /Project State unavailable/);
});
