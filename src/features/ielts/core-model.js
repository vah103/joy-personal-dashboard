const CLOUD = document.querySelector('meta[name="joy-backend"]')?.content === "cloudflare";
const PROGRAM_URL = "/project-data/ielts/program-2026.json?v=ielts-journey-v4";
const API = "/api/ielts-core";
const LOCAL = "joy-ielts-journey-v2";
const TZ = "Asia/Ho_Chi_Minh";
const DONE = new Set(["completed"]);
const SKILL_LABELS = {
  writing: "Writing",
  speaking: "Speaking",
  reading: "Reading",
  listening: "Listening",
  review: "Review",
};
const KIND_LABELS = {
  guided: "Guided with ChatGPT",
  course: "External course",
  test: "Test",
  review: "Review",
};
const app = {
  program: null,
  data: blank(),
  version: 0,
  tab: "now",
  mode: "loading",
  saveTimer: 0,
};

function blank() {
  return {
    schemaVersion: 2,
    goal: {
      overall: 7,
      minimumSkill: 6.5,
      date: "2026-12-31",
    },
    taskStates: {},
    customTasks: [],
    courseSessions: [],
    assessments: [],
    errorLogs: [],
    rhythmReviews: {},
    settings: {
      eveningReminder: true,
      weeklyReviewReminder: true,
    },
  };
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normal(value) {
  const base = blank();
  if (Number(value?.schemaVersion) !== 2) return base;
  return {
    ...base,
    goal: { ...base.goal, ...object(value.goal) },
    taskStates: object(value.taskStates),
    customTasks: Array.isArray(value.customTasks) ? value.customTasks.slice(-200).map(normalizeTask).filter(Boolean) : [],
    courseSessions: Array.isArray(value.courseSessions) ? value.courseSessions.slice(-100).map(normalizeCourseSession).filter(Boolean) : [],
    assessments: Array.isArray(value.assessments) ? value.assessments.slice(-50).map(normalizeAssessment).filter(Boolean) : [],
    errorLogs: Array.isArray(value.errorLogs) ? value.errorLogs.slice(-300).map(normalizeError).filter(Boolean) : [],
    rhythmReviews: object(value.rhythmReviews),
    settings: { ...base.settings, ...object(value.settings) },
  };
}

function normalizeTask(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || "").trim();
  const title = String(value.title || "").trim();
  const rhythmId = String(value.rhythmId || "").trim();
  if (!id || !title || !rhythmId) return null;
  return {
    id,
    rhythmId,
    kind: ["guided", "course", "test", "review"].includes(value.kind) ? value.kind : "guided",
    skill: SKILL_LABELS[value.skill] ? value.skill : "review",
    title,
    minutes: Math.min(360, Math.max(5, Number(value.minutes) || 30)),
    objective: String(value.objective || "").trim(),
    steps: Array.isArray(value.steps) ? value.steps.map(String).filter(Boolean).slice(0, 12) : [],
    material: String(value.material || "").trim(),
    output: String(value.output || "").trim(),
    doneWhen: Array.isArray(value.doneWhen) ? value.doneWhen.map(String).filter(Boolean).slice(0, 8) : [],
    source: "chatgpt",
  };
}

function normalizeCourseSession(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || `course-${Date.now()}`).trim();
  const date = String(value.date || "").trim();
  const title = String(value.title || "").trim();
  if (!date || !title) return null;
  return {
    id,
    date,
    title,
    taskType: String(value.taskType || "Writing").trim(),
    status: ["waiting", "reviewed", "applied"].includes(value.status) ? value.status : "reviewed",
    recording: String(value.recording || "").trim(),
    summary: String(value.summary || "").trim(),
    method: String(value.method || "").trim(),
    feedback: String(value.feedback || "").trim(),
    homework: String(value.homework || "").trim(),
    nextPractice: String(value.nextPractice || "").trim(),
    updatedAt: Number(value.updatedAt || Date.now()),
  };
}

function normalizeAssessment(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || `assessment-${Date.now()}`).trim();
  const date = String(value.date || "").trim();
  if (!date) return null;
  const score = (key) => {
    const number = Number(value.scores?.[key]);
    return Number.isFinite(number) && number >= 0 && number <= 9 ? number : null;
  };
  return {
    id,
    date,
    label: String(value.label || "Assessment").trim(),
    scores: {
      listening: score("listening"),
      reading: score("reading"),
      writing: score("writing"),
      speaking: score("speaking"),
    },
    evidence: String(value.evidence || "").trim(),
    updatedAt: Number(value.updatedAt || Date.now()),
  };
}

