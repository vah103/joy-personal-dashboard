import {
  normalizeProjectBlocker,
  normalizeProjectDecision,
  normalizeProjectMemoryEvidence,
  normalizeProjectRepoRef,
  normalizeProjectSnapshot,
  normalizeWorkSession,
  normalizeWorkSessionEvent,
} from "./model.js";
import * as memoryRepository from "./repository.js";
import {
  JOY_CORE_ACTIONS,
  assertJoyCorePermission,
} from "../joy-core/permissions.js";
import {
  JoyCoreError,
  appendJoyProgressLog,
  getJoyProject,
  updateJoyProject,
} from "../joy-core/service.js";
import { recordCoreAuditEvent } from "../joy-core/repository.js";

function requireDatabase(env) {
  if (!env?.DB) throw new JoyCoreError("JOY_CORE_DATABASE_UNAVAILABLE", 503);
  return env.DB;
}

function nowValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : Date.now();
}

function stableRequestId(value, field = "clientRequestId") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (!normalized) throw new JoyCoreError("JOY_MEMORY_INVALID_INPUT", 400, { field });
  return normalized;
}

function generatedId(prefix, requestId) {
  return `${prefix}-${stableRequestId(requestId)}`.slice(0, 80);
}

function optionalText(value, maxLength = 20_000) {
  return String(value || "").trim().slice(0, maxLength);
}

function requiredText(value, field, maxLength = 20_000) {
  const text = optionalText(value, maxLength);
  if (!text) throw new JoyCoreError("JOY_MEMORY_INVALID_INPUT", 400, { field });
  return text;
}

function stringList(value, maxItems = 50, maxLength = 4_000) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function permission(context, action) {
  assertJoyCorePermission(context?.role, action, context?.scopes);
}

function serviceDependencies(options = {}) {
  return {
    repository: options.repository || memoryRepository,
    getProject: options.getProject || getJoyProject,
    updateProject: options.updateProject || updateJoyProject,
    appendProgressLog: options.appendProgressLog || appendJoyProgressLog,
    audit: options.audit || recordCoreAuditEvent,
  };
}

async function audit(env, context, action, entityType, entityId, payload, now, dependencies) {
  if (dependencies.audit === false) return;
  const db = requireDatabase(env);
  await dependencies.audit(db, context.userEmail, {
    id: `audit-${crypto.randomUUID()}`,
    actorType: context.actorType || "assistant",
    actorId: context.actorId || "custom-gpt",
    action,
    entityType,
    entityId,
    payload,
    createdAt: now,
  });
}

async function ensureWritableProject(env, context, projectId, now, dependencies) {
  let detail = await dependencies.getProject(env, context, projectId, { now });
  if (!detail.compatibilityMode) return detail;
  await dependencies.updateProject(env, context, projectId, {
    currentFocus: detail.project.currentFocus,
    nextAction: detail.project.nextAction,
    blockers: detail.project.blockers,
  }, { now });
  detail = await dependencies.getProject(env, context, projectId, { now });
  return detail;
}

function defaultSnapshot(projectId, now) {
  return normalizeProjectSnapshot({
    projectId,
    createdAt: now,
    updatedAt: now,
  }, now);
}

function snapshotWith(snapshot, patch, now) {
  return normalizeProjectSnapshot({
    ...(snapshot || defaultSnapshot(patch.projectId, now)),
    ...patch,
    projectId: patch.projectId || snapshot?.projectId,
    version: Number(snapshot?.version || 0) + 1,
    createdAt: snapshot?.createdAt || now,
    updatedAt: now,
  }, now);
}

export async function bootstrapProjectWorkspace(
  env,
  context,
  projectId,
  input = {},
  options = {},
) {
  permission(context, JOY_CORE_ACTIONS.WORKSPACE_READ);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  const dependencies = serviceDependencies(options);
  const detail = await dependencies.getProject(env, context, projectId, { now });
  const limit = Math.min(20, Math.max(1, Number(input.limit || 8)));
  const [
    snapshot,
    activeSession,
    recentSessions,
    recentEvents,
    decisions,
    openBlockers,
    evidence,
    repoRefs,
  ] = await Promise.all([
    dependencies.repository.getProjectSnapshot(db, context.userEmail, projectId),
    dependencies.repository.getOpenWorkSession(db, context.userEmail, projectId),
    dependencies.repository.listWorkSessions(db, context.userEmail, projectId, limit),
    dependencies.repository.listRecentProjectEvents(db, context.userEmail, projectId, limit * 4),
    dependencies.repository.listProjectDecisions(db, context.userEmail, projectId, limit * 2),
    dependencies.repository.listProjectBlockers(db, context.userEmail, projectId, "open", limit * 2),
    dependencies.repository.listProjectMemoryEvidence(db, context.userEmail, projectId, limit * 2),
    dependencies.repository.listProjectRepoRefs(db, context.userEmail, projectId, limit * 2),
  ]);
  const activeEvents = activeSession
    ? await dependencies.repository.listWorkSessionEvents(
      db,
      context.userEmail,
      activeSession.id,
      100,
    )
    : [];
  return {
    project: detail,
    memory: {
      snapshot,
      activeSession,
      activeEvents,
      recentSessions,
      recentEvents,
      decisions,
      openBlockers,
      evidence,
      repoRefs,
    },
    continuation: {
      status: activeSession ? "resume_active_session" : "ready_for_new_session",
      currentGoal: activeSession?.goal || snapshot?.currentGoal || detail.project.currentFocus || "",
      nextActions: snapshot?.nextActions?.length
        ? snapshot.nextActions
        : detail.project.nextAction
          ? [detail.project.nextAction]
          : [],
      blockers: openBlockers.map((item) => item.title),
      latestSummary: snapshot?.summary || "",
    },
    generatedAt: now,
  };
}

