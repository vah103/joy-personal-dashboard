function renderRoadmap() {
  const stages = getStages().map(effectiveStage);
  const stage = stages.find((item) => item.id === hubState.activeStageId) || stages[0];
  if (!stage) {
    hubElements.body.innerHTML = `<div class="hub-empty">No roadmap data is available.</div>`;
    return;
  }

  const stageNote = hubState.overrides.stageNotes[stage.id] || stage.results?.[0]?.summary || "";
  const sourceResults = (stage.results || []).map((result) => `
    <article class="hub-result-card">
      <div><strong>${escapeHub(formatHubDate(result.date))}</strong><span>Verified result</span></div>
      <p>${escapeHub(result.summary)}</p>
      <div class="hub-evidence-list">
        ${(result.evidence || []).map((path) => `<a href="https://github.com/${escapeHub(hubState.source.repository)}/blob/${escapeHub(hubState.source.ref || "main")}/${escapeHub(path)}" target="_blank" rel="noreferrer">${escapeHub(path.split("/").at(-1))} ↗</a>`).join("")}
      </div>
    </article>`).join("");

  hubElements.body.innerHTML = `
    <div class="hub-roadmap-layout">
      <aside class="hub-stage-list" aria-label="Project stages">
        <div class="hub-progress-summary">
          <span>Overall progress</span>
          <strong>${projectProgress()}%</strong>
          <div><i style="width:${projectProgress()}%"></i></div>
        </div>
        ${stages.map((item) => `
          <button type="button" class="hub-stage-button ${item.id === stage.id ? "active" : ""}" data-hub-action="select-stage" data-stage-id="${escapeHub(item.id)}">
            <span class="hub-stage-number">${item.status === "completed" ? "✓" : item.number}</span>
            <span><strong>${escapeHub(item.shortName || item.name)}</strong><small>${escapeHub(labelStatus(item.status))} · ${item.progress}%</small></span>
          </button>`).join("")}
      </aside>

      <section class="hub-stage-detail">
        <div class="hub-stage-heading">
          <div>
            <p>Stage ${stage.number} of ${stages.length}</p>
            <h3>${escapeHub(stage.name)}</h3>
          </div>
          <label class="hub-status-select">Status
            <select data-hub-stage-status="${escapeHub(stage.id)}">
              ${["not-started","in-progress","verification","completed","blocked"].map((status) => `<option value="${status}" ${status === stage.status ? "selected" : ""}>${escapeHub(labelStatus(status))}</option>`).join("")}
            </select>
          </label>
        </div>

        <p class="hub-stage-objective">${escapeHub(stage.objective)}</p>

        <section class="hub-section-card">
          <div class="hub-section-heading"><div><span>Checklist</span><strong>${stage.progress}% complete</strong></div><small>Progress is calculated automatically.</small></div>
          <div class="hub-checklist">
            ${stage.checklist.map((item) => `
              <label class="hub-check-row ${item.done ? "done" : ""}">
                <input type="checkbox" data-hub-check="${escapeHub(item.id)}" ${item.done ? "checked" : ""}>
                <span class="hub-checkmark">${item.done ? "✓" : ""}</span>
                <span>${escapeHub(item.label)}</span>
              </label>`).join("")}
          </div>
        </section>

        <section class="hub-completion-gate">
          <span>Completion gate</span>
          <p>${escapeHub(stage.completionCriteria)}</p>
        </section>

        <section class="hub-section-card">
          <div class="hub-section-heading">
            <div><span>Results achieved</span><strong>Editable summary</strong></div>
            <small>GitHub evidence stays unchanged; your summary is saved separately.</small>
          </div>
          <textarea class="hub-summary-editor" data-hub-stage-note="${escapeHub(stage.id)}" rows="4" placeholder="Write a concise result summary…">${escapeHub(stageNote)}</textarea>
          <div class="hub-source-results">${sourceResults || `<p class="hub-muted">No verified result has been linked to this stage yet.</p>`}</div>
        </section>
      </section>
    </div>`;
}

function renderCommands() {
  const commands = mergedCommands();
  const categories = [...new Set(commands.map((command) => command.category || "Other"))].sort();

  hubElements.body.innerHTML = `
    <section class="hub-command-toolbar">
      <div><p>Reusable command library</p><h3>${commands.length} commands</h3></div>
      <div>
        <select id="hub-command-filter" aria-label="Filter command category">
          <option value="">All categories</option>
          ${categories.map((category) => `<option value="${escapeHub(category)}">${escapeHub(category)}</option>`).join("")}
        </select>
        <button class="hub-primary-button" type="button" data-hub-action="add-command">+ Add command</button>
      </div>
    </section>
    <div class="hub-command-list">
      ${commands.map(renderCommandCard).join("")}
    </div>`;
}

