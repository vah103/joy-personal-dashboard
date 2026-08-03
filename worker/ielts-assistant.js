import IELTS_PROGRAM from "../project-data/ielts/program-2026.json" with { type: "json" };
import { JoyCoreError } from "./joy-core/service.js";
import {
  mutateIeltsState,
  readIeltsState,
} from "./ielts-core.js";

const DONE = new Set(["completed"]);
const SKILLS = new Set(["listening", "reading", "writing", "speaking", "review"]);
const TASK_KINDS = new Set(["guided", "test", "review"]);
const COURSE_STATUSES = new Set(["waiting", "reviewed", "applied"]);
const PLAN_ID = "ielts-band-7-december-2026";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requiredText(value, field, maxLength = 4_000) {
  const text = String(value || "").trim();
  if (!text) throw new JoyCoreError("IELTS_INVALID_INPUT", 400, { field });
  if (text.length > maxLength) throw new JoyCoreError("IELTS_INVALID_INPUT", 400, { field, maxLength });
  return text;
}

function optionalText(value, maxLength = 4_000) {
  return String(value || "").trim().slice(0, maxLength);
}

function requiredClientRequestId(value) {
  return requiredText(value, "clientRequestId", 80);
}

function normalizedDate(value, fallback = vietnamDateKey()) {
  const date = String(value || fallback).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new JoyCoreError("IELTS_INVALID_DATE", 400, { date });
  }
  return date;
}

function finiteNumber(value, field, minimum, maximum, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new JoyCoreError("IELTS_INVALID_INPUT", 400, { field, minimum, maximum });
  }
  return number;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableId(prefix, requestId) {
  const slug = String(requestId)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "request";
  return `${prefix}-${slug}-${stableHash(requestId)}`.slice(0, 80);
}

