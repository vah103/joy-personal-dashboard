import assert from "node:assert/strict";
import test from "node:test";

import {
  getJoyOverview,
  getJoyProject,
  promoteLegacyJoyData,
} from "../worker/joy-core/service.js";
import {
  legacyTaskCoreId,
  legacyTaskSourceRef,
} from "../worker/joy-core/legacy-compatibility.js";

const NOW = 1_785_644_800_000;
const CONTEXT = {
  role: "owner",
  userEmail: "owner@example.com",
  actorType: "user",
  actorId: "owner@example.com",
};

function coreProject(id) {
  return {
    id,
    title: id === "ielts" ? "IELTS Journey" : "TurtleBot4 Graduation Thesis",
    summary: "",
    status: "active",
    progress: id === "ielts" ? 0 : 32,
    current_stage_id: id === "ielts" ? "august-foundation" : "stage-4",
    current_focus: "",
    next_action: "",
    blockers_json: "[]",
    source_type: "joy",
    source_ref: id === "ielts"
      ? "ielts-core:ielts-band-7-december-2026"
      : "asset:/project-data/turtlebot4/current-state.json",
    metadata_json: JSON.stringify(id === "ielts" ? {
      targetOverallBand: 7,
      minimumSkillBand: 6.5,
      targetDate: "2026-12-31",
    } : {}),
    version: 1,
    created_at: NOW - 20_000,
    updated_at: NOW - 10_000,
    archived_at: null,
  };
}

function legacyProject(id) {
  return {
    id,
    name: id === "2" ? "IELTS" : "TurtleBot 4",
    focus: id === "2" ? "Speaking fluency" : "Graduation project",
    next_action: id === "2" ? "Complete a Part 2 mock" : "Prepare meeting",
    progress: id === "2" ? 62 : 38,
    archived: 0,
    created_at: NOW - 40_000,
    updated_at: NOW - 5_000,
  };
}

function legacyTask(id, title) {
  return {
    id,
    title,
    done: 0,
    created_at: NOW - 30_000,
    updated_at: NOW - 4_000,
  };
}

function rowFromProjectArgs(args) {
  return {
    id: args[1],
    title: args[2],
    summary: args[3],
    status: args[4],
    progress: args[5],
    current_stage_id: args[6],
    current_focus: args[7],
    next_action: args[8],
    blockers_json: args[9],
    source_type: args[10],
    source_ref: args[11],
    metadata_json: args[12],
    version: args[13],
    created_at: args[14],
    updated_at: args[15],
    archived_at: args[16],
  };
}

function rowFromTaskArgs(args) {
  return {
    id: args[1],
    project_id: args[2],
    milestone_id: args[3],
    title: args[4],
    description: args[5],
    status: args[6],
    priority: args[7],
    due_at: args[8],
    scheduled_for: args[9],
    completed_at: args[10],
    position: args[11],
    source_type: args[12],
    source_ref: args[13],
    metadata_json: args[14],
    version: args[15],
    created_at: args[16],
    updated_at: args[17],
  };
}

function database({
  coreProjects = [],
  legacyProjects = [],
  legacyTasks = [],
} = {}) {
  const state = {
    coreProjects: structuredClone(coreProjects),
    legacyProjects: structuredClone(legacyProjects),
    legacyTasks: structuredClone(legacyTasks),
    coreTasks: [],
    audits: [],
  };
  return {
    state,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              if (sql.includes("FROM joy_core_projects")) {
                return { results: state.coreProjects };
              }
              if (sql.includes("FROM joy_projects")) {
                return { results: state.legacyProjects };
              }
              if (sql.includes("source_ref LIKE 'legacy:tasks:%'")) {
                return {
                  results: state.coreTasks.map((task) => ({ source_ref: task.source_ref })),
                };
              }
              if (sql.includes("FROM joy_core_tasks")) {
                const projectId = sql.includes("project_id = ?") ? args[1] : null;
                const tasks = projectId
                  ? state.coreTasks.filter((task) => task.project_id === projectId)
                  : state.coreTasks.filter((task) => ["todo", "in_progress", "blocked"].includes(task.status));
                return { results: tasks };
              }
              if (sql.includes("FROM tasks")) return { results: state.legacyTasks };
              if (
                sql.includes("FROM joy_core_milestones")
                || sql.includes("FROM joy_core_progress_logs")
                || sql.includes("FROM joy_core_evidence")
              ) {
                return { results: [] };
              }
              throw new Error(`Unexpected all query: ${sql}`);
            },
            async first() {
              if (sql.includes("FROM joy_core_projects")) {
                return state.coreProjects.find((project) => project.id === args[1]) || null;
              }
              if (sql.includes("FROM joy_core_tasks")) {
                return state.coreTasks.find((task) => task.id === args[1]) || null;
              }
              throw new Error(`Unexpected first query: ${sql}`);
            },
            async run() {
              if (sql.includes("INSERT INTO joy_core_projects")) {
                const row = rowFromProjectArgs(args);
                state.coreProjects = state.coreProjects.filter((item) => item.id !== row.id);
                state.coreProjects.push(row);
                return {};
              }
              if (sql.includes("INSERT INTO joy_core_tasks")) {
                const row = rowFromTaskArgs(args);
                state.coreTasks = state.coreTasks.filter((item) => item.id !== row.id);
                state.coreTasks.push(row);
                return {};
              }
              if (sql.includes("INSERT INTO joy_core_audit_events")) {
                state.audits.push({ id: args[1], action: args[4], entityId: args[6] });
                return {};
              }
              throw new Error(`Unexpected run query: ${sql}`);
            },
          };
        },
      };
    },
  };
}