function normalizeError(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || `error-${Date.now()}`).trim();
  const label = String(value.label || "").trim();
  if (!label) return null;
  return {
    id,
    skill: SKILL_LABELS[value.skill] ? value.skill : "review",
    label,
    cause: String(value.cause || "").trim(),
    action: String(value.action || "").trim(),
    count: Math.max(1, Number(value.count) || 1),
    active: value.active !== false,
    updatedAt: Number(value.updatedAt || Date.now()),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dateKey() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDate(value) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

function staticTasks() {
  if (!app.program) return [];
  const prelaunch = app.program.prelaunch.map((task) => ({ ...task, rhythmId: "prelaunch", groupLabel: "Before August" }));
  const baseline = app.program.baseline.tasks.map((task) => ({ ...task, rhythmId: "baseline", groupLabel: "Baseline · 1–2 Aug" }));
  const rhythms = app.program.august.weeks.flatMap((week) => (
    week.rhythms.flatMap((rhythm) => (
      rhythm.tasks.map((task) => ({
        ...task,
        rhythmId: rhythm.id,
        groupLabel: `${week.title} · ${rhythm.label}`,
        weekId: week.id,
      }))
    ))
  ));
  return [...prelaunch, ...baseline, ...rhythms];
}

function rhythmTasks(rhythmId) {
  const defaults = staticTasks().filter((task) => task.rhythmId === rhythmId);
  const custom = app.data.customTasks.filter((task) => task.rhythmId === rhythmId);
  if (!custom.length) return defaults;
  return [...defaults.filter((task) => task.kind === "course"), ...custom];
}

function allTasks() {
  const groups = [
    "prelaunch",
    "baseline",
    ...app.program.august.weeks.flatMap((week) => week.rhythms.map((rhythm) => rhythm.id)),
    ...app.program.phases.map((phase) => phase.id),
  ];
  return groups.flatMap(rhythmTasks);
}

function findTask(id) {
  return allTasks().find((task) => task.id === id);
}

function taskState(task) {
  return object(app.data.taskStates[task.id]);
}

function isDone(task) {
  return DONE.has(taskState(task).status);
}

function completedMinutes(tasks) {
  return tasks.reduce((sum, task) => {
    if (!isDone(task)) return sum;
    return sum + Math.max(0, Number(taskState(task).minutes || task.minutes));
  }, 0);
}

function taskProgress(tasks) {
  return tasks.length ? Math.round((tasks.filter(isDone).length / tasks.length) * 100) : 0;
}

function allWeeks() {
  return app.program?.august?.weeks || [];
}

function allRhythms() {
  return allWeeks().flatMap((week) => week.rhythms.map((rhythm) => ({ ...rhythm, week })));
}

function dateNumber(range) {
  return Number(String(range || "").match(/\d+/)?.[0] || 0);
}

function currentContext(today = dateKey()) {
  if (!app.program) return { type: "loading", id: "loading", label: "Loading", tasks: [] };
  if (today < "2026-08-01") {
    return {
      type: "prelaunch",
      id: "prelaunch",
      label: "Before August · App & course setup",
      objective: "Prepare Joy, recent course knowledge and baseline materials.",
      tasks: rhythmTasks("prelaunch"),
      targetMinutes: app.program.prelaunch.reduce((sum, task) => sum + task.minutes, 0),
    };
  }
  if (today <= "2026-08-02") {
    return {
      type: "baseline",
      id: "baseline",
      label: "Baseline · 1–2 Aug",
      objective: app.program.baseline.objective,
      tasks: rhythmTasks("baseline"),
      targetMinutes: app.program.baseline.tasks.reduce((sum, task) => sum + task.minutes, 0),
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
    const phase = app.program.phases.find((item) => item.id === phaseByMonth[today.slice(5, 7)])
      || app.program.phases.at(-1);
    return {
      type: "phase",
      id: phase.id,
      label: `${phase.month} · ${phase.title}`,
      objective: phase.outcome,
      tasks: app.data.customTasks.filter((task) => task.rhythmId === phase.id),
      targetMinutes: 0,
    };
  }
  const day = Number(today.slice(-2));
  const rhythm = allRhythms().find((item) => {
    const [start, end] = String(item.dateRange).match(/\d+/g)?.map(Number) || [];
    return day >= start && day <= end;
  });
  if (rhythm && today.startsWith("2026-08")) {
    return {
      type: "rhythm",
      id: rhythm.id,
      label: `${rhythm.label} · ${rhythm.days}`,
      dateRange: rhythm.dateRange,
      objective: rhythm.objective,
      week: rhythm.week,
      tasks: rhythmTasks(rhythm.id),
      targetMinutes: 360,
    };
  }
  const nextRhythm = allRhythms().find((item) => dateNumber(item.dateRange) >= day);
  return {
    type: "journey",
    id: nextRhythm?.id || "journey",
    label: nextRhythm ? `${nextRhythm.label} · ${nextRhythm.dateRange}` : "Next phase",
    objective: nextRhythm?.objective || "Use the latest assessment to prepare the next phase.",
    week: nextRhythm?.week,
    tasks: nextRhythm ? rhythmTasks(nextRhythm.id) : [],
    targetMinutes: nextRhythm ? 360 : 0,
  };
}

function nextTask(context = currentContext()) {
  return context.tasks.find((task) => !isDone(task))
    || allTasks().find((task) => !isDone(task))
    || null;
}

function latestAssessment() {
  return [...app.data.assessments].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

function baselineAssessment() {
  return [...app.data.assessments].sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

function localLoad() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL));
    return { data: normal(value?.data), version: Number(value?.version || 0) };
  } catch {
    return { data: blank(), version: 0 };
  }
}