function renderCommandCard(command) {
  const verified = command.verifiedAt ? `Verified ${formatHubDate(command.verifiedAt)}` : "Not verified";
  return `
    <article class="hub-command-card" data-command-category="${escapeHub(command.category || "Other")}">
      <header>
        <div><span>${escapeHub(command.category || "Other")}</span><h3>${escapeHub(command.name || "Untitled command")}</h3></div>
        <span class="hub-safety-tag ${escapeHub(command.safety || "read-only")}">${escapeHub(labelStatus(command.safety || "read-only"))}</span>
      </header>
      <div class="hub-command-meta"><span>${escapeHub(command.runOn || "Not specified")}</span><span>${escapeHub(verified)}</span></div>
      <p>${escapeHub(command.purpose || "")}</p>
      <pre><code>${escapeHub(command.code || "")}</code></pre>
      <div class="hub-command-result"><span>Expected result</span><p>${escapeHub(command.expectedResult || "Not recorded")}</p></div>
      <footer>
        <button type="button" data-hub-action="copy-command" data-command-id="${escapeHub(command.id)}">Copy</button>
        <button type="button" data-hub-action="edit-command" data-command-id="${escapeHub(command.id)}">Edit</button>
      </footer>
    </article>`;
}

function renderJournal() {
  const reports = Array.isArray(hubState.source.reports) ? hubState.source.reports : [];
  hubElements.body.innerHTML = `
    <section class="hub-journal-heading">
      <div><p>Lab journal</p><h3>${reports.length} recorded session${reports.length === 1 ? "" : "s"}</h3></div>
      <a href="${escapeHub(hubState.source.project?.repositoryUrl || `https://github.com/${hubState.source.repository}`)}" target="_blank" rel="noreferrer">Open repository ↗</a>
    </section>
    <div class="hub-journal-list">
      ${reports.map(renderJournalEntry).join("") || `<div class="hub-empty">No daily report was found.</div>`}
    </div>`;
}

function markdownSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(markdown || "").match(new RegExp(`##\\s+[^\\n]*${escaped}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i"));
  return match ? match[1].trim() : "";
}

function bulletLines(value, limit = 8) {
  return String(value || "").split("\n")
    .map((line) => line.match(/^\s*[-*]\s+(.+)/)?.[1])
    .filter(Boolean)
    .slice(0, limit);
}