test("explicit promotion preserves IELTS context and promotes only high-confidence tasks", async () => {
  const db = database({
    coreProjects: [coreProject("ielts"), coreProject("turtlebot4")],
    legacyProjects: [legacyProject("1"), legacyProject("2")],
    legacyTasks: [
      legacyTask("reading-1", "Complete the input reading task."),
      legacyTask("meeting-1", "Prepare for the graduation project meeting."),
      legacyTask("shopping-1", "Buy soy sauce."),
    ],
  });
  const env = { DB: db };
  const legacyBefore = structuredClone(db.state.legacyTasks);

  const first = await promoteLegacyJoyData(env, CONTEXT, { now: NOW });
  const auditCount = db.state.audits.length;
  const second = await promoteLegacyJoyData(env, CONTEXT, { now: NOW + 1 });

  assert.deepEqual(first.tasksCreated.sort(), [
    "task-legacy-meeting-1",
    "task-legacy-reading-1",
  ]);
  assert.deepEqual(second.tasksCreated, []);
  assert.deepEqual(second.tasksDeduplicated.sort(), first.tasksCreated.sort());
  assert.equal(db.state.audits.length, auditCount);
  assert.deepEqual(db.state.legacyTasks, legacyBefore);

  const ielts = await getJoyProject(env, CONTEXT, "ielts", { now: NOW });
  const turtleBot = await getJoyProject(env, CONTEXT, "turtlebot4", { now: NOW });
  assert.deepEqual(ielts.tasks.map((task) => task.id), ["task-legacy-reading-1"]);
  assert.deepEqual(turtleBot.tasks.map((task) => task.id), ["task-legacy-meeting-1"]);

  assert.equal(ielts.project.progress, 0);
  assert.equal(ielts.project.currentStageId, "august-foundation");
  assert.equal(ielts.project.metadata.targetOverallBand, 7);
  assert.equal(ielts.project.metadata.minimumSkillBand, 6.5);
  assert.equal(ielts.project.metadata.targetDate, "2026-12-31");
  assert.deepEqual(ielts.project.metadata.legacyMigration, {
    legacyProjectId: "2",
    reportedProgress: 62,
    previousFocus: "Speaking fluency",
    previousNextAction: "Complete a Part 2 mock",
    sourceRef: "legacy:joy_projects",
    reportedAt: NOW - 5_000,
  });

  const overview = await getJoyOverview(env, CONTEXT, { now: NOW });
  assert.deepEqual(
    overview.openTasks.map((task) => task.id).sort(),
    ["task-legacy-meeting-1", "task-legacy-reading-1"],
  );
  assert.deepEqual(overview.inboxTasks.map((task) => task.id), ["shopping-1"]);
  assert.deepEqual(overview.projects.map((project) => project.id).sort(), ["ielts", "turtlebot4"]);
});

test("all approved IELTS titles classify deterministically while general tasks stay in inbox", async () => {
  const approved = [
    ["save-1", "Save 50 each night and practice the Writing exam weekends."],
    ["read-1", "Complete the input reading task."],
    ["listen-1", "Complete the listening input task."],
    ["practice-1", "Complete the IELTS practice test."],
  ];
  const db = database({
    coreProjects: [coreProject("ielts")],
    legacyTasks: [
      ...approved.map(([id, title]) => legacyTask(id, title)),
      legacyTask("orientation-1", "Prepare for the Techvico orientation."),
      legacyTask("foil-1", "Buy aluminum foil."),
    ],
  });

  await promoteLegacyJoyData({ DB: db }, CONTEXT, { now: NOW });

  assert.deepEqual(
    db.state.coreTasks.map((task) => task.project_id),
    ["ielts", "ielts", "ielts", "ielts"],
  );
  assert.equal(legacyTaskCoreId("Read Task 1"), "task-legacy-read-task-1");
  assert.equal(legacyTaskCoreId("Read Task 1"), legacyTaskCoreId("Read Task 1"));
  assert.equal(legacyTaskSourceRef("read/1"), "legacy:tasks:read%2F1");
});

test("promotion skips a classified task when its canonical project is absent", async () => {
  const db = database({
    legacyProjects: [legacyProject("2")],
    legacyTasks: [legacyTask("reading-1", "Complete the input reading task.")],
  });

  const result = await promoteLegacyJoyData({ DB: db }, CONTEXT, { now: NOW });

  assert.deepEqual(result.tasksCreated, []);
  assert.deepEqual(result.tasksSkipped, ["reading-1"]);
  assert.deepEqual(db.state.coreTasks, []);
  assert.deepEqual(db.state.legacyTasks.map((task) => task.id), ["reading-1"]);
});
