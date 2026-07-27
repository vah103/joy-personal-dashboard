function translateIeltsText(value) {
  const text = String(value ?? "");
  if (UI_TEXT_VI.has(text)) return UI_TEXT_VI.get(text);

  const exact = {
    "Synced": "Đã đồng bộ",
    "Local only": "Chỉ lưu trên thiết bị",
    "Connecting…": "Đang kết nối…",
    "Saving…": "Đang lưu…",
    "Local": "Lưu cục bộ",
    "Offline": "Ngoại tuyến",
    "D1 synced · Open August Coach": "Đã đồng bộ D1 · Mở IELTS Coach tháng 8",
    "Local mode · Open August Coach": "Chế độ cục bộ · Mở IELTS Coach tháng 8",
    "Prepare August Intensive": "Chuẩn bị đợt tăng tốc tháng 8",
    "Review August evidence": "Xem lại bằng chứng tháng 8",
    "Complete August review": "Hoàn thành tổng kết tháng 8",
    "Build learner baseline": "Xây dựng mức đầu vào người học",
    "Complete learner profile": "Hoàn thiện Hồ sơ người học",
    "The August system is ready.": "Hệ thống học tháng 8 đã sẵn sàng.",
    "Strict Mode keeps unfinished work visible.": "Chế độ nghiêm ngặt luôn giữ bài chưa hoàn thành ở trạng thái hiển thị.",
    "Open Recovery": "Mở phần học bù",
    "Back-translation first, then independent writing": "Ban đầu dịch ngược, sau đó tự viết độc lập",
    "One original Task 1 table and one Task 2 discussion essay under a 60-minute limit.": "Một Task 1 dạng bảng và một Task 2 dạng Discussion trong giới hạn 60 phút.",
    "Record externally for now, then save Part 1 notes, a Part 2 transcript and Part 3 evidence.": "Hiện tại hãy thu âm bên ngoài, sau đó lưu ghi chú Part 1, transcript Part 2 và bằng chứng Part 3.",
    "Use one trusted full test without a dictionary; Joy records score, time and weak question types.": "Làm một full test đáng tin cậy, không dùng từ điển; Joy sẽ lưu điểm, thời gian và dạng câu còn yếu.",
    "Use one trusted full test without pausing; Joy records score, time and error patterns.": "Làm một full test đáng tin cậy, không tạm dừng; Joy sẽ lưu điểm, thời gian và kiểu lỗi.",
    "Complete one full Academic Reading test in 60 minutes without a dictionary.": "Hoàn thành một bài Academic Reading đầy đủ trong 60 phút, không dùng từ điển.",
    "Complete one full IELTS Listening test once, without pausing or replaying.": "Làm một bài IELTS Listening đầy đủ một lần, không tạm dừng hoặc nghe lại.",
    "Save the exact source so the result can be checked later.": "Lưu chính xác nguồn đề để có thể kiểm tra kết quả về sau.",
    "Writing and Speaking will remain unscored until reviewed.": "Writing và Speaking sẽ chưa có band cho tới khi được chấm.",
    "Reading and Listening conversions are approximate; Writing and Speaking bands must come from a later review rather than self-invention.": "Band quy đổi của Reading và Listening chỉ mang tính gần đúng; band Writing và Speaking phải đến từ phần chấm sau đó, không được tự đặt.",
  };
  if (exact[text]) return exact[text];

  return text
    .replace(/^(\d+) days until August$/, "Còn $1 ngày đến tháng 8")
    .replace(/^(\d+\/\d+) required missions complete$/, "Đã hoàn thành $1 nhiệm vụ bắt buộc")
    .replace(/^(\d+) required missions complete$/, "Đã hoàn thành $1 nhiệm vụ bắt buộc")
    .replace(/^(\d+) overdue missions$/, "$1 nhiệm vụ quá hạn")
    .replace(/^(\d+) overdue mission\(s\) need recovery\.$/, "$1 nhiệm vụ quá hạn cần được học bù.")
    .replace(/^(\d+) mission\(s\) remain today\.$/, "Hôm nay còn $1 nhiệm vụ.")
    .replace(/^Today is complete\.$/, "Hôm nay đã hoàn thành.")
    .replace(/^Preparation is part of the plan\.$/, "Chuẩn bị cũng là một phần của kế hoạch.")
    .replace(/^Day (\d+): /, "Ngày $1: ")
    .replace(/^Day (\d+) · /, "Ngày $1 · ")
    .replace(/^Week (\d+) · /, "Tuần $1 · ")
    .replace(/^(\d+)% complete$/, "Đã hoàn thành $1%")
    .replace(/^(\d+\/\d+) missions$/, "$1 nhiệm vụ")
    .replace(/^(\d+) missions$/, "$1 nhiệm vụ")
    .replace(/^(\d+) occurrence\(s\)$/, "$1 lần xuất hiện")
    .replace(/^Today (\d+\/\d+)$/, "Hôm nay $1")
    .replace(/^Starts 1 Aug$/, "Bắt đầu 1/8")
    .replace(/^Speaking (\d+)$/, "Speaking $1")
    .replace(/^(\d+) overdue$/, "$1 quá hạn")
    .replace(/^Complete (Writing|Speaking|Reading|Listening) diagnostic$/, "Hoàn thành bài đầu vào $1")
    .replace(/^Target ([\d.]+) overall · Writing ([\d.]+) in August · expected test (.+)$/, "Mục tiêu Overall $1 · Writing $2 trong tháng 8 · dự kiến thi $3")
    .replace(/^(\d+) min morning · (\d+) min evening · (\d+) min daily Speaking$/, "$1 phút buổi sáng · $2 phút buổi tối · $3 phút Speaking hằng ngày")
    .replace(/^(Writing|Speaking|Reading|Listening) is the lowest measured skill\.$/, "$1 hiện là kỹ năng có mức đo thấp nhất.")
    .replace(/^(\d+)\/4 diagnostic results saved\.$/, "Đã lưu $1/4 kết quả đầu vào.")
    .replace(/^(\d+) words saved$/, "Đã lưu $1 từ")
    .replace(/^(low|medium|high) confidence$/, (_, level) => confidenceLabel(level))
    .replace(/^(Task|Coherence|Vocabulary|Grammar) · (high|medium|low)$/, (_, category, level) => `${errorCategoryLabel(category)} · ${severityLabel(level)}`)
    .replace(/^(Task 1|Task 2|Both) rewrite$/, (_, task) => `Viết lại ${rewriteTaskLabel(task)}`)
    .replace(/^Adaptive mission · due (.+)$/, "Nhiệm vụ thích ứng · hạn $1")
    .replace(/^Required rewrite · within (\d+) hours$/, "Bài viết lại bắt buộc · trong vòng $1 giờ")
    .replace(/^(\d+) words · (\d+) minutes$/, "$1 từ · $2 phút")
    .replace(/^Writing baseline reviewed: estimated band ([\d.]+)\.$/, "Đã chấm đầu vào Writing: band ước tính $1.")
    .replace(/^(Writing|Speaking|Reading|Listening) baseline saved\.$/, "Đã lưu đầu vào $1.")
    .replace(/^Due (.+)\. Feedback is not complete until you produce a corrected version\.$/, "Hạn $1. Phần chữa bài chỉ hoàn tất khi bạn nộp phiên bản đã sửa.")
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

translateIeltsDom(document.querySelector("#ielts-modal") || document);
translateIeltsDom(document.querySelector("#project-list") || document);

const observer = new MutationObserver(() => {
  translateIeltsDom(document.querySelector("#ielts-modal") || document);
  translateIeltsDom(document.querySelector("#project-list") || document);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