function codeBlocks(markdown) {
  return [...String(markdown || "").matchAll(/```(?:bash|text|shell)?\s*\n([\s\S]*?)```/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function renderJournalEntry(report) {
  const completed = bulletLines(markdownSection(report.content, "Đã thực hiện"));
  const confirmed = bulletLines(markdownSection(report.content, "Kết quả"));
  const issues = bulletLines(markdownSection(report.content, "Sự cố"));
  const blocks = codeBlocks(report.content);
  const edit = hubState.overrides.journals[report.date] || {};
  const defaultSummary = [...completed, ...confirmed].slice(0, 6).join("\n• ");
  const summary = edit.summary ?? (defaultSummary ? `• ${defaultSummary}` : "");
  const proof = edit.proof ?? inferJournalProof(report);

  return `
    <article class="hub-journal-card">
      <header>
        <div><span>${escapeHub(formatHubDate(report.date))}</span><h3>${escapeHub(report.name)}</h3></div>
        <a href="${escapeHub(report.htmlUrl || "#")}" target="_blank" rel="noreferrer">Raw report ↗</a>
      </header>
      <div class="hub-journal-grid">
        <section>
          <h4>What happened</h4>
          <textarea rows="6" data-hub-journal-summary="${escapeHub(report.date)}">${escapeHub(summary)}</textarea>
        </section>
        <section>
          <h4>What this proves</h4>
          <textarea rows="6" data-hub-journal-proof="${escapeHub(report.date)}">${escapeHub(proof)}</textarea>
        </section>
      </div>
      ${blocks.length ? `<details class="hub-journal-commands"><summary>${blocks.length} command block${blocks.length === 1 ? "" : "s"} used</summary>${blocks.slice(0, 8).map((block) => `<pre><code>${escapeHub(block)}</code></pre>`).join("")}</details>` : ""}
      ${issues.length ? `<div class="hub-open-issues"><span>Open issues</span><ul>${issues.slice(0, 6).map((issue) => `<li>${escapeHub(issue)}</li>`).join("")}</ul></div>` : ""}
    </article>`;
}

function inferJournalProof(report) {
  const content = String(report.content || "").toLowerCase();
  if (content.includes("localization") && content.includes("nav2")) {
    return "The SLAM → saved map → AMCL Localization → Nav2 workflow operated on the real TurtleBot4. Reproducibility and formal benchmark evidence are still required.";
  }
  if (content.includes("slam")) return "The robot and laptop can create and save a lab occupancy map.";
  return "This session provides evidence for the tasks recorded in the source report.";
}

function defaultPlan() {
  const stage = currentStage();
  const pending = nextPendingItem(stage);
  return {
    title: "Reproduce Localization and Nav2 from a fresh startup",
    why: "Navigation worked in the previous lab session, but the complete workflow has not yet been proven repeatable from a clean startup.",
    location: "Lab",
    priority: "High",
    currentFocus: hubState.source?.project?.currentFocus || stage?.objective || "",
    nextAction: pending?.label || hubState.source?.project?.nextAction || "",
    completionCriteria: [
      "Localization starts correctly with the versioned lab map.",
      "Three fixed Nav2 goals complete consecutively.",
      "Logs and RViz evidence are saved.",
      "The launch/config used in the test is committed.",
    ].join("\n"),
  };
}

function effectivePlan() {
  return { ...defaultPlan(), ...hubState.overrides.plan };
}

function renderPlan() {
  const plan = effectivePlan();
  const stage = currentStage();
  const pending = nextPendingItem(stage);

  hubElements.body.innerHTML = `
    <div class="hub-plan-layout">
      <section class="hub-plan-card">
        <div class="hub-plan-heading"><div><span>Recommended next action</span><h3>${escapeHub(plan.title)}</h3></div><span class="hub-priority">${escapeHub(plan.priority)}</span></div>
        <label>Plan title<input data-hub-plan="title" value="${escapeHub(plan.title)}"></label>
        <label>Why this matters<textarea data-hub-plan="why" rows="3">${escapeHub(plan.why)}</textarea></label>
        <div class="hub-plan-fields">
          <label>Location<select data-hub-plan="location"><option ${plan.location === "Lab" ? "selected" : ""}>Lab</option><option ${plan.location === "Home" ? "selected" : ""}>Home</option><option ${plan.location === "Both" ? "selected" : ""}>Both</option></select></label>
          <label>Priority<select data-hub-plan="priority"><option ${plan.priority === "High" ? "selected" : ""}>High</option><option ${plan.priority === "Medium" ? "selected" : ""}>Medium</option><option ${plan.priority === "Low" ? "selected" : ""}>Low</option></select></label>
        </div>
        <label>Current focus<input data-hub-plan="currentFocus" value="${escapeHub(plan.currentFocus)}"></label>
        <label>Next action<input data-hub-plan="nextAction" value="${escapeHub(plan.nextAction || pending?.label || "")}"></label>
        <label>Completion criteria<textarea data-hub-plan="completionCriteria" rows="5">${escapeHub(plan.completionCriteria)}</textarea></label>
        <div class="hub-plan-actions">
          <button class="hub-primary-button" type="button" data-hub-action="add-plan-to-todo">Add to To-do</button>
          <button type="button" data-hub-action="reset-plan">Regenerate from roadmap</button>
        </div>
      </section>

      <section class="hub-chat-card">
        <header><div><span>Joy project assistant</span><h3>Ask about TurtleBot4</h3></div><i aria-hidden="true">✦</i></header>
        <div class="hub-chat-suggestions">
          ${["What should I do next?","What should I prepare for the lab?","Why did a Nav2 goal abort?","What can I do at home?"].map((question) => `<button type="button" data-hub-action="ask-suggestion" data-question="${escapeHub(question)}">${escapeHub(question)}</button>`).join("")}
        </div>
        <div class="hub-chat-log" id="hub-chat-log">
          ${hubState.chat.length ? hubState.chat.map((message) => `<div class="hub-chat-message ${message.role}"><span>${message.role === "joy" ? "Joy" : "Vanh"}</span><p>${escapeHub(message.text)}</p></div>`).join("") : `<div class="hub-chat-empty"><strong>Project-aware answers</strong><p>Joy uses the roadmap, checklist, commands and daily reports loaded in this popup.</p></div>`}
        </div>
        <form id="hub-chat-form">
          <input name="question" autocomplete="off" placeholder="Ask Joy about this project…" required>
          <button type="submit" aria-label="Send question">Send</button>
        </form>
      </section>
    </div>`;
}
