import assert from "node:assert/strict";
import test from "node:test";

import { JOY_ACTIONS_OPENAPI } from "../worker/joy-actions-openapi-extended.js";
import { handleJoyActionsRequest } from "../worker/joy-actions.js";
import {
  appendProjectWorkSessionEvent,
  bootstrapProjectWorkspace,
  finishProjectWorkSession,
  startProjectWorkSession,
} from "../worker/project-memory/service.js";
import {
  JOY_CORE_ACTIONS,
  canPerformJoyCoreAction,
} from "../worker/joy-core/permissions.js";

const NOW = 1_800_000_000_000;
const CONTEXT = {
  userEmail: "owner@example.com",
  role: "assistant",
  scopes: null,
  actorType: "assistant",
  actorId: "gpt-ielts",
};

function memoryHarness() {
  const state = {
    snapshots: new Map(),
    sessions: new Map(),
    events: new Map(),
    decisions: new Map(),
    blockers: new Map(),
    evidence: new Map(),
    repoRefs: new Map(),
    project: {
      id: "ielts",
      title: "IELTS Journey",
      status: "active",
      progress: 10,
      currentFocus: "Baseline",
      nextAction: "Complete the baseline",
      blockers: [],
      version: 1,
    },
    progressLogs: [],
  };

  const values = (map, predicate = () => true) => [...map.values()].filter(predicate);
  const cloneList = (items) => items.map((item) => structuredClone(item));
  const repository = {
    getProjectSnapshot: async (_db, _email, projectId) => state.snapshots.get(projectId) || null,
    saveProjectSnapshot: async (_db, _email, value) => {
      state.snapshots.set(value.projectId, structuredClone(value));
      return structuredClone(value);
    },
    getWorkSession: async (_db, _email, id) => structuredClone(state.sessions.get(id) || null),
    getWorkSessionByRequestId: async (_db, _email, requestId) => structuredClone(
      values(state.sessions, (item) => item.clientRequestId === requestId)[0] || null,
    ),
    getOpenWorkSession: async (_db, _email, projectId) => structuredClone(
      values(state.sessions, (item) => item.projectId === projectId && item.status === "open")[0] || null,
    ),
    listWorkSessions: async (_db, _email, projectId, limit) => cloneList(values(
      state.sessions,
      (item) => item.projectId === projectId,
    ).sort((a, b) => b.startedAt - a.startedAt).slice(0, limit)),
    saveWorkSession: async (_db, _email, value) => {
      state.sessions.set(value.id, structuredClone(value));
      return structuredClone(value);
    },
    getWorkSessionEvent: async (_db, _email, id) => structuredClone(state.events.get(id) || null),
    getWorkSessionEventByRequestId: async (_db, _email, requestId) => structuredClone(
      values(state.events, (item) => item.clientRequestId === requestId)[0] || null,
    ),
    listWorkSessionEvents: async (_db, _email, sessionId, limit) => cloneList(values(
      state.events,
      (item) => item.sessionId === sessionId,
    ).sort((a, b) => a.occurredAt - b.occurredAt).slice(0, limit)),
    listRecentProjectEvents: async (_db, _email, projectId, limit) => cloneList(values(
      state.events,
      (item) => item.projectId === projectId,
    ).sort((a, b) => b.occurredAt - a.occurredAt).slice(0, limit)),
    saveWorkSessionEvent: async (_db, _email, value) => {
      state.events.set(value.id, structuredClone(value));
      return structuredClone(value);
    },
    getProjectDecision: async (_db, _email, id) => structuredClone(state.decisions.get(id) || null),
    listProjectDecisions: async (_db, _email, projectId, limit) => cloneList(values(
      state.decisions,
      (item) => item.projectId === projectId,
    ).slice(0, limit)),
    saveProjectDecision: async (_db, _email, value) => {
      state.decisions.set(value.id, structuredClone(value));
      return structuredClone(value);
    },
    getProjectBlocker: async (_db, _email, id) => structuredClone(state.blockers.get(id) || null),
    listProjectBlockers: async (_db, _email, projectId, status, limit) => cloneList(values(
      state.blockers,
      (item) => item.projectId === projectId && (!status || item.status === status),
    ).slice(0, limit)),
    saveProjectBlocker: async (_db, _email, value) => {
      state.blockers.set(value.id, structuredClone(value));
      return structuredClone(value);
    },
    listProjectMemoryEvidence: async (_db, _email, projectId, limit) => cloneList(values(
      state.evidence,
      (item) => item.projectId === projectId,
    ).slice(0, limit)),
    saveProjectMemoryEvidence: async (_db, _email, value) => {
      state.evidence.set(value.id, structuredClone(value));
      return structuredClone(value);
    },
    listProjectRepoRefs: async (_db, _email, projectId, limit) => cloneList(values(
      state.repoRefs,
      (item) => item.projectId === projectId,
    ).slice(0, limit)),
    saveProjectRepoRef: async (_db, _email, value) => {
      state.repoRefs.set(value.id, structuredClone(value));
      return structuredClone(value);
    },
  };

  const options = {
    now: NOW,
    repository,
    audit: async () => {},
    getProject: async () => ({
      project: structuredClone(state.project),
      tasks: [],
      milestones: [],
      progressLogs: [],
      evidence: [],
      compatibilityMode: false,
    }),
    updateProject: async (_env, _context, _projectId, patch) => {
      state.project = {
        ...state.project,
        ...structuredClone(patch),
        version: state.project.version + 1,
        updatedAt: NOW,
      };
      return structuredClone(state.project);
    },
    appendProgressLog: async (_env, _context, projectId, input) => {
      const log = { id: `log-${state.progressLogs.length + 1}`, projectId, ...structuredClone(input) };
      state.progressLogs.push(log);
      return { log, deduplicated: false };
    },
  };
  return { state, options };
}

