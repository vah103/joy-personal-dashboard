function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function projectFromRow(row) {
  if (!row) return null;
  return {
    schemaVersion: 1,
    id: row.id,
    title: row.title,
    summary: row.summary || "",
    status: row.status,
    progress: Number(row.progress || 0),
    currentStageId: row.current_stage_id || null,
    currentFocus: row.current_focus || "",
    nextAction: row.next_action || "",
    blockers: parseJson(row.blockers_json, []),
    sourceType: row.source_type || "manual",
    sourceRef: row.source_ref || null,
    metadata: parseJson(row.metadata_json, {}),
    version: Number(row.version || 0),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
    archivedAt: row.archived_at === null || row.archived_at === undefined
      ? null
      : Number(row.archived_at),
  };
}

function taskFromRow(row) {
  if (!row) return null;
  return {
    schemaVersion: 1,
    id: row.id,
    projectId: row.project_id,
    milestoneId: row.milestone_id || null,
    title: row.title,
    description: row.description || "",
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at === null || row.due_at === undefined ? null : Number(row.due_at),
    scheduledFor: row.scheduled_for === null || row.scheduled_for === undefined
      ? null
      : Number(row.scheduled_for),
    completedAt: row.completed_at === null || row.completed_at === undefined
      ? null
      : Number(row.completed_at),
    position: Number(row.position || 0),
    sourceType: row.source_type || "manual",
    sourceRef: row.source_ref || null,
    metadata: parseJson(row.metadata_json, {}),
    version: Number(row.version || 0),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

function milestoneFromRow(row) {
  if (!row) return null;
  return {
    schemaVersion: 1,
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description || "",
    status: row.status,
    targetAt: row.target_at === null || row.target_at === undefined ? null : Number(row.target_at),
    completedAt: row.completed_at === null || row.completed_at === undefined
      ? null
      : Number(row.completed_at),
    position: Number(row.position || 0),
    sourceType: row.source_type || "manual",
    sourceRef: row.source_ref || null,
    metadata: parseJson(row.metadata_json, {}),
    version: Number(row.version || 0),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

function progressLogFromRow(row) {
  if (!row) return null;
  return {
    schemaVersion: 1,
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id || null,
    kind: row.kind,
    title: row.title,
    detail: row.detail || "",
    progressAfter: row.progress_after === null || row.progress_after === undefined
      ? null
      : Number(row.progress_after),
    occurredAt: Number(row.occurred_at || 0),
    sourceType: row.source_type || "manual",
    sourceRef: row.source_ref || null,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: Number(row.created_at || 0),
  };
}

function evidenceFromRow(row) {
  if (!row) return null;
  return {
    schemaVersion: 1,
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id || null,
    progressLogId: row.progress_log_id || null,
    kind: row.kind,
    label: row.label,
    uri: row.uri,
    contentType: row.content_type || null,
    sourceType: row.source_type || "manual",
    sourceRef: row.source_ref || null,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: Number(row.created_at || 0),
  };
}

function resultsOf(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

export async function listCoreProjects(db, userEmail) {
  const result = await db.prepare(`
    SELECT * FROM joy_core_projects
    WHERE user_email = ? AND status <> 'archived'
    ORDER BY updated_at DESC, created_at DESC
  `).bind(userEmail).all();
  return resultsOf(result).map(projectFromRow);
}

export async function getCoreProject(db, userEmail, projectId) {
  const row = await db.prepare(`
    SELECT * FROM joy_core_projects
    WHERE user_email = ? AND id = ?
  `).bind(userEmail, projectId).first();
  return projectFromRow(row);
}

export async function saveCoreProject(db, userEmail, project) {
  await db.prepare(`
    INSERT INTO joy_core_projects (
      user_email, id, title, summary, status, progress, current_stage_id,
      current_focus, next_action, blockers_json, source_type, source_ref,
      metadata_json, version, created_at, updated_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      status = excluded.status,
      progress = excluded.progress,
      current_stage_id = excluded.current_stage_id,
      current_focus = excluded.current_focus,
      next_action = excluded.next_action,
      blockers_json = excluded.blockers_json,
      source_type = excluded.source_type,
      source_ref = excluded.source_ref,
      metadata_json = excluded.metadata_json,
      version = excluded.version,
      updated_at = excluded.updated_at,
      archived_at = excluded.archived_at
  `).bind(
    userEmail,
    project.id,
    project.title,
    project.summary,
    project.status,
    project.progress,
    project.currentStageId,
    project.currentFocus,
    project.nextAction,
    JSON.stringify(project.blockers || []),
    project.sourceType,
    project.sourceRef,
    JSON.stringify(project.metadata || {}),
    project.version,
    project.createdAt,
    project.updatedAt,
    project.archivedAt,
  ).run();
  return getCoreProject(db, userEmail, project.id);
}

export async function listCoreTasks(db, userEmail, projectId, options = {}) {
  const limit = Math.min(200, Math.max(1, Number(options.limit || 100)));
  const result = await db.prepare(`
    SELECT * FROM joy_core_tasks
    WHERE user_email = ? AND project_id = ?
    ORDER BY
      CASE status
        WHEN 'in_progress' THEN 0
        WHEN 'blocked' THEN 1
        WHEN 'todo' THEN 2
        WHEN 'done' THEN 3
        ELSE 4
      END,
      position ASC,
      due_at ASC,
      updated_at DESC
    LIMIT ?
  `).bind(userEmail, projectId, limit).all();
  return resultsOf(result).map(taskFromRow);
}

export async function listOpenCoreTasks(db, userEmail, limit = 50) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit || 50)));
  const result = await db.prepare(`
    SELECT * FROM joy_core_tasks
    WHERE user_email = ? AND status IN ('todo', 'in_progress', 'blocked')
    ORDER BY
      CASE priority
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        ELSE 3
      END,
      due_at ASC,
      updated_at DESC
    LIMIT ?
  `).bind(userEmail, safeLimit).all();
  return resultsOf(result).map(taskFromRow);
}

export async function getCoreTask(db, userEmail, taskId) {
  const row = await db.prepare(`
    SELECT * FROM joy_core_tasks
    WHERE user_email = ? AND id = ?
  `).bind(userEmail, taskId).first();
  return taskFromRow(row);
}

export async function saveCoreTask(db, userEmail, task) {
  await db.prepare(`
    INSERT INTO joy_core_tasks (
      user_email, id, project_id, milestone_id, title, description, status,
      priority, due_at, scheduled_for, completed_at, position, source_type,
      source_ref, metadata_json, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO UPDATE SET
      project_id = excluded.project_id,
      milestone_id = excluded.milestone_id,
      title = excluded.title,
      description = excluded.description,
      status = excluded.status,
      priority = excluded.priority,
      due_at = excluded.due_at,
      scheduled_for = excluded.scheduled_for,
      completed_at = excluded.completed_at,
      position = excluded.position,
      source_type = excluded.source_type,
      source_ref = excluded.source_ref,
      metadata_json = excluded.metadata_json,
      version = excluded.version,
      updated_at = excluded.updated_at
  `).bind(
    userEmail,
    task.id,
    task.projectId,
    task.milestoneId,
    task.title,
    task.description,
    task.status,
    task.priority,
    task.dueAt,
    task.scheduledFor,
    task.completedAt,
    task.position,
    task.sourceType,
    task.sourceRef,
    JSON.stringify(task.metadata || {}),
    task.version,
    task.createdAt,
    task.updatedAt,
  ).run();
  return getCoreTask(db, userEmail, task.id);
}

export async function listCoreMilestones(db, userEmail, projectId) {
  const result = await db.prepare(`
    SELECT * FROM joy_core_milestones
    WHERE user_email = ? AND project_id = ?
    ORDER BY position ASC, target_at ASC, updated_at DESC
  `).bind(userEmail, projectId).all();
  return resultsOf(result).map(milestoneFromRow);
}

export async function getCoreMilestone(db, userEmail, milestoneId) {
  const row = await db.prepare(`
    SELECT * FROM joy_core_milestones
    WHERE user_email = ? AND id = ?
  `).bind(userEmail, milestoneId).first();
  return milestoneFromRow(row);
}

export async function saveCoreMilestone(db, userEmail, milestone) {
  await db.prepare(`
    INSERT INTO joy_core_milestones (
      user_email, id, project_id, title, description, status, target_at,
      completed_at, position, source_type, source_ref, metadata_json,
      version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO UPDATE SET
      project_id = excluded.project_id,
      title = excluded.title,
      description = excluded.description,
      status = excluded.status,
      target_at = excluded.target_at,
      completed_at = excluded.completed_at,
      position = excluded.position,
      source_type = excluded.source_type,
      source_ref = excluded.source_ref,
      metadata_json = excluded.metadata_json,
      version = excluded.version,
      updated_at = excluded.updated_at
  `).bind(
    userEmail,
    milestone.id,
    milestone.projectId,
    milestone.title,
    milestone.description,
    milestone.status,
    milestone.targetAt,
    milestone.completedAt,
    milestone.position,
    milestone.sourceType,
    milestone.sourceRef,
    JSON.stringify(milestone.metadata || {}),
    milestone.version,
    milestone.createdAt,
    milestone.updatedAt,
  ).run();
  return getCoreMilestone(db, userEmail, milestone.id);
}

export async function listCoreProgressLogs(db, userEmail, projectId, limit = 50) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit || 50)));
  const result = await db.prepare(`
    SELECT * FROM joy_core_progress_logs
    WHERE user_email = ? AND project_id = ?
    ORDER BY occurred_at DESC, created_at DESC
    LIMIT ?
  `).bind(userEmail, projectId, safeLimit).all();
  return resultsOf(result).map(progressLogFromRow);
}

