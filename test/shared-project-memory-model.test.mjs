import assert from "node:assert/strict";
import test from "node:test";

import { normalizeProjectRepoRef } from "../worker/project-memory/model.js";

const NOW = 1_800_000_000_000;

test("project memory requires an explicit valid repository reference type", () => {
  assert.throws(
    () => normalizeProjectRepoRef({
      id: "repo-ref-1",
      projectId: "turtlebot4",
      repoFullName: "vah103/joy-personal-dashboard",
      ref: "agent/shared-project-memory",
    }, NOW),
    /repoRef\.refType/,
  );

  const value = normalizeProjectRepoRef({
    id: "repo-ref-2",
    projectId: "turtlebot4",
    repoFullName: "vah103/joy-personal-dashboard",
    refType: "branch",
    ref: "agent/shared-project-memory",
  }, NOW);

  assert.equal(value.refType, "branch");
  assert.equal(value.status, "active");
});
