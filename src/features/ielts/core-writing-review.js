const WRITING_REVIEW_API = "/api/ielts/diagnostic-review";
let writingReviewBusy = false;

function writingReviewNormal(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const taskNormal = (task, criterionName) => ({
    scores: {
      [criterionName]: band(task?.scores?.[criterionName]),
      coherenceCohesion: band(task?.scores?.coherenceCohesion),
      lexicalResource: band(task?.scores?.lexicalResource),
      grammaticalRangeAccuracy: band(task?.scores?.grammaticalRangeAccuracy),
    },
    band: band(task?.band),
    summary: String(task?.summary || "").slice(0, 1200),
    evidence: Array.isArray(task?.evidence) ? task.evidence.slice(0, 6) : [],
    words: num(task?.words, 0, 0, 5000),
    minutes: num(task?.minutes, 0, 0, 300),
  });

  const overallBand = band(value.overallBand);
  if (overallBand === null) return null;
  return {
    version: Number(value.version || 1),
    task1: taskNormal(value.task1, "taskAchievement"),
    task2: taskNormal(value.task2, "taskResponse"),
    overallBand,
    confidence: ["low", "medium", "high"].includes(value.confidence) ? value.confidence : "medium",
    strengths: Array.isArray(value.strengths) ? value.strengths.slice(0, 5) : [],
    priorityErrors: Array.isArray(value.priorityErrors) ? value.priorityErrors.slice(0, 8) : [],
    learningPriorities: Array.isArray(value.learningPriorities) ? value.learningPriorities.slice(0, 5) : [],
    rewritePlan: value.rewritePlan && typeof value.rewritePlan === "object" ? value.rewritePlan : null,
    examinerSummary: String(value.examinerSummary || "").slice(0, 1800),
    weighting: String(value.weighting || "Task 1 ×1; Task 2 ×2"),
  };
}

function writingFingerprint(diagnostic) {
  const source = `${diagnostic?.task1Text || ""}\u241e${diagnostic?.task2Text || ""}\u241e${diagnostic?.task1Minutes || 0}\u241e${diagnostic?.task2Minutes || 0}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16)}-${source.length}`;
}

function writingReviewFresh(diagnostic) {
  return Boolean(
    diagnostic?.review
    && diagnostic.reviewFingerprint
    && diagnostic.reviewFingerprint === writingFingerprint(diagnostic)
  );
}

function withWritingReviewState(normalized, value) {
  const source = obj(value);
  normalized.writing.review = writingReviewNormal(source.writing?.review);
  normalized.writing.reviewedAt = Number(source.writing?.reviewedAt || 0);
  normalized.writing.reviewMethod = String(source.writing?.reviewMethod || "").slice(0, 100);
  normalized.writing.reviewFingerprint = String(source.writing?.reviewFingerprint || "").slice(0, 100);
  return normalized;
}

function enhanceWritingDiagnosticCard(skill, original) {
  if (skill !== "writing") return original;
  const diagnostic = app.data.diagnostics.writing;
  if (!diagnosticDone(diagnostic)) return original;
  const fresh = writingReviewFresh(diagnostic);
  const stale = Boolean(diagnostic.review && !fresh);
  const button = `<button class="diagnostic-ai-button" data-writing-review="${fresh ? "view" : "run"}">${fresh ? "View Joy AI review" : stale ? "Essay changed · review again" : "Review with Joy AI"}</button>`;
  return original.replace("</article>", `${button}</article>`);
}

function renderWritingReviewSummary() {
  const diagnostic = app.data.diagnostics.writing;
  const review = diagnostic.review;
  if (!review) return;
  const summary = document.querySelector("#ielts-body .baseline-summary");
  if (!summary || document.querySelector("#ielts-body .writing-review-summary")) return;
  if (!writingReviewFresh(diagnostic)) {
    summary.insertAdjacentHTML("beforebegin", `<section class="writing-review-summary stale"><header><span><small>Joy AI diagnostic review</small><h3>Review is outdated</h3></span><strong>Essay changed</strong></header><p>The saved band belongs to an earlier version of the diagnostic. Run the reviewer again before using it as your baseline.</p><footer><small>Joy will not treat the old score as current evidence.</small><button data-writing-review="run">Review current version</button></footer></section>`);
    return;
  }
  summary.insertAdjacentHTML("beforebegin", writingReviewSummary(review));
}

