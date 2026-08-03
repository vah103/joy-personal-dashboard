const COURSE_SYNC_API = "/api/ielts-course-sync";
const COURSE_DOC_URL = "https://docs.google.com/document/d/18KxStmQagYYJUbySCnUzgvyWPI5IaQXVN7y7B3HPK_s/edit?tab=t.vznu7eqg75we#heading=h.262bo2er2035";
const COURSE_CACHE_KEY = "joy-ielts-course-knowledge-v1";
const COURSE_AUTO_CHECK_MS = 24 * 60 * 60 * 1000;

app.courseSync = {
  connected: false,
  loaded: false,
  loading: false,
  syncing: false,
  error: "",
  knowledge: courseCacheLoad(),
};

installCourseStylesheet();

function installCourseStylesheet() {
  if (document.querySelector('link[data-ielts-course-sync-style]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/project-data/ielts/ielts-course-sync.css?v=ielts-course-docs-v1";
  link.dataset.ieltsCourseSyncStyle = "true";
  document.head.append(link);
}

function courseCacheLoad() {
  try {
    return normalizeCourseKnowledge(JSON.parse(localStorage.getItem(COURSE_CACHE_KEY)));
  } catch {
    return null;
  }
}

function courseCacheSave(value) {
  const normalized = normalizeCourseKnowledge(value);
  if (!normalized) return;
  localStorage.setItem(COURSE_CACHE_KEY, JSON.stringify(normalized));
}

function normalizeCourseKnowledge(value) {
  if (!value || typeof value !== "object" || Number(value.schemaVersion) !== 1) return null;
  const topics = Array.isArray(value.topics)
    ? value.topics.slice(0, 120).map((topic) => ({
        id: String(topic?.id || ""),
        skill: "writing",
        taskType: String(topic?.taskType || "Writing").slice(0, 120),
        title: String(topic?.title || "Course notes").slice(0, 240),
        summary: String(topic?.summary || "").slice(0, 2_200),
        grammar: Array.isArray(topic?.grammar) ? topic.grammar.map(String).slice(0, 20) : [],
        source: topic?.source && typeof topic.source === "object" ? topic.source : {},
      }))
    : [];
  return {
    schemaVersion: 1,
    source: value.source && typeof value.source === "object" ? value.source : {},
    stats: value.stats && typeof value.stats === "object" ? value.stats : {},
    topics,
  };
}

function renderCourse() {
  const body = document.querySelector("#ielts-body");
  const sync = app.courseSync || {};
  const knowledge = sync.knowledge;
  const topics = knowledge?.topics || [];
  const syncedAt = Number(knowledge?.source?.syncedAt || 0);
  const checkedAt = Number(knowledge?.source?.lastCheckedAt || 0);
  const status = sync.syncing
    ? "Syncing latest notes…"
    : sync.error
      ? sync.error
      : knowledge
        ? checkedAt && Date.now() - checkedAt < COURSE_AUTO_CHECK_MS
          ? "Knowledge is up to date"
          : "Ready to check for updates"
        : sync.connected
          ? "Connected · not synced yet"
          : "Connect Google Docs once";
  const action = sync.connected
    ? `<button class="ielts-primary" type="button" data-ielts-action="sync-course-docs" ${sync.syncing ? "disabled" : ""}>${sync.syncing ? "Syncing…" : "Sync latest notes"}</button>`
    : '<button class="ielts-primary" type="button" data-ielts-action="connect-course-docs">Connect Google Docs</button>';
  const topicLabels = topics
    .map((topic) => topic.taskType || topic.title)
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 8);

  body.innerHTML = `
    <section class="ielts-course-doc-card">
      <div class="ielts-course-doc-copy">
        <small>External Writing Course</small>
        <h3>Writing Course Notes</h3>
        <p>Google Docs remains the source of truth. Joy stores a compact structured index and sends only the relevant lesson knowledge into each Writing task.</p>
        <div class="ielts-course-doc-actions">
          <a href="${COURSE_DOC_URL}" target="_blank" rel="noopener noreferrer">Open Google Docs</a>
          ${action}
        </div>
      </div>
      <aside class="ielts-course-sync-status ${sync.error ? "error" : ""}">
        <span aria-hidden="true"></span>
        <small>Course knowledge</small>
        <strong>${escapeHtml(status)}</strong>
        <p>${knowledge ? `${Number(knowledge.stats?.topicCount || topics.length)} topics across ${Number(knowledge.stats?.tabCount || 0)} tabs` : "No synchronized knowledge yet"}</p>
        <em>${syncedAt ? `Last synced ${escapeHtml(formatCourseTimestamp(syncedAt))}` : "The first sync reads every current tab"}</em>
      </aside>
    </section>
    <section class="ielts-course-knowledge-panel">
      <header>
        <span><small>How Joy uses it</small><h3>Live course context</h3></span>
        <b>${topics.length ? `${topics.length} indexed` : "Waiting for sync"}</b>
      </header>
      <p>Joy checks the document automatically every 24 hours after connection. A changed content hash refreshes the stored knowledge; unchanged notes are left untouched.</p>
      ${topicLabels.length ? `<div class="ielts-course-topic-tags">${topicLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>` : `
        <div class="ielts-course-empty">
          <strong>Your notes stay in Google Docs</strong>
          <p>Connect once, then press Sync latest notes. Future class updates will be detected automatically.</p>
        </div>`}
    </section>`;

  queueMicrotask(() => { void prepareCoursePanel(); });
}

async function prepareCoursePanel() {
  if (!CLOUD || app.tab !== "course") return;
  if (!app.courseSync.loaded && !app.courseSync.loading) {
    await loadCourseKnowledge();
  }
  const checkedAt = Number(app.courseSync.knowledge?.source?.lastCheckedAt || 0);
  if (
    app.courseSync.connected
    && !app.courseSync.syncing
    && Date.now() - checkedAt >= COURSE_AUTO_CHECK_MS
  ) {
    await syncCourseKnowledge(false);
  }
}

async function loadCourseKnowledge() {
  app.courseSync.loading = true;
  try {
    const payload = await requestJson(COURSE_SYNC_API);
    app.courseSync.connected = payload.connected === true;
    app.courseSync.knowledge = normalizeCourseKnowledge(payload.knowledge) || app.courseSync.knowledge;
    app.courseSync.error = "";
    if (app.courseSync.knowledge) courseCacheSave(app.courseSync.knowledge);
  } catch (error) {
    app.courseSync.error = courseSyncErrorText(error);
  } finally {
    app.courseSync.loading = false;
    app.courseSync.loaded = true;
    if (app.tab === "course") renderCourseWithoutReload();
  }
}

async function syncCourseKnowledge(manual) {
  if (!CLOUD || app.courseSync.syncing) return;
  app.courseSync.syncing = true;
  app.courseSync.error = "";
  if (app.tab === "course") renderCourseWithoutReload();
  try {
    const payload = await requestJson(COURSE_SYNC_API, {
      method: "POST",
      body: JSON.stringify({ reason: manual ? "manual" : "daily-check" }),
    });
    app.courseSync.connected = true;
    app.courseSync.knowledge = normalizeCourseKnowledge(payload.knowledge);
    if (app.courseSync.knowledge) courseCacheSave(app.courseSync.knowledge);
    if (manual) toast(payload.changed ? "Latest Writing notes synced to Joy." : "Writing notes are already up to date.");
  } catch (error) {
    if (error.status === 403 && error.payload?.error === "DOCS_AUTHORIZATION_REQUIRED") {
      app.courseSync.connected = false;
      app.courseSync.error = "Google Docs connection is required";
      if (manual) {
        location.assign("/auth/docs/start");
        return;
      }
    } else {
      app.courseSync.error = courseSyncErrorText(error);
      if (manual) toast(app.courseSync.error);
    }
  } finally {
    app.courseSync.syncing = false;
    if (app.tab === "course") renderCourseWithoutReload();
  }
}

function renderCourseWithoutReload() {
  const body = document.querySelector("#ielts-body");
  if (!body || app.tab !== "course") return;
  const previousLoaded = app.courseSync.loaded;
  app.courseSync.loaded = true;
  renderCourse();
  app.courseSync.loaded = previousLoaded || true;
}

function courseSyncErrorText(error) {
  const code = error?.payload?.error || error?.message || "";
  if (code === "IELTS_COURSE_DOCUMENT_NOT_FOUND") return "Writing notes document was not found";
  if (code === "DOCS_AUTHORIZATION_REQUIRED") return "Google Docs connection is required";
  return "Course knowledge could not be synchronized";
}

function formatCourseTimestamp(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Number(value)));
}

