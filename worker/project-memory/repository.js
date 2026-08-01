function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function resultsOf(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function snapshotFromRow(row) {
  if (!row) return null;
  return {
    projectId: row.project_id,
    summary: row.summary || "",
    currentGoal: row.current_goal || "",
    currentState: parseJson(row.current_state_json, {}),
    nextActions: parseJson(row.next_actions_json, []),
    latestSessionId: row.latest_session_id || null,
    version: Number(row.version || 0),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

function sessionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    goal: row.goal,
    status: row.status,
    summary: row.summary || "",
    outcomes: parseJson(row.outcomes_json, []),
    nextActions: parseJson(row.next_actions_json, []),
    metadata: parseJson(row.metadata_json, {}),
    actorType: row.actor_type,
    actorId: row.actor_id,
    clientRequestId: row.client_request_id || null,
    version: Number(row.version || 0),
    startedAt: Number(row.started_at || 0),
    endedAt: row.ended_at === null || row.ended_at === undefined ? null : Number(row.ended_at),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

function eventFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    projectId: row.project_id,
    kind: row.kind,
    title: row.title,
    detail: row.detail || "",
    payload: parseJson(row.payload_json, {}),
    occurredAt: Number(row.occurred_at || 0),
    clientRequestId: row.client_request_id || null,
    createdAt: Number(row.created_at || 0),
  };
}

function decisionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id || null,
    title: row.title,
    decision: row.decision,
    rationale: row.rationale || "",
    status: row.status,
    supersedesId: row.supersedes_id || null,
    occurredAt: Number(row.occurred_at || 0),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

function blockerFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id || null,
    title: row.title,
    detail: row.detail || "",
    status: row.status,
    resolution: row.resolution || "",
    openedAt: Number(row.opened_at || 0),
    resolvedAt: row.resolved_at === null || row.resolved_at === undefined
      ? null
      : Number(row.resolved_at),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

function memoryEvidenceFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id || null,
    label: row.label,
    kind: row.kind,
    uri: row.uri || null,
    detail: row.detail || "",
    metadata: parseJson(row.metadata_json, {}),
    createdAt: Number(row.created_at || 0),
  };
}

function repoRefFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id || null,
    repoFullName: row.repo_full_name,
    refType: row.ref_type,
    ref: row.ref,
    uri: row.uri || null,
    status: row.status,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

export async function getProjectSnapshot(db, userEmail, projectId) {
  const row = await db.prepare(`
    SELECT * FROM joy_project_snapshots
    WHERE user_email = ? AND project_id = ?
  `).bind(userEmail, projectId).first();
  return snapshotFromRow(row);
}

export async function saveProjectSnapshot(db, userEmail, snapshot) {
  await db.prepare(`
    INSERT INTO joy_project_snapshots (
      user_email, project_id, summary, current_goal, current_state_json,
      next_actions_json, latest_session_id, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, project_id) DO UPDATE SET
      summary = excluded.summary,
      current_goal = excluded.current_goal,
      current_state_json = excluded.current_state_json,
      next_actions_json = excluded.next_actions_json,
      latest_session_id = excluded.latest_session_id,
      version = excluded.version,
      updated_at = excluded.updated_at
  `).bind(
    userEmail,
    snapshot.projectId,
    snapshot.summary,
    snapshot.currentGoal,
    JSON.stringify(snapshot.currentState || {}),
    JSON.stringify(snapshot.nextActions || []),
    snapshot.latestSessionId,
    snapshot.version,
    snapshot.createdAt,
    snapshot.updatedAt,
  ).run();
  return getProjectSnapshot(db, userEmail, snapshot.projectId);
}

export async function getWorkSession(db, userEmail, sessionId) {
  const row = await db.prepare(`
    SELECT * FROM joy_work_sessions
    WHERE user_email = ? AND id = ?
  `).bind(userEmail, sessionId).first();
  return sessionFromRow(row);
}

export async function getWorkSessionByRequestId(db, userEmail, clientRequestId) {
  if (!clientRequestId) return null;
  const row = await db.prepare(`
    SELECT * FROM joy_work_sessions
    WHERE user_email = ? AND client_request_id = ?
  `).bind(userEmail, clientRequestId).first();
  return sessionFromRow(row);
}

export async function getOpenWorkSession(db, userEmail, projectId) {
  const row = await db.prepare(`
    SELECT * FROM joy_work_sessions
    WHERE user_email = ? AND project_id = ? AND status = 'open'
    ORDER BY started_at DESC
    LIMIT 1
  `).bind(userEmail, projectId).first();
  return sessionFromRow(row);
}

export async function listWorkSessions(db, userEmail, projectId, limit = 10) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit || 10)));
  const result = await db.prepare(`
    SELECT * FROM joy_work_sessions
    WHERE user_email = ? AND project_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `).bind(userEmail, projectId, safeLimit).all();
  return resultsOf(result).map(sessionFromRow);
}

