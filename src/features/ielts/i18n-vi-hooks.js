function translateIeltsText(value) {
  let text = String(value ?? "");
  if (UI_TEXT_VI.has(text)) return UI_TEXT_VI.get(text);
  return text
    .replace(/^(\d+) days until August$/, "Còn $1 ngày đến tháng 8")
    .replace(/^(\d+) required missions complete$/, "Đã hoàn thành $1 nhiệm vụ bắt buộc")
    .replace(/^(\d+) overdue missions$/, "$1 nhiệm vụ quá hạn")
    .replace(/^(\d+) overdue mission\(s\) need recovery\.$/, "$1 nhiệm vụ quá hạn cần được học bù.")
    .replace(/^(\d+) mission\(s\) remain today\.$/, "Hôm nay còn $1 nhiệm vụ.")
    .replace(/^Today is complete\.$/, "Hôm nay đã hoàn thành.")
    .replace(/^Preparation is part of the plan\.$/, "Chuẩn bị cũng là một phần của kế hoạch.")
    .replace(/^Day (\d+): /, "Ngày $1: ")
    .replace(/^Day (\d+) · /, "Ngày $1 · ")
    .replace(/^Week (\d+) · /, "Tuần $1 · ")
    .replace(/^(\d+) missions$/, "$1 nhiệm vụ")
    .replace(/^(\d+) occurrence\(s\)$/, "$1 lần xuất hiện")
    .replace(/^Today (\d+\/\d+)$/, "Hôm nay $1")
    .replace(/^Starts 1 Aug$/, "Bắt đầu 1/8")
    .replace(/^Speaking (\d+)$/, "Speaking $1")
    .replace(/^(\d+) overdue$/, "$1 quá hạn")
    .replace(/^Due /, "Hạn ")
    .replace(/^within 48 hours$/, "trong vòng 48 giờ")
    .replace(/^confidence$/, "độ tin cậy")
    .replace(/ Evidence: /g, " Bằng chứng: ")
    .replace(/ Better version: /g, " Câu tốt hơn: ");
}

function translateIeltsDom(root = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const current = node.nodeValue;
    const leading = current.match(/^\s*/)?.[0] || "";
    const trailing = current.match(/\s*$/)?.[0] || "";
    const body = current.trim();
    if (!body) return;
    const translated = translateIeltsText(body);
    if (translated !== body) node.nodeValue = `${leading}${translated}${trailing}`;
  });
  root.querySelectorAll?.("[placeholder], [aria-label], [title]").forEach((element) => {
    ["placeholder", "aria-label", "title"].forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const value = element.getAttribute(attribute);
      const translated = translateIeltsText(value);
      if (translated !== value) element.setAttribute(attribute, translated);
    });
  });
}

function ensureVietnamesePlan() {
  if (!app.plan || app.plan.__language === IELTS_LANGUAGE) return;
  app.plan = localizeIeltsPlan(app.plan);
  Object.defineProperty(app.plan, "__language", { value: IELTS_LANGUAGE, enumerable: false });
}

function wrapTranslatedRender(original) {
  return function translatedRender(...args) {
    ensureVietnamesePlan();
    const result = original.apply(this, args);
    translateIeltsDom(document.querySelector("#ielts-modal") || document);
    return result;
  };
}

const renderBeforeVietnamese = render; render = wrapTranslatedRender(renderBeforeVietnamese);
const todayBeforeVietnamese = today; today = wrapTranslatedRender(todayBeforeVietnamese);
const roadmapBeforeVietnamese = roadmap; roadmap = wrapTranslatedRender(roadmapBeforeVietnamese);
const logBeforeVietnamese = log; log = wrapTranslatedRender(logBeforeVietnamese);
const coachBeforeVietnamese = coach; coach = wrapTranslatedRender(coachBeforeVietnamese);
const editorBeforeVietnamese = editor; editor = wrapTranslatedRender(editorBeforeVietnamese);
const weeklyBeforeVietnamese = weekly; weekly = wrapTranslatedRender(weeklyBeforeVietnamese);
const finalReviewBeforeVietnamese = finalReview; finalReview = wrapTranslatedRender(finalReviewBeforeVietnamese);
const baselineBeforeVietnamese = baseline; baseline = wrapTranslatedRender(baselineBeforeVietnamese);
const editProfileBeforeVietnamese = editProfile; editProfile = wrapTranslatedRender(editProfileBeforeVietnamese);
const diagnosticEditorBeforeVietnamese = diagnosticEditor; diagnosticEditor = wrapTranslatedRender(diagnosticEditorBeforeVietnamese);
const openWritingReviewBeforeVietnamese = openWritingReview; openWritingReview = wrapTranslatedRender(openWritingReviewBeforeVietnamese);
const openWritingRewriteBeforeVietnamese = openWritingRewrite; openWritingRewrite = wrapTranslatedRender(openWritingRewriteBeforeVietnamese);