function writingReviewSummary(review) {
  const topPriority = review.learningPriorities?.[0];
  return `<section class="writing-review-summary">
    <header>
      <span><small>Joy AI diagnostic review</small><h3>Writing baseline · ${review.overallBand}</h3></span>
      <strong>${esc(review.confidence)} confidence</strong>
    </header>
    <div class="writing-review-task-bands">
      <article><small>Task 1</small><b>${review.task1.band}</b><span>${esc(review.task1.summary)}</span></article>
      <article><small>Task 2</small><b>${review.task2.band}</b><span>${esc(review.task2.summary)}</span></article>
    </div>
    <p>${esc(review.examinerSummary)}</p>
    ${topPriority ? `<aside><b>First priority</b><span>${esc(topPriority.focus)} — ${esc(topPriority.nextExercise)}</span></aside>` : ""}
    <footer><small>Task 2 is weighted twice. This is an AI estimate, not an official IELTS score.</small><button data-writing-review="view">Open full review</button></footer>
  </section>`;
}

async function runWritingReview() {
  if (writingReviewBusy) return;
  const diagnostic = app.data.diagnostics.writing;
  if (!diagnosticDone(diagnostic)) {
    toast("Submit the full Writing diagnostic before requesting a review.");
    return;
  }

  writingReviewBusy = true;
  setWritingReviewButtons("Reviewing in two passes…", true);
  sync("AI reviewing…");

  try {
    const fingerprint = writingFingerprint(diagnostic);
    const payload = await req(WRITING_REVIEW_API, {
      method: "POST",
      body: JSON.stringify({
        skill: "writing",
        task1Text: diagnostic.task1Text,
        task2Text: diagnostic.task2Text,
        task1Minutes: diagnostic.task1Minutes,
        task2Minutes: diagnostic.task2Minutes,
        learnerProfile: app.data.learnerProfile,
      }),
    });

    const review = writingReviewNormal(payload.review);
    if (!review) throw new Error("INVALID_WRITING_REVIEW");
    if (fingerprint !== writingFingerprint(diagnostic)) throw new Error("DIAGNOSTIC_CHANGED_DURING_REVIEW");

    diagnostic.review = review;
    diagnostic.reviewFingerprint = fingerprint;
    diagnostic.estimatedBand = review.overallBand;
    diagnostic.status = "reviewed";
    diagnostic.reviewedAt = Number(payload.reviewedAt || Date.now());
    diagnostic.reviewMethod = String(payload.methodology || "two-pass-evidence-then-scoring");
    mergeWritingDiagnosticErrors(review);
    save();
    baseline();
    toast(`Writing baseline reviewed: estimated band ${review.overallBand}.`);
    setTimeout(() => openWritingReview(), 100);
  } catch (error) {
    console.error("Joy Writing diagnostic review failed", error);
    const message = error.message === "AI_UNAVAILABLE"
      ? "Joy AI is unavailable right now. Your diagnostic remains saved."
      : error.message === "DIAGNOSTIC_CHANGED_DURING_REVIEW"
        ? "The essay changed during review. Save it and run the reviewer again."
        : "Joy could not complete the Writing review. Try again without resubmitting the essay.";
    toast(message);
  } finally {
    writingReviewBusy = false;
    setWritingReviewButtons("Review with Joy AI", false);
    sync(app.mode === "cloud" ? "Synced" : "Local only");
  }
}

function mergeWritingDiagnosticErrors(review) {
  app.data.errorLogs = app.data.errorLogs.filter((item) => item.source !== "writing-diagnostic-ai-v1");
  review.priorityErrors.slice(0, 6).forEach((item) => {
    const evidence = item.evidence ? ` Evidence: “${item.evidence}”.` : "";
    const correction = item.correction ? ` Better version: ${item.correction}.` : "";
    app.data.errorLogs.push({
      id: crypto.randomUUID?.() || `wr-${Date.now()}-${Math.random()}`,
      skill: "writing",
      label: item.title,
      action: `${item.explanation}${evidence}${correction}`.trim(),
      count: 1,
      source: "writing-diagnostic-ai-v1",
      code: item.code,
      severity: item.severity,
      at: Date.now(),
    });
  });
}