export async function saveWorkSession(db, userEmail, session) {
  await db.prepare(`
    INSERT INTO joy_work_sessions (
      user_email, id, project_id, title, goal, status, summary,
      outcomes_json, next_actions_json, metadata_json, actor_type, actor_id,
      client_request_id, version, started_at, ended_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO UPDATE SET
      title = excluded.title,
      goal = excluded.goal,
      status = excluded.status,
      summary = excluded.summary,
      outcomes_json = excluded.outcomes_json,
      next_actions_json = excluded.next_actions_json,
      metadata_json = excluded.metadata_json,
      version = excluded.version,
      ended_at = excluded.ended_at,
      updated_at = excluded.updated_at
  `).bind(
    userEmail,
    session.id,
    session.projectId,
    session.title,
    session.goal,
    session.status,
    session.summary,
    JSON.stringify(session.outcomes || []),
    JSON.stringify(session.nextActions || []),
    JSON.stringify(session.metadata || {}),
    session.actorType,
    session.actorId,
    session.clientRequestId,
    session.version,
    session.startedAt,
    session.endedAt,
    session.createdAt,
    session.updatedAt,
  ).run();
  return getWorkSession(db, userEmail, session.id);
}

export async function getWorkSessionEvent(db, userEmail, eventId) {
  const row = await db.prepare(`
    SELECT * FROM joy_work_session_events
    WHERE user_email = ? AND id = ?
  `).bind(userEmail, eventId).first();
  return eventFromRow(row);
}

export async function getWorkSessionEventByRequestId(db, userEmail, clientRequestId) {
  if (!clientRequestId) return null;
  const row = await db.prepare(`
    SELECT * FROM joy_work_session_events
    WHERE user_email = ? AND client_request_id = ?
  `).bind(userEmail, clientRequestId).first();
  return eventFromRow(row);
}

export async function listWorkSessionEvents(db, userEmail, sessionId, limit = 100) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit || 100)));
  const result = await db.prepare(`
    SELECT * FROM joy_work_session_events
    WHERE user_email = ? AND session_id = ?
    ORDER BY occurred_at ASC, created_at ASC
    LIMIT ?
  `).bind(userEmail, sessionId, safeLimit).all();
  return resultsOf(result).map(eventFromRow);
}

export async function listRecentProjectEvents(db, userEmail, projectId, limit = 30) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 30)));
  const result = await db.prepare(`
    SELECT * FROM joy_work_session_events
    WHERE user_email = ? AND project_id = ?
    ORDER BY occurred_at DESC, created_at DESC
    LIMIT ?
  `).bind(userEmail, projectId, safeLimit).all();
  return resultsOf(result).map(eventFromRow);
}

export async function saveWorkSessionEvent(db, userEmail, event) {
  await db.prepare(`
    INSERT INTO joy_work_session_events (
      user_email, id, session_id, project_id, kind, title, detail,
      payload_json, occurred_at, client_request_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO NOTHING
  `).bind(
    userEmail,
    event.id,
    event.sessionId,
    event.projectId,
    event.kind,
    event.title,
    event.detail,
    JSON.stringify(event.payload || {}),
    event.occurredAt,
    event.clientRequestId,
    event.createdAt,
  ).run();
  return getWorkSessionEvent(db, userEmail, event.id);
}

export async function getProjectDecision(db, userEmail, decisionId) {
  const row = await db.prepare(`
    SELECT * FROM joy_project_decisions
    WHERE user_email = ? AND id = ?
  `).bind(userEmail, decisionId).first();
  return decisionFromRow(row);
}

export async function listProjectDecisions(db, userEmail, projectId, limit = 20) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 20)));
  const result = await db.prepare(`
    SELECT * FROM joy_project_decisions
    WHERE user_email = ? AND project_id = ?
    ORDER BY occurred_at DESC
    LIMIT ?
  `).bind(userEmail, projectId, safeLimit).all();
  return resultsOf(result).map(decisionFromRow);
}

export async function saveProjectDecision(db, userEmail, decision) {
  await db.prepare(`
    INSERT INTO joy_project_decisions (
      user_email, id, project_id, session_id, title, decision, rationale,
      status, supersedes_id, occurred_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO UPDATE SET
      title = excluded.title,
      decision = excluded.decision,
      rationale = excluded.rationale,
      status = excluded.status,
      supersedes_id = excluded.supersedes_id,
      updated_at = excluded.updated_at
  `).bind(
    userEmail,
    decision.id,
    decision.projectId,
    decision.sessionId,
    decision.title,
    decision.decision,
    decision.rationale,
    decision.status,
    decision.supersedesId,
    decision.occurredAt,
    decision.createdAt,
    decision.updatedAt,
  ).run();
  return getProjectDecision(db, userEmail, decision.id);
}