function localSave() {
  localStorage.setItem(LOCAL, JSON.stringify({ data: app.data, version: app.version }));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `REQUEST_${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function syncLabel(text) {
  const element = document.querySelector("#ielts-sync");
  if (element) element.textContent = text;
}

function shell() {
  if (document.querySelector("#ielts-modal")) return;
  const modal = document.createElement("div");
  modal.id = "ielts-modal";
  modal.className = "ielts-backdrop";
  modal.hidden = true;
  modal.innerHTML = `
    <section class="ielts-core" role="dialog" aria-modal="true" aria-labelledby="ielts-title">
      <header class="ielts-header">
        <div class="ielts-title">
          <span class="ielts-band">7.0</span>
          <span>
            <small>Target · December 2026</small>
            <h2 id="ielts-title">IELTS Journey</h2>
            <em id="ielts-sub">Loading your learning context…</em>
          </span>
        </div>
        <div class="ielts-header-actions">
          <span id="ielts-sync">Connecting…</span>
          <button type="button" data-ielts-action="share">Share with ChatGPT</button>
          <button type="button" data-ielts-action="import">Import</button>
          <button class="ielts-close" type="button" aria-label="Close IELTS" data-ielts-action="close">×</button>
        </div>
      </header>
      <nav class="ielts-tabs" aria-label="IELTS sections">
        <button class="active" data-ielts-tab="now">Now</button>
        <button data-ielts-tab="course">Course</button>
        <button data-ielts-tab="journey">Journey</button>
        <button data-ielts-tab="progress">Progress</button>
      </nav>
      <main id="ielts-body"></main>
      <aside id="ielts-drawer" hidden></aside>
    </section>`;
  document.body.append(modal);
}

async function load() {
  shell();
  const local = localLoad();
  app.data = local.data;
  app.version = local.version;
  try {
    const [program, cloud] = await Promise.all([
      requestJson(PROGRAM_URL),
      CLOUD ? requestJson(API).catch(() => null) : null,
    ]);
    app.program = program;
    if (cloud) {
      const incoming = normal(cloud.data);
      app.data = incoming;
      app.version = Number(cloud.version || 0);
      app.mode = "cloud";
      localSave();
      if (Number(cloud.data?.schemaVersion) !== 2) save();
    } else {
      app.mode = "local";
    }
    render();
    updateDashboardCard();
    deepLink();
  } catch (error) {
    console.error("Joy IELTS could not load", error);
    app.mode = "error";
    const body = document.querySelector("#ielts-body");
    if (body) body.innerHTML = '<div class="ielts-empty"><strong>IELTS Journey could not load.</strong><button data-ielts-action="reload">Try again</button></div>';
  }
}

function save() {
  localSave();
  clearTimeout(app.saveTimer);
  syncLabel("Saving…");
  app.saveTimer = setTimeout(async () => {
    if (!CLOUD) {
      app.mode = "local";
      syncLabel("Local");
      updateDashboardCard();
      return;
    }
    try {
      const payload = await requestJson(API, {
        method: "PUT",
        body: JSON.stringify({ data: app.data, baseVersion: app.version }),
      });
      app.version = Number(payload.version || app.version);
      app.mode = "cloud";
      localSave();
      syncLabel("Synced");
    } catch (error) {
      if (error.status === 409) {
        app.data = normal(error.payload.data);
        app.version = Number(error.payload.version || 0);
        localSave();
        render();
      }
      app.mode = "local";
      syncLabel("Offline");
    }
    updateDashboardCard();
  }, 350);
}

function deepLink() {
  const url = new URL(location.href);
  if (url.searchParams.get("ielts") === "1" || location.hash === "#ielts") openIelts();
}
