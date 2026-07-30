function render() {
  if (!app.program) return;
  document.querySelectorAll("[data-ielts-tab]").forEach((button) => {
    const active = button.dataset.ieltsTab === app.tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const context = currentContext();
  document.querySelector("#ielts-sub").textContent = context.label;
  syncLabel(app.mode === "cloud" ? "Synced" : app.mode === "local" ? "Local" : "Connecting…");
  if (app.tab === "course") renderCourse();
  else if (app.tab === "journey") renderJourney();
  else if (app.tab === "progress") renderProgress();
  else renderNow();
  updateDashboardCard();
}

function progressBar(value) {
  return `<span class="ielts-progress" aria-label="${value}% complete"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></span>`;
}

function taskCard(task) {
  const state = taskState(task);
  const status = isDone(task) ? "Completed" : state.status === "progress" ? "In progress" : "Not started";
  return `
    <article class="ielts-task-card ${isDone(task) ? "completed" : ""}">
      <button type="button" data-ielts-action="task" data-task-id="${escapeHtml(task.id)}">
        <span class="ielts-task-check" aria-hidden="true">${isDone(task) ? "✓" : ""}</span>
        <span class="ielts-task-copy">
          <span class="ielts-task-meta">
            <b class="ielts-kind ${escapeHtml(task.kind)}">${escapeHtml(KIND_LABELS[task.kind] || task.kind)}</b>
            <i>${escapeHtml(SKILL_LABELS[task.skill])} · ${task.minutes} min</i>
          </span>
          <strong>${escapeHtml(task.title)}</strong>
          <small>${escapeHtml(task.objective)}</small>
        </span>
        <span class="ielts-task-status">${status}</span>
      </button>
    </article>`;
}

function renderNow() {
  const body = document.querySelector("#ielts-body");
  const context = currentContext();
  const tasks = context.tasks;
  const minutes = completedMinutes(tasks);
  const target = context.targetMinutes || tasks.reduce((sum, task) => sum + task.minutes, 0);
  const percent = taskProgress(tasks);
  const next = nextTask(context);

  if (context.type === "monthly-review") {
    body.innerHTML = `
      <section class="ielts-now-hero">
        <div>
          <small>August · Monthly checkpoint</small>
          <h3>Turn the month into evidence</h3>
          <p>Compare baseline and final assessments, then share the complete Joy context with ChatGPT to design September.</p>
        </div>
        <button class="ielts-primary" data-ielts-action="assessment">Add assessment</button>
      </section>
      ${renderAssessmentComparison()}
      <section class="ielts-action-panel">
        <span><small>Next step</small><strong>Prepare the September phase</strong><p>Use progress, recurring errors and course coverage—not task count alone.</p></span>
        <button data-ielts-action="share">Share full context</button>
      </section>`;
    return;
  }

  body.innerHTML = `
    <section class="ielts-now-hero">
      <div>
        <small>${escapeHtml(context.week ? `Week ${context.week.number} · ${context.week.title}` : context.type === "baseline" ? "1–2 August" : "Preparation")}</small>
        <h3>${escapeHtml(context.label)}</h3>
        <p>${escapeHtml(context.objective)}</p>
      </div>
      <div class="ielts-time">
        <strong>${formatMinutes(minutes)}</strong>
        <small>of ${formatMinutes(target)}</small>
      </div>
    </section>
    <section class="ielts-rhythm-progress">
      ${progressBar(percent)}
      <span>${tasks.filter(isDone).length}/${tasks.length} tasks completed</span>
    </section>
    ${next ? `
      <section class="ielts-next">
        <span>
          <small>Next task</small>
          <strong>${escapeHtml(next.title)}</strong>
          <p>${escapeHtml(KIND_LABELS[next.kind])} · ${next.minutes} min</p>
        </span>
        <button class="ielts-primary" data-ielts-action="task" data-task-id="${escapeHtml(next.id)}">Open task</button>
      </section>` : ""}
    <section class="ielts-section-heading">
      <span><small>${escapeHtml(context.type === "prelaunch" ? "Before August" : context.type === "baseline" ? "Input check" : "Current rhythm")}</small><h3>Tasks</h3></span>
      <button data-ielts-action="import" data-import-rhythm="${escapeHtml(context.id)}">Import from ChatGPT</button>
    </section>
    <div class="ielts-task-list">
      ${tasks.length ? tasks.map(taskCard).join("") : '<p class="ielts-empty-copy">No tasks have been prepared for this rhythm yet.</p>'}
    </div>`;
}

function renderCourse() {
  const body = document.querySelector("#ielts-body");
  const sessions = [...app.data.courseSessions].sort((a, b) => b.date.localeCompare(a.date));
  body.innerHTML = `
    <section class="ielts-course-hero">
      <div>
        <small>External Writing Course</small>
        <h3>Class knowledge becomes learning context</h3>
        <p>Recordings stay outside Joy. Joy stores the lesson method, feedback, homework and the next application.</p>
      </div>
      <button class="ielts-primary" data-ielts-action="import-course">Import lesson notes</button>
    </section>
    <div class="ielts-course-schedule">
      ${app.program.course.schedule.map((item) => `
        <article>
          <small>${escapeHtml(item.days)}</small>
          <strong>${escapeHtml(item.focus)}</strong>
          <span>External class · actual time counts toward the 6-hour rhythm</span>
        </article>`).join("")}
    </div>
    <section class="ielts-section-heading">
      <span><small>Course memory</small><h3>Recent sessions</h3></span>
      <b>${sessions.length} saved</b>
    </section>
    <div class="ielts-course-list">
      ${sessions.length ? sessions.map((session) => `
        <article>
          <span class="ielts-course-date">${escapeHtml(formatDate(session.date))}</span>
          <span>
            <small>${escapeHtml(session.taskType)} · ${escapeHtml(session.status)}</small>
            <strong>${escapeHtml(session.title)}</strong>
            <p>${escapeHtml(session.summary || "Lesson summary has not been added yet.")}</p>
            ${session.nextPractice ? `<em>Next: ${escapeHtml(session.nextPractice)}</em>` : ""}
          </span>
          <button data-ielts-action="course-detail" data-course-id="${escapeHtml(session.id)}">Open</button>
        </article>`).join("") : `
        <div class="ielts-empty-state">
          <strong>No course sessions saved yet</strong>
          <p>Start with four to six recent Task 1 and Task 2 recordings. Ask ChatGPT to summarise one, then import the result here.</p>
        </div>`}
    </div>`;
}

function renderJourney() {
  const body = document.querySelector("#ielts-body");
  const current = currentContext();
  body.innerHTML = `
    <section class="ielts-journey-hero">
      <span><small>Long-term goal</small><h3>Band 7.0 · December 2026</h3><p>August is the first adaptive phase, not the whole plan.</p></span>
      <strong>7.0</strong>
    </section>
    <section class="ielts-phase-row">
      ${app.program.phases.map((phase) => `
        <article class="${phase.status}">
          <span></span>
          <small>${escapeHtml(phase.month)}</small>
          <strong>${escapeHtml(phase.title)}</strong>
          <p>${escapeHtml(phase.outcome)}</p>
        </article>`).join("")}
    </section>
    <section class="ielts-section-heading">
      <span><small>August · Foundation</small><h3>Four adaptive weeks</h3></span>
      <b>18 h/week</b>
    </section>
    <div class="ielts-week-list">
      ${allWeeks().map((week) => {
        const weekTasks = week.rhythms.flatMap((rhythm) => rhythmTasks(rhythm.id));
        return `
          <article>
            <header>
              <span><small>Week ${week.number} · ${escapeHtml(week.dateRange)}</small><h3>${escapeHtml(week.title)}</h3></span>
              <strong>${taskProgress(weekTasks)}%</strong>
            </header>
            <p>${escapeHtml(week.outcome)}</p>
            <div>
              ${week.rhythms.map((rhythm) => `
                <button class="${current.id === rhythm.id ? "active" : ""}" data-ielts-action="view-rhythm" data-rhythm-id="${escapeHtml(rhythm.id)}">
                  <small>${escapeHtml(rhythm.label)} · ${escapeHtml(rhythm.days)}</small>
                  <strong>${escapeHtml(rhythm.objective)}</strong>
                  <span>${taskProgress(rhythmTasks(rhythm.id))}% · ${formatMinutes(completedMinutes(rhythmTasks(rhythm.id)))}/6h</span>
                </button>`).join("")}
            </div>
          </article>`;
      }).join("")}
    </div>`;
}

function renderAssessmentComparison() {
  const baseline = baselineAssessment();
  const latest = latestAssessment();
  const skills = ["listening", "reading", "writing", "speaking"];
  return `
    <div class="ielts-score-grid">
      ${skills.map((skill) => `
        <article>
          <small>${SKILL_LABELS[skill]}</small>
          <span><b>${baseline?.scores?.[skill] ?? "—"}</b><i>Baseline</i></span>
          <span><b>${latest?.scores?.[skill] ?? "—"}</b><i>Latest</i></span>
          <span><b>${skill === "writing" || skill === "speaking" ? "6.5+" : "7.0"}</b><i>Dec target</i></span>
        </article>`).join("")}
    </div>`;
}

function renderProgress() {
  const body = document.querySelector("#ielts-body");
  const activeErrors = app.data.errorLogs.filter((error) => error.active).sort((a, b) => b.count - a.count).slice(0, 5);
  const completed = allTasks().filter(isDone);
  body.innerHTML = `
    <section class="ielts-progress-header">
      <span><small>Evidence, not task count</small><h3>Progress toward Band 7.0</h3><p>Band estimates are checkpoints. Course attendance and completed tasks are supporting evidence, not scores.</p></span>
      <button class="ielts-primary" data-ielts-action="assessment">Add assessment</button>
    </section>
    ${renderAssessmentComparison()}
    <div class="ielts-progress-columns">
      <section>
        <header><span><small>Patterns</small><h3>Recurring errors</h3></span><button data-ielts-action="error">Add error</button></header>
        <div class="ielts-error-list">
          ${activeErrors.length ? activeErrors.map((error) => `
            <article>
              <span class="ielts-skill-dot ${escapeHtml(error.skill)}"></span>
              <span><small>${escapeHtml(SKILL_LABELS[error.skill])} · ${error.count}×</small><strong>${escapeHtml(error.label)}</strong><p>${escapeHtml(error.action || error.cause)}</p></span>
            </article>`).join("") : '<p class="ielts-empty-copy">Recurring errors will appear after baseline and task reviews.</p>'}
        </div>
      </section>
      <section>
        <header><span><small>Consistency</small><h3>Learning evidence</h3></span></header>
        <dl class="ielts-evidence-stats">
          <div><dt>Recorded time</dt><dd>${formatMinutes(completedMinutes(completed))}</dd></div>
          <div><dt>Tasks completed</dt><dd>${completed.length}</dd></div>
          <div><dt>Course sessions</dt><dd>${app.data.courseSessions.length}</dd></div>
          <div><dt>Assessments</dt><dd>${app.data.assessments.length}</dd></div>
        </dl>
      </section>
    </div>`;
}

function formatMinutes(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}m`;
}
