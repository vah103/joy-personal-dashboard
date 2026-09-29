const TASK_HEADERS = Object.freeze([
  "ID",
  "Project",
  "Task",
  "Primary owner position",
  "Current action owner",
  "Execution surface",
  "Usage mode",
  "Criticality",
  "Status",
  "Depends on",
  "Review",
  "Canonical",
  "Next action",
]);

const STAFF_HEADERS = Object.freeze([
  "Position",
  "Seat status",
  "Default surface",
  "Secondary / support",
  "Current assignee",
]);

export const KNOWN_TASK_STATUSES = Object.freeze([
  "IDEA",
  "ROUTING_REQUIRED",
  "PENDING_GOVERNANCE",
  "TODO",
  "ACTIVE",
  "BLOCKED",
  "BLOCKED_BY_USAGE",
  "RECOVERY_REQUIRED",
  "COMPLETE_PENDING_REVIEW",
  "PENDING_REVIEW",
  "PENDING_USER",
  "PENDING_CANONICAL_SYNC",
  "PENDING_STRATEGIC_REVIEW",
  "DONE",
  "CANCELLED",
]);

const REVIEW_STATUSES = new Set(["COMPLETE_PENDING_REVIEW", "PENDING_REVIEW"]);
const BLOCKED_STATUSES = new Set([
  "BLOCKED",
  "BLOCKED_BY_USAGE",
  "RECOVERY_REQUIRED",
  "PENDING_USER",
  "PENDING_CANONICAL_SYNC",
  "PENDING_STRATEGIC_REVIEW",
  "PENDING_GOVERNANCE",
]);
const ACTIONABLE_STATUSES = new Set(["IDEA", "ROUTING_REQUIRED", "TODO", "ACTIVE"]);
const CURRENT_HANDOFF_STATES = new Set(["PENDING_PICKUP", "ACKNOWLEDGED"]);
const BLANK_VALUES = new Set(["", "—", "-"]);
const RUNTIME_FRESH_MINUTES = 45;

function valueOrUnknown(value) {
  const normalized = String(value ?? "").trim();
  return BLANK_VALUES.has(normalized) ? "UNKNOWN" : normalized;
}

function isBlank(value) {
  return BLANK_VALUES.has(String(value ?? "").trim());
}