export async function getProjectBlocker(db, userEmail, blockerId) {
  const row = await db.prepare(`
    SELECT * FROM joy_project_blockers
    WHERE user_email = ? AND id = ?
  `).bind(userEmail, blockerId).first();
  return blockerFromRow(row);
}

export async function listProjectBlockers(db, userEmail, projectId, status = null, limit = 30) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 30)));
  const query = status
    ? `SELECT * FROM joy_project_blockers
       WHERE user_email = ? AND project_id = ? AND status = ?
       ORDER BY updated_at DESC LIMIT ?`
    : `SELECT * FROM joy_project_blockers
       WHERE user_email = ? AND project_id = ?
       ORDER BY updated_at DESC LIMIT ?`;
  const statement = status
    ? db.prepare(query).bind(userEmail, projectId, status, safeLimit)
    : db.prepare(query).bind(userEmail, projectId, safeLimit);
  const result = await statement.all();
  return resultsOf(result).map(blockerFromRow);
}

export async function saveProjectBlocker(db, userEmail, blocker) {
  await db.prepare(`
    INSERT INTO joy_project_blockers (
      user_email, id, project_id, session_id, title, detail, status,
      resolution, opened_at, resolved_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO UPDATE SET
      title = excluded.title,
      detail = excluded.detail,
      status = excluded.status,
      resolution = excluded.resolution,
      resolved_at = excluded.resolved_at,
      updated_at = excluded.updated_at
  `).bind(
    userEmail,
    blocker.id,
    blocker.projectId,
    blocker.sessionId,
    blocker.title,
    blocker.detail,
    blocker.status,
    blocker.resolution,
    blocker.openedAt,
    blocker.resolvedAt,
    blocker.createdAt,
    blocker.updatedAt,
  ).run();
  return getProjectBlocker(db, userEmail, blocker.id);
}

export async function getProjectMemoryEvidence(db, userEmail, evidenceId) {
  const row = await db.prepare(`
    SELECT * FROM joy_project_memory_evidence
    WHERE user_email = ? AND id = ?
  `).bind(userEmail, evidenceId).first();
  return memoryEvidenceFromRow(row);
}

export async function listProjectMemoryEvidence(db, userEmail, projectId, limit = 30) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 30)));
  const result = await db.prepare(`
    SELECT * FROM joy_project_memory_evidence
    WHERE user_email = ? AND project_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(userEmail, projectId, safeLimit).all();
  return resultsOf(result).map(memoryEvidenceFromRow);
}

export async function saveProjectMemoryEvidence(db, userEmail, evidence) {
  await db.prepare(`
    INSERT INTO joy_project_memory_evidence (
      user_email, id, project_id, session_id, label, kind, uri,
      detail, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO NOTHING
  `).bind(
    userEmail,
    evidence.id,
    evidence.projectId,
    evidence.sessionId,
    evidence.label,
    evidence.kind,
    evidence.uri,
    evidence.detail,
    JSON.stringify(evidence.metadata || {}),
    evidence.createdAt,
  ).run();
  return getProjectMemoryEvidence(db, userEmail, evidence.id);
}

export async function getProjectRepoRef(db, userEmail, repoRefId) {
  const row = await db.prepare(`
    SELECT * FROM joy_project_repo_refs
    WHERE user_email = ? AND id = ?
  `).bind(userEmail, repoRefId).first();
  return repoRefFromRow(row);
}

export async function listProjectRepoRefs(db, userEmail, projectId, limit = 30) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 30)));
  const result = await db.prepare(`
    SELECT * FROM joy_project_repo_refs
    WHERE user_email = ? AND project_id = ?
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(userEmail, projectId, safeLimit).all();
  return resultsOf(result).map(repoRefFromRow);
}

export async function saveProjectRepoRef(db, userEmail, repoRef) {
  await db.prepare(`
    INSERT INTO joy_project_repo_refs (
      user_email, id, project_id, session_id, repo_full_name, ref_type,
      ref, uri, status, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO UPDATE SET
      repo_full_name = excluded.repo_full_name,
      ref_type = excluded.ref_type,
      ref = excluded.ref,
      uri = excluded.uri,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    userEmail,
    repoRef.id,
    repoRef.projectId,
    repoRef.sessionId,
    repoRef.repoFullName,
    repoRef.refType,
    repoRef.ref,
    repoRef.uri,
    repoRef.status,
    JSON.stringify(repoRef.metadata || {}),
    repoRef.createdAt,
    repoRef.updatedAt,
  ).run();
  return getProjectRepoRef(db, userEmail, repoRef.id);
}