function relevantCourseTopics(task) {
  if (task?.skill !== "writing") return [];
  const topics = app.courseSync?.knowledge?.topics || [];
  if (!topics.length) return [];
  const target = `${task.title || ""} ${task.objective || ""} ${task.material || ""}`.toLowerCase();
  const families = [
    ["Time Changing", /time changing|line graph|trend|over time/i],
    ["Time Fixed", /time fixed|bar chart|pie chart|table/i],
    ["Maps", /\bmap\b/i],
    ["Process", /\bprocess\b/i],
    ["Mixed Chart", /mixed chart/i],
    ["Opinion", /opinion|agree|disagree/i],
    ["Discussion", /discussion|both views/i],
    ["Advantages", /advantage|disadvantage/i],
    ["Problems", /problem|solution/i],
  ];
  const targetFamilies = families.filter(([, pattern]) => pattern.test(target)).map(([name]) => name);
  const targetTask = /task\s*2|essay/i.test(target) ? "Task 2" : /task\s*1|chart|map|process/i.test(target) ? "Task 1" : "";
  const words = new Set(target.match(/[a-z]{4,}/g) || []);
  return topics
    .map((topic) => {
      const haystack = `${topic.taskType} ${topic.title} ${topic.summary}`.toLowerCase();
      let score = 0;
      if (targetTask && topic.taskType.includes(targetTask)) score += 4;
      if (targetFamilies.some((family) => topic.taskType.includes(family) || topic.title.includes(family))) score += 10;
      for (const word of words) if (haystack.includes(word)) score += 1;
      if (/overview|foundation|grammar/i.test(topic.title)) score += 1;
      return { topic, score };
    })
    .filter((item) => item.score > 0 || (!targetTask && item.topic.skill === "writing"))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map(({ topic }) => ({
      taskType: topic.taskType,
      title: topic.title,
      grammar: topic.grammar,
      summary: topic.summary,
      source: topic.source,
    }));
}