test("one work session carries project context into the next GPT conversation", async () => {
  const harness = memoryHarness();
  const env = { DB: {} };
  const started = await startProjectWorkSession(env, CONTEXT, "ielts", {
    title: "IELTS baseline review",
    goal: "Review Listening and prepare the next four-skill tasks",
    clientRequestId: "ielts-session-20260801",
  }, harness.options);

  assert.equal(started.session.status, "open");
  assert.equal(started.snapshot.currentGoal, started.session.goal);

  const decision = await appendProjectWorkSessionEvent(env, CONTEXT, started.session.id, {
    kind: "decision",
    title: "Use official keys for final scores",
    detail: "Transcript-only grading remains provisional.",
    decision: {
      decision: "Only official answer keys can produce final IELTS scores.",
      rationale: "Transcription can mishear spelling, numbers, and names.",
    },
    clientRequestId: "ielts-decision-official-key",
  }, harness.options);
  assert.equal(decision.typedMemory.decision.status, "active");

  const blocker = await appendProjectWorkSessionEvent(env, CONTEXT, started.session.id, {
    kind: "blocker",
    title: "Reading answer key missing",
    detail: "The current baseline cannot be graded officially yet.",
    blocker: { status: "open" },
    clientRequestId: "ielts-blocker-answer-key",
  }, harness.options);
  assert.equal(blocker.typedMemory.blocker.status, "open");

  await appendProjectWorkSessionEvent(env, CONTEXT, started.session.id, {
    kind: "repo_ref",
    title: "IELTS bridge branch",
    detail: "Code prepared for review.",
    repoRef: {
      repoFullName: "vah103/joy-personal-dashboard",
      refType: "branch",
      ref: "agent/ielts-session-memory",
      status: "active",
    },
    clientRequestId: "ielts-repo-ref-branch",
  }, harness.options);

  const finished = await finishProjectWorkSession(env, CONTEXT, started.session.id, {
    summary: "Listening review completed and the scoring rule was documented.",
    outcomes: ["Listening transcript reviewed", "Official-key rule saved"],
    nextActions: ["Obtain the Reading answer key", "Continue the Reading baseline"],
    currentState: { listeningReviewed: true },
    projectUpdate: { progress: 15 },
    clientRequestId: "finish-ielts-session-20260801",
  }, harness.options);

  assert.equal(finished.session.status, "completed");
  assert.equal(finished.project.progress, 15);
  assert.equal(finished.project.nextAction, "Obtain the Reading answer key");
  assert.deepEqual(finished.project.blockers, ["Reading answer key missing"]);
  assert.equal(harness.state.progressLogs.length, 1);

  const workspace = await bootstrapProjectWorkspace(
    env,
    CONTEXT,
    "ielts",
    {},
    harness.options,
  );
  assert.equal(workspace.continuation.status, "ready_for_new_session");
  assert.match(workspace.continuation.latestSummary, /Listening review completed/);
  assert.equal(workspace.continuation.nextActions[0], "Obtain the Reading answer key");
  assert.deepEqual(workspace.continuation.blockers, ["Reading answer key missing"]);
  assert.equal(workspace.memory.decisions.length, 1);
  assert.equal(workspace.memory.repoRefs[0].ref, "agent/ielts-session-memory");
});

