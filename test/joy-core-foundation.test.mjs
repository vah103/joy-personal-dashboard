import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeEvidence,
  normalizeMilestone,
  normalizeProgressLog,
  normalizeProject,
  normalizeTask,
} from "../worker/joy-core/model.js";
import {
  JOY_CORE_ACTIONS,
  assertJoyCorePermission,
  canPerformJoyCoreAction,
} from "../worker/joy-core/permissions.js";

const NOW = 1_785_491_580_000;

test("normalizes a canonical project and completes progress", () => {
  const project = normalizeProject({
    id: "TurtleBot4",
    title: "TurtleBot4 thesis",
    status: "completed",
    progress: 62,
    blockers: ["", "No blocker"],
  }, NOW);

  assert.equal(project.id, "turtlebot4");
  assert.equal(project.status, "completed");
  assert.equal(project.progress, 100);
  assert.deepEqual(project.blockers, ["No blocker"]);
  assert.equal(project.createdAt, NOW);
});

test("normalizes related task, milestone, log, and evidence records", () => {
  const milestone = normalizeMilestone({
    id: "stage-4",
    projectId: "turtlebot4",
    title: "Simulation baseline",
  }, NOW);
  const task = normalizeTask({
    id: "stage-4-sim",
    projectId: "turtlebot4",
    milestoneId: milestone.id,
    title: "Launch one simulated world",
    status: "done",
  }, NOW);
  const log = normalizeProgressLog({
    id: "log-stage-4-sim",
    projectId: "turtlebot4",
    taskId: task.id,
    title: "Simulation launched",
    kind: "result",
    progressAfter: 105,
  }, NOW);
  const evidence = normalizeEvidence({
    id: "evidence-stage-4-sim",
    projectId: "turtlebot4",
    taskId: task.id,
    progressLogId: log.id,
    label: "Launch log",
    uri: "report/2026-07-31.md",
    kind: "log",
  }, NOW);

  assert.equal(task.completedAt, NOW);
  assert.equal(log.progressAfter, 100);
  assert.equal(evidence.progressLogId, log.id);
});

test("rejects unstable identifiers and unsupported statuses", () => {
  assert.throws(
    () => normalizeProject({ id: "Bad ID", title: "Invalid" }, NOW),
    /project\.id/,
  );
  assert.throws(
    () => normalizeTask({
      id: "task-1",
      projectId: "project-1",
      title: "Invalid status",
      status: "finished",
    }, NOW),
    /task\.status/,
  );
});

test("keeps assistant writes safe and reserves destructive actions for owner", () => {
  assert.equal(
    canPerformJoyCoreAction("assistant", JOY_CORE_ACTIONS.TASK_UPDATE),
    true,
  );
  assert.equal(
    canPerformJoyCoreAction("assistant", JOY_CORE_ACTIONS.TASK_DELETE),
    false,
  );
  assert.equal(
    canPerformJoyCoreAction("viewer", JOY_CORE_ACTIONS.PROJECT_READ),
    true,
  );
  assert.throws(
    () => assertJoyCorePermission("assistant", JOY_CORE_ACTIONS.PROJECT_DELETE),
    /JOY_CORE_FORBIDDEN/,
  );
  assert.doesNotThrow(
    () => assertJoyCorePermission("owner", JOY_CORE_ACTIONS.PROJECT_DELETE),
  );
});

test("honors optional client scopes after role permissions", () => {
  assert.equal(
    canPerformJoyCoreAction(
      "assistant",
      JOY_CORE_ACTIONS.TASK_UPDATE,
      [JOY_CORE_ACTIONS.TASK_READ],
    ),
    false,
  );
  assert.equal(
    canPerformJoyCoreAction("assistant", JOY_CORE_ACTIONS.TASK_UPDATE, ["*"]),
    true,
  );
});