const updateCardBeforeVietnamese = updateCard;
updateCard = function updateCardVietnamese(...args) {
  ensureVietnamesePlan();
  const result = updateCardBeforeVietnamese.apply(this, args);
  translateIeltsDom(document.querySelector("#project-list") || document);
  return result;
};

const cardBeforeVietnamese = card;
card = function cardVietnamese(...args) {
  const result = cardBeforeVietnamese.apply(this, args);
  translateIeltsDom(document.querySelector("#project-list") || document);
  return result;
};

const syncBeforeVietnamese = sync;
sync = function syncVietnamese(text) { return syncBeforeVietnamese(translateIeltsText(text)); };

const toastBeforeVietnamese = toast;
toast = function toastVietnamese(text) {
  const direct = {
    "Strict Mode remains on for August.": "Chế độ nghiêm ngặt tiếp tục được bật trong tháng 8.",
    "Moved to Recovery Queue.": "Đã chuyển vào Hàng đợi học bù.",
    "No mission is waiting.": "Không có nhiệm vụ nào đang chờ.",
    "Strict Mode requires time, evidence and score when relevant.": "Chế độ nghiêm ngặt yêu cầu thời gian, bằng chứng và điểm số khi cần.",
    "Minimum Day recorded · partial progress.": "Đã ghi nhận Ngày tối thiểu · chỉ tính một phần tiến độ.",
    "Mission completed with evidence.": "Đã hoàn thành nhiệm vụ kèm bằng chứng.",
    "Weekly review saved.": "Đã lưu tổng kết tuần.",
    "August review saved.": "Đã lưu tổng kết tháng 8.",
    "Learner profile saved for August.": "Đã lưu Hồ sơ người học cho tháng 8.",
    "Writing diagnostic requires at least 150 words for Task 1 and 250 for Task 2.": "Bài Writing đầu vào yêu cầu tối thiểu 150 từ cho Task 1 và 250 từ cho Task 2.",
    "Add a fuller Part 2 transcript before submitting the Speaking baseline.": "Hãy bổ sung transcript Part 2 đầy đủ hơn trước khi nộp bài Speaking đầu vào.",
    "Submit the full Writing diagnostic before requesting a review.": "Hãy nộp đầy đủ bài Writing đầu vào trước khi yêu cầu chấm.",
    "Joy AI is unavailable right now. Your diagnostic remains saved.": "Joy AI hiện chưa khả dụng. Bài đầu vào của bạn vẫn được lưu.",
    "The essay changed during review. Save it and run the reviewer again.": "Bài viết đã thay đổi trong lúc chấm. Hãy lưu và chấm lại.",
    "Joy could not complete the Writing review. Try again without resubmitting the essay.": "Joy chưa thể hoàn tất phần chấm Writing. Hãy thử lại mà không cần nộp lại bài.",
    "This review is outdated because the essay changed.": "Kết quả chấm đã cũ vì bài viết đã thay đổi.",
    "Run the Writing review first.": "Hãy chấm bài Writing trước.",
    "No active Writing rewrite is available.": "Hiện không có bài Writing cần viết lại.",
    "The adaptive rewrite requires at least 100 words of corrected writing.": "Bài viết lại thích ứng yêu cầu tối thiểu 100 từ đã được sửa.",
    "Writing rewrite completed with evidence.": "Đã hoàn thành bài Writing viết lại kèm bằng chứng.",
  };
  return toastBeforeVietnamese(direct[text] || translateIeltsText(text));
};

fmt = function formatVietnameseDate(dateKey) {
  return new Intl.DateTimeFormat(IELTS_LANGUAGE, { timeZone: TZ, weekday: "short", day: "numeric", month: "short" })
    .format(new Date(`${dateKey}T00:00:00+07:00`));
};

rewriteDueLabel = function rewriteDueLabelVietnamese(plan) {
  if (!plan?.dueAt) return "trong vòng 48 giờ";
  return new Intl.DateTimeFormat(IELTS_LANGUAGE, { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    .format(new Date(plan.dueAt));
};

const observer = new MutationObserver(() => {
  translateIeltsDom(document.querySelector("#ielts-modal") || document);
  translateIeltsDom(document.querySelector("#project-list") || document);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
