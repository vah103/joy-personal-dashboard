import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { patchDashboardProjectSeed } from "../scripts/sync-turtlebot-fallbacks.mjs";

const root = new URL("../", import.meta.url);
const appStateSource = fs.readFileSync(new URL("src/pages/dashboard/app-state.js", root), "utf8");

const canonicalProject = {
  id: 1,
  name: "TurtleBot 4",
  progress: 42,
  accent: "slate",
  focus: "Start frontier detection and safe goal generation",
  next: "Implement frontier-cell detection and publish RViz markers",
};

function runAppState(savedProjects) {
  const storage = new Map([
    ["joy-dashboard-sample", JSON.stringify({
      projects: savedProjects,
      gmailDismissedIds: [],
      gmailPinnedIds: [],
    })],
  ]);
  const context = {
    console,
    Date,
    JSON,
    Math,
    Set,
    URLSearchParams,
    document: { querySelector: () => null },
    window: {
      JoyDashboardConfig: {
        google: {},
        refresh: {},
        weather: {},
        timeZone: "Asia/Ho_Chi_Minh",
        seedProjects: [canonicalProject],
      },
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
    },
    createProjectId: () => "generated-project",
    vietnamDateKey: () => "2026-08-04",
  };
  vm.createContext(context);
  vm.runInContext(
    `${appStateSource}\nglobalThis.__state = state; globalThis.__normalizeProject = normalizeProject;`,
    context,
  );
  return context;
}

test("build fallback writes canonical current state into the first-paint TurtleBot seed", () => {
  const source = `window.JoyDashboardConfig = Object.freeze({
  seedProjects: Object.freeze([
    Object.freeze({
      id: 1,
      name: "TurtleBot 4",
      progress: 40,
      accent: "slate",
      focus: "Old focus",
      next: "Old next action",
    }),
  ]),
});`;
  const currentState = {
    project: {
      overallProgress: canonicalProject.progress,
      currentFocus: canonicalProject.focus,
      nextAction: canonicalProject.next,
    },
  };

  const patched = patchDashboardProjectSeed(source, currentState);
  const patchedAgain = patchDashboardProjectSeed(patched, currentState);

  assert.equal(patchedAgain, patched);
  assert.match(patched, /progress: 42/);
  assert.match(patched, new RegExp(JSON.stringify(canonicalProject.focus)));
  assert.match(patched, new RegExp(JSON.stringify(canonicalProject.next)));
  assert.doesNotMatch(patched, /progress: 40|Old focus|Old next action/);
});

test("stale local and cloud TurtleBot records cannot render before canonical progress", () => {
  const context = runAppState([{
    id: "1",
    name: "TurtleBot 4",
    progress: 40,
    accent: "slate",
    focus: "Saved Stage 3 focus",
    next: "Saved Stage 3 action",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  }]);

  assert.equal(context.__state.projects.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.__state.projects[0])),
    {
      id: "1",
      name: canonicalProject.name,
      progress: canonicalProject.progress,
      accent: canonicalProject.accent,
      focus: canonicalProject.focus,
      next: canonicalProject.next,
      archived: false,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  );

  const staleCloudRecord = context.__normalizeProject({
    id: "1",
    name: "TurtleBot4",
    progress: 40,
    accent: "slate",
    focus: "Cloud Stage 3 focus",
    next: "Cloud Stage 3 action",
  });
  assert.equal(staleCloudRecord.progress, 42);
  assert.equal(staleCloudRecord.focus, canonicalProject.focus);
  assert.equal(staleCloudRecord.next, canonicalProject.next);
});
