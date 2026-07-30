(() => {
  const asset = "daily-brief.css?v=joy-daily-brief-v5";
  if (document.querySelector(`link[rel="stylesheet"][href="${asset}"]`)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = asset;
  link.dataset.dailyBriefStyles = "canonical";
  document.head.append(link);
})();