test("session and event retries are idempotent", async () => {
  const harness = memoryHarness();
  const env = { DB: {} };
  const input = {
    title: "TurtleBot4 lab",
    goal: "Validate localization",
    clientRequestId: "tb4-lab-20260801",
  };
  const first = await startProjectWorkSession(env, CONTEXT, "ielts", input, harness.options);
  const second = await startProjectWorkSession(env, CONTEXT, "ielts", input, harness.options);
  assert.equal(first.session.id, second.session.id);
  assert.equal(second.deduplicated, true);

  const eventInput = {
    kind: "test",
    title: "Localization smoke test",
    detail: "The robot stayed localized after a short drive.",
    clientRequestId: "tb4-localization-smoke",
  };
  const eventFirst = await appendProjectWorkSessionEvent(
    env,
    CONTEXT,
    first.session.id,
    eventInput,
    harness.options,
  );
  const eventSecond = await appendProjectWorkSessionEvent(
    env,
    CONTEXT,
    first.session.id,
    eventInput,
    harness.options,
  );
  assert.equal(eventFirst.event.id, eventSecond.event.id);
  assert.equal(eventSecond.deduplicated, true);
});

test("assistant and viewer roles receive safe memory permissions", () => {
  assert.equal(
    canPerformJoyCoreAction("viewer", JOY_CORE_ACTIONS.WORKSPACE_READ),
    true,
  );
  assert.equal(
    canPerformJoyCoreAction("viewer", JOY_CORE_ACTIONS.SESSION_CREATE),
    false,
  );
  assert.equal(
    canPerformJoyCoreAction("assistant", JOY_CORE_ACTIONS.MEMORY_CREATE),
    true,
  );
  assert.equal(
    canPerformJoyCoreAction(
      "assistant",
      JOY_CORE_ACTIONS.SESSION_UPDATE,
      [JOY_CORE_ACTIONS.WORKSPACE_READ],
    ),
    false,
  );
});

test("GPT Actions publishes four project-memory operations with Builder-safe descriptions", () => {
  assert.equal(JOY_ACTIONS_OPENAPI.info.version, "1.4.0");
  const operations = Object.values(JOY_ACTIONS_OPENAPI.paths)
    .flatMap((methods) => Object.values(methods))
    .filter((operation) => operation && typeof operation === "object" && operation.operationId);
  const ids = operations.map((operation) => operation.operationId);
  for (const id of [
    "bootstrapJoyWorkspace",
    "startJoyWorkSession",
    "appendJoyWorkSessionEvent",
    "finishJoyWorkSession",
  ]) {
    assert.equal(ids.includes(id), true, id);
  }
  for (const operation of operations) {
    assert.ok((operation.description || "").length <= 300, operation.operationId);
  }
});

test("authenticated Joy Actions delegates workspace bootstrap to project memory", async () => {
  let received = null;
  const response = await handleJoyActionsRequest(
    new Request("https://app.hey-joy.workers.dev/api/joy/v1/workspaces/ielts?limit=5", {
      headers: { Authorization: "Bearer test" },
    }),
    {},
    {
      authenticate: async () => CONTEXT,
      projectMemoryService: {
        async bootstrapWorkspace(env, context, projectId, input) {
          received = { env, context, projectId, input };
          return {
            project: { project: { id: projectId } },
            memory: {
              snapshot: null,
              activeSession: null,
              activeEvents: [],
              recentSessions: [],
              recentEvents: [],
              decisions: [],
              openBlockers: [],
              evidence: [],
              repoRefs: [],
            },
            continuation: {
              status: "ready_for_new_session",
              currentGoal: "",
              nextActions: [],
              blockers: [],
              latestSummary: "",
            },
            generatedAt: NOW,
          };
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(received.projectId, "ielts");
  assert.equal(received.input.limit, "5");
});
