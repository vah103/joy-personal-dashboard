import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const statePath = resolve(root, "project-data/turtlebot4/current-state.json");
const mergerPath = resolve(root, "project-data/turtlebot4/project-current-state.js");

test("canonical TurtleBot state owns card, Overview and Roadmap UI", async () => {
  const [stateSource, merger] = await Promise.all([
    readFile(statePath, "utf8"),
    readFile(mergerPath, "utf8"),
  ]);
  const currentState = JSON.parse(stateSource);
  assert.equal(currentState.project.overallProgress, 42);

  const percentage = { textContent: "17%" };
  const track = { style: { width: "17%" } };
  const focus = { textContent: "Old Stage 3 focus" };
  const next = { textContent: "Old benchmark action" };
  const pill = { textContent: "Week 4 of 12 · Stage 3 of 9" };
  const overview = { textContent: "17%" };
  const roadmapProgress = { textContent: "40%" };
  const roadmapTrack = { style: { width: "40%" } };
  const title = { textContent: "TurtleBot 4" };
  const listeners = new Map();
  const card = {
    querySelector(selector) {
      if (selector === ".project-top strong") return title;
      if (selector === ".project-top span") return percentage;
      if (selector === ".progress-track span") return track;
      if (selector === "dl div:first-child dd") return focus;
      if (selector === "dl div:last-child dd") return next;
      if (selector === ".project-stage-pill") return pill;
      return null;
    },
  };
  const document = {
    querySelectorAll(selector) {
      return selector === "#project-list .project-card" ? [card] : [];
    },
    querySelector(selector) {
      if (selector === ".ps-metrics article:first-child strong") return overview;
      if (selector === ".hub-progress-summary strong") return roadmapProgress;
      if (selector === ".hub-progress-summary div i") return roadmapTrack;
      return null;
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };

  const context = {
    hubState: {
      source: {
        project: { currentStageId: "stage-3" },
        history: [],
        roadmap: {
          stages: [
            { id: "stage-3", status: "in-progress", checklist: [], results: [] },
            { id: "stage-4", status: "not-started", checklist: [], results: [] },
            { id: "stage-5", status: "not-started", checklist: [], results: [] },
          ],
        },
      },
      projectState: {
        project: { id: "turtlebot4", totalWeeks: 12 },
        history: [],
        weeks: [],
      },
      overrides: { checklist: {} },
      activeStageId: "stage-3",
    },
    hubElements: { modal: { hidden: true } },
    document,
    updateTurtleBotCard() {
      percentage.textContent = "17%";
      track.style.width = "17%";
      focus.textContent = "Old Stage 3 focus";
      next.textContent = "Old benchmark action";
      pill.textContent = "Week 4 of 12 · Stage 3 of 9";
    },
    renderHub() {},
    fetch: async () => ({ ok: true, json: async () => currentState }),
    console: { error: (error) => assert.fail(String(error)) },
  };

  runInNewContext(merger, context);
  await new Promise((resolveReady) => setImmediate(resolveReady));

  assert.equal(context.hubState.canonicalProgress, 42);
  assert.equal(context.hubState.projectState.project.overallProgress, 42);
  assert.equal(percentage.textContent, "42%");
  assert.equal(track.style.width, "42%");
  assert.equal(focus.textContent, currentState.project.currentFocus);
  assert.equal(next.textContent, currentState.project.nextAction);
  assert.equal(pill.textContent, "Week 4 of 12 · Stage 5 of 9");
  assert.equal(overview.textContent, "42%");
  assert.equal(roadmapProgress.textContent, "42%");
  assert.equal(roadmapTrack.style.width, "42%");

  percentage.textContent = "9%";
  track.style.width = "9%";
  focus.textContent = "Stale focus";
  pill.textContent = "Week 4 of 12 · Stage 3 of 9";
  listeners.get("joy-project-hub:card-updated")();
  assert.equal(percentage.textContent, "42%");
  assert.equal(track.style.width, "42%");
  assert.equal(focus.textContent, currentState.project.currentFocus);
  assert.equal(pill.textContent, "Week 4 of 12 · Stage 5 of 9");

  overview.textContent = "8%";
  roadmapProgress.textContent = "47%";
  roadmapTrack.style.width = "47%";
  listeners.get("joy-project-hub:rendered")();
  assert.equal(overview.textContent, "42%");
  assert.equal(roadmapProgress.textContent, "42%");
  assert.equal(roadmapTrack.style.width, "42%");
});