export async function startProjectWorkSession(
  env,
  context,
  projectId,
  input = {},
  options = {},
) {
  permission(context, JOY_CORE_ACTIONS.SESSION_CREATE);
  permission(context, JOY_CORE_ACTIONS.WORKSPACE_UPDATE);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  const dependencies = serviceDependencies(options);
  const requestId = stableRequestId(input.clientRequestId);
  const existing = await dependencies.repository.getWorkSessionByRequestId(
    db,
    context.userEmail,
    requestId,
  );
  if (existing) {
    return { session: existing, deduplicated: true, resumed: existing.status === "open" };
  }

  await ensureWritableProject(env, context, projectId, now, dependencies);
  const active = await dependencies.repository.getOpenWorkSession(
    db,
    context.userEmail,
    projectId,
  );
  if (active) {
    if (input.resumeExisting !== false) {
      return { session: active, deduplicated: false, resumed: true };
    }
    throw new JoyCoreError("JOY_WORK_SESSION_ALREADY_OPEN", 409, { activeSession: active });
  }

  const session = normalizeWorkSession({
    id: generatedId("session", requestId),
    projectId,
    title: requiredText(input.title, "title", 240),
    goal: requiredText(input.goal, "goal", 4_000),
    status: "open",
    metadata: plainObject(input.metadata),
    actorType: context.actorType || "assistant",
    actorId: context.actorId || "custom-gpt",
    clientRequestId: requestId,
    version: 1,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  }, now);
  const saved = await dependencies.repository.saveWorkSession(db, context.userEmail, session);
  const currentSnapshot = await dependencies.repository.getProjectSnapshot(
    db,
    context.userEmail,
    projectId,
  );
  const snapshot = await dependencies.repository.saveProjectSnapshot(
    db,
    context.userEmail,
    snapshotWith(currentSnapshot, {
      projectId,
      currentGoal: saved.goal,
      latestSessionId: saved.id,
      currentState: {
        ...(currentSnapshot?.currentState || {}),
        sessionStatus: "open",
        sessionTitle: saved.title,
        sessionStartedAt: saved.startedAt,
      },
    }, now),
  );
  await audit(env, context, JOY_CORE_ACTIONS.SESSION_CREATE, "work_session", saved.id, {
    projectId,
    goal: saved.goal,
  }, now, dependencies);
  return { session: saved, snapshot, deduplicated: false, resumed: false };
}