export function vietnamDateKey(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function staticTasks(program = IELTS_PROGRAM) {
  const prelaunch = (program.prelaunch || []).map((task) => ({
    ...task,
    rhythmId: "prelaunch",
    groupLabel: "Before August",
  }));
  const baseline = (program.baseline?.tasks || []).map((task) => ({
    ...task,
    rhythmId: "baseline",
    groupLabel: "Baseline · 1–2 Aug",
  }));
  const rhythms = (program.august?.weeks || []).flatMap((week) => (
    (week.rhythms || []).flatMap((rhythm) => (
      (rhythm.tasks || []).map((task) => ({
        ...task,
        rhythmId: rhythm.id,
        groupLabel: `${week.title} · ${rhythm.label}`,
        weekId: week.id,
      }))
    ))
  ));
  return [...prelaunch, ...baseline, ...rhythms];
}

function baselineTasks(program = IELTS_PROGRAM) {
  return staticTasks(program).filter((task) => task.rhythmId === "baseline");
}

function baselineIncomplete(data, program = IELTS_PROGRAM) {
  const tasks = baselineTasks(program);
  return tasks.length > 0 && tasks.some((task) => !DONE.has(taskState(data, task.id).status));
}

function effectiveRhythm(data, rhythm, program = IELTS_PROGRAM) {
  if (rhythm.id !== "aug-w1-r1" || !baselineIncomplete(data, program)) return rhythm;
  return {
    ...rhythm,
    objective: "Complete every unfinished baseline test before beginning the error-repair tasks.",
  };
}

function allRhythms(program = IELTS_PROGRAM) {
  return (program.august?.weeks || []).flatMap((week) => (
    (week.rhythms || []).map((rhythm) => ({ ...rhythm, week }))
  ));
}

function rhythmTasks(data, rhythmId, program = IELTS_PROGRAM) {
  if (rhythmId === "aug-w1-r1" && baselineIncomplete(data, program)) {
    return baselineTasks(program).map((task) => ({
      ...task,
      groupLabel: "Foundation & Error Awareness · Rhythm 1 · Baseline first",
    }));
  }
  const defaults = staticTasks(program).filter((task) => task.rhythmId === rhythmId);
  const custom = (data.customTasks || []).filter((task) => task.rhythmId === rhythmId);
  if (!custom.length) return defaults;
  return [...defaults.filter((task) => task.kind === "course"), ...custom];
}

function allTasks(data, program = IELTS_PROGRAM) {
  const groups = [
    "prelaunch",
    "baseline",
    ...allRhythms(program).map((rhythm) => rhythm.id),
    ...(program.phases || []).map((phase) => phase.id),
  ];
  return [...new Map(groups.flatMap((rhythmId) => rhythmTasks(data, rhythmId, program))
    .map((task) => [task.id, task])).values()];
}

function taskState(data, taskId) {
  return object(data.taskStates?.[taskId]);
}

function taskWithState(data, task) {
  const state = taskState(data, task.id);
  return {
    ...clone(task),
    state: {
      status: state.status || "pending",
      minutes: Number(state.minutes || 0) || null,
      evidence: optionalText(state.evidence, 20_000),
      reflection: optionalText(state.reflection, 20_000),
      startedAt: Number(state.startedAt || 0) || null,
      completedAt: Number(state.completedAt || 0) || null,
      updatedAt: Number(state.updatedAt || 0) || null,
    },
  };
}

function dateNumber(range) {
  return Number(String(range || "").match(/\d+/)?.[0] || 0);
}

export function currentIeltsContext(data, today = vietnamDateKey(), program = IELTS_PROGRAM) {
  if (today < "2026-08-01") {
    return {
      type: "prelaunch",
      id: "prelaunch",
      label: "Before August · App & course setup",
      objective: "Prepare Joy, recent course knowledge and baseline materials.",
      tasks: rhythmTasks(data, "prelaunch", program),
      targetMinutes: (program.prelaunch || []).reduce((sum, task) => sum + Number(task.minutes || 0), 0),
    };
  }
  if (today <= "2026-08-02") {
    return {
      type: "baseline",
      id: "baseline",
      label: "Baseline · 1–2 Aug",
      objective: program.baseline?.objective || "Measure current IELTS ability.",
      tasks: rhythmTasks(data, "baseline", program),
      targetMinutes: (program.baseline?.tasks || []).reduce((sum, task) => sum + Number(task.minutes || 0), 0),
    };
  }
  if (today === "2026-08-31") {
    return {
      type: "monthly-review",
      id: "august-review",
      label: "August review · 31 Aug",
      objective: "Compare baseline with final evidence and prepare September.",
      tasks: [],
      targetMinutes: 60,
    };
  }
  if (today > "2026-08-31") {
    const phaseByMonth = {
      "09": "september-accuracy",
      "10": "october-band-65",
      "11": "november-exam",
      "12": "december-peak",
    };
    const phase = (program.phases || []).find((item) => item.id === phaseByMonth[today.slice(5, 7)])
      || (program.phases || []).at(-1);
    return {
      type: "phase",
      id: phase?.id || "journey",
      label: phase ? `${phase.month} · ${phase.title}` : "IELTS Journey",
      objective: phase?.outcome || "Use the latest evidence to prepare the next IELTS phase.",
      tasks: phase ? (data.customTasks || []).filter((task) => task.rhythmId === phase.id) : [],
      targetMinutes: 0,
    };
  }

  const day = Number(today.slice(-2));
  const rhythms = allRhythms(program).map((rhythm) => effectiveRhythm(data, rhythm, program));
  const rhythm = rhythms.find((item) => {
    const [start, end] = String(item.dateRange).match(/\d+/g)?.map(Number) || [];
    return day >= start && day <= end;
  });
  if (rhythm && today.startsWith("2026-08")) {
    const tasks = rhythmTasks(data, rhythm.id, program);
    const baselineFirst = rhythm.id === "aug-w1-r1" && baselineIncomplete(data, program);
    return {
      type: "rhythm",
      id: rhythm.id,
      label: `${rhythm.label} · ${rhythm.days}`,
      dateRange: rhythm.dateRange,
      objective: rhythm.objective,
      week: rhythm.week,
      tasks,
      targetMinutes: baselineFirst
        ? tasks.reduce((sum, task) => sum + Number(task.minutes || 0), 0)
        : 360,
    };
  }

  const nextRhythm = rhythms.find((item) => dateNumber(item.dateRange) >= day);
  const tasks = nextRhythm ? rhythmTasks(data, nextRhythm.id, program) : [];
  const baselineFirst = nextRhythm?.id === "aug-w1-r1" && baselineIncomplete(data, program);
  return {
    type: "journey",
    id: nextRhythm?.id || "journey",
    label: nextRhythm ? `${nextRhythm.label} · ${nextRhythm.dateRange}` : "Next phase",
    objective: nextRhythm?.objective || "Use the latest assessment to prepare the next phase.",
    week: nextRhythm?.week,
    tasks,
    targetMinutes: nextRhythm
      ? baselineFirst
        ? tasks.reduce((sum, task) => sum + Number(task.minutes || 0), 0)
        : 360
      : 0,
  };
}

function progressFor(data, tasks) {
  const completed = tasks.filter((task) => DONE.has(taskState(data, task.id).status));
  const minutes = completed.reduce((sum, task) => (
    sum + Math.max(0, Number(taskState(data, task.id).minutes || task.minutes || 0))
  ), 0);
  return {
    percent: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
    completedTasks: completed.length,
    totalTasks: tasks.length,
    completedMinutes: minutes,
  };
}

function latestByDate(items) {
  return [...(items || [])].sort((left, right) => (
    String(right.date || "").localeCompare(String(left.date || ""))
      || Number(right.updatedAt || 0) - Number(left.updatedAt || 0)
  ));
}

function teachingSnapshot(record, today = vietnamDateKey()) {
  const data = record.data;
  const current = currentIeltsContext(data, today);
  const tasks = current.tasks.map((task) => taskWithState(data, task));
  const nextTask = tasks.find((task) => !DONE.has(task.state.status))
    || allTasks(data).map((task) => taskWithState(data, task)).find((task) => !DONE.has(task.state.status))
    || null;
  return {
    planId: PLAN_ID,
    date: today,
    timezone: "Asia/Ho_Chi_Minh",
    goal: clone(data.goal || {}),
    current: {
      type: current.type,
      id: current.id,
      label: current.label,
      dateRange: current.dateRange || null,
      objective: current.objective,
      targetMinutes: current.targetMinutes,
      progress: progressFor(data, current.tasks),
      tasks,
    },
    nextTask,
    latestAssessment: latestByDate(data.assessments)[0] || null,
    activeErrors: (data.errorLogs || []).filter((item) => item.active !== false).slice(-20),
    recentCourseSessions: latestByDate(data.courseSessions).slice(0, 8),
    stateVersion: record.version,
    updatedAt: record.updatedAt,
  };
}

export async function getIeltsTeachingContext(env, context, input = {}, dependencies = {}) {
  const readState = dependencies.readState || readIeltsState;
  const today = normalizedDate(input.date, vietnamDateKey(dependencies.now?.() || new Date()));
  return teachingSnapshot(await readState(context.userEmail, env), today);
}

export async function getIeltsTeachingTask(env, context, taskId, input = {}, dependencies = {}) {
  const readState = dependencies.readState || readIeltsState;
  const today = normalizedDate(input.date, vietnamDateKey(dependencies.now?.() || new Date()));
  const record = await readState(context.userEmail, env);
  const task = allTasks(record.data).find((item) => item.id === String(taskId));
  if (!task) throw new JoyCoreError("IELTS_TASK_NOT_FOUND", 404, { taskId });
  const relevantErrors = (record.data.errorLogs || [])
    .filter((error) => error.active !== false && (error.skill === task.skill || error.skill === "review"))
    .slice(-8);
  return {
    planId: PLAN_ID,
    date: today,
    task: taskWithState(record.data, task),
    relevantErrors,
    recentCourseSessions: latestByDate(record.data.courseSessions).slice(0, 6),
    stateVersion: record.version,
  };
}

async function mutateFor(context, env, updater, dependencies) {
  const mutateState = dependencies.mutateState || mutateIeltsState;
  return mutateState(context.userEmail, env, updater);
}

export async function startIeltsTeachingTask(env, context, taskId, input = {}, dependencies = {}) {
  const id = requiredText(taskId, "taskId", 160);
  const result = await mutateFor(context, env, (data) => {
    const task = allTasks(data).find((item) => item.id === id);
    if (!task) throw new JoyCoreError("IELTS_TASK_NOT_FOUND", 404, { taskId: id });
    const current = taskState(data, id);
    if (!DONE.has(current.status)) {
      data.taskStates[id] = {
        ...current,
        status: "progress",
        startedAt: Number(current.startedAt || Date.now()),
        updatedAt: Date.now(),
      };
    }
    return data;
  });
  return {
    ok: true,
    taskId: id,
    state: taskState(result.data, id),
    stateVersion: result.version,
  };
}

export async function completeIeltsTeachingTask(env, context, taskId, input = {}, dependencies = {}) {
  const id = requiredText(taskId, "taskId", 160);
  const minutes = finiteNumber(input.minutes, "minutes", 1, 480);
  const evidence = requiredText(input.evidence, "evidence", 20_000);
  const reflection = requiredText(input.reflection, "reflection", 20_000);
  const result = await mutateFor(context, env, (data) => {
    const task = allTasks(data).find((item) => item.id === id);
    if (!task) throw new JoyCoreError("IELTS_TASK_NOT_FOUND", 404, { taskId: id });
    data.taskStates[id] = {
      ...taskState(data, id),
      status: "completed",
      minutes,
      evidence,
      reflection,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    };
    return data;
  }, dependencies);
  return {
    ok: true,
    taskId: id,
    state: taskState(result.data, id),
    stateVersion: result.version,
  };
}

export async function addIeltsAssessment(env, context, input = {}, dependencies = {}) {
  const requestId = requiredClientRequestId(input.clientRequestId);
  const id = stableId("assessment-gpt", requestId);
  const date = normalizedDate(input.date);
  const scores = {};
  let hasScore = false;
  for (const skill of ["listening", "reading", "writing", "speaking"]) {
    const score = finiteNumber(input.scores?.[skill], `scores.${skill}`, 0, 9, null);
    scores[skill] = score;
    if (score !== null) hasScore = true;
  }
  if (!hasScore) throw new JoyCoreError("IELTS_ASSESSMENT_SCORE_REQUIRED", 400);
  const assessment = {
    id,
    date,
    label: requiredText(input.label || "Assessment", "label", 240),
    scores,
    evidence: requiredText(input.evidence, "evidence", 20_000),
    source: "chatgpt",
    clientRequestId: requestId,
    updatedAt: Date.now(),
  };
  const result = await mutateFor(context, env, (data) => {
    data.assessments = [
      ...(data.assessments || []).filter((item) => item.id !== id),
      assessment,
    ];
    return data;
  }, dependencies);
  return { ok: true, assessment, stateVersion: result.version };
}

export async function addIeltsRecurringError(env, context, input = {}, dependencies = {}) {
  const requestId = requiredClientRequestId(input.clientRequestId);
  const skill = String(input.skill || "").trim().toLowerCase();
  if (!SKILLS.has(skill)) throw new JoyCoreError("IELTS_INVALID_SKILL", 400, { skill });
  const label = requiredText(input.label, "label", 240);
  const cause = requiredText(input.cause, "cause", 4_000);
  const action = requiredText(input.action, "action", 4_000);
  let saved;
  const result = await mutateFor(context, env, (data) => {
    const errors = data.errorLogs || [];
    const sameRequest = errors.find((item) => item.clientRequestId === requestId);
    const existing = sameRequest || errors.find((item) => (
      item.active !== false
      && item.skill === skill
      && String(item.label || "").toLowerCase() === label.toLowerCase()
    ));
    if (existing) {
      existing.skill = skill;
      existing.label = label;
      existing.cause = cause;
      existing.action = action;
      if (!sameRequest) existing.count = Math.max(1, Number(existing.count || 1)) + 1;
      existing.active = true;
      existing.clientRequestId = requestId;
      existing.source = "chatgpt";
      existing.updatedAt = Date.now();
      saved = clone(existing);
    } else {
      saved = {
        id: stableId("error-gpt", requestId),
        skill,
        label,
        cause,
        action,
        count: 1,
        active: true,
        source: "chatgpt",
        clientRequestId: requestId,
        updatedAt: Date.now(),
      };
      errors.push(saved);
    }
    data.errorLogs = errors;
    return data;
  }, dependencies);
  return { ok: true, error: saved, stateVersion: result.version };
}

export async function addIeltsCourseSession(env, context, input = {}, dependencies = {}) {
  const requestId = requiredClientRequestId(input.clientRequestId);
  const status = String(input.status || "reviewed").trim().toLowerCase();
  if (!COURSE_STATUSES.has(status)) throw new JoyCoreError("IELTS_INVALID_COURSE_STATUS", 400, { status });
  const session = {
    id: stableId("course-gpt", requestId),
    date: normalizedDate(input.date),
    title: requiredText(input.title, "title", 240),
    taskType: optionalText(input.taskType || "Writing", 120),
    status,
    recording: optionalText(input.recording, 4_000),
    summary: requiredText(input.summary, "summary", 20_000),
    method: optionalText(input.method, 20_000),
    feedback: optionalText(input.feedback, 20_000),
    homework: optionalText(input.homework, 20_000),
    nextPractice: optionalText(input.nextPractice, 20_000),
    source: "chatgpt",
    clientRequestId: requestId,
    updatedAt: Date.now(),
  };
  const result = await mutateFor(context, env, (data) => {
    data.courseSessions = [
      ...(data.courseSessions || []).filter((item) => item.id !== session.id),
      session,
    ];
    return data;
  }, dependencies);
  return { ok: true, session, stateVersion: result.version };
}

function planningRhythms(today, data) {
  const rhythms = allRhythms();
  const current = currentIeltsContext(data, today);
  if (current.type === "rhythm") {
    const index = rhythms.findIndex((item) => item.id === current.id);
    return [rhythms[index], rhythms[index + 1]].filter(Boolean).map((item) => item.id);
  }
  if (current.type === "baseline" || current.type === "prelaunch") return rhythms.slice(0, 1).map((item) => item.id);
  if (current.type === "journey" && current.id !== "journey") return [current.id];
  if (current.type === "phase") return [current.id];
  return [];
}

function normalizeGuidedTask(value, rhythmId, index) {
  const kind = String(value.kind || "guided").trim().toLowerCase();
  if (!TASK_KINDS.has(kind)) throw new JoyCoreError("IELTS_INVALID_TASK_KIND", 400, { kind });
  const skill = String(value.skill || "review").trim().toLowerCase();
  if (!SKILLS.has(skill)) throw new JoyCoreError("IELTS_INVALID_SKILL", 400, { skill });
  return {
    id: requiredText(value.id || `${rhythmId}-custom-${String(index + 1).padStart(2, "0")}`, "tasks.id", 160),
    rhythmId,
    kind,
    skill,
    title: requiredText(value.title, "tasks.title", 240),
    minutes: finiteNumber(value.minutes, "tasks.minutes", 5, 360, 30),
    objective: requiredText(value.objective, "tasks.objective", 4_000),
    steps: Array.isArray(value.steps)
      ? value.steps.map((item) => requiredText(item, "tasks.steps", 1_000)).slice(0, 12)
      : [],
    material: optionalText(value.material, 4_000),
    output: requiredText(value.output, "tasks.output", 4_000),
    doneWhen: Array.isArray(value.doneWhen)
      ? value.doneWhen.map((item) => requiredText(item, "tasks.doneWhen", 1_000)).slice(0, 8)
      : [],
    source: "chatgpt",
  };
}

export async function replaceIeltsRhythmTasks(env, context, rhythmId, input = {}, dependencies = {}) {
  const id = requiredText(rhythmId, "rhythmId", 160);
  const requestId = requiredClientRequestId(input.clientRequestId);
  if (!Array.isArray(input.tasks) || !input.tasks.length) {
    throw new JoyCoreError("IELTS_TASKS_REQUIRED", 400);
  }
  let savedTasks;
  const today = normalizedDate(input.date, vietnamDateKey(dependencies.now?.() || new Date()));
  const result = await mutateFor(context, env, (data) => {
    const allowed = planningRhythms(today, data);
    if (!allowed.includes(id)) {
      throw new JoyCoreError("IELTS_RHYTHM_NOT_PLANNABLE", 403, { rhythmId: id, allowed });
    }
    savedTasks = input.tasks.slice(0, 12).map((task, index) => normalizeGuidedTask(task, id, index));
    const totalMinutes = savedTasks.reduce((sum, task) => sum + task.minutes, 0);
    if (totalMinutes > 360) {
      throw new JoyCoreError("IELTS_RHYTHM_EXCEEDS_SIX_HOURS", 400, { totalMinutes });
    }
    savedTasks = savedTasks.map((task) => ({ ...task, clientRequestId: requestId }));
    data.customTasks = [
      ...(data.customTasks || []).filter((task) => task.rhythmId !== id),
      ...savedTasks,
    ];
    return data;
  }, dependencies);
  return {
    ok: true,
    rhythmId: id,
    tasks: savedTasks,
    stateVersion: result.version,
  };
}

export const IELTS_ASSISTANT_SERVICE = Object.freeze({
  getTeachingContext: getIeltsTeachingContext,
  getTeachingTask: getIeltsTeachingTask,
  startTask: startIeltsTeachingTask,
  completeTask: completeIeltsTeachingTask,
  addAssessment: addIeltsAssessment,
  addRecurringError: addIeltsRecurringError,
  addCourseSession: addIeltsCourseSession,
  replaceRhythmTasks: replaceIeltsRhythmTasks,
});
