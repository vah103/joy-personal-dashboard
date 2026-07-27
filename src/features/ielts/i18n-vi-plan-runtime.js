function localizeIeltsPlan(plan) {
  const clone = JSON.parse(JSON.stringify(plan || {}));
  clone.title = PLAN_VI.title;
  clone.primaryGoal = PLAN_VI.primaryGoal;

  if (clone.learnerProfile) {
    clone.learnerProfile.preferences = PLAN_VI.preferences;
    clone.learnerProfile.knownSpeakingContext = PLAN_VI.knownSpeakingContext;
  }

  clone.prelaunch = (clone.prelaunch || []).map((item) => ({
    ...item,
    title: PLAN_VI.prelaunch[item.id] || item.title,
  }));

  clone.weeks = (clone.weeks || []).map((week) => ({
    ...week,
    ...(PLAN_VI.weeks[week.id] || {}),
  }));

  clone.days = (clone.days || []).map((day) => {
    const localized = DAYS_VI[day.date];
    if (!localized) {
      return {
        ...day,
        weekday: WEEKDAY_LABEL[day.weekday] || day.weekday,
      };
    }
    return {
      ...day,
      weekday: WEEKDAY_LABEL[day.weekday] || day.weekday,
      theme: localized.theme || day.theme,
      milestone: localized.milestone || day.milestone,
      tasks: (day.tasks || []).map((task, index) => {
        const translated = localized.tasks?.[index];
        if (!translated) return task;
        return [task[0], task[1], translated[0], task[3], translated[1], task[5], task[6]];
      }),
    };
  });

  return clone;
}

function sessionLabel(value) { return SESSION_LABEL[value] || value; }
function evidenceLabel(value) { return EVIDENCE_LABEL[value] || String(value || "").replaceAll("_", " "); }
function confidenceLabel(value) { return CONFIDENCE_LABEL[value] || value; }
function severityLabel(value) { return SEVERITY_LABEL[value] || value; }
function errorCategoryLabel(value) { return ERROR_CATEGORY_LABEL[value] || value; }
function rewriteTaskLabel(value) { return value === "Both" ? "Cả Task 1 và Task 2" : value; }

Object.assign(LABEL, { writing: "Viết", speaking: "Nói", reading: "Đọc", listening: "Nghe", review: "Ôn tập" });
Object.assign(STATUS, {
  pending: "Chưa bắt đầu",
  progress: "Đang làm",
  completed: "Đã hoàn thành",
  "completed-minimum": "Ngày tối thiểu",
  overdue: "Quá hạn",
  recovery: "Cần học bù",
});
