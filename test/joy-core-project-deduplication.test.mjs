import assert from "node:assert/strict";
import test from "node:test";

import {
  getJoyOverview,
  listJoyProjects,
} from "../worker/joy-core/service.js";

const NOW = 1_785_644_800_000;
const CONTEXT = {
  role: "owner",
  userEmail: "owner@example.com",
};

function coreProject(id, updatedAt = NOW) {
  return {
    id,
    title: id === "ielts" ? "IELTS Journey" : "TurtleBot4 Graduation Thesis",
    summary: "",
    status: "active",
    progress: 20,
    current_stage_id: null,
    current_focus: "Canonical focus",
    next_action: "Canonical next action",
    blockers_json: "[]",
    source_type: "joy",
    source_ref: id === "ielts"
      ? "ielts-core:ielts-band-7-december-2026"
      : "custom-gpt",
    metadata_json: "{}",
    version: 1,
    created_at: updatedAt,
    updated_at: updatedAt,
    archived_at: null,
  };
}

function legacyProject(id, updatedAt = NOW - 1) {
  return {
    id,
    name: id === "1" ? "TurtleBot 4" : id === "2" ? "IELTS" : "Legacy project",
    focus: "Legacy focus",
    next_action: "Legacy next action",
    progress: 95,
    archived: 0,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

function database({ core = [], legacy = [] } = {}) {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            async all() {
              if (sql.includes("FROM joy_core_projects")) return { results: core };
              if (sql.includes("FROM joy_projects")) return { results: legacy };
              if (sql.includes("source_ref LIKE 'legacy:tasks:%'")) return { results: [] };
              if (
                sql.includes("FROM joy_core_tasks")
                || sql.includes("FROM joy_core_progress_logs")
                || sql.includes("FROM tasks")
              ) {
                return { results: [] };
              }
              throw new Error(`Unexpected query: ${sql}`);
            },
          };
        },
      };
    },
  };
}

function turtleBotAssets() {
  return {
    async fetch() {
      return Response.json({
        updatedAt: "2026-08-01T00:00:00.000Z",
        project: {
          currentStatus: "active",
          progress: 30,
          currentFocus: "Canonical TurtleBot focus",
          nextAction: "Canonical TurtleBot next action",
        },
      });
    },
  };
}

test("overview keeps canonical projects and suppresses their matching legacy records", async () => {
  const env = {
    DB: database({
      core: [coreProject("ielts")],
      legacy: [legacyProject("1"), legacyProject("2")],
    }),
    ASSETS: turtleBotAssets(),
  };

  const overview = await getJoyOverview(env, CONTEXT, { now: NOW });

  assert.deepEqual(
    overview.projects.map((project) => project.id).sort(),
    ["ielts", "turtlebot4"],
  );
});

test("an unmigrated legacy project remains visible beside canonical projects", async () => {
  const env = {
    DB: database({
      core: [coreProject("ielts")],
      legacy: [legacyProject("2"), legacyProject("3")],
    }),
  };

  const projects = await listJoyProjects(env, CONTEXT, { now: NOW });

  assert.deepEqual(projects.map((project) => project.id).sort(), ["3", "ielts"]);
});

test("a mapped legacy project remains visible when its canonical replacement is absent", async () => {
  const env = {
    DB: database({ legacy: [legacyProject("2")] }),
  };

  const projects = await listJoyProjects(env, CONTEXT, { now: NOW });

  assert.deepEqual(projects.map((project) => project.id), ["2"]);
  assert.equal(projects[0].sourceRef, "legacy:joy_projects");
});

test("newer or higher-progress legacy data never replaces an existing canonical project", async () => {
  const canonical = coreProject("ielts", NOW - 10_000);
  const env = {
    DB: database({
      core: [canonical],
      legacy: [legacyProject("2", NOW)],
    }),
  };

  const projects = await listJoyProjects(env, CONTEXT, { now: NOW });

  assert.equal(projects.length, 1);
  assert.equal(projects[0].id, "ielts");
  assert.equal(projects[0].progress, 20);
  assert.equal(projects[0].currentFocus, "Canonical focus");
});