function openWritingReview() {
  const diagnostic = app.data.diagnostics.writing;
  const review = diagnostic.review;
  if (!review || !writingReviewFresh(diagnostic)) {
    toast(review ? "This review is outdated because the essay changed." : "Run the Writing review first.");
    runWritingReview();
    return;
  }
  const editor = document.querySelector("#ielts-editor");
  editor.hidden = false;
  editor.classList.add("diagnostic-editor", "writing-review-editor");
  editor.innerHTML = `<header>
    <span><small>Two-pass evidence review · ${esc(review.confidence)} confidence</small><h3>Writing baseline · ${review.overallBand}</h3></span>
    <button data-ia="close-editor">×</button>
  </header>
  <section class="review-disclaimer">AI diagnostic estimate only. Task 2 is weighted twice in the combined result.</section>
  ${reviewTaskSection("Task 1", review.task1, "Task Achievement", "taskAchievement")}
  ${reviewTaskSection("Task 2", review.task2, "Task Response", "taskResponse")}
  <section class="review-block"><h4>What already works</h4><div class="review-list">${review.strengths.length ? review.strengths.map(item => `<article><b>${esc(item.title)}</b><q>${esc(item.evidence)}</q><p>${esc(item.whyItMatters)}</p></article>`).join("") : '<p class="empty">No reliable strength was identified.</p>'}</div></section>
  <section class="review-block"><h4>Priority errors</h4><div class="review-list errors">${review.priorityErrors.length ? review.priorityErrors.map(item => `<article data-severity="${esc(item.severity)}"><header><b>${esc(item.title)}</b><span>${esc(item.category)} · ${esc(item.severity)}</span></header><q>${esc(item.evidence)}</q><p>${esc(item.explanation)}</p>${item.correction ? `<code>${esc(item.correction)}</code>` : ""}</article>`).join("") : '<p class="empty">No priority errors were returned.</p>'}</div></section>
  <section class="review-block"><h4>Learning priorities</h4><ol class="review-priorities">${review.learningPriorities.map(item => `<li><b>${esc(item.focus)}</b><p>${esc(item.reason)}</p><small>Next exercise: ${esc(item.nextExercise)}</small></li>`).join("")}</ol></section>
  ${review.rewritePlan ? `<section class="review-rewrite"><small>Required rewrite · within ${Number(review.rewritePlan.deadlineHours || 48)} hours</small><h4>${esc(review.rewritePlan.task)}</h4><ol>${(review.rewritePlan.instructions || []).map(item => `<li>${esc(item)}</li>`).join("")}</ol></section>` : ""}
  <section class="review-examiner-summary"><small>Joy’s assessment</small><p>${esc(review.examinerSummary)}</p></section>
  <footer class="review-footer"><button data-writing-review="run">Run review again</button><button class="primary" data-writing-review="errors">Open Error Log</button></footer>`;
}

function reviewTaskSection(title, task, taskCriterionLabel, taskCriterionKey) {
  const rows = [
    [taskCriterionLabel, task.scores[taskCriterionKey]],
    ["Coherence & Cohesion", task.scores.coherenceCohesion],
    ["Lexical Resource", task.scores.lexicalResource],
    ["Grammar Range & Accuracy", task.scores.grammaticalRangeAccuracy],
  ];
  return `<section class="review-task">
    <header><span><small>${task.words} words · ${task.minutes} minutes</small><h4>${title}</h4></span><strong>${task.band}</strong></header>
    <div class="review-criteria">${rows.map(([label, score]) => `<span><small>${esc(label)}</small><b>${score}</b></span>`).join("")}</div>
    <p>${esc(task.summary)}</p>
    <div class="review-evidence">${task.evidence.map(item => `<article><q>${esc(item.quote)}</q><span>${esc(item.finding)}</span></article>`).join("")}</div>
  </section>`;
}

function setWritingReviewButtons(text, disabled) {
  document.querySelectorAll("[data-writing-review]").forEach((button) => {
    if (button.dataset.writingReview === "run") {
      button.textContent = text;
      button.disabled = disabled;
    }
  });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-writing-review]");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const action = button.dataset.writingReview;
  if (action === "run") runWritingReview();
  if (action === "view") openWritingReview();
  if (action === "errors") {
    closeEditor();
    app.tab = "log";
    render();
    setTimeout(() => document.querySelector(".logs")?.scrollIntoView({ behavior: "smooth" }), 20);
  }
}, true);

window.JoyIELTS.reviewWritingDiagnostic = runWritingReview;
window.JoyIELTS.getWritingReview = () => structuredClone(app.data.diagnostics.writing.review);
