import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const statePath = resolve(root, "project-data/turtlebot4/current-state.json");
const mergerPath = resolve(root, "project-data/turtlebot4/project-current-state.js");

test("canonical TurtleBot progress owns card and overview percentages", async () => {
  const [stateSource, merger] = await Promise.all([
    readFile(statePath, "utf8"),
    readFile(mergerPath, "utf8"),
  ]);
  const currentState = JSON.parse(stateSource);
  assert.equal(currentState.project.overallProgress, 42);

  const percentage = { textContent: "17%" };
  const track = { style: { width: "17%" } };
  const overview = { textContent: "17%" };
  const title = { textContent: "TurtleBot 4" };
  const listeners = new Map();
  const card = {
    querySelector(selector) {
      if (selector === ".project-top strong") return title;
      if (selector === ".project-top span") return percentage;
      if (selector === ".progress-track span") return track;
      return null;
    },
  };
  const document = {
    querySelectorAll(selector) {
      return selector === "#project-list .project-card" ? [card] : [];
    },
    querySelector(selector) {
      return selector === ".ps-metrics article:first-child strong" ? overview : null;
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
        project: { id: "turtlebot4" },
        history: [],
        weeks: [],
      },
      activeStageId: "stage-3",
    },
    hubElements: { modal: { hidden: true } },
    document,
    updateTurtleBotCard() {
      percentage.textContent = "17%";
      track.style.width = "17%";
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
  assert.equal(overview.textContent, "42%");

  percentage.textContent = "9%";
  track.style.width = "9%";
  listeners.get("joy-project-hub:card-updated")();
  assert.equal(percentage.textContent, "42%");
  assert.equal(track.style.width, "42%");

  overview.textContent = "8%";
  listeners.get("joy-project-hub:rendered")();
  assert.equal(overview.textContent, "42%");
});
