import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import SPEAKING_SOURCES from "../project-data/ielts/speaking-sources.json" with { type: "json" };
import PROGRAM from "../project-data/ielts/program-2026.json" with { type: "json" };

const root = resolve(import.meta.dirname, "..");
const sourceAssignmentPath = resolve(root, "src", "features", "ielts", "source-assignment.js");
const promptBridgePath = resolve(root, "src", "features", "ielts", "course-prompt-bridge.js");

function speakingTaskText(task = {}) {
  return `${task.id || ""} ${task.title || ""} ${task.objective || ""} ${(task.steps || []).join(" ")}`;
}

function speakingTaskPart(task = {}) {
  const text = speakingTaskText(task);
  const hasPart1 = /\bpart\s*1\b/i.test(text);
  const hasPart2 = /\bpart\s*2\b/i.test(text);
  const hasPart3 = /\bpart\s*3\b/i.test(text);
  if (
    /\b(full|complete|final|baseline|mock)\b[\s\S]{0,30}\bspeaking\b/i.test(text)
    || (hasPart1 && hasPart2 && hasPart3)
    || /all\s+three\s+parts/i.test(text)
  ) return "full";
  if ((hasPart2 && hasPart3) || /part\s*2\s*[-–—+&/]\s*3/i.test(text)) return "part23";
  if (hasPart1) return "part1";
  if (hasPart2) return "part2";
  if (hasPart3) return "part3";
  return "";
}

function allProgramTasks() {
  return [
    ...PROGRAM.prelaunch,
    ...PROGRAM.baseline.tasks,
    ...PROGRAM.august.weeks.flatMap((week) => (
      week.rhythms.flatMap((rhythm) => rhythm.tasks)
    )),
  ];
}

test("Speaking source catalog contains STUDY4 and YouPass chat-first coverage", () => {
  assert.equal(SPEAKING_SOURCES.schemaVersion, 1);
  assert.deepEqual(SPEAKING_SOURCES.selectionPolicy.randomPracticeSkills, ["speaking"]);
  assert.ok(SPEAKING_SOURCES.selectionPolicy.neverStore.includes("pronunciationScoreFromText"));
  assert.ok(SPEAKING_SOURCES.selectionPolicy.neverStore.includes("officialBandClaimFromText"));

  const providerIds = new Set(SPEAKING_SOURCES.providers.map((provider) => provider.id));
  assert.deepEqual([...providerIds], ["study4", "youpass"]);

  const coverage = new Set(
    SPEAKING_SOURCES.tests.map((item) => `${item.providerId}:${item.taskPart}`),
  );
  assert.ok(coverage.has("study4:full"));
  assert.ok(coverage.has("youpass:full"));
  assert.ok(coverage.has("youpass:part1"));
  assert.ok(coverage.has("youpass:part2"));
  assert.ok(coverage.has("youpass:part3"));
  assert.ok(coverage.has("youpass:part23"));
});

test("every Speaking source is allowlisted, stable and contains no copied samples", () => {
  const providerHosts = new Map(
    SPEAKING_SOURCES.providers.map((provider) => [
      provider.id,
      new Set(provider.allowedHosts),
    ]),
  );
  const ids = new Set();

  for (const source of SPEAKING_SOURCES.tests) {
    assert.equal(source.skill, "speaking");
    assert.equal(source.interactionMode, "chat-first");
    assert.equal(ids.has(source.id), false, `Duplicate Speaking source: ${source.id}`);
    ids.add(source.id);
    assert.ok(["full", "part1", "part2", "part3", "part23"].includes(source.taskPart));
    assert.ok(Array.isArray(source.speakingParts) && source.speakingParts.length > 0);
    assert.ok(Array.isArray(source.topicTags) && source.topicTags.length > 0);

    const url = new URL(source.url);
    assert.equal(url.protocol, "https:");
    assert.ok(providerHosts.get(source.providerId)?.has(url.hostname));
    assert.equal("sampleAnswer" in source, false);
    assert.equal("modelAnswer" in source, false);
    assert.equal("questions" in source, false);
  }
});

test("all ordinary August Speaking tasks map to a chat-first source pool", () => {
  const speakingTasks = allProgramTasks().filter((task) => (
    task.skill === "speaking"
    && !String(task.id || "").startsWith("baseline-")
    && task.kind !== "review"
    && task.kind !== "course"
  ));

  assert.ok(speakingTasks.length >= 6);
  for (const task of speakingTasks) {
    assert.notEqual(
      speakingTaskPart(task),
      "",
      `Speaking task does not identify Part 1, Part 2, Part 3 or full mock: ${task.id}`,
    );
  }

  const baseline = PROGRAM.baseline.tasks.find((task) => task.id === "baseline-speaking");
  assert.ok(baseline?.materialUrl);
  assert.equal(String(baseline.materialUrl).includes("study4.com"), false);
  assert.equal(String(baseline.materialUrl).includes("youpass.vn"), false);
});

test("frontend bundle implements source locking and chat-first teaching rules", async () => {
  const [assignmentSource, promptSource] = await Promise.all([
    readFile(sourceAssignmentPath, "utf8"),
    readFile(promptBridgePath, "utf8"),
  ]);
  new Function(`${assignmentSource}\n${promptSource}`);

  assert.match(promptSource, /IELTS_SPEAKING_SOURCE_LIBRARY_URL/);
  assert.match(promptSource, /isSpeakingSourceTask/);
  assert.match(promptSource, /Speaking set locked to this task/);
  assert.match(promptSource, /ask exactly one question at a time/i);
  assert.match(promptSource, /I will TYPE each answer immediately/i);
  assert.match(promptSource, /Do not assess pronunciation from text/i);
  assert.match(promptSource, /fluency evidence is limited/i);
  assert.match(promptSource, /no more than three weak answers/i);
  assert.match(promptSource, /paste or screenshot ONLY the current question/i);
});
