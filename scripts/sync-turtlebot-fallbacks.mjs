import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function appendResult(results, result) {
  const list = Array.isArray(results) ? results : [];
  if (!result) return list;
  const normalized = { ...result };
  delete normalized.stageId;
  const exists = list.some((entry) => (
    entry?.date === normalized.date && entry?.summary === normalized.summary
  ));
  if (!exists) list.push(normalized);
  return list;
}

export function patchSourceSnapshot(snapshot, currentState) {
  const next = clone(snapshot);
  const completedStageIds = currentState.roadmap?.completedStageIds || [];
  const completedStages = new Set(completedStageIds);
  const activeStageId = currentState.roadmap?.activeStageId
    || currentState.project?.currentStageId;
  const results = currentState.roadmap?.results || [];

  next.project = { ...(next.project || {}), ...clone(currentState.project || {}) };
  next.project.currentStageId = activeStageId;
  next.project.currentStatus = currentState.project?.currentStatus || "in-progress";
  next.project.lastReviewed = currentState.project?.lastReviewed || currentState.updatedAt;

  if (next.roadmap) {
    next.roadmap.updatedAt = currentState.updatedAt;
    next.roadmap.activeStageId = activeStageId;
    next.roadmap.completedStageIds = [...completedStageIds];
    next.roadmap.completedChecklistIds = [
      ...(currentState.roadmap?.completedChecklistIds || []),
    ];

    for (const stage of next.roadmap.stages || []) {
      if (completedStages.has(stage.id)) {
        stage.status = "completed";
        stage.checklist = (stage.checklist || []).map((item) => ({ ...item, done: true }));
        stage.results = appendResult(
          stage.results,
          results.find((entry) => entry.stageId === stage.id),
        );
      } else if (stage.id === activeStageId) {
        stage.status = "in-progress";
      } else if (stage.status === "in-progress") {
        stage.status = "not-started";
      }
    }
  }

  return next;
}

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index === -1) throw new Error(`Missing TurtleBot fallback anchor: ${label}`);
  if (source.indexOf(search, index + search.length) !== -1) {
    throw new Error(`Duplicate TurtleBot fallback anchor: ${label}`);
  }
  return source.replace(search, replacement);
}

function fallbackLiteral(currentState) {
  return JSON.stringify({
    updatedAt: currentState.updatedAt,
    project: currentState.project,
    scope: currentState.scope,
    roadmap: {
      completedStageIds: currentState.roadmap?.completedStageIds || [],
      activeStageId: currentState.roadmap?.activeStageId
        || currentState.project?.currentStageId,
    },
    history: currentState.history || [],
  });
}

export function patchPlanFallback(source, currentState) {
  if (source.includes("JOY_TURTLEBOT_CANONICAL_FALLBACK")) return source;
  const literal = fallbackLiteral(currentState);
  const anchor = "\n  let lockedState = PLAN;";
  const overlay = `
  // JOY_TURTLEBOT_CANONICAL_FALLBACK: generated from current-state.json during build.
  const TURTLEBOT_FALLBACK_STATE = ${literal};
  PLAN.updatedAt = TURTLEBOT_FALLBACK_STATE.updatedAt;
  Object.assign(PLAN.project, TURTLEBOT_FALLBACK_STATE.project);
  PLAN.scope = { ...(PLAN.scope || {}), ...(TURTLEBOT_FALLBACK_STATE.scope || {}) };
  PLAN.history = [...(PLAN.history || []).filter((entry) =>
    !(TURTLEBOT_FALLBACK_STATE.history || []).some((canonical) =>
      canonical.date === entry.date && canonical.title === entry.title)),
    ...(TURTLEBOT_FALLBACK_STATE.history || [])];
  const turtleBotFallbackCompletedStages = new Set(
    TURTLEBOT_FALLBACK_STATE.roadmap.completedStageIds || [],
  );
  for (const week of PLAN.weeks || []) {
    if (!(week.stageIds || []).some((stageId) => turtleBotFallbackCompletedStages.has(stageId))) continue;
    for (const day of week.days || []) {
      day.tasks = (day.tasks || []).map((task) => ({ ...task, done: true }));
    }
  }
`;
  return replaceOnce(source, anchor, `${overlay}${anchor}`, "12-week PLAN owner");
}

