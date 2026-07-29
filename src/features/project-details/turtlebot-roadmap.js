(() => {
  const ROADMAP_URL = "https://docs.google.com/document/d/16tNFhp4qvS8rlGTzL_8DQ_3fGJJoasrL1hJAQ16xPkk/edit?tab=t.ov3oqkj75gyr";
  const OPEN_TASKS = new Set();
  const DONE_BY_DEFAULT = new Set([
    "s1-1-1","s1-1-2","s1-1-3","s1-1-4","s1-2-1","s1-2-2",
    "s1-2-3","s1-2-4","s1-2-5","s1-3-1","s1-3-2","s1-3-3",
    "s1-3-4","s1-3-5","s1-3-6","s1-4-1","s1-4-2","s1-4-3",
    "s1-4-4","s1-4-5","s1-5-1","s1-5-2","s1-5-3","s1-5-4",
    "s1-5-5","s1-6-1","s1-6-2","s1-6-3","s1-6-4","s1-6-5",
    "s2-1-1","s2-1-2","s2-1-3","s2-1-4","s2-1-5","s2-1-6",
    "s2-2-1","s2-2-2","s2-2-3","s2-2-4","s2-2-5","s2-3-1",
    "s2-3-2","s2-3-3","s2-3-4","s2-4-1","s2-4-2","s2-4-3",
    "s2-4-4","s2-4-5","s2-5-1","s2-5-2","s2-5-3","s2-5-4",
    "s2-5-5","s2-5-6","s2-6-1","s2-6-2","s2-6-3","s2-6-4",
    "s2-6-5","s2-7-1","s2-7-2","s2-7-3","s2-7-4","s2-7-5",
    "s3-1-1","s3-1-4","s3-2-1"
  ]);

  const ROADMAP = [
    {
      id: "stage-1", number: 1, short: "Foundation", title: "Foundation & Inputs", state: "complete",
      main: "Establish a safe, observable and stable ROS 2 foundation so every later stage uses verified input streams, frames, namespaces and an approved map.",
      objective: "Confirm reliable communication between the laptop and TurtleBot 4; verify battery, LiDAR, odometry, TF, RGB and depth data; document the map; and keep the required streams stable for a continuous 20–30 minute observation session.",
      gate: "All required inputs are stable, frames and namespaces are confirmed, one official map is selected, and no severe unexplained error remains.",
      tasks: [
        ["Task 1.1", "Verify ROS 2 connection and namespace", ["Confirm the ROS 2 Jazzy environment on the laptop and robot.", "Verify nodes, topics, services and actions under the /bot1 namespace.", "Record network addresses, discovery settings and environment source commands.", "Keep the namespace configurable in reusable project launch files."]],
        ["Task 1.2", "Verify battery, LiDAR, odometry and TF", ["Read BatteryState and record the main battery values.", "Confirm that /bot1/scan publishes real LiDAR data at a stable rate.", "Verify odometry changes correctly without abnormal jumps.", "Confirm the odom → base_link and sensor TF chain.", "Document the LiDAR start_motor recovery procedure."]],
        ["Task 1.3", "Verify the RGB-D camera", ["Identify the RGB image, depth image and camera_info topics.", "Check message types, publishers, QoS and rates.", "Confirm RGB images are live and timestamps update.", "Verify depth units, usable range and invalid values.", "Confirm the camera frame connects to base_link through TF.", "Classify camera diagnostic issues."]],
        ["Task 1.4", "Verify QoS, timestamps and latency", ["Record QoS settings for required topics.", "Measure message rates and rate variation.", "Confirm header timestamps update without unexplained pauses.", "Record RGB–depth timestamp differences and the synchronization method.", "Save the results in CSV or Markdown."]],
        ["Task 1.5", "Manage the map and metadata", ["Store map files with a clear version or date.", "Record resolution, origin, mode, robot, namespace and SLAM command.", "Describe incomplete regions, dynamic obstacles and layout changes.", "Save an RViz image linked to the map report.", "Select one official map for Stage 2 and Stage 3."]],
        ["Task 1.6", "Run a 20–30 minute stability test", ["Run read-only monitoring continuously for 20–30 minutes.", "Monitor battery, scan, odometry, TF, RGB-D and diagnostics.", "Test stationary operation and light movement.", "Record data loss, TF timeout, reduced frequency and node crashes.", "Finish with a pass/fail table and open issues."]]
      ]
    },
    {
      id: "stage-2", number: 2, short: "Localization & Nav2", title: "Localization & Nav2", state: "complete",
      main: "Build a project-owned workflow that loads the approved map, localizes the robot with AMCL, starts Nav2 and navigates to operator-selected goals.",
      objective: "From a fresh start, localize the robot reliably on the approved map, keep LaserScan aligned with the map, activate the required lifecycle nodes and complete three fixed goals consecutively in a safe area.",
      gate: "The complete workflow is reproducible from a fresh start using project code and configuration, and G1 → G2 → G3 all return SUCCEEDED in one session.",
      tasks: [
        ["Task 2.1", "Create project bringup and configuration", ["Create a tb4_project_bringup package or equivalent.", "Create Localization and Nav2 launch files with arguments.", "Use a project-maintained Nav2 parameter file.", "Create a combined launch with reproducible startup order.", "Store defaults in YAML and avoid personal absolute paths.", "Build, lint and test at home."]],
        ["Task 2.2", "Load the map and set the initial pose", ["Load the official map selected in Stage 1.", "Open RViz with map as Fixed Frame and required displays.", "Set 2D Pose Estimate to the real robot pose.", "Confirm the AMCL particle cloud converges.", "Move slightly and verify continuous pose updates."]],
        ["Task 2.3", "Verify TF and scan–map alignment", ["Confirm the map → odom → base_link TF chain.", "Verify LaserScan overlaps walls and static obstacles.", "Record scan offset, dispersed particles, pose jumps or wrong heading.", "Create a recovery procedure for pose, TF, map and stack restart."]],
        ["Task 2.4", "Start and verify the Nav2 lifecycle", ["Start planner_server, controller_server, bt_navigator and behavior_server.", "Confirm the navigate_to_pose action server exists.", "Verify important lifecycle nodes report active [3].", "Standardize lifecycle reset through the lifecycle manager.", "Reproduce the active state through project launch files."]],
        ["Task 2.5", "Verify costmaps, planner, controller and recovery", ["Confirm footprint or robot_radius matches TurtleBot 4.", "Check obstacle, inflation, global and local costmaps.", "Verify the planner creates a valid path.", "Verify the controller produces safe motion commands.", "Test recovery behaviours in a safe area.", "Record every parameter change and reason."]],
        ["Task 2.6", "Create three fixed goals", ["Choose an easy goal, a heading-change goal and a longer goal.", "Save x, y and yaw in config/fixed_goals.yaml using map frame.", "Keep goals in free space outside inflated obstacles.", "Pilot each goal and confirm a safe route.", "Version any later coordinate change."]],
        ["Task 2.7", "Run fresh-start verification", ["Begin from a clean stack or restarted environment.", "Repeat sensors → Localization → initial pose → Nav2 → lifecycle.", "Run G1 → G2 → G3 without restarting Nav2 or moving the robot by hand.", "Require every goal to return SUCCEEDED.", "Save time, RViz evidence, action results, recovery behaviour and notes."]]
      ]
    },
    {
      id: "stage-3", number: 3, short: "Nav2 Benchmark", title: "Navigation Benchmark", state: "current",
      main: "Turn ‘the robot can navigate’ into a quantitative and repeatable baseline for later comparison with frontier and semantic-risk-aware exploration.",
      objective: "Create a fixed goal set, benchmark runner, logging workflow and metric report covering success rate, time, path length, replanning, recovery and failure.",
      gate: "Repeated trials use a frozen map, goal set and Nav2 configuration, and all metrics and failures are traceable to saved evidence.",
      tasks: [
        ["Task 3.1", "Design the benchmark goal set", ["Choose 3–5 official goals covering different routes.", "Store name, x, y, yaw and difficulty in YAML.", "Save an RViz image showing positions and order.", "Keep map, goals and configuration unchanged within a version."]],
        ["Task 3.2", "Build the benchmark runner", ["Read goals from YAML and send NavigateToPose actions.", "Record start, end and result for every goal.", "Apply timeout and safe stop on failure.", "Export one CSV per run.", "Keep the runner separate from read-only monitoring."]],
        ["Task 3.3", "Standardize logging and rosbag", ["Define required pose, odometry, scan, cmd_vel, plan, costmap, TF and action topics.", "Create start/stop scripts with run identifiers.", "Save bringup and runner terminal logs.", "Check rosbag contents before leaving the lab."]],
        ["Task 3.4", "Run repeated trials", ["Run at least three repetitions of the same route.", "Keep start condition, map, configuration and goal order equivalent.", "Record dynamic obstacles.", "Keep failed runs in the dataset."]],
        ["Task 3.5", "Calculate navigation metrics", ["Calculate success rate, travel time and path length.", "Count replans, recoveries, timeouts, aborted and canceled actions.", "Report mean, minimum, maximum and spread.", "Link failures to logs, screenshots or rosbag."]],
        ["Task 3.6", "Freeze the Nav2 baseline", ["Select the official parameter file.", "Attach a version or commit SHA.", "Document known limits and likely failures.", "Create a separate comparison version before later tuning."]]
      ]
    },
    {
      id: "stage-4", number: 4, short: "Simulation", title: "Simulation & Scenarios", state: "upcoming",
      main: "Create a safe, controlled simulation environment for developing exploration, perception and risk components before using the real robot.",
      objective: "Provide a robot model, LiDAR, RGB-D, odometry, TF, map and Nav2 interface close to the real system, with scenarios that can be reset and repeated.",
      gate: "The simulation launches reproducibly and supports repeatable static, narrow-path, blocked-route and semantic scenarios.",
      tasks: [
        ["Task 4.1", "Prepare the robot model and simulation stack", ["Select a ROS 2 Jazzy-compatible simulator.", "Verify model, footprint, odometry and controller.", "Keep interfaces close to the real robot.", "Create a one-command launch."]],
        ["Task 4.2", "Build the world and map", ["Create rooms, corridors, corners, doors and obstacles.", "Create a matching occupancy map.", "Define an official start pose and valid regions.", "Version world, map and model."]],
        ["Task 4.3", "Verify simulated sensors and TF", ["Check LiDAR, RGB, depth, camera_info, odometry and TF.", "Set useful rates, timestamps and noise.", "Verify camera intrinsics and depth.", "Document differences from real sensors."]],
        ["Task 4.4", "Design controlled test scenarios", ["Create static, narrow-path and blocked-route scenarios.", "Create a semantic target scenario.", "Create controlled failure cases.", "Define start, end and metric conditions."]],
        ["Task 4.5", "Compare simulation and reality", ["Compare footprint, speed, acceleration, sensor range and costmaps.", "Document unrealistic effects.", "Separate transferable and retuned parameters.", "Do not claim real performance from simulation alone."]]
      ]
    },
    {
      id: "stage-5", number: 5, short: "Frontier Baseline", title: "Frontier Exploration Baseline", state: "upcoming",
      main: "Build a geometric frontier exploration system that autonomously selects unknown regions and serves as the baseline for the proposed method.",
      objective: "Detect, cluster and score valid frontiers; navigate to them; recover from failed goals; measure coverage; and stop correctly.",
      gate: "Repeatable exploration runs produce measurable coverage, travel and failure results before semantic scoring is added.",
      tasks: [
        ["Task 5.1", "Detect frontiers from the occupancy grid", ["Subscribe to the exploration map or costmap.", "Define the free-to-unknown frontier rule.", "Filter noise and small components.", "Write unit tests on small grids."]],
        ["Task 5.2", "Cluster frontiers and create safe goals", ["Group adjacent frontier cells.", "Calculate a safe representative point.", "Verify free-space clearance.", "Reject unreachable clusters."]],
        ["Task 5.3", "Build geometric scoring baselines", ["Implement nearest-frontier scoring.", "Implement geometric information gain.", "Normalize score components.", "Log every candidate score."]],
        ["Task 5.4", "Integrate with Nav2 and the goal manager", ["Send the selected frontier through NavigateToPose.", "Monitor feedback, timeout and result.", "Select a new frontier after success.", "Penalize failed goals.", "Never dispatch two active goals."]],
        ["Task 5.5", "Define stopping and failure handling", ["Stop when no valid frontier remains or coverage is reached.", "Stop safely on timeout, low battery or stack failure.", "Classify detector, goal, planner and controller failures.", "Store goal history."]],
        ["Task 5.6", "Evaluate the frontier baseline", ["Measure coverage, exploration time and distance.", "Count goals, failures, revisits and recoveries.", "Compare nearest frontier and information gain.", "Validate before a real-robot pilot."]]
      ]
    },
    {
      id: "stage-6", number: 6, short: "RGB-D Perception", title: "RGB-D Perception", state: "upcoming",
      main: "Detect a small set of meaningful objects, obtain depth and transform observed object positions from the camera frame to the map frame.",
      objective: "Publish semantic observations with class, confidence, timestamp and 3D map position, and measure detection, inference and localization errors.",
      gate: "Selected classes are detected reliably, invalid depth is handled and observations are transformed to map frame with measured quality.",
      tasks: [
        ["Task 6.1", "Select object classes and data criteria", ["Choose 2–3 object classes.", "Define sizes, distances, lighting and viewing angles.", "Set confidence and invalid-detection criteria.", "Prepare representative data."]],
        ["Task 6.2", "Stabilize the RGB-D pipeline", ["Verify RGB, depth and camera_info timestamps.", "Synchronize streams with message_filters.", "Handle invalid and outlier depth.", "Confirm units and intrinsics.", "Request TF at image timestamp."]],
        ["Task 6.3", "Integrate the object detector", ["Start with a pretrained detector.", "Standardize preprocessing and class mapping.", "Publish boxes, class, confidence and inference time.", "Support live and rosbag modes."]],
        ["Task 6.4", "Estimate depth and 3D position", ["Select robust depth values inside boxes.", "Back-project pixels using camera intrinsics.", "Reject unreliable depth.", "Record depth quality."]],
        ["Task 6.5", "Transform detections to the map frame", ["Transform camera points through base_link to map.", "Use image timestamps.", "Publish class, position, confidence and timestamp.", "Display RViz markers."]],
        ["Task 6.6", "Evaluate perception", ["Measure precision, recall and F1.", "Measure inference time and processing rate.", "Measure depth and map-position error.", "Document lighting, distance, occlusion and motion failures."]]
      ]
    },
    {
      id: "stage-7", number: 7, short: "Semantic Mapping", title: "Semantic Mapping", state: "upcoming",
      main: "Maintain a persistent, map-linked representation of detected semantic entities and fuse repeated observations of the same object.",
      objective: "Store class, position, confidence and timestamps; associate duplicate observations; visualize the semantic map; and evaluate consistency.",
      gate: "Entities can be saved, reloaded, visualized and updated without uncontrolled duplication, with measured position consistency.",
      tasks: [
        ["Task 7.1", "Define the semantic data model", ["Define ID, class, map position, confidence and timestamps.", "Store observation count and uncertainty.", "Define serialization.", "Version the format."]],
        ["Task 7.2", "Associate repeated observations", ["Define class and distance thresholds.", "Fuse repeated positions.", "Create a new entity when association fails.", "Log decisions."]],
        ["Task 7.3", "Handle confidence and object state", ["Update confidence from repeated observations.", "Track last-seen time and count.", "Define stale-object handling.", "Avoid silent deletion."]],
        ["Task 7.4", "Save and reload the semantic map", ["Save entities with occupancy-map version.", "Reload without changing IDs or positions.", "Reject incompatible map versions.", "Create a save/load test."]],
        ["Task 7.5", "Visualize semantic entities", ["Publish labelled RViz markers.", "Show confidence or uncertainty.", "Provide entity-history inspection.", "Separate visualization from storage."]],
        ["Task 7.6", "Evaluate semantic-map quality", ["Measure localization error and duplicate rate.", "Test different viewpoints.", "Test save/reload consistency.", "Document association failures."]]
      ]
    },
    {
      id: "stage-8", number: 8, short: "Semantic-risk-aware", title: "Semantic-risk-aware Exploration", state: "upcoming",
      main: "Select exploration goals using geometric information, semantic value, path cost, risk and previous failure history.",
      objective: "Implement an explainable utility function and compare the proposed method against the geometric frontier baseline under controlled conditions.",
      gate: "Both methods run with frozen configurations, every score component is logged and comparison metrics use equivalent scenarios.",
      tasks: [
        ["Task 8.1", "Define the frontier utility function", ["Define information, distance, semantic, risk and history terms.", "Normalize every component.", "Store weights in YAML.", "Document expected effects."]],
        ["Task 8.2", "Add semantic value", ["Define valuable classes or regions.", "Calculate semantic value per frontier.", "Handle missing semantic evidence.", "Log the contribution."]],
        ["Task 8.3", "Add path and local risk", ["Define clearance and path-risk measures.", "Penalize narrow or unstable routes.", "Keep risk distinct from distance.", "Log the contribution."]],
        ["Task 8.4", "Add revisit and failure history", ["Penalize recently visited regions.", "Penalize failed or aborted goals.", "Define decay or reset rules.", "Persist history during each run."]],
        ["Task 8.5", "Integrate scoring with execution", ["Score all valid candidates.", "Select the highest valid utility.", "Publish score breakdown and markers.", "Send one Nav2 goal.", "Update after success or failure."]],
        ["Task 8.6", "Compare baseline and proposed methods", ["Freeze scenario, map, start pose, objects and time limit.", "Run repeated trials.", "Compare coverage, time, travel, failures and discoveries.", "Report trade-offs and weight sensitivity."]]
      ]
    },
    {
      id: "stage-9", number: 9, short: "Integration & Thesis", title: "Mission Integration & Thesis", state: "upcoming",
      main: "Integrate the complete mission, run final experiments and produce the graduation thesis with reproducible evidence.",
      objective: "Demonstrate the end-to-end system, compare methods, analyze limitations and package code, data, figures, video and written results.",
      gate: "The mission is demonstrated safely, experiments are repeatable, claims are supported and evidence is traceable to repository versions.",
      tasks: [
        ["Task 9.1", "Integrate the end-to-end mission", ["Create one launch flow.", "Verify startup order and lifecycle.", "Add safe stop, timeout and low-battery handling.", "Run the complete mission before experiments."]],
        ["Task 9.2", "Freeze the experiment protocol", ["Fix map, environment, start pose, objects and timeout.", "Define valid and invalid runs.", "Define run order.", "Freeze code and configuration."]],
        ["Task 9.3", "Run final experiments", ["Collect repeated baseline runs.", "Collect repeated proposed-method runs.", "Keep failed runs with reasons.", "Check evidence after every session."]],
        ["Task 9.4", "Analyze results and limitations", ["Calculate agreed metrics.", "Create tables, plots and failure categories.", "Explain trade-offs.", "Document validity threats and limitations."]],
        ["Task 9.5", "Complete thesis and figures", ["Write methods, implementation, experiments and results.", "Create architecture and flowchart figures.", "Link claims to evidence and versions.", "Complete revisions and formatting."]],
        ["Task 9.6", "Prepare demonstration and handover", ["Prepare a safe demo script and recovery plan.", "Record final video and screenshots.", "Clean the repository and instructions.", "Package configuration, data and presentation materials."]]
      ]
    }
  ];

  function ensureStyles() {
    if (document.querySelector("#joy-roadmap-hub-v3-styles")) return;
    const style = document.createElement("style");
    style.id = "joy-roadmap-hub-v3-styles";
    style.textContent = `
      .joy-roadmap-source{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:13px;padding:10px 12px;border:1px solid #dce4e7;border-radius:11px;background:#fff}.joy-roadmap-source span{color:#65767e;font-size:.7rem;line-height:1.45}.joy-roadmap-source a{white-space:nowrap;color:#506b77;font-size:.69rem;font-weight:800;text-decoration:none}.joy-roadmap-intro{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.joy-roadmap-info{padding:14px;border:1px solid #dbe3e6;border-radius:13px;background:#f8fafb}.joy-roadmap-info span,.joy-task-status{color:#7a8990;font-size:.65rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.joy-roadmap-info p{margin:6px 0 0;color:#52636b;font-size:.76rem;line-height:1.55}.joy-roadmap-tasks{display:grid;gap:8px}.joy-roadmap-task{overflow:hidden;border:1px solid #dce3e6;border-radius:12px;background:#fff}.joy-roadmap-task[open]{border-color:#9fb3bc;box-shadow:0 8px 22px rgba(54,72,80,.07)}.joy-roadmap-task summary{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:12px 13px;cursor:pointer;list-style:none}.joy-roadmap-task summary::-webkit-details-marker{display:none}.joy-task-number{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:#edf2f4;color:#4f6873;font-size:.68rem;font-weight:900}.joy-roadmap-task.complete .joy-task-number{background:#dfece4;color:#4c7359}.joy-roadmap-task summary b{display:block;color:#3f5058;font-size:.77rem;line-height:1.35}.joy-roadmap-task summary small{display:block;margin-top:3px;color:#7a8990;font-size:.65rem;font-weight:800}.joy-task-status{padding:5px 7px;border-radius:7px;background:#f0f3f4;white-space:nowrap}.joy-roadmap-task.complete .joy-task-status{background:#e4efe7;color:#52715c}.joy-roadmap-task.partial .joy-task-status{background:#eef2f4;color:#58717c}.joy-roadmap-items{display:grid;gap:7px;padding:12px 13px 14px;border-top:1px solid #e3e8ea;background:#fafbfb}.joy-roadmap-item{display:grid;grid-template-columns:20px 1fr;gap:9px;align-items:start;padding:8px 9px;border:1px solid #e1e6e8;border-radius:9px;background:#fff;cursor:pointer}.joy-roadmap-item input{position:absolute;opacity:0;pointer-events:none}.joy-check{width:18px;height:18px;display:grid;place-items:center;border:1px solid #b8c5ca;border-radius:5px;background:#fff;color:#fff;font-size:.65rem;font-weight:900}.joy-roadmap-item.done{background:#f1f6f3}.joy-roadmap-item.done .joy-check{border-color:#6f9280;background:#6f9280}.joy-roadmap-item span:last-child{color:#53636a;font-size:.72rem;line-height:1.45}.joy-roadmap-item.done span:last-child{color:#718078;text-decoration:line-through}.joy-roadmap-gate{margin-top:14px;padding:13px 14px;border:1px solid #d4dfe3;border-left:4px solid #6f8995;border-radius:11px;background:#f5f8f9}.joy-roadmap-gate span{color:#6d7d84;font-size:.64rem;font-weight:850;letter-spacing:.06em;text-transform:uppercase}.joy-roadmap-gate p{margin:5px 0 0;color:#4f6169;font-size:.74rem;line-height:1.5}.joy-stage-progress{display:block;height:5px;margin-top:5px;border-radius:99px;background:#e1e7e9;overflow:hidden}.joy-stage-progress i{display:block;height:100%;background:#708b96}@media(max-width:760px){.joy-roadmap-intro{grid-template-columns:1fr}.joy-roadmap-source{align-items:flex-start;flex-direction:column}.joy-roadmap-task summary{grid-template-columns:32px 1fr}.joy-task-status{grid-column:1/-1;width:max-content;margin-left:42px}}
    `;
    document.head.append(style);
  }

  function itemId(stage, taskIndex, itemIndex) { return `s${stage.number}-${taskIndex + 1}-${itemIndex + 1}`; }
  function itemDone(id) {
    const value = hubState?.overrides?.checklist?.[id];
    return typeof value === "boolean" ? value : DONE_BY_DEFAULT.has(id);
  }
  function taskStats(stage, taskIndex) {
    const total = stage.tasks[taskIndex][2].length;
    let completed = 0;
    for (let index = 0; index < total; index += 1) if (itemDone(itemId(stage, taskIndex, index))) completed += 1;
    return { total, completed, percent: total ? Math.round(completed / total * 100) : 0 };
  }
  function stageStats(stage) {
    let total = 0, completed = 0, completeTasks = 0;
    stage.tasks.forEach((task, index) => { const stats = taskStats(stage, index); total += stats.total; completed += stats.completed; if (stats.percent === 100) completeTasks += 1; });
    return { total, completed, completeTasks, taskCount: stage.tasks.length, percent: total ? Math.round(completed / total * 100) : 0 };
  }
  function overallProgress() {
    let total = 0, completed = 0;
    ROADMAP.forEach((stage) => { const stats = stageStats(stage); total += stats.total; completed += stats.completed; });
    return total ? Math.round(completed / total * 100) : 0;
  }
  function renderTask(stage, task, taskIndex, defaultOpen) {
    const stats = taskStats(stage, taskIndex);
    const complete = stats.percent === 100;
    const partial = stats.percent > 0 && !complete;
    const key = `${stage.id}:${taskIndex}`;
    const open = OPEN_TASKS.has(key) || defaultOpen;
    return `<details class="joy-roadmap-task ${complete ? "complete" : partial ? "partial" : ""}" data-joy-roadmap-task="${escapeHub(key)}" ${open ? "open" : ""}><summary><span class="joy-task-number">${complete ? "✓" : taskIndex + 1}</span><span><b>${escapeHub(task[1])}</b><small>${escapeHub(task[0])} · ${stats.completed}/${stats.total} items</small></span><span class="joy-task-status">${complete ? "Complete" : partial ? "In progress" : "Not started"}</span></summary><div class="joy-roadmap-items">${task[2].map((label, itemIndex) => { const id = itemId(stage, taskIndex, itemIndex); const done = itemDone(id); return `<label class="joy-roadmap-item ${done ? "done" : ""}"><input type="checkbox" data-hub-check="${escapeHub(id)}" ${done ? "checked" : ""}><span class="joy-check">${done ? "✓" : ""}</span><span>${escapeHub(label)}</span></label>`; }).join("")}</div></details>`;
  }
  function verifiedEvidence(stageId) {
    const sourceStage = getStages().find((stage) => stage.id === stageId);
    if (!sourceStage?.results?.length) return "";
    return `<section class="hub-section-card"><div class="hub-section-heading"><div><span>Verified evidence</span><strong>${sourceStage.results.length} recorded result${sourceStage.results.length === 1 ? "" : "s"}</strong></div><small>Evidence from the connected TurtleBot repository.</small></div><div class="hub-source-results">${sourceStage.results.map((result) => `<article class="hub-result-card"><div><strong>${escapeHub(formatHubDate(result.date))}</strong><span>Verified result</span></div><p>${escapeHub(result.summary)}</p><div class="hub-evidence-list">${(result.evidence || []).map((path) => `<a href="https://github.com/${escapeHub(hubState.source.repository)}/blob/${escapeHub(hubState.source.ref || "main")}/${escapeHub(path)}" target="_blank" rel="noreferrer">${escapeHub(path.split("/").at(-1))} ↗</a>`).join("")}</div></article>`).join("")}</div></section>`;
  }

  function renderDetailedRoadmap() {
    ensureStyles();
    const stage = ROADMAP.find((item) => item.id === hubState.activeStageId) || ROADMAP[1];
    const stats = stageStats(stage);
    const firstIncomplete = stage.tasks.findIndex((task, index) => taskStats(stage, index).percent < 100);
    hubElements.body.innerHTML = `<div class="hub-roadmap-layout"><aside class="hub-stage-list" aria-label="Project stages"><div class="hub-progress-summary"><span>Detailed roadmap progress</span><strong>${overallProgress()}%</strong><div><i style="width:${overallProgress()}%"></i></div></div>${ROADMAP.map((item) => { const itemStats = stageStats(item); const complete = itemStats.percent === 100; const status = complete ? "Complete" : itemStats.percent > 0 || item.id === hubState.source?.project?.currentStageId ? "In progress" : item.state === "verification" ? "Needs verification" : "Upcoming"; return `<button type="button" class="hub-stage-button ${item.id === stage.id ? "active" : ""}" data-hub-action="select-stage" data-stage-id="${escapeHub(item.id)}"><span class="hub-stage-number">${complete ? "✓" : item.number}</span><span><strong>${escapeHub(item.short)}</strong><small>${escapeHub(status)} · ${itemStats.percent}%</small><i class="joy-stage-progress"><i style="width:${itemStats.percent}%"></i></i></span></button>`; }).join("")}</aside><section class="hub-stage-detail"><div class="hub-stage-heading"><div><p>Stage ${stage.number} of ${ROADMAP.length}</p><h3>${escapeHub(stage.title)}</h3></div><span class="ps-status">${stats.completeTasks}/${stats.taskCount} tasks complete</span></div><div class="joy-roadmap-source"><span>Open a task to see its detailed work items. A task becomes Complete only after every item is checked.</span><a href="${ROADMAP_URL}" target="_blank" rel="noreferrer">Open Google Docs roadmap ↗</a></div><div class="joy-roadmap-intro"><article class="joy-roadmap-info"><span>Main content</span><p>${escapeHub(stage.main)}</p></article><article class="joy-roadmap-info"><span>Objective</span><p>${escapeHub(stage.objective)}</p></article></div><section class="hub-section-card"><div class="hub-section-heading"><div><span>Tasks</span><strong>${stats.percent}% complete</strong></div><small>Checkbox progress is saved through Joy Project Hub.</small></div><div class="joy-roadmap-tasks">${stage.tasks.map((task, index) => renderTask(stage, task, index, OPEN_TASKS.size === 0 && index === firstIncomplete)).join("")}</div></section><section class="joy-roadmap-gate"><span>Completion gate</span><p>${escapeHub(stage.gate)}</p></section>${verifiedEvidence(stage.id)}</section></div>`;
  }

  document.addEventListener("toggle", (event) => {
    const task = event.target.closest?.("[data-joy-roadmap-task]");
    if (!task) return;
    if (task.open) OPEN_TASKS.add(task.dataset.joyRoadmapTask); else OPEN_TASKS.delete(task.dataset.joyRoadmapTask);
  }, true);

  ensureStyles();
  renderRoadmap = renderDetailedRoadmap;
  if (hubState?.source && hubState.activeTab === "roadmap" && hubElements?.modal && !hubElements.modal.hidden) renderRoadmap();
})();
