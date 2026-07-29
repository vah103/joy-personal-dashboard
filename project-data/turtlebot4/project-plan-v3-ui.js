(() => {
  const PLAN_URL = "https://docs.google.com/document/d/16tNFhp4qvS8rlGTzL_8DQ_3fGJJoasrL1hJAQ16xPkk/edit?tab=t.v3cdh2rm6ba6#heading=h.qwh3f9tw4uho";
  const START_DATE = "2026-07-13";
  const DAY_MS = 86400000;
  const T = (label, roadmapItemIds = [], extra = {}) => ({
    label,
    ...(roadmapItemIds.length ? { roadmapItemIds } : {}),
    ...extra,
  });

  const weekSpecs = [
    {
      title: "Foundation & Inputs",
      stageIds: ["stage-1"],
      objective: "Close the platform, sensor and input-data foundation so later stages use stable topics, frames and evidence.",
      deliverable: "Verified robot inputs, map metadata, a 20–30 minute stability result and committed Stage 1 evidence.",
      before: [
        T("Update the repository, build the workspace and verify preflight tools.", [], { done: true }),
        T("Prepare required topic, QoS, message-rate, timestamp and frame checks."),
        T("Create the map metadata template and Week 1 evidence folders."),
      ],
      lab: [
        T("Verify ROS 2 discovery, /bot1, battery, LiDAR, odometry and TF.", ["s1-connection", "s1-battery", "s1-lidar", "s1-odom-tf"]),
        T("Verify RGB-D topics, CameraInfo, publish rate, frames and diagnostics.", ["s1-camera"]),
        T("Measure QoS, rates and timestamps, then run the 20–30 minute stability test.", ["s1-timing", "s1-stability"]),
        T("Save the versioned map, logs, RViz evidence and RGB/depth samples.", ["s1-map"]),
      ],
      after: [
        T("Complete the sensor-status table and document every warning or blocker."),
        T("Finish map metadata, the Stage 1 report, PROJECT_STATUS and roadmap updates."),
        T("Commit configuration, summary logs, images and the report."),
      ],
      gate: "Inputs are stable; RGB-D is verified or blocked with evidence; Stage 1 evidence is committed.",
    },
    {
      title: "Localization & Nav2",
      stageIds: ["stage-2"],
      objective: "Reproduce Localization and Nav2 from a clean startup and complete three fixed goals consecutively.",
      deliverable: "Repeatable bringup, fixed goals, fresh-start evidence and a three-goal result table.",
      before: [
        T("Prepare project launches for Localization, Nav2 and RViz with parameterized map and config."),
        T("Create fixed_goals.yaml and the fresh-start checklist."),
        T("Prepare rosbag, terminal logging and a goal-result sheet; build and lint everything."),
      ],
      lab: [
        T("Restart cleanly with no leftover nodes.", ["s2-fresh-start"]),
        T("Load the map, set initial pose and confirm scan alignment.", ["s2-load-map", "s2-initial-pose"]),
        T("Verify map → odom → base_link and active Nav2 lifecycle nodes.", ["s2-tf", "s2-goals"]),
        T("Run G1 → G2 → G3 without restarting or resetting pose.", ["s2-three-goals"]),
        T("Capture action state, costmap, plan and logs for every failure."),
      ],
      after: [
        T("Normalize and commit project launch/config.", ["s2-config"]),
        T("Finalize fixed_goals.yaml and write fresh-start and goal-result reports."),
        T("Update roadmap and PROJECT_STATUS, then prepare the Week 3 benchmark."),
      ],
      gate: "Localization/Nav2 reproduce from fresh startup and three fixed goals succeed consecutively.",
    },
    {
      title: "Navigation Benchmark",
      stageIds: ["stage-3"],
      objective: "Turn successful navigation into a measured and repeatable Nav2 baseline for later exploration comparisons.",
      deliverable: "A fixed protocol, 9–15 valid trials, metrics, failure analysis and a frozen Nav2 baseline.",
      before: [
        T("Finalize benchmark_goals.yaml with 3–5 representative safe goals.", ["s3-goal-set"]),
        T("Finish the benchmark runner, rosbag, CSV and terminal logging.", ["s3-logging"]),
        T("Prepare success-rate, travel-time, path-length, recovery and failure analysis.", ["s3-metrics"]),
        T("Freeze one candidate Nav2 configuration before testing."),
      ],
      lab: [
        T("Recheck Localization/Nav2 with the fresh-start procedure and validate every goal in RViz."),
        T("Run one pilot to confirm runner, rosbag and CSV outputs."),
        T("Run at least three complete benchmark rounds; target five when possible.", ["s3-runs"]),
        T("Keep map, goal order, config and start conditions comparable; record every disruption and failure."),
        T("Verify all recorded files before leaving the lab."),
      ],
      after: [
        T("Calculate metrics and classify failures by subsystem.", ["s3-metrics"]),
        T("Freeze the official Nav2 baseline with configuration version and commit SHA."),
        T("Write the Stage 3 report, charts and thesis benchmark methodology."),
      ],
      gate: "A reproducible protocol, 9–15 valid trials and a frozen official Nav2 baseline exist.",
    },
    {
      title: "Simulation & Scenarios",
      stageIds: ["stage-4"],
      objective: "Create a safe simulation environment with interfaces close to the real robot and standardized exploration scenarios.",
      deliverable: "Repeatable TurtleBot4 simulation, three versioned scenarios and simulation-to-real notes.",
      home: [
        T("Install and verify TurtleBot4 simulation, Gazebo and dependencies.", ["s4-world"]),
        T("Standardize namespaces, topics, actions, frames and simulated sensors.", ["s4-sensors"]),
        T("Create open-space, corridor/corner and narrow-risk scenarios.", ["s4-scenarios"]),
        T("Standardize start pose, map, time limit, stopping conditions and semantic-object placement."),
        T("Run the Nav2 baseline and document simulation-to-real differences.", ["s4-parity"]),
        T("Write the simulation startup guide and thesis environment section."),
      ],
      gate: "Simulation starts reliably, three scenarios are versioned and frontier work no longer depends on robot access.",
    },
    {
      title: "Frontier Detection & Goal Generation",
      stageIds: ["stage-5"],
      objective: "Detect frontiers from OccupancyGrid, cluster them and generate safe candidate goals in simulation.",
      deliverable: "Tested frontier detector, clusters, safe goals, RViz markers and rejection logs.",
      home: [
        T("Define detector inputs/outputs and classify free, occupied and unknown cells."),
        T("Detect free–unknown boundaries and cluster frontier cells.", ["s5-detect"]),
        T("Compute centroids and geometric information; reject unsafe or tiny clusters."),
        T("Validate candidate goals through the costmap and planner."),
        T("Publish frontier, cluster, centroid and goal markers in RViz."),
        T("Create unit/replay tests and log all rejection reasons."),
      ],
      gate: "Detection is stable, goals stay in safe free space and edge cases are tested.",
    },
    {
      title: "Frontier Exploration Baseline",
      stageIds: ["stage-5"],
      objective: "Complete the autonomous exploration loop, handle failed goals and validate the baseline in simulation and on the robot.",
      deliverable: "Nearest and geometric baselines, stopping behavior, metrics and one safe real-robot pilot.",
      before: [
        T("Implement nearest and geometric frontier scoring.", ["s5-score"]),
        T("Build goal selection, NavigateToPose execution, timeout and transitions.", ["s5-nav"]),
        T("Add failed-goal memory and define stopping conditions."),
        T("Run both baselines in simulation and prepare lab safety limits."),
      ],
      lab: [
        T("Run a supervised pilot in a small low-traffic area."),
        T("Verify frontier markers, selected goal and global plan before continuous execution."),
        T("Test nearest first and geometric second; monitor stalls, repeated goals and recovery."),
        T("Record rosbag, logs, RViz evidence and video; stop on localization or avoidance instability."),
      ],
      after: [
        T("Fix goal validation, timeout and blacklist behavior from real data."),
        T("Calculate coverage, distance, goals and failed-goal rate.", ["s5-eval"]),
        T("Run regression tests, freeze the baseline and write the Stage 5 report."),
      ],
      gate: "Both baselines produce metrics, failures cannot loop forever and a safe robot pilot is documented.",
    },
    {
      title: "RGB-D Object Detection",
      stageIds: ["stage-6"],
      objective: "Choose 2–3 meaningful classes, collect real data and build a measurable detector.",
      deliverable: "Real-data detector, test set, initial metrics, stable inference and organized RGB-D evidence.",
      before: [
        T("Select 2–3 classes and a pretrained model; verify laptop inference."),
        T("Implement the detection node with class, confidence, box and timestamp.", ["s6-detection"]),
        T("Prepare collection conditions, rosbag commands, storage and ground-truth records."),
      ],
      lab: [
        T("Verify RGB, depth, CameraInfo, timestamps and camera TF.", ["s6-camera"]),
        T("Collect easy, difficult and negative samples across distance, angle, lighting and occlusion."),
        T("Save scene layouts and run live or replay inference before leaving."),
      ],
      after: [
        T("Create an independent test set and evaluate precision, recall, F1, false positives and inference time.", ["s6-eval"]),
        T("Select thresholds/resolution, optimize replay performance and document the detector."),
      ],
      gate: "Selected classes are detected on real data with a test set, metrics and usable inference speed.",
    },
    {
      title: "Depth & 3D Localization",
      stageIds: ["stage-6"],
      objective: "Combine detections, depth and TF to localize objects in the map frame and measure ground-truth error.",
      deliverable: "Measured RGB-D-to-map localization pipeline with markers, error analysis and limits.",
      before: [
        T("Synchronize RGB and depth and handle resolution differences."),
        T("Implement robust bounding-box depth filtering.", ["s6-depth"]),
        T("Convert pixels to 3D and transform camera → base_link → odom → map.", ["s6-transform"]),
        T("Publish 3D detections and prepare ground-truth/error calculations."),
      ],
      lab: [
        T("Place objects at measured locations and record multiple distances and angles."),
        T("Confirm RViz markers and record truth, estimates and viewing conditions."),
        T("Collect depth, reflection, occlusion and image-edge failure cases."),
      ],
      after: [
        T("Calculate mean, median and maximum localization error.", ["s6-eval"]),
        T("Separate detector, depth, calibration, timestamp and TF errors."),
        T("Freeze the perception pipeline, document limits and commit the Stage 6 report."),
      ],
      gate: "Objects are localized in map frame and ground-truth error is measured in replay and lab conditions.",
    },
    {
      title: "Semantic Mapping",
      stageIds: ["stage-7"],
      objective: "Fuse repeated detections into stable semantic objects, reduce duplicates and support save/load.",
      deliverable: "Persistent semantic database, stable IDs, RViz display and duplicate/stability metrics.",
      before: [
        T("Define the semantic object record.", ["s7-model"]),
        T("Implement association and fusion across repeated observations.", ["s7-fusion"]),
        T("Create labeled RViz markers and JSON/YAML save-load.", ["s7-storage", "s7-viz"]),
        T("Prepare multi-view, nearby-object and persistence tests."),
      ],
      lab: [
        T("Observe the same object from multiple poses and verify stable IDs."),
        T("Test two nearby same-class objects and temporary detection loss."),
        T("Save the object database, rosbag, RViz evidence and ground-truth layout."),
      ],
      after: [
        T("Calculate duplicate rate and position stability.", ["s7-eval"]),
        T("Tune association/fusion and verify save/load after restart."),
        T("Export a sample semantic map and write the Stage 7 report."),
      ],
      gate: "Objects keep stable IDs, nearby objects remain distinct and the semantic map saves/reloads with measured quality.",
    },
    {
      title: "Semantic-Risk-Aware Utility",
      stageIds: ["stage-8"],
      objective: "Implement frontier utility from geometric gain, semantic value, path cost, risk and history.",
      deliverable: "Explainable evaluator, normalized terms, YAML weights, ablation modes and scenario tests.",
      home: [
        T("Define and normalize geometric, semantic, cost, risk and penalty terms.", ["s8-utility", "s8-semantic", "s8-risk"]),
        T("Implement total and component scores for every frontier."),
        T("Visualize rankings and score components."),
        T("Create versioned YAML weights and semantic/risk/history modes.", ["s8-history"]),
        T("Run unit tests and three simulation scenarios."),
        T("Prepare five comparison and ablation configurations."),
      ],
      gate: "Every selection is explainable, components are independently logged and weights are versioned.",
    },
    {
      title: "Comparison & Ablation",
      stageIds: ["stage-8"],
      objective: "Compare baselines with the proposed method, isolate semantic and risk contributions and validate the final candidate.",
      deliverable: "Comparison tables, ablations, robot confirmation and a frozen final configuration.",
      before: [
        T("Run nearest, geometric, risk-only, semantic-only and full modes under identical conditions."),
        T("Repeat runs and calculate coverage, time, path, discovery, failures, recovery and risk exposure."),
        T("Select robot candidates and prepare the repeatable safety protocol."),
      ],
      lab: [
        T("Use the same area, start pose and object layout for every method."),
        T("Run geometric and full methods, plus another ablation when possible."),
        T("Record all data and evidence for comparative analysis.", ["s8-comparison"]),
      ],
      after: [
        T("Analyze simulation and robot results separately and perform semantic/risk ablation."),
        T("Explain coverage, time, distance and safety trade-offs."),
        T("Freeze final weights and write the Stage 8 methods and results."),
      ],
      gate: "Baseline/full comparison and semantic/risk ablations are complete with final weights and limitations.",
    },
    {
      title: "Mission Integration & Thesis",
      stageIds: ["stage-9"],
      objective: "Integrate the complete system, run final experiments, record the demo and finish all project deliverables.",
      deliverable: "End-to-end demo, final analysis, reproducible release, thesis, video and defense slides.",
      before: [
        T("Complete the mission state machine or behavior tree.", ["s9-mission"]),
        T("Integrate errors, safety monitoring, final launch/config and demo scenario."),
        T("Run simulation/rosbag rehearsal and prepare final storage, cameras and backups."),
        T("Update thesis chapters and reserve final result figures."),
      ],
      lab: [
        T("Run preflight for Localization, Nav2, RGB-D and semantic mapping."),
        T("Run the end-to-end real-robot mission.", ["s9-mission"]),
        T("Collect missing final baseline and proposed runs.", ["s9-experiments"]),
        T("Record logs, data, RViz evidence, failures, recovery and demo video; back up before leaving."),
      ],
      after: [
        T("Analyze final data and create tables, charts and architecture figures.", ["s9-analysis"]),
        T("Finish thesis methods, results, discussion, limitations and future work.", ["s9-writing"]),
        T("Finalize README, reproduction guide, release, demo video and slides."),
        T("Audit all nine stages for code, config, logs, results, reports and evidence."),
      ],
      gate: "The end-to-end mission, final evidence, thesis, release, video and reproduction guide are complete.",
    },
  ];

  const dateAt = (offset) => {
    const value = new Date(`${START_DATE}T00:00:00+07:00`);
    value.setTime(value.getTime() + offset * DAY_MS);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  };

  const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const normalizeTask = (task, weekNumber, dayIndex, taskIndex) => ({
    ...(typeof task === "string" ? { label: task } : task),
    id: `w${weekNumber}-d${dayIndex + 1}-t${taskIndex + 1}`,
    weight: 1,
  });
  const split = (tasks, slot) => tasks.filter((_, index) => index % 2 === slot);
  const makeDays = (spec, weekIndex) => {
    const weekNumber = weekIndex + 1;
    const buckets = Array.from({ length: 7 }, () => []);
    const locations = ["Home", "Home", "Lab", "Lab", "Home", "Optional Lab", "Home"];

    if (spec.home?.length) {
      const activeDays = [0, 1, 2, 3, 4, 6];
      spec.home.forEach((task, index) => buckets[activeDays[index % activeDays.length]].push(task));
      locations[2] = "Home";
      locations[3] = "Home";
      locations[5] = "Optional Home";
    } else {
      buckets[0] = split(spec.before || [], 0);
      buckets[1] = split(spec.before || [], 1);
      buckets[2] = split(spec.lab || [], 0);
      buckets[3] = split(spec.lab || [], 1);
      buckets[4] = split(spec.after || [], 0);
      buckets[6] = split(spec.after || [], 1);
    }

    buckets[5] = [T(`Use only if the Week ${weekNumber} completion gate is still unmet.`, [], { optional: true })];
    if (spec.gate) buckets[6].push(T(`Completion gate: ${spec.gate}`));

    return buckets.map((tasks, dayIndex) => ({
      date: dateAt(weekIndex * 7 + dayIndex),
      label: labels[dayIndex],
      location: locations[dayIndex],
      optional: dayIndex === 5,
      tasks: tasks.map((task, taskIndex) => normalizeTask(task, weekNumber, dayIndex, taskIndex)),
    }));
  };

  const weeks = weekSpecs.map((spec, index) => ({
    number: index + 1,
    title: spec.title,
    stageIds: spec.stageIds,
    start: dateAt(index * 7),
    end: dateAt(index * 7 + 6),
    objective: spec.objective,
    deliverable: spec.deliverable,
    days: makeDays(spec, index),
  }));

  const PLAN = {
    schemaVersion: 2,
    updatedAt: "2026-07-29",
    project: {
      id: "turtlebot4",
      name: "TurtleBot 4",
      subtitle: "Semantic-risk-aware autonomous exploration",
      timezone: "Asia/Ho_Chi_Minh",
      projectStart: "2026-07-14",
      planStart: "2026-07-13",
      planEnd: "2026-10-04",
      totalWeeks: 12,
      currentStageId: "stage-3",
      googleDocUrl: PLAN_URL,
      progressMethod: "Weighted technical checklist across all nine stages; schedule tasks and elapsed time remain separate.",
      currentBlockers: [
        "The Stage 3 physical benchmark is pending until the robot is sufficiently charged.",
        "Rosbag and CSV outputs still need validation in one pilot run.",
        "Navigation metrics and the frozen official Nav2 baseline are not yet available.",
      ],
    },
    scope: {
      includedStageIds: ["stage-1", "stage-2", "stage-3", "stage-4", "stage-5", "stage-6", "stage-7", "stage-8", "stage-9"],
      excludedStageIds: [],
      excludedReason: "All nine stages are included. New Plan is the primary execution source, including Simulation & Scenarios in Week 4.",
      objectClassLimit: 3,
      environmentLimit: 1,
    },
    labPolicy: {
      primaryDays: ["Wednesday", "Thursday"],
      optionalDay: "Saturday",
      rule: "Prepare and test at home first. Use lab time for hardware validation and data collection. Saturday is recovery buffer only.",
    },
    history: [
      { date: "2026-07-14", progressAfter: 0, title: "Project baseline created", detail: "The TurtleBot4 project started with no verified robot workflow." },
      { date: "2026-07-14", progressAfter: 2, title: "Robot connection and battery verified", detail: "ROS 2 networking and BatteryState were confirmed." },
      { date: "2026-07-14", progressAfter: 5, title: "LiDAR, odometry and TF verified", detail: "LiDAR operation, odometry and the required TF chain were confirmed." },
      { date: "2026-07-14", progressAfter: 7, title: "First lab map saved", detail: "SLAM produced a versioned occupancy map." },
      { date: "2026-07-23", progressAfter: 9, title: "Saved map and initial pose reproduced", detail: "The map loaded and AMCL initial pose was set in RViz." },
      { date: "2026-07-23", progressAfter: 11, title: "Map-to-base TF verified", detail: "The map → odom → base_link chain aligned scans with the map." },
      { date: "2026-07-23", progressAfter: 13, title: "Multiple Nav2 goals completed", detail: "Nav2 lifecycle nodes were activated and the robot reached multiple goals." },
      { date: "2026-07-29", progressAfter: 16, title: "Stage 1 inputs completed", detail: "RGB-D, timing and the 20-minute stability observation were verified." },
      { date: "2026-07-29", progressAfter: 22, title: "Stage 2 navigation completed", detail: "Map, AMCL, Nav2, fresh-start navigation and docking succeeded on the real robot." },
      { date: "2026-07-29", progressAfter: 24, title: "Stage 3 benchmark prepared", detail: "Four fixed goals, checksums and the benchmark runner passed dry-run." },
    ],
    weeks,
  };

  let lockedState = PLAN;
  Object.defineProperty(hubState, "projectState", {
    configurable: true,
    enumerable: true,
    get: () => lockedState,
    set: (value) => {
      if (value?.project?.totalWeeks === 12) lockedState = value;
    },
  });

  const replaceText = (value) => String(value)
    .replaceAll("10-Week Plan", "12-Week Plan")
    .replaceAll("10-week execution plan", "12-week execution plan")
    .replaceAll("10-week schedule", "12-week schedule")
    .replaceAll("Active 10-week scope", "All 9 technical stages")
    .replaceAll("27 Jul - 4 Oct 2026", "13 Jul - 4 Oct 2026")
    .replaceAll("Project State v2", "Project State v3")
    .replaceAll("Accelerated core thesis", "Full 12-week thesis plan")
    .replace(/\bWeek ([0-9-]+) of 10\b/g, "Week $1 of 12")
    .replace(/\b([0-9]+)\/10\b/g, "$1/12");

  function patchVisibleText() {
    const roots = [
      document.querySelector("#turtlebot-hub-modal"),
      findTurtleBotCard?.(),
    ].filter(Boolean);
    roots.forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const next = replaceText(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
      }
    });
  }

  const previousAnswer = answerProjectQuestion;
  answerProjectQuestion = (question) => {
    const value = String(question || "").toLowerCase();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const week = weeks.find((item) => today >= item.start && today <= item.end) || weeks.at(-1);
    const pending = (week?.days || []).flatMap((day) =>
      (day.tasks || []).filter((task) => {
        const linked = task.roadmapItemIds || [];
        if (linked.length) {
          return linked.some((id) => !getStages().map(effectiveStage)
            .some((stage) => stage.checklist?.some((item) => item.id === id && item.done)));
        }
        const override = hubState.overrides.planTasks?.[task.id];
        return typeof override === "boolean" ? !override : !task.done;
      }).map((task) => ({ task, day })));
    const next = pending[0];
    if (/(today|next|focus|what should i do)/.test(value)) {
      return `The schedule is Week ${week?.number || "-"} of 12: ${week?.title || "TurtleBot4"}. Next action: ${next?.task.label || "Review the current completion gate"}.`;
    }
    if (/(progress|percent|completion)/.test(value)) {
      return `Overall technical completion is ${projectProgress()}% across all nine stages. The current schedule is Week ${week?.number || "-"} of 12. Timeline progress never increases technical completion.`;
    }
    if (/(lab|prepare)/.test(value)) {
      const lab = (week?.days || []).find((day) => day.date >= today && day.location === "Lab");
      return lab
        ? `Next lab session: ${lab.label}, ${lab.date}. Prepare for: ${(lab.tasks || []).map((task) => task.label).join("; ")}.`
        : `No remaining lab day is scheduled this week. Continue with: ${next?.task.label || "the current completion gate"}.`;
    }
    return previousAnswer(question);
  };

  function activatePlan() {
    hubState.projectState = PLAN;
    hubState.overrides = normalizeOverrides(hubState.overrides);
    storeLocalOverrides();
    updateTurtleBotCard();
    if (!hubElements.modal?.hidden) renderHub();
    patchVisibleText();
  }

  const observer = new MutationObserver(() => {
    if (hubState.projectState !== PLAN) hubState.projectState = PLAN;
    patchVisibleText();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  activatePlan();
  setTimeout(activatePlan, 100);
  setTimeout(activatePlan, 700);
})();