async function saveTypedMemory(db, context, session, event, input, now, repository) {
  const typed = {};
  if (event.kind === "decision") {
    const value = plainObject(input.decision);
    const decision = normalizeProjectDecision({
      id: value.id || `decision-${event.id}`,
      projectId: session.projectId,
      sessionId: session.id,
      title: value.title || event.title,
      decision: value.decision || event.detail,
      rationale: value.rationale,
      status: value.status,
      supersedesId: value.supersedesId,
      occurredAt: event.occurredAt,
      createdAt: now,
      updatedAt: now,
    }, now);
    if (decision.supersedesId) {
      const previous = await repository.getProjectDecision(
        db,
        context.userEmail,
        decision.supersedesId,
      );
      if (previous && previous.projectId === session.projectId) {
        await repository.saveProjectDecision(db, context.userEmail, normalizeProjectDecision({
          ...previous,
          status: "superseded",
          updatedAt: now,
        }, now));
      }
    }
    typed.decision = await repository.saveProjectDecision(db, context.userEmail, decision);
  }

  if (event.kind === "blocker") {
    const value = plainObject(input.blocker);
    const requestedId = value.id || `blocker-${event.id}`;
    const current = value.id
      ? await repository.getProjectBlocker(db, context.userEmail, requestedId)
      : null;
    if (current && current.projectId !== session.projectId) {
      throw new JoyCoreError("JOY_MEMORY_BLOCKER_PROJECT_MISMATCH", 400);
    }
    const blocker = normalizeProjectBlocker({
      ...(current || {}),
      id: requestedId,
      projectId: session.projectId,
      sessionId: session.id,
      title: value.title || current?.title || event.title,
      detail: value.detail || current?.detail || event.detail,
      status: value.status || current?.status || "open",
      resolution: value.resolution || current?.resolution,
      openedAt: current?.openedAt || event.occurredAt,
      resolvedAt: value.status === "resolved" ? now : current?.resolvedAt,
      createdAt: current?.createdAt || now,
      updatedAt: now,
    }, now);
    typed.blocker = await repository.saveProjectBlocker(db, context.userEmail, blocker);
  }

  if (event.kind === "evidence") {
    const value = plainObject(input.evidence);
    const evidence = normalizeProjectMemoryEvidence({
      id: value.id || `memory-evidence-${event.id}`,
      projectId: session.projectId,
      sessionId: session.id,
      label: value.label || event.title,
      kind: value.kind,
      uri: value.uri,
      detail: value.detail || event.detail,
      metadata: value.metadata,
      createdAt: event.occurredAt,
    }, now);
    typed.evidence = await repository.saveProjectMemoryEvidence(
      db,
      context.userEmail,
      evidence,
    );
  }

  if (event.kind === "repo_ref" || input.repoRef) {
    const value = plainObject(input.repoRef);
    const repoRef = normalizeProjectRepoRef({
      id: value.id || `repo-ref-${event.id}`,
      projectId: session.projectId,
      sessionId: session.id,
      repoFullName: value.repoFullName,
      refType: value.refType,
      ref: value.ref,
      uri: value.uri,
      status: value.status,
      metadata: value.metadata,
      createdAt: now,
      updatedAt: now,
    }, now);
    typed.repoRef = await repository.saveProjectRepoRef(db, context.userEmail, repoRef);
  }
  return typed;
}

export async function appendProjectWorkSessionEvent(
  env,
  context,
  sessionId,
  input = {},
  options = {},
) {
  permission(context, JOY_CORE_ACTIONS.SESSION_UPDATE);
  permission(context, JOY_CORE_ACTIONS.MEMORY_CREATE);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  const dependencies = serviceDependencies(options);
  const session = await dependencies.repository.getWorkSession(db, context.userEmail, sessionId);
  if (!session) throw new JoyCoreError("JOY_WORK_SESSION_NOT_FOUND", 404);
  if (session.status !== "open") {
    throw new JoyCoreError("JOY_WORK_SESSION_CLOSED", 409, { session });
  }
  const requestId = stableRequestId(input.clientRequestId);
  const existing = await dependencies.repository.getWorkSessionEventByRequestId(
    db,
    context.userEmail,
    requestId,
  );
  if (existing) {
    return { event: existing, typedMemory: {}, deduplicated: true };
  }
  const event = normalizeWorkSessionEvent({
    id: generatedId("event", requestId),
    sessionId: session.id,
    projectId: session.projectId,
    kind: input.kind,
    title: requiredText(input.title, "title", 240),
    detail: input.detail,
    payload: plainObject(input.payload),
    occurredAt: input.occurredAt || now,
    clientRequestId: requestId,
    createdAt: now,
  }, now);
  const saved = await dependencies.repository.saveWorkSessionEvent(
    db,
    context.userEmail,
    event,
  );
  const typedMemory = await saveTypedMemory(
    db,
    context,
    session,
    saved,
    input,
    now,
    dependencies.repository,
  );
  const currentSnapshot = await dependencies.repository.getProjectSnapshot(
    db,
    context.userEmail,
    session.projectId,
  );
  const snapshot = await dependencies.repository.saveProjectSnapshot(
    db,
    context.userEmail,
    snapshotWith(currentSnapshot, {
      projectId: session.projectId,
      currentGoal: session.goal,
      latestSessionId: session.id,
      currentState: {
        ...(currentSnapshot?.currentState || {}),
        lastEventKind: saved.kind,
        lastEventTitle: saved.title,
        lastEventAt: saved.occurredAt,
      },
    }, now),
  );
  await audit(env, context, JOY_CORE_ACTIONS.MEMORY_CREATE, "work_session_event", saved.id, {
    sessionId: session.id,
    projectId: session.projectId,
    kind: saved.kind,
  }, now, dependencies);
  return { event: saved, typedMemory, snapshot, deduplicated: false };
}

function sessionLogDetail(summary, outcomes, nextActions) {
  const sections = [summary];
  if (outcomes.length) sections.push(`Outcomes:\n- ${outcomes.join("\n- ")}`);
  if (nextActions.length) sections.push(`Next actions:\n- ${nextActions.join("\n- ")}`);
  return sections.join("\n\n");
}

