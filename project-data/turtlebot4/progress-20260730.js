(() => {
  const STAGE_3_CHECKLIST_IDS = [
    "s3-goal-set",
    "s3-logging",
    "s3-runs",
    "s3-metrics",
  ];

  const STAGE_3_DETAILED_TASK_ITEM_COUNTS = [4, 5, 4, 4, 4, 4];
  const STAGE_3_DETAILED_CHECKLIST_IDS = STAGE_3_DETAILED_TASK_ITEM_COUNTS.flatMap(
    (count, taskIndex) => Array.from(
      { length: count },
      (_, itemIndex) => `s3-${taskIndex + 1}-${itemIndex + 1}`,
    ),
  );

  const STAGE_3_SCHEDULE_TASK_IDS = [
    "w3-d2-t2",
    "w3-d3-t1",
    "w3-d3-t3",
    "w3-d4-t1",
    "w3-d4-t2",
    "w3-d5-t2",
    "w3-d7-t1",
    "w3-d7-t2",
  ];

  const HISTORY_TITLE = "Stage 3 navigation benchmark completed";

  function applyProgressUpdate() {
    const plan = hubState?.projectState;
    if (!plan || plan.project?.totalWeeks !== 12) return false;

    plan.updatedAt = "2026-07-30";
    plan.project.currentStageId = "stage-4";
    plan.project.currentBlockers = [
      "TurtleBot4 simulation and the first controlled world are not set up yet.",
      "Simulated LiDAR, RGB-D, odometry and TF still need verification before frontier development.",
    ];
    plan.project.stage3Result = {
      trials: 12,
      successes: 12,
      successRate: 100,
      recoveries: 0,
      totalTravelTimeSeconds: 101.11,
      meanTravelTimeSeconds: 8.43,
      totalPathLengthMeters: 20.62,
      meanPathLengthMeters: 1.72,
      rosbagMessages: 43542,
    };

    if (!(plan.history || []).some((entry) => entry.title === HISTORY_TITLE)) {
      plan.history ||= [];
      plan.history.push({
        date: "2026-07-30",
        progressAfter: 32,
        title: HISTORY_TITLE,
        detail: "The real TurtleBot4 completed 12/12 fixed Nav2 trials with 100% success and zero recoveries.",
      });
    }

    hubState.overrides = normalizeOverrides(hubState.overrides);
    hubState.overrides.checklist ||= {};
    hubState.overrides.planTasks ||= {};

    let overridesChanged = false;
    [...STAGE_3_CHECKLIST_IDS, ...STAGE_3_DETAILED_CHECKLIST_IDS].forEach((id) => {
      if (hubState.overrides.checklist[id] === true) return;
      hubState.overrides.checklist[id] = true;
      overridesChanged = true;
    });
    STAGE_3_SCHEDULE_TASK_IDS.forEach((id) => {
      if (hubState.overrides.planTasks[id] === true) return;
      hubState.overrides.planTasks[id] = true;
      overridesChanged = true;
    });

    if (overridesChanged) {
      if (typeof scheduleHubSave === "function") scheduleHubSave();
      else storeLocalOverrides();
    }

    updateTurtleBotCard();
    if (!hubElements?.modal?.hidden) renderHub();
    return true;
  }

  function applyWithRetry() {
    if (applyProgressUpdate()) return;
    window.setTimeout(applyProgressUpdate, 100);
  }

  applyWithRetry();
  window.setTimeout(applyProgressUpdate, 250);
  window.setTimeout(applyProgressUpdate, 900);
  window.addEventListener("pageshow", applyProgressUpdate);
})();
