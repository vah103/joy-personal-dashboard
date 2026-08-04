import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const promptBridgePath = resolve(root, "src", "features", "ielts", "course-prompt-bridge.js");

function runtimeSource(source) {
  return `
const app = {
  program: { baseline: { objective: "Measure current ability" } },
  data: { taskStates: {}, customTasks: [], errorLogs: [], courseSessions: [] },
};
const baselineSeed = [
  { id: "baseline-listening", rhythmId: "baseline", skill: "listening", minutes: 90 },
  { id: "baseline-reading", rhythmId: "baseline", skill: "reading", minutes: 130 },
  { id: "baseline-writing", rhythmId: "baseline", skill: "writing", minutes: 120, title: "Full Writing baseline", materialUrl: "https://ielts.org/writing" },
  { id: "baseline-speaking", rhythmId: "baseline", skill: "speaking", minutes: 75, title: "Full Speaking baseline", materialUrl: "https://ielts.org/speaking", material: "Official Speaking sample", steps: [], doneWhen: [] },
];
function sourceAssignmentFor(task) { return app.data.taskStates[task.id]?.sourceAssignment || null; }
function sourceAdjustedTask(task) { return task; }
function relevantCourseTopics() { return []; }
function loadIeltsSourceLibrary() { return Promise.resolve({ providers: [], tests: [] }); }
function requestJson() { return Promise.resolve({ providers: [], tests: [] }); }
function isAssignedSourceTask() { return false; }
function sourceRequiresFullTest() { return false; }
function eligibleSourceTests() { return []; }
function makeSourceAssignment(test) { return { testId: test.id, testTitle: test.title, testUrl: test.url }; }
function baselineTasks() { return baselineSeed.map((task) => ({ ...task })); }
function effectiveRhythm(rhythm) { return rhythm; }
function rhythmTasks() { return []; }
function staticTasks() { return []; }
function currentContext() { return { id: "aug-w1-r1", type: "rhythm", label: "Rhythm 1", tasks: [{ id: "regular" }], targetMinutes: 360 }; }
function dateKey() { return "2026-08-04"; }
function isDone(task) { return app.data.taskStates[task.id]?.status === "completed"; }
function taskMaterialLinks() { return ""; }
function sourceAssignmentPanel() { return ""; }
async function taskDrawer() {}
function externalMaterialLink() { return ""; }
function escapeHtml(value) { return String(value); }
${source}
globalThis.__test = {
  app,
  baselineTasks,
  currentContext,
  eligibleSourceTests,
  sourceAdjustedTask,
  teachingPrompt,
};`;
}

async function makeRuntime() {
  const source = await readFile(promptBridgePath, "utf8");
  const sandbox = { console };
  vm.runInNewContext(runtimeSource(source), sandbox);
  return { source, api: sandbox.__test };
}

test("unfinished baseline remains the current context after 2 August and target time counts only unfinished tasks", async () => {
  const { api } = await makeRuntime();
  api.app.data.taskStates = {
    "baseline-listening": { status: "completed" },
    "baseline-reading": { status: "completed" },
  };

  const context = api.currentContext("2026-08-04");
  assert.equal(context.id, "baseline");
  assert.match(context.label, /catch-up/i);
  assert.equal(context.targetMinutes, 195);
  assert.equal(context.tasks.length, 4);
  assert.equal(context.tasks.find((task) => task.id === "baseline-speaking").title, "Speaking text-response baseline");

  for (const task of context.tasks) api.app.data.taskStates[task.id] = { status: "completed" };
  assert.equal(api.currentContext("2026-08-05").id, "aug-w1-r1");
});

test("Writing baseline prompt refuses planning or course help before both timed responses exist", async () => {
  const { api } = await makeRuntime();
  const task = api.baselineTasks().find((item) => item.id === "baseline-writing");
  const prompt = api.teachingPrompt(task);

  assert.match(prompt, /unaided IELTS Writing baseline/i);
  assert.match(prompt, /do not discuss the prompts, plan ideas/i);
  assert.match(prompt, /write Task 1 in 20 minutes and Task 2 in 40 minutes/i);
  assert.match(prompt, /paste Task 1 and Task 2 exactly as written/i);
  assert.doesNotMatch(prompt, /Relevant synchronized Writing-course knowledge/);
});

test("Speaking baseline uses the official source in text-response mode and does not claim pronunciation evidence", async () => {
  const { api } = await makeRuntime();
  const task = api.baselineTasks().find((item) => item.id === "baseline-speaking");
  const effective = api.sourceAdjustedTask(task);
  const prompt = api.teachingPrompt(task);

  assert.equal(effective.title, "Speaking text-response baseline");
  assert.match(effective.objective, /Pronunciation is not assessed/i);
  assert.match(prompt, /official IELTS Speaking material attached to this baseline/i);
  assert.match(prompt, /Do not replace it with STUDY4, YouPass/i);
  assert.match(prompt, /Do not assess pronunciation from text/i);
  assert.match(prompt, /fluency evidence is limited/i);
});

test("Speaking source selection excludes guidance-heavy articles and one-question sets from grouped practice", async () => {
  const { api, source } = await makeRuntime();
  const library = {
    tests: [
      { id: "one", skill: "speaking", taskPart: "part1", questionFlow: "single-question" },
      { id: "library", skill: "speaking", taskPart: "part1", questionFlow: "choose-one-current-question" },
      { id: "article", skill: "speaking", taskPart: "full", questionFlow: "article-topic-set", speakingParts: ["part1", "part2", "part3"] },
      { id: "full", skill: "speaking", taskPart: "full", questionFlow: "provider-full-set", speakingParts: ["part1", "part2", "part3"] },
    ],
  };

  const part1 = api.eligibleSourceTests({ id: "p1", skill: "speaking", title: "Speaking Part 1 answers" }, library);
  assert.deepEqual(part1.map((item) => item.id), ["library"]);

  const part3 = api.eligibleSourceTests({ id: "p3", skill: "speaking", title: "Speaking Part 3 answers" }, library);
  assert.deepEqual(part3.map((item) => item.id), ["full"]);

  const full = api.eligibleSourceTests({ id: "mock", skill: "speaking", title: "Full Speaking mock" }, library);
  assert.deepEqual(full.map((item) => item.id), ["full"]);
  assert.match(source, /questionFlow !== "article-topic-set"/);
});
