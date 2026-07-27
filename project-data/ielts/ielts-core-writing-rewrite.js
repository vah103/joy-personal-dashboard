function ensureWritingRewriteAssignment() {
  const diagnostic = app.data.diagnostics?.writing;
  if (!writingReviewFresh(diagnostic)) return null;
  const plan = diagnostic.review?.rewritePlan;
  if (!plan) return null;
  if (!plan.status) {
    const assignedAt = Date.now();
    plan.status = "pending";
    plan.assignedAt = assignedAt;
    plan.dueAt = assignedAt + (Number(plan.deadlineHours || 48) * 60 * 60 * 1000);
    plan.completedAt = 0;
    plan.minutes = 0;
    plan.evidence = "";
    save();
  }
  return plan;
}

function pendingWritingRewrite() {
  const plan = ensureWritingRewriteAssignment();
  return plan && plan.status !== "completed" ? plan : null;
}

function rewriteDueLabel(plan) {
  if (!plan?.dueAt) return "within 48 hours";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(plan.dueAt));
}

function writingRewriteCallout(plan) {
  return `<section class="writing-rewrite-mission ${Date.now() > Number(plan.dueAt || Infinity) ? "late" : ""}">
    <span><small>Required adaptive mission</small><strong>${esc(plan.task)} rewrite</strong><p>Due ${esc(rewriteDueLabel(plan))}. Feedback is not complete until you produce a corrected version.</p></span>
    <button data-writing-rewrite="open">Complete rewrite</button>
  </section>`;
}

const todayBeforeWritingRewrite = today;
today = function todayWithWritingRewrite() {
  todayBeforeWritingRewrite();
  const plan = pendingWritingRewrite();
  if (!plan || document.querySelector("#ielts-body .writing-rewrite-mission")) return;
  const anchor = document.querySelector("#ielts-body .baseline-callout") || document.querySelector("#ielts-body .ielts-hero");
  anchor?.insertAdjacentHTML("afterend", writingRewriteCallout(plan));
};

const coachBeforeWritingRewrite = coach;
coach = function coachWithWritingRewrite() {
  coachBeforeWritingRewrite();
  const plan = pendingWritingRewrite();
  if (!plan || document.querySelector("#ielts-body .writing-rewrite-mission")) return;
  const coachCard = document.querySelector("#ielts-body .coach");
  coachCard?.insertAdjacentHTML("afterend", writingRewriteCallout(plan));
};

function openWritingRewrite() {
  const plan = ensureWritingRewriteAssignment();
  if (!plan) {
    toast("No active Writing rewrite is available.");
    return;
  }
  const editor = document.querySelector("#ielts-editor");
  editor.hidden = false;
  editor.classList.add("diagnostic-editor", "writing-rewrite-editor");
  editor.innerHTML = `<header><span><small>Adaptive mission · due ${esc(rewriteDueLabel(plan))}</small><h3>${esc(plan.task)} rewrite</h3></span><button data-ia="close-editor">×</button></header>
    <section class="review-rewrite"><small>Use the diagnostic feedback</small><ol>${(plan.instructions || []).map(item => `<li>${esc(item)}</li>`).join("")}</ol></section>
    <form data-writing-rewrite-form>
      <label>Actual minutes<input type="number" name="minutes" min="1" max="240" value="${Number(plan.minutes || 30)}" required></label>
      <label class="wide">Corrected response or rewritten body paragraphs<textarea class="long-answer" name="evidence" required placeholder="Paste the corrected version here. Joy requires a substantive rewrite, not a note saying that you reviewed it.">${esc(plan.evidence || "")}</textarea><small>Minimum 100 words for this adaptive assignment.</small></label>
      <footer class="wide"><button type="button" data-ia="close-editor">Save later</button><button class="primary">Submit rewrite</button></footer>
    </form>`;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-writing-rewrite]");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.dataset.writingRewrite === "open") openWritingRewrite();
}, true);

document.addEventListener("submit", (event) => {
  const form = event.target.closest?.("[data-writing-rewrite-form]");
  if (!form) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const plan = ensureWritingRewriteAssignment();
  if (!plan) return;
  const data = new FormData(form);
  const evidence = String(data.get("evidence") || "").trim();
  if (words(evidence) < 100) {
    toast("The adaptive rewrite requires at least 100 words of corrected writing.");
    return;
  }
  plan.status = "completed";
  plan.minutes = num(data.get("minutes"), 30, 1, 240);
  plan.evidence = evidence.slice(0, 40_000);
  plan.completedAt = Date.now();
  save();
  closeEditor();
  render();
  toast("Writing rewrite completed with evidence.");
}, true);

window.JoyIELTS.openWritingRewrite = openWritingRewrite;
