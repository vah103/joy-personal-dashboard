function openDrawer(content) {
  const drawer = document.querySelector("#ielts-drawer");
  drawer.hidden = false;
  drawer.innerHTML = content;
}

function closeDrawer() {
  const drawer = document.querySelector("#ielts-drawer");
  drawer.hidden = true;
  drawer.innerHTML = "";
}

function externalMaterialLink(url, label) {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol !== "https:") return "";
    return `<a class="ielts-material-link" href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  } catch {
    return "";
  }
}

function taskMaterialLinks(task) {
  const direct = externalMaterialLink(task.materialUrl, "Open official material");
  const fallback = task.materialFallbackUrl && task.materialFallbackUrl !== task.materialUrl
    ? externalMaterialLink(task.materialFallbackUrl, "Open official source page")
    : "";
  if (!direct && !fallback) return "";
  return `<div class="ielts-material-links">${direct}${fallback}</div>`;
}

function taskDrawer(task) {
  const state = taskState(task);
  openDrawer(`
    <header class="ielts-drawer-header">
      <span>
        <small>${escapeHtml(KIND_LABELS[task.kind])} · ${escapeHtml(SKILL_LABELS[task.skill])}</small>
        <h3>${escapeHtml(task.title)}</h3>
      </span>
      <button type="button" aria-label="Close task" data-ielts-action="close-drawer">×</button>
    </header>
    <section class="ielts-task-detail">
      <div class="ielts-task-detail-meta">
        <span>${task.minutes} min</span>
        <span>${escapeHtml(task.groupLabel || task.rhythmId)}</span>
      </div>
      <div>
        <small>Objective</small>
        <p>${escapeHtml(task.objective)}</p>
      </div>
      <div>
        <small>Steps</small>
        <ol>${task.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      </div>
      ${task.material ? `<div><small>Materials</small><p>${escapeHtml(task.material)}</p>${taskMaterialLinks(task)}</div>` : ""}
      <div>
        <small>Output</small>
        <p>${escapeHtml(task.output)}</p>
      </div>
      <div>
        <small>Done when</small>
        <ul>${task.doneWhen.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </section>
    ${task.kind !== "course" ? `
      <button class="ielts-chatgpt-button" data-ielts-action="start-chatgpt" data-task-id="${escapeHtml(task.id)}">
        <span>Start with ChatGPT</span>
        <small>Copy the full teaching prompt and open ChatGPT</small>
      </button>` : `
      <div class="ielts-course-note">
        <strong>This is an external class.</strong>
        <p>Attend the lesson and save the recording. ChatGPT guidance begins in the separate lesson-review task.</p>
      </div>`}
    <form class="ielts-complete-form" data-ielts-form="complete-task">
      <input type="hidden" name="taskId" value="${escapeHtml(task.id)}">
      <label>Actual time
        <input name="minutes" type="number" min="1" max="480" value="${escapeHtml(state.minutes || task.minutes)}" required>
      </label>
      <label>Result or evidence
        <textarea name="evidence" required placeholder="Score, file/link, response completed or lesson recording…">${escapeHtml(state.evidence || "")}</textarea>
      </label>
      <label>What did you learn or struggle with?
        <textarea name="reflection" required placeholder="Keep this short and factual.">${escapeHtml(state.reflection || "")}</textarea>
      </label>
      <footer>
        <button type="button" data-ielts-action="close-drawer">Cancel</button>
        <button class="ielts-primary" type="submit">${isDone(task) ? "Update result" : "Complete task"}</button>
      </footer>
    </form>`);
}

function teachingPrompt(task) {
  const relevantErrors = app.data.errorLogs
    .filter((error) => error.active && (error.skill === task.skill || error.skill === "review"))
    .slice(0, 5);
  const course = [...app.data.courseSessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  return `You are my IELTS teacher. Guide me through the Joy task below step by step.

Important teaching rules:
- Do not give me the entire lesson or all answers at once.
- Start with the first step, wait for my response, then correct me before continuing.
- Adapt the difficulty to my evidence and recurring errors.
- Use relevant knowledge from my external Writing course, but point out any uncertainty or conflict.
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

Recent external-course knowledge:
${JSON.stringify(course, null, 2)}

Begin by explaining today’s objective in one short paragraph, then give me only Step 1.`;
}

function shareContext() {
  const context = currentContext();
  return `Read this Joy IELTS context and use it to plan or teach my next IELTS work.

Planning rules:
- Long-term target: overall 7.0 by December 2026, with no skill below 6.5.
- August is the Foundation phase.
- Each week has three rhythms: Mon–Tue, Wed–Thu and Fri–Sun.
- Each rhythm has a six-hour cap.
- External Writing classes count toward that cap.
- Create exact self-study tasks only one rhythm ahead.
- Every self-study task must include objective, steps, materials, output and doneWhen.
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
    recentCourseSessions: [...app.data.courseSessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    rhythmReviews: app.data.rhythmReviews,
  }, null, 2)}`;
}

async function copyText(value) {
  let clipboardError = null;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      clipboardError = error;
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto -9999px";
  textarea.style.opacity = "0";
  document.body.append(textarea);

  let copied = false;
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    copied = document.execCommand("copy");
  } finally {
    textarea.remove();
  }

  if (!copied) {
    throw clipboardError || new Error("Clipboard access was blocked.");
  }
}

function promptFallbackDrawer({ title, description, prompt }) {
  openDrawer(`
    <header class="ielts-drawer-header">
      <span><small>Joy → ChatGPT</small><h3>${escapeHtml(title)}</h3></span>
      <button type="button" aria-label="Close prompt" data-ielts-action="close-drawer">×</button>
    </header>
    <p class="ielts-drawer-intro">${escapeHtml(description)}</p>
    <div class="ielts-import-form">
      <textarea data-ielts-prompt readonly spellcheck="false">${escapeHtml(prompt)}</textarea>
      <footer>
        <button type="button" data-ielts-action="close-drawer">Close</button>
        <button type="button" data-ielts-action="copy-chatgpt-prompt">Copy prompt</button>
        <button class="ielts-primary" type="button" data-ielts-action="open-chatgpt">Open ChatGPT</button>
      </footer>
    </div>`);

  requestAnimationFrame(() => {
    const field = document.querySelector("[data-ielts-prompt]");
    field?.focus();
    field?.select();
  });
}

async function openChatGptPrompt(prompt, { task = null, label = "Prompt" } = {}) {
  try {
    await copyText(prompt);
  } catch {
    promptFallbackDrawer({
      title: `${label} needs manual copy`,
      description: "Your browser blocked clipboard access. The full prompt is selected below; press Ctrl+C, then open ChatGPT.",
      prompt,
    });
    toast("Clipboard blocked. The prompt is selected for manual copy.");
    return false;
  }

  if (task) {
    updateTask(task.id, { status: "progress", startedAt: Date.now() });
  }

  const chat = window.open("https://chatgpt.com/", "_blank", "noopener");
  if (!chat) {
    promptFallbackDrawer({
      title: `${label} is ready`,
      description: "The prompt is already copied, but your browser blocked the new tab. Open ChatGPT below and paste it with Ctrl+V.",
      prompt,
    });
    toast(`${label} copied. Open ChatGPT from Joy.`);
    return true;
  }

  toast(`${label} copied. Paste it into the new ChatGPT tab.`);
  return true;
}

function importDrawer(expectedType = "rhythm_tasks", rhythmId = currentContext().id) {
  const example = expectedType === "course_session"
    ? {
        type: "course_session",
        session: {
          id: "course-2026-08-07-task2",
          date: "2026-08-07",
          title: "Opinion essay development",
          taskType: "Task 2",
          status: "reviewed",
          recording: "Link or filename",
          summary: "Main lesson knowledge",
          method: "Teacher's method",
          feedback: "Personal feedback",
          homework: "Assigned homework",
          nextPractice: "What ChatGPT should practise next",
        },
      }
    : {
        type: "rhythm_tasks",
        rhythmId,
        tasks: [
          {
            id: `${rhythmId}-custom-01`,
            kind: "guided",
            skill: "reading",
            title: "Exact task title",
            minutes: 60,
            objective: "One measurable ability",
            steps: ["First action", "Practice", "Correction"],
            material: "Exact source, prompt or material",
            output: "What I must produce",
            doneWhen: ["Observable completion rule"],
          },
        ],
      };
  openDrawer(`
    <header class="ielts-drawer-header">
      <span><small>ChatGPT → Joy</small><h3>${expectedType === "course_session" ? "Import lesson notes" : "Import rhythm tasks"}</h3></span>
      <button type="button" data-ielts-action="close-drawer">×</button>
    </header>
    <p class="ielts-drawer-intro">Paste structured JSON produced by ChatGPT. Joy validates it before replacing the generated tasks or saving course knowledge.</p>
    <form class="ielts-import-form" data-ielts-form="import-json">
      <input type="hidden" name="expectedType" value="${escapeHtml(expectedType)}">
      <textarea name="payload" spellcheck="false" required placeholder='${escapeHtml(JSON.stringify(example, null, 2))}'></textarea>
      <details>
        <summary>Expected format</summary>
        <pre>${escapeHtml(JSON.stringify(example, null, 2))}</pre>
      </details>
      <footer>
        <button type="button" data-ielts-action="close-drawer">Cancel</button>
        <button class="ielts-primary" type="submit">Validate and import</button>
      </footer>
    </form>`);
}

function courseDetail(session) {
  const field = (label, value) => value ? `<div><small>${label}</small><p>${escapeHtml(value)}</p></div>` : "";
  openDrawer(`
    <header class="ielts-drawer-header">
      <span><small>${escapeHtml(formatDate(session.date))} · ${escapeHtml(session.taskType)}</small><h3>${escapeHtml(session.title)}</h3></span>
      <button type="button" data-ielts-action="close-drawer">×</button>
    </header>
    <section class="ielts-course-detail">
      ${field("Lesson summary", session.summary)}
      ${field("Teacher's method", session.method)}
      ${field("Your feedback", session.feedback)}
      ${field("Homework", session.homework)}
      ${field("Next application", session.nextPractice)}
      ${field("Recording", session.recording)}
    </section>`);
}

function assessmentDrawer() {
  openDrawer(`
    <header class="ielts-drawer-header">
      <span><small>Progress checkpoint</small><h3>Add assessment</h3></span>
      <button type="button" aria-label="Close task" data-ielts-action="close-drawer">×</button>
    </header>
    <form class="ielts-assessment-form" data-ielts-form="assessment">
      <label>Date<input type="date" name="date" value="${dateKey()}" required></label>
      <label>Label<input name="label" value="Assessment" required></label>
      ${["listening", "reading", "writing", "speaking"].map((skill) => `
        <label>${SKILL_LABELS[skill]}<input type="number" name="${skill}" min="0" max="9" step="0.5" placeholder="—"></label>`).join("")}
      <label class="wide">Evidence<textarea name="evidence" required placeholder="Test source, scores, feedback and uncertainty."></textarea></label>
      <footer class="wide">
        <button type="button" data-ielts-action="close-drawer">Cancel</button>
        <button class="ielts-primary" type="submit">Save assessment</button>
      </footer>
    </form>`);
}

function errorDrawer() {
  openDrawer(`
    <header class="ielts-drawer-header">
      <span><small>Recurring pattern</small><h3>Add an error</h3></span>
      <button type="button" data-ielts-action="close-drawer">×</button>
    </header>
    <form class="ielts-error-form" data-ielts-form="error">
      <label>Skill<select name="skill">${Object.entries(SKILL_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
      <label>Recurring error<input name="label" required></label>
      <label class="wide">Cause<textarea name="cause" required></textarea></label>
      <label class="wide">Prevention action<textarea name="action" required></textarea></label>
      <footer class="wide">
        <button type="button" data-ielts-action="close-drawer">Cancel</button>
        <button class="ielts-primary" type="submit">Save error</button>
      </footer>
    </form>`);
}

function rhythmDrawer(rhythmId) {
  const rhythm = allRhythms().find((item) => item.id === rhythmId);
  if (!rhythm) return;
  const tasks = rhythmTasks(rhythm.id);
  openDrawer(`
    <header class="ielts-drawer-header">
      <span><small>${escapeHtml(rhythm.label)} · ${escapeHtml(rhythm.dateRange)}</small><h3>${escapeHtml(rhythm.week.title)}</h3></span>
      <button type="button" data-ielts-action="close-drawer">×</button>
    </header>
    <p class="ielts-drawer-intro">${escapeHtml(rhythm.objective)}</p>
    <div class="ielts-drawer-task-list">${tasks.map(taskCard).join("")}</div>`);
}

function openIelts(tab = "now") {
  app.tab = tab;
  document.querySelector("#ielts-modal").hidden = false;
  document.body.classList.add("ielts-open");
  render();
}

function closeIelts() {
  document.querySelector("#ielts-modal").hidden = true;
  document.body.classList.remove("ielts-open");
  closeDrawer();
}

function updateTask(id, patch) {
  app.data.taskStates[id] = {
    ...object(app.data.taskStates[id]),
    ...patch,
    updatedAt: Date.now(),
  };
  save();
  render();
}

function updateDashboardCard() {
  const card = document.querySelector(".ielts-project-card");
  if (!card || !app.program) return;
  const context = currentContext();
  const tasks = context.tasks;
  const next = nextTask(context);
  const percent = taskProgress(tasks);
  const minutes = completedMinutes(tasks);
  const target = context.targetMinutes || 360;
  const progress = card.querySelector(".project-top span");
  if (progress) progress.textContent = `${percent}%`;
  const bar = card.querySelector(".progress-track span");
  if (bar) bar.style.width = `${percent}%`;

  const values = card.querySelectorAll("dl dd");
  if (values[0]) values[0].textContent = context.label;
  if (values[1]) values[1].textContent = next?.title || "Review progress with ChatGPT";

  const source = card.querySelector(".ielts-project-source");
  if (source) {
    source.textContent = `${formatMinutes(minutes)} / ${formatMinutes(target)} · ${tasks.filter(isDone).length}/${tasks.length} tasks`;
  }
}

function toast(message) {
  document.querySelector("#ielts-toast")?.remove();
  const element = document.createElement("div");
  element.id = "ielts-toast";
  element.className = "ielts-toast";
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 3200);
}

function parseImportedJson(raw) {
  const text = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
}

function importPayload(payload) {
  const type = payload?.type || (Array.isArray(payload?.tasks) ? "rhythm_tasks" : payload?.session ? "course_session" : "");
  if (type === "rhythm_tasks") {
    const rhythmId = String(payload.rhythmId || "").trim();
    const validRhythm = [
      "prelaunch",
      "baseline",
      ...allRhythms().map((item) => item.id),
      ...app.program.phases.map((phase) => phase.id),
    ].includes(rhythmId);
    if (!validRhythm || !Array.isArray(payload.tasks) || !payload.tasks.length) {
      throw new Error("Rhythm ID or task list is invalid.");
    }
    const tasks = payload.tasks.map((task, index) => normalizeTask({
      ...task,
      id: task.id || `${rhythmId}-custom-${String(index + 1).padStart(2, "0")}`,
      rhythmId,
    }));
    if (tasks.some((task) => !task)) throw new Error("Every task needs a title, rhythm, duration and valid type.");
    app.data.customTasks = [
      ...app.data.customTasks.filter((task) => task.rhythmId !== rhythmId),
      ...tasks,
    ];
    save();
    return `${tasks.length} guided task(s) imported.`;
  }
  if (type === "course_session") {
    const session = normalizeCourseSession(payload.session);
    if (!session) throw new Error("Course Session needs at least a date and title.");
    app.data.courseSessions = [
      ...app.data.courseSessions.filter((item) => item.id !== session.id),
      session,
    ];
    save();
    return "Course Session imported.";
  }
  if (type === "assessment") {
    const assessment = normalizeAssessment(payload.assessment);
    if (!assessment) throw new Error("Assessment needs a date and scores.");
    app.data.assessments = [
      ...app.data.assessments.filter((item) => item.id !== assessment.id),
      assessment,
    ];
    save();
    return "Assessment imported.";
  }
  throw new Error("Unsupported import type.");
}

document.addEventListener("click", async (event) => {
  const tab = event.target.closest?.("[data-ielts-tab]");
  const action = event.target.closest?.("[data-ielts-action]");
  if (event.target.id === "ielts-modal") {
    closeIelts();
    return;
  }
  if (tab) {
    app.tab = tab.dataset.ieltsTab;
    closeDrawer();
    render();
    return;
  }
  if (!action) return;
  const type = action.dataset.ieltsAction;
  if (type === "close") closeIelts();
  else if (type === "close-drawer") closeDrawer();
  else if (type === "reload") location.reload();
  else if (type === "task") {
    const task = findTask(action.dataset.taskId);
    if (task) taskDrawer(task);
  } else if (type === "start-chatgpt") {
    const task = findTask(action.dataset.taskId);
    if (!task) return;
    await openChatGptPrompt(teachingPrompt(task), { task, label: "Teaching prompt" });
  } else if (type === "share") {
    await openChatGptPrompt(shareContext(), { label: "Joy context" });
  } else if (type === "copy-chatgpt-prompt") {
    const field = document.querySelector("[data-ielts-prompt]");
    if (!field) return;
    try {
      await copyText(field.value);
      toast("Prompt copied. Paste it into ChatGPT with Ctrl+V.");
    } catch {
      field.focus();
      field.select();
      toast("Clipboard is still blocked. Press Ctrl+C to copy the selected prompt.");
    }
  } else if (type === "open-chatgpt") {
    const chat = window.open("https://chatgpt.com/", "_blank", "noopener");
    if (!chat) toast("Your browser blocked the new tab. Open ChatGPT manually.");
  } else if (type === "import") {
    importDrawer("rhythm_tasks", action.dataset.importRhythm || currentContext().id);
  } else if (type === "import-course") {
    importDrawer("course_session");
  } else if (type === "course-detail") {
    const session = app.data.courseSessions.find((item) => item.id === action.dataset.courseId);
    if (session) courseDetail(session);
  } else if (type === "assessment") {
    assessmentDrawer();
  } else if (type === "error") {
    errorDrawer();
  } else if (type === "view-rhythm") {
    rhythmDrawer(action.dataset.rhythmId);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest?.("[data-ielts-form]");
  if (!form) return;
  event.preventDefault();
  const values = new FormData(form);
  const type = form.dataset.ieltsForm;
  if (type === "complete-task") {
    const task = findTask(String(values.get("taskId")));
    if (!task) return;
    updateTask(task.id, {
      status: "completed",
      minutes: Number(values.get("minutes")),
      evidence: String(values.get("evidence") || "").trim(),
      reflection: String(values.get("reflection") || "").trim(),
      completedAt: Date.now(),
    });
    closeDrawer();
    toast("Task completed and saved to Joy.");
  } else if (type === "import-json") {
    try {
      const message = importPayload(parseImportedJson(values.get("payload")));
      closeDrawer();
      render();
      toast(message);
    } catch (error) {
      toast(error.message || "The imported JSON is invalid.");
    }
  } else if (type === "assessment") {
    const score = (name) => {
      const value = String(values.get(name) || "").trim();
      return value === "" ? null : Number(value);
    };
    const assessment = normalizeAssessment({
      id: `assessment-${values.get("date")}-${Date.now()}`,
      date: String(values.get("date")),
      label: String(values.get("label")),
      scores: {
        listening: score("listening"),
        reading: score("reading"),
        writing: score("writing"),
        speaking: score("speaking"),
      },
      evidence: String(values.get("evidence") || "").trim(),
    });
    app.data.assessments.push(assessment);
    save();
    closeDrawer();
    render();
    toast("Assessment saved.");
  } else if (type === "error") {
    const label = String(values.get("label") || "").trim();
    const skill = String(values.get("skill"));
    const existing = app.data.errorLogs.find((error) => error.active && error.skill === skill && error.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      existing.count += 1;
      existing.cause = String(values.get("cause") || "").trim();
      existing.action = String(values.get("action") || "").trim();
      existing.updatedAt = Date.now();
    } else {
      app.data.errorLogs.push(normalizeError({
        id: `error-${Date.now()}`,
        skill,
        label,
        cause: String(values.get("cause") || "").trim(),
        action: String(values.get("action") || "").trim(),
      }));
    }
    save();
    closeDrawer();
    render();
    toast("Recurring error saved.");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || document.querySelector("#ielts-modal")?.hidden) return;
  if (document.querySelector("#ielts-drawer")?.hidden) closeIelts();
  else closeDrawer();
});

window.JoyIELTS = {
  version: "journey-v4",
  open: openIelts,
  shareContext,
  getCurrentContext: () => structuredClone(currentContext()),
  getProgress: () => taskProgress(currentContext().tasks),
  refreshCard: updateDashboardCard,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", load, { once: true });
} else {
  void load();
}