export async function listRecentCoreProgressLogs(db, userEmail, limit = 20) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 20)));
  const result = await db.prepare(`
    SELECT * FROM joy_core_progress_logs
    WHERE user_email = ?
    ORDER BY occurred_at DESC, created_at DESC
    LIMIT ?
  `).bind(userEmail, safeLimit).all();
  return resultsOf(result).map(progressLogFromRow);
}

export async function getCoreProgressLog(db, userEmail, logId) {
  const row = await db.prepare(`
    SELECT * FROM joy_core_progress_logs
    WHERE user_email = ? AND id = ?
  `).bind(userEmail, logId).first();
  return progressLogFromRow(row);
}

export async function saveCoreProgressLog(db, userEmail, log) {
  await db.prepare(`
    INSERT INTO joy_core_progress_logs (
      user_email, id, project_id, task_id, kind, title, detail,
      progress_after, occurred_at, source_type, source_ref, metadata_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO NOTHING
  `).bind(
    userEmail,
    log.id,
    log.projectId,
    log.taskId,
    log.kind,
    log.title,
    log.detail,
    log.progressAfter,
    log.occurredAt,
    log.sourceType,
    log.sourceRef,
    JSON.stringify(log.metadata || {}),
    log.createdAt,
  ).run();
  return getCoreProgressLog(db, userEmail, log.id);
}