export function patchDetailedRoadmapFallback(source, currentState) {
  if (source.includes("JOY_TURTLEBOT_ROADMAP_FALLBACK")) return source;
  const completedStageIds = currentState.roadmap?.completedStageIds || [];
  const activeStageId = currentState.roadmap?.activeStageId
    || currentState.project?.currentStageId;
  const progress = Number(currentState.project?.overallProgress) || 0;
  const anchor = "\n  function ensureStyles() {";
  const overlay = `
  // JOY_TURTLEBOT_ROADMAP_FALLBACK: generated from current-state.json during build.
  const TURTLEBOT_FALLBACK_COMPLETED_STAGES = new Set(${JSON.stringify(completedStageIds)});
  const TURTLEBOT_FALLBACK_ACTIVE_STAGE = ${JSON.stringify(activeStageId)};
  const TURTLEBOT_FALLBACK_PROGRESS = ${Math.max(0, Math.min(100, Math.round(progress)))};
  ROADMAP.forEach((stage) => {
    stage.state = TURTLEBOT_FALLBACK_COMPLETED_STAGES.has(stage.id)
      ? "complete"
      : stage.id === TURTLEBOT_FALLBACK_ACTIVE_STAGE
        ? "current"
        : "upcoming";
  });
`;
  let next = replaceOnce(source, anchor, `${overlay}${anchor}`, "detailed ROADMAP owner");

  const itemDoneSource = `  function itemDone(id) {
    const value = hubState?.overrides?.checklist?.[id];
    return typeof value === "boolean" ? value : DONE_BY_DEFAULT.has(id);
  }`;
  const itemDoneReplacement = `  function itemDone(id) {
    const stageNumber = String(id || "").match(/^s(\\d+)-/)?.[1];
    if (stageNumber && TURTLEBOT_FALLBACK_COMPLETED_STAGES.has(\`stage-\${stageNumber}\`)) return true;
    const value = hubState?.overrides?.checklist?.[id];
    return typeof value === "boolean" ? value : DONE_BY_DEFAULT.has(id);
  }`;
  next = replaceOnce(next, itemDoneSource, itemDoneReplacement, "detailed checklist fallback");

  const progressSource = `  function overallProgress() {
    let total = 0, completed = 0;
    ROADMAP.forEach((stage) => { const stats = stageStats(stage); total += stats.total; completed += stats.completed; });
    return total ? Math.round(completed / total * 100) : 0;
  }`;
  const progressReplacement = `  function overallProgress() {
    return TURTLEBOT_FALLBACK_PROGRESS;
  }`;
  return replaceOnce(next, progressSource, progressReplacement, "detailed progress fallback");
}

export async function synchronizeTurtleBotFallbacks(publicRoot) {
  const turtleBotDir = resolve(publicRoot, "project-data", "turtlebot4");
  const currentStatePath = resolve(turtleBotDir, "current-state.json");
  const sourcePath = resolve(turtleBotDir, "source.json");
  const planPath = resolve(turtleBotDir, "project-plan-v3-ui.js");
  const detailedRoadmapPath = resolve(publicRoot, "turtlebot-roadmap.js");

  const [stateSource, sourceSnapshot, planSource, roadmapSource] = await Promise.all([
    readFile(currentStatePath, "utf8"),
    readFile(sourcePath, "utf8"),
    readFile(planPath, "utf8"),
    readFile(detailedRoadmapPath, "utf8"),
  ]);

  const currentState = JSON.parse(stateSource);
  const patchedSource = patchSourceSnapshot(JSON.parse(sourceSnapshot), currentState);
  const patchedPlan = patchPlanFallback(planSource, currentState);
  const patchedRoadmap = patchDetailedRoadmapFallback(roadmapSource, currentState);

  await Promise.all([
    writeFile(sourcePath, `${JSON.stringify(patchedSource)}\n`),
    writeFile(planPath, patchedPlan),
    writeFile(detailedRoadmapPath, patchedRoadmap),
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const publicRoot = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "dist");
  await synchronizeTurtleBotFallbacks(publicRoot);
  console.log("TurtleBot fallback snapshots synchronized from current-state.json");
}