function teachingPrompt(task) {
  const relevantErrors = app.data.errorLogs
    .filter((error) => error.active && (error.skill === task.skill || error.skill === "review"))
    .slice(0, 5);
  const structuredCourseKnowledge = relevantCourseTopics(task);
  const recentSessions = [...app.data.courseSessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  return `You are my IELTS teacher. Guide me through the Joy task below step by step.

Important teaching rules:
- Do not give me the entire lesson or all answers at once.
- Start with the first step, wait for my response, then correct me before continuing.
- Adapt the difficulty to my evidence and recurring errors.
- For Writing, follow the relevant synchronized knowledge from my external course. Do not replace the teacher's framework with a conflicting one.
- Use advanced grammar only where it is natural for the current task type.
- At the end, produce a short structured result I can import or record in Joy.

Long-term goal:
- IELTS overall 7.0 by December 2026
- Minimum skill target: 6.5

Current task:
${JSON.stringify({
    id: task.id,
    rhythmId: task.rhythmId,
    skill: task.skill,
    kind: task.kind,
    title: task.title,
    availableMinutes: task.minutes,
    objective: task.objective,
    steps: task.steps,
    material: task.material,
    materialUrl: task.materialUrl,
    materialFallbackUrl: task.materialFallbackUrl,
    output: task.output,
    doneWhen: task.doneWhen,
  }, null, 2)}

Active recurring errors:
${JSON.stringify(relevantErrors, null, 2)}

Relevant synchronized Writing-course knowledge:
${JSON.stringify(structuredCourseKnowledge, null, 2)}

Recent manually imported course sessions:
${JSON.stringify(recentSessions, null, 2)}

Begin by explaining today’s objective in one short paragraph, then give me only Step 1.`;
}

function shareContext() {
  const context = currentContext();
  const courseKnowledge = app.courseSync?.knowledge;
  return `Read this Joy IELTS context and use it to plan or teach my next IELTS work.

Planning rules:
- Long-term target: overall 7.0 by December 2026, with no skill below 6.5.
- August is the Foundation phase.
- Each week has three rhythms: Mon–Tue, Wed–Thu and Fri–Sun.
- Each rhythm has a six-hour cap.
- External Writing classes count toward that cap.
- Create exact self-study tasks only one rhythm ahead.
- Every self-study task must include objective, steps, materials, output and doneWhen.
- For Writing, preserve the synchronized external-course method and use only the relevant topic knowledge.
- Teach interactively and wait for my answer after each exercise.

Joy data:
${JSON.stringify({
    exportedAt: new Date().toISOString(),
    goal: app.data.goal,
    current: {
      id: context.id,
      label: context.label,
      objective: context.objective,
      progress: taskProgress(context.tasks),
      completedMinutes: completedMinutes(context.tasks),
      tasks: context.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        skill: task.skill,
        kind: task.kind,
        minutes: task.minutes,
        status: taskState(task).status || "pending",
        result: taskState(task).evidence || "",
        reflection: taskState(task).reflection || "",
      })),
    },
    assessments: app.data.assessments,
    activeErrors: app.data.errorLogs.filter((error) => error.active),
    courseKnowledge: courseKnowledge ? {
      source: courseKnowledge.source,
      stats: courseKnowledge.stats,
      topics: courseKnowledge.topics,
    } : null,
    recentCourseSessions: [...app.data.courseSessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    rhythmReviews: app.data.rhythmReviews,
  }, null, 2)}`;
}

document.addEventListener("click", (event) => {
  const action = event.target.closest?.("[data-ielts-action]");
  if (!action) return;
  if (action.dataset.ieltsAction === "connect-course-docs") {
    location.assign("/auth/docs/start");
  } else if (action.dataset.ieltsAction === "sync-course-docs") {
    void syncCourseKnowledge(true);
  }
});

function openCourseDeepLink(attempt = 0) {
  const url = new URL(location.href);
  if (url.searchParams.get("course") !== "1") return;
  if (app.program) {
    openIelts("course");
    return;
  }
  if (attempt < 40) setTimeout(() => openCourseDeepLink(attempt + 1), 100);
}

setTimeout(() => openCourseDeepLink(), 0);