export async function listCoreEvidence(db, userEmail, projectId, limit = 100) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit || 100)));
  const result = await db.prepare(`
    SELECT * FROM joy_core_evidence
    WHERE user_email = ? AND project_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(userEmail, projectId, safeLimit).all();
  return resultsOf(result).map(evidenceFromRow);
}

export async function getCoreEvidence(db, userEmail, evidenceId) {
  const row = await db.prepare(`
    SELECT * FROM joy_core_evidence
    WHERE user_email = ? AND id = ?
  `).bind(userEmail, evidenceId).first();
  return evidenceFromRow(row);
}

export async function saveCoreEvidence(db, userEmail, evidence) {
  await db.prepare(`
    INSERT INTO joy_core_evidence (
      user_email, id, project_id, task_id, progress_log_id, kind, label,
      uri, content_type, source_type, source_ref, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_email, id) DO NOTHING
  `).bind(
    userEmail,
    evidence.id,
    evidence.projectId,
    evidence.taskId,
    evidence.progressLogId,
    evidence.kind,
    evidence.label,
    evidence.uri,
    evidence.contentType,
    evidence.sourceType,
    evidence.sourceRef,
    JSON.stringify(evidence.metadata || {}),
    evidence.createdAt,
  ).run();
  return getCoreEvidence(db, userEmail, evidence.id);
}

export async function recordCoreAuditEvent(db, userEmail, event) {
  await db.prepare(`
    INSERT INTO joy_core_audit_events (
      user_email, id, actor_type, actor_id, action, entity_type,
      entity_id, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    userEmail,
    event.id,
    event.actorType,
    event.actorId,
    event.action,
    event.entityType,
    event.entityId,
    JSON.stringify(event.payload || {}),
    event.createdAt,
  ).run();
}

export async function listLegacyProjects(db, userEmail) {
  try {
    const result = await db.prepare(`
      SELECT id, name, focus, next_action, progress, archived, created_at, updated_at
      FROM joy_projects
      WHERE user_email = ? AND archived = 0
      ORDER BY updated_at DESC, created_at DESC
    `).bind(userEmail).all();
    return resultsOf(result).map((row) => ({
      schemaVersion: 1,
      id: String(row.id || "").trim().toLowerCase(),
      title: String(row.name || row.id || "Untitled project"),
      summary: "",
      status: "active",
      progress: Math.min(100, Math.max(0, Number(row.progress || 0))),
      currentStageId: null,
      currentFocus: String(row.focus || ""),
      nextAction: String(row.next_action || ""),
      blockers: [],
      sourceType: "joy",
      sourceRef: "legacy:joy_projects",
      metadata: { compatibilitySource: "joy_projects" },
      version: 0,
      createdAt: Number(row.created_at || 0),
      updatedAt: Number(row.updated_at || 0),
      archivedAt: null,
    })).filter((project) => project.id);
  } catch (error) {
    console.warn("Joy Core legacy project adapter failed", error?.message || error);
    return [];
  }
}

export async function listLegacyInboxTasks(db, userEmail, limit = 30) {
  try {
    const safeLimit = Math.min(100, Math.max(1, Number(limit || 30)));
    const result = await db.prepare(`
      SELECT id, title, done, created_at, updated_at
      FROM tasks
      WHERE user_email = ? AND done = 0
      ORDER BY updated_at DESC, created_at DESC
      LIMIT ?
    `).bind(userEmail, safeLimit).all();
    return resultsOf(result).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.done ? "done" : "todo",
      createdAt: Number(row.created_at || 0),
      updatedAt: Number(row.updated_at || 0),
      sourceType: "joy",
      sourceRef: "legacy:tasks",
    }));
  } catch (error) {
    console.warn("Joy Core legacy task adapter failed", error?.message || error);
    return [];
  }
}