function splitMarkdownRow(line) {
  const source = String(line || "").trim();
  if (!source.startsWith("|")) return [];
  const body = source.endsWith("|") ? source.slice(1, -1) : source.slice(1);
  const cells = [];
  let cell = "";
  let escaped = false;
  for (const char of body) {
    if (escaped) {
      cell += char === "|" ? "|" : `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "|") {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }
  if (escaped) cell += "\\";
  cells.push(cell.trim());
  return cells;
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseTable(markdown, expectedHeaders) {
  const lines = String(markdown || "").split(/\r?\n/);
  const rows = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const headers = splitMarkdownRow(lines[index]);
    if (headers.length !== expectedHeaders.length) continue;
    if (!expectedHeaders.every((header, position) => headers[position] === header)) continue;
    if (!isSeparatorRow(splitMarkdownRow(lines[index + 1]))) continue;

    for (let cursor = index + 2; cursor < lines.length; cursor += 1) {
      if (!lines[cursor].trim().startsWith("|")) break;
      const cells = splitMarkdownRow(lines[cursor]);
      if (cells.length !== headers.length) continue;
      rows.push(Object.fromEntries(headers.map((header, position) => [header, cells[position]])));
    }
  }
  return rows;
}

export function parseTasks(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const hasTaskSchema = lines.some((line, index) => {
    const headers = splitMarkdownRow(line);
    return (
      headers.length === TASK_HEADERS.length
      && TASK_HEADERS.every((header, position) => headers[position] === header)
      && isSeparatorRow(splitMarkdownRow(lines[index + 1]))
    );
  });
  if (!hasTaskSchema) return [];

  return lines
    .map((line) => splitMarkdownRow(line))
    .filter((cells) => (
      cells.length === TASK_HEADERS.length
      && /^[A-Z]{1,5}\d{3}$/.test(cells[0] || "")
      && KNOWN_TASK_STATUSES.includes(cells[8] || "")
    ))
    .map((cells) => Object.fromEntries(
      TASK_HEADERS.map((header, position) => [header, cells[position]]),
    ))
    .map((row) => ({
      id: row.ID,
      project: row.Project,
      title: row.Task,
      primaryOwner: row["Primary owner position"],
      currentActionOwner: row["Current action owner"],
      executionSurface: row["Execution surface"],
      usageMode: row["Usage mode"],
      criticality: row.Criticality,
      status: row.Status,
      dependsOn: row["Depends on"],
      review: row.Review,
      canonical: row.Canonical,
      nextAction: row["Next action"],
    }));
}

export function parseStaff(markdown) {
  return parseTable(markdown, STAFF_HEADERS).map((row) => ({
    position: row.Position,
    seatStatus: row["Seat status"],
    defaultSurface: row["Default surface"],
    secondarySupport: row["Secondary / support"],
    currentAssignee: row["Current assignee"],
  }));
}

function normalizeHandoffField(label) {
  return String(label || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function handoffValue(fields, label) {
  return fields.get(normalizeHandoffField(label)) || "";
}

export function parseHandoffs(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const handoffs = [];
  let current = null;

  const finish = () => {
    if (!current) return;
    const fields = current.fields;
    const taskLabel = handoffValue(fields, "Task");
    const taskId = taskLabel.match(/\b([A-Z]{1,5}\d{3})\b/)?.[1] || "";
    handoffs.push({
      id: current.id,
      headingSender: current.headingSender,
      headingReceiver: current.headingReceiver,
      project: handoffValue(fields, "Project"),
      task: taskLabel,
      taskId,
      publishedAt: handoffValue(fields, "Published at"),
      senderRole: handoffValue(fields, "Sender role") || current.headingSender,
      senderAssignee: handoffValue(fields, "Sender assignee"),
      receiverPosition: handoffValue(fields, "Receiver position") || current.headingReceiver,
      receiverAssignee: handoffValue(fields, "Receiver assignee"),
      pickupState: handoffValue(fields, "Pickup state"),
      pickupEvidence: handoffValue(fields, "Pickup evidence"),
      requestedAction: handoffValue(fields, "Requested action"),
      nextGate: handoffValue(fields, "Next gate"),
      criticality: handoffValue(fields, "Criticality"),
      canonicalImpact: handoffValue(fields, "Canonical impact"),
      taskPrimaryOwner: handoffValue(fields, "Task primary owner"),
    });
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(/^###\s+(HO-[^\s]+)\s+—\s+(.+?)\s+→\s+(.+?)\s*$/);
    if (heading) {
      finish();
      current = {
        id: heading[1].trim(),
        headingSender: heading[2].trim(),
        headingReceiver: heading[3].trim(),
        fields: new Map(),
      };
      continue;
    }
    if (!current) continue;
    const bullet = line.match(/^-\s+([^:]+):\s*(.*)$/);
    if (!bullet) continue;
    current.fields.set(normalizeHandoffField(bullet[1]), bullet[2].trim());
  }
  finish();
  return handoffs;
}

export function laneForStatus(status) {
  const normalized = String(status || "").trim();
  if (["IDEA", "ROUTING_REQUIRED", "TODO"].includes(normalized)) return "TODO";
  if (normalized === "ACTIVE") return "ACTIVE";
  if (REVIEW_STATUSES.has(normalized)) return "REVIEW";
  if (BLOCKED_STATUSES.has(normalized)) return "BLOCKED_GATED";
  if (normalized === "DONE") return "DONE";
  return "OTHER_ARCHIVED";
}

function actorMatchesPosition(actor, position) {
  const left = String(actor || "").trim();
  const right = String(position || "").trim();
  if (!left || !right || isBlank(left)) return false;
  if (left === right) return true;
  if (left.startsWith(`${right} /`)) return true;
  if (right === "Research Director" && left === "USER") return true;
  return false;
}

function knownActor(actor, positions) {
  if (isBlank(actor)) return true;
  if (String(actor).trim() === "USER") return true;
  return positions.some((position) => actorMatchesPosition(actor, position));
}

function unresolvedDependencies(task, tasksById) {
  const ids = [...String(task.dependsOn || "").matchAll(/\b([A-Z]{1,5}\d{3})\b/g)]
    .map((match) => match[1]);
  return [...new Set(ids)].filter((id) => {
    if (id === task.id) return false;
    const dependency = tasksById.get(id);
    return dependency && dependency.status !== "DONE";
  });
}

function gateForTask(task, unresolved) {
  if (unresolved.length) {
    return {
      type: "DEPENDENCY",
      detail: unresolved.join(", "),
      owner: "UNKNOWN",
    };
  }
  const map = {
    BLOCKED: "BLOCKER",
    BLOCKED_BY_USAGE: "USAGE",
    RECOVERY_REQUIRED: "RECOVERY",
    PENDING_USER: "USER",
    PENDING_CANONICAL_SYNC: "CANONICAL",
    PENDING_STRATEGIC_REVIEW: "STRATEGIC",
    PENDING_GOVERNANCE: "GOVERNANCE",
    COMPLETE_PENDING_REVIEW: "REVIEW",
    PENDING_REVIEW: "REVIEW",
  };
  const type = map[task.status];
  if (!type) return null;
  return {
    type,
    detail: task.nextAction || task.status,
    owner: valueOrUnknown(task.currentActionOwner),
  };
}

export function normalizeRuntimePresence(heartbeat, nowMs = Date.now()) {
  if (!heartbeat || typeof heartbeat !== "object") {
    return {
      state: "UNKNOWN_UNAVAILABLE",
      host: "UNKNOWN",
      lastSeen: null,
      source: "UNKNOWN",
      rawMachineState: "UNKNOWN",
      ageMinutes: null,
      freshnessMinutes: RUNTIME_FRESH_MINUTES,
    };
  }

  const lastSeen = String(heartbeat.last_seen || "").trim();
  const parsed = Date.parse(lastSeen);
  if (!lastSeen || Number.isNaN(parsed)) {
    return {
      state: "UNKNOWN_UNAVAILABLE",
      host: valueOrUnknown(heartbeat.host),
      lastSeen: lastSeen || null,
      source: valueOrUnknown(heartbeat.source),
      rawMachineState: valueOrUnknown(heartbeat.machine_state),
      ageMinutes: null,
      freshnessMinutes: RUNTIME_FRESH_MINUTES,
    };
  }

  const ageMinutes = Math.max(0, (Number(nowMs) - parsed) / 60_000);
  return {
    state: ageMinutes <= RUNTIME_FRESH_MINUTES
      ? "RECENTLY_CONFIRMED"
      : "STALE_NOT_RECENTLY_CONFIRMED",
    host: valueOrUnknown(heartbeat.host),
    lastSeen,
    source: valueOrUnknown(heartbeat.source),
    rawMachineState: valueOrUnknown(heartbeat.machine_state),
    ageMinutes: Math.round(ageMinutes * 10) / 10,
    freshnessMinutes: RUNTIME_FRESH_MINUTES,
  };
}

function rolePresence() {
  return {
    state: "UNKNOWN_UNAVAILABLE",
    source: "NO_AUTHORIZED_ROLE_SESSION_SOURCE",
    lastSeen: null,
  };
}

function deriveWorkload(position, assignee, tasks, handoffs) {
  const owned = tasks.filter((task) => actorMatchesPosition(task.primaryOwner, position));
  const action = tasks.filter((task) => actorMatchesPosition(task.currentActionOwner, position));
  const incoming = handoffs.filter((handoff) => (
    handoff.pickupState === "PENDING_PICKUP"
    && actorMatchesPosition(handoff.receiverPosition, position)
  ));
  const reviewing = action.filter((task) => REVIEW_STATUSES.has(task.status));
  const blocked = action.filter((task) => BLOCKED_STATUSES.has(task.status));
  const actionable = action.filter((task) => ACTIONABLE_STATUSES.has(task.status));
  const waitingOwned = owned.filter((task) => (
    !["DONE", "CANCELLED"].includes(task.status)
    && (
      !actorMatchesPosition(task.currentActionOwner, position)
      || REVIEW_STATUSES.has(task.status)
      || BLOCKED_STATUSES.has(task.status)
    )
  ));

  let workload = "FREE_FOR_NEW_WORK";
  if (reviewing.length) workload = "REVIEWING";
  else if (blocked.length) workload = "BLOCKED";
  else if (actionable.length || incoming.length) workload = "ACTION_NOW";
  else if (waitingOwned.length) workload = "WAITING";
  else if (isBlank(assignee)) workload = "UNBOUND";

  return {
    workload,
    actionableTasks: actionable,
    reviewingTasks: reviewing,
    blockedTasks: blocked,
    waitingOwnedTasks: waitingOwned,
    incomingHandoffs: incoming,
  };
}

function handoffTimeline(handoffs) {
  return handoffs
    .filter((handoff) => handoff.publishedAt && !Number.isNaN(Date.parse(handoff.publishedAt)))
    .map((handoff) => ({
      type: "HANDOFF_PUBLISHED",
      timestamp: handoff.publishedAt,
      project: handoff.project,
      taskId: handoff.taskId,
      role: handoff.senderRole,
      sourceType: "HANDOFFS",
      sourceId: handoff.id,
      summary: `${handoff.senderRole} → ${handoff.receiverPosition}`,
    }))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 20);
}

export function buildCompanyLiveBoard({
  tasksMarkdown,
  handoffsMarkdown,
  staffMarkdown,
  heartbeat = null,
  fetchedAt = new Date().toISOString(),
  heartbeatSourceAvailable = heartbeat !== null,
  nowMs = Date.now(),
} = {}) {
  const tasks = parseTasks(tasksMarkdown);
  const handoffs = parseHandoffs(handoffsMarkdown);
  const staff = parseStaff(staffMarkdown);
  const positions = staff.map((item) => item.position);
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const warnings = [];

  if (!tasks.length) warnings.push({ code: "TASKS_EMPTY", source: "TASKS" });
  if (!staff.length) warnings.push({ code: "STAFF_EMPTY", source: "STAFF" });

  const tasksWithView = tasks.map((task) => {
    const lane = laneForStatus(task.status);
    if (!KNOWN_TASK_STATUSES.includes(task.status)) {
      warnings.push({ code: "UNKNOWN_TASK_STATUS", taskId: task.id, value: task.status });
    }
    if (!knownActor(task.primaryOwner, positions)) {
      warnings.push({ code: "UNKNOWN_PRIMARY_OWNER", taskId: task.id, value: task.primaryOwner });
    }
    if (!knownActor(task.currentActionOwner, positions)) {
      warnings.push({ code: "UNKNOWN_ACTION_OWNER", taskId: task.id, value: task.currentActionOwner });
    }
    const unresolved = unresolvedDependencies(task, tasksById);
    const gate = gateForTask(task, unresolved);
    return { ...task, lane, unresolvedDependencies: unresolved, gate };
  });

  for (const handoff of handoffs) {
    if (!knownActor(handoff.senderRole, positions)) {
      warnings.push({ code: "UNKNOWN_HANDOFF_SENDER", handoffId: handoff.id, value: handoff.senderRole });
    }
    if (!knownActor(handoff.receiverPosition, positions)) {
      warnings.push({ code: "UNKNOWN_HANDOFF_RECEIVER", handoffId: handoff.id, value: handoff.receiverPosition });
    }
    const linkedTask = handoff.taskId ? tasksById.get(handoff.taskId) : null;
    if (
      linkedTask
      && handoff.taskPrimaryOwner
      && linkedTask.primaryOwner !== handoff.taskPrimaryOwner
    ) {
      warnings.push({
        code: "HANDOFF_PRIMARY_OWNER_MISMATCH",
        handoffId: handoff.id,
        taskId: linkedTask.id,
        value: handoff.taskPrimaryOwner,
      });
    }
  }

  const currentHandoffs = handoffs.filter((handoff) => {
    if (!CURRENT_HANDOFF_STATES.has(handoff.pickupState)) return false;
    if (!handoff.taskId) return true;
    const linkedTask = tasksById.get(handoff.taskId);
    return !linkedTask || !["DONE", "CANCELLED"].includes(linkedTask.status);
  });
  const presentationHandoffs = [
    ...currentHandoffs,
    ...handoffs.filter((handoff) => !CURRENT_HANDOFF_STATES.has(handoff.pickupState)),
  ];
  const blockers = tasksWithView
    .filter((task) => task.gate)
    .map((task) => ({
      taskId: task.id,
      project: task.project,
      status: task.status,
      gateType: task.gate.type,
      detail: task.gate.detail,
      nextActionOwner: task.gate.owner,
      nextAction: task.nextAction,
    }));

  const relationships = [];
  for (const handoff of currentHandoffs.filter((item) => item.pickupState === "PENDING_PICKUP")) {
    relationships.push({
      type: "PENDING_HANDOFF",
      from: handoff.senderRole,
      to: handoff.receiverPosition,
      taskId: handoff.taskId,
      evidenceId: handoff.id,
    });
  }
  for (const task of tasksWithView) {
    if (REVIEW_STATUSES.has(task.status)) {
      relationships.push({
        type: "REVIEW_WAIT",
        from: task.primaryOwner,
        to: valueOrUnknown(task.currentActionOwner),
        taskId: task.id,
        evidenceId: task.id,
      });
    }
    for (const dependency of task.unresolvedDependencies) {
      relationships.push({
        type: "DEPENDENCY_WAIT",
        from: task.id,
        to: dependency,
        taskId: task.id,
        evidenceId: task.id,
      });
    }
    if (task.gate && !["REVIEW", "DEPENDENCY"].includes(task.gate.type)) {
      relationships.push({
        type: "GATE_WAIT",
        from: task.id,
        to: task.gate.owner,
        taskId: task.id,
        evidenceId: task.id,
        gateType: task.gate.type,
      });
    }
  }

  const roles = staff.map((member) => {
    const workload = deriveWorkload(member.position, member.currentAssignee, tasksWithView, currentHandoffs);
    return {
      ...member,
      workload: workload.workload,
      presence: rolePresence(),
      actionableTasks: workload.actionableTasks.map((task) => task.id),
      reviewingTasks: workload.reviewingTasks.map((task) => task.id),
      blockedTasks: workload.blockedTasks.map((task) => task.id),
      waitingOwnedTasks: workload.waitingOwnedTasks.map((task) => task.id),
      incomingHandoffs: workload.incomingHandoffs.map((handoff) => handoff.id),
    };
  });

  const summary = {
    actionableNow: tasksWithView.filter((task) => (
      ACTIONABLE_STATUSES.has(task.status)
      && task.unresolvedDependencies.length === 0
      && !isBlank(task.currentActionOwner)
    )).length,
    waiting: roles.filter((role) => role.workload === "WAITING").length,
    review: tasksWithView.filter((task) => REVIEW_STATUSES.has(task.status)).length,
    blockedGated: blockers.length,
    freeForNewWork: roles.filter((role) => role.workload === "FREE_FOR_NEW_WORK").length,
    // TASKS is a snapshot and has no transition timestamp. Do not invent recency.
    doneRecently: null,
  };

  const runtimePresence = heartbeatSourceAvailable
    ? normalizeRuntimePresence(heartbeat, nowMs)
    : normalizeRuntimePresence(null, nowMs);

  return {
    schemaVersion: 1,
    readOnly: true,
    fetchedAt,
    summary,
    roles,
    tasks: tasksWithView,
    handoffs: presentationHandoffs,
    blockers,
    relationships,
    timeline: handoffTimeline(handoffs),
    runtimePresence,
    warnings,
    sources: [
      { kind: "TASKS", path: "company/operations/TASKS.md", available: Boolean(tasksMarkdown) },
      { kind: "HANDOFFS", path: "company/operations/HANDOFFS.md", available: Boolean(handoffsMarkdown) },
      { kind: "STAFF", path: "company/operations/STAFF.md", available: Boolean(staffMarkdown) },
      { kind: "RUNTIME_HEARTBEAT", path: "company/operations/runtime/dell.json", available: heartbeatSourceAvailable },
    ],
  };
}