export async function finishProjectWorkSession(
  env,
  context,
  sessionId,
  input = {},
  options = {},
) {
  permission(context, JOY_CORE_ACTIONS.SESSION_UPDATE);
  permission(context, JOY_CORE_ACTIONS.WORKSPACE_UPDATE);
  permission(context, JOY_CORE_ACTIONS.PROJECT_UPDATE);
  permission(context, JOY_CORE_ACTIONS.LOG_CREATE);
  const db = requireDatabase(env);
  const now = nowValue(options.now);
  const dependencies = serviceDependencies(options);
  const session = await dependencies.repository.getWorkSession(db, context.userEmail, sessionId);
  if (!session) throw new JoyCoreError("JOY_WORK_SESSION_NOT_FOUND", 404);
  if (session.status === "completed") {
    const snapshot = await dependencies.repository.getProjectSnapshot(
      db,
      context.userEmail,
      session.projectId,
    );
    return { session, snapshot, deduplicated: true };
  }
  if (session.status !== "open") throw new JoyCoreError("JOY_WORK_SESSION_CLOSED", 409);

  stableRequestId(input.clientRequestId);
  const summary = requiredText(input.summary, "summary", 20_000);
  const outcomes = stringList(input.outcomes, 50, 4_000);
  const nextActions = stringList(input.nextActions, 30, 2_000);
  const openBlockers = await dependencies.repository.listProjectBlockers(
    db,
    context.userEmail,
    session.projectId,
    "open",
    100,
  );
  const currentDetail = await ensureWritableProject(
    env,
    context,
    session.projectId,
    now,
    dependencies,
  );
  const explicitPatch = plainObject(input.projectUpdate);
  const defaultNextAction = nextActions[0] || currentDetail.project.nextAction || "";
  const projectPatch = {
    currentFocus: Object.hasOwn(explicitPatch, "currentFocus")
      ? explicitPatch.currentFocus
      : defaultNextAction || session.goal,
    nextAction: Object.hasOwn(explicitPatch, "nextAction")
      ? explicitPatch.nextAction
      : defaultNextAction,
    blockers: Object.hasOwn(explicitPatch, "blockers")
      ? explicitPatch.blockers
      : openBlockers.map((item) => item.title),
    ...explicitPatch,
  };
  const project = await dependencies.updateProject(
    env,
    context,
    session.projectId,
    projectPatch,
    { now },
  );

  const completed = normalizeWorkSession({
    ...session,
    status: "completed",
    summary,
    outcomes,
    nextActions,
    metadata: {
      ...session.metadata,
      ...(plainObject(input.metadata)),
    },
    version: session.version + 1,
    endedAt: now,
    updatedAt: now,
  }, now);
  const savedSession = await dependencies.repository.saveWorkSession(
    db,
    context.userEmail,
    completed,
  );
  const currentSnapshot = await dependencies.repository.getProjectSnapshot(
    db,
    context.userEmail,
    session.projectId,
  );
  const snapshot = await dependencies.repository.saveProjectSnapshot(
    db,
    context.userEmail,
    snapshotWith(currentSnapshot, {
      projectId: session.projectId,
      summary,
      currentGoal: nextActions[0] || "",
      currentState: {
        ...plainObject(input.currentState),
        sessionStatus: "completed",
        lastCompletedSessionId: session.id,
        lastCompletedAt: now,
        outcomes,
      },
      nextActions,
      latestSessionId: session.id,
    }, now),
  );
  const logResult = await dependencies.appendProgressLog(env, context, session.projectId, {
    kind: "result",
    title: optionalText(input.logTitle, 240) || `Work session: ${session.title}`,
    detail: sessionLogDetail(summary, outcomes, nextActions),
    progressAfter: Object.hasOwn(projectPatch, "progress") ? projectPatch.progress : null,
    occurredAt: now,
    metadata: {
      workSessionId: session.id,
      outcomes,
      nextActions,
    },
    clientRequestId: `finish-${session.id}`,
  }, { now });
  await audit(env, context, JOY_CORE_ACTIONS.SESSION_UPDATE, "work_session", session.id, {
    projectId: session.projectId,
    status: "completed",
    projectVersion: project.version,
  }, now, dependencies);
  return {
    session: savedSession,
    snapshot,
    project,
    progressLog: logResult.log || logResult,
    openBlockers,
    deduplicated: false,
  };
}

export const PROJECT_MEMORY_SERVICE = Object.freeze({
  bootstrapWorkspace: bootstrapProjectWorkspace,
  startWorkSession: startProjectWorkSession,
  appendSessionEvent: appendProjectWorkSessionEvent,
  finishWorkSession: finishProjectWorkSession,
});
