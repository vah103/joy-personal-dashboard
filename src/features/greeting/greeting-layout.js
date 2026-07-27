(() => {
  const greeting = document.querySelector("#greeting");
  if (!greeting) return;

  function formatGreeting() {
    if (greeting.querySelector(".greeting-daypart")) return;

    const match = greeting.textContent
      .trim()
      .match(/^(Good\s+(?:morning|afternoon|evening),)\s+(Vanh\.)$/i);

    if (!match) return;

    const daypart = document.createElement("span");
    daypart.className = "greeting-daypart";

    const name = document.createElement("span");
    name.className = "greeting-name";

    const animatedWords = [...greeting.querySelectorAll(":scope > .joy-motion-word")];
    if (animatedWords.length === 3) {
      daypart.append(
        animatedWords[0],
        document.createTextNode(" "),
        animatedWords[1],
      );
      name.append(animatedWords[2]);
    } else {
      daypart.textContent = match[1];
      name.textContent = match[2];
    }

    greeting.replaceChildren(daypart, document.createTextNode(" "), name);
  }

  formatGreeting();

  const observer = new MutationObserver(formatGreeting);
  observer.observe(greeting, {
    childList: true,
    characterData: true,
    subtree: true,
  });
})();

(() => {
  const card = document.querySelector(".joy-brief");
  const message = card?.querySelector(".joy-message");
  const briefTitle = document.querySelector("#brief-title");
  const briefCopy = document.querySelector("#brief-copy");
  if (!card || !message || !briefTitle || !briefCopy) return;

  const ROTATION_MS = 9000;
  const REFRESH_MS = 15 * 60 * 1000;
  const state = {
    stories: [],
    index: 0,
    timer: null,
    paused: false,
    loaded: false,
  };

  const overview = document.createElement("div");
  overview.className = "daily-brief-slide daily-brief-overview is-active";
  overview.dataset.slideType = "overview";
  overview.append(briefTitle, briefCopy);

  const storySlide = document.createElement("div");
  storySlide.className = "daily-brief-slide daily-brief-story-slide";
  storySlide.dataset.slideType = "story";
  storySlide.hidden = true;
  storySlide.innerHTML = `
    <div class="daily-brief-meta">
      <span class="daily-brief-tag" data-brief-tag>DAILY BRIEF</span>
      <span class="daily-brief-source" data-brief-source></span>
    </div>
    <button class="daily-brief-headline" type="button" data-brief-open></button>
    <p class="daily-brief-summary" data-brief-summary></p>
  `;

  const status = document.createElement("p");
  status.className = "daily-brief-status";
  status.textContent = "Checking important updates…";

  const slideStack = document.createElement("div");
  slideStack.className = "daily-brief-stack";
  slideStack.append(overview, storySlide, status);
  message.replaceChildren(slideStack);

  const controls = document.createElement("div");
  controls.className = "daily-brief-controls";
  controls.innerHTML = `
    <button type="button" class="daily-brief-arrow" data-brief-prev aria-label="Previous update">‹</button>
    <span class="daily-brief-counter" data-brief-counter>1/1</span>
    <button type="button" class="daily-brief-arrow" data-brief-next aria-label="Next update">›</button>
  `;
  card.append(controls);

  const progress = document.createElement("span");
  progress.className = "daily-brief-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = "<i></i>";
  card.append(progress);

  const drawer = createDrawer();
  const tag = storySlide.querySelector("[data-brief-tag]");
  const source = storySlide.querySelector("[data-brief-source]");
  const headline = storySlide.querySelector("[data-brief-open]");
  const summary = storySlide.querySelector("[data-brief-summary]");
  const counter = controls.querySelector("[data-brief-counter]");
  const progressFill = progress.querySelector("i");

  card.classList.add("daily-brief-enabled");

  function createDrawer() {
    const backdrop = document.createElement("div");
    backdrop.className = "daily-brief-drawer-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <aside class="daily-brief-drawer" role="dialog" aria-modal="true" aria-labelledby="daily-brief-drawer-title">
        <div class="daily-brief-drawer-heading">
          <div>
            <p>JOY DAILY BRIEF</p>
            <h2 id="daily-brief-drawer-title"></h2>
          </div>
          <button type="button" data-brief-close aria-label="Close daily brief">×</button>
        </div>
        <div class="daily-brief-drawer-body">
          <section>
            <h3>What happened</h3>
            <p data-drawer-summary></p>
          </section>
          <section>
            <h3>Why it matters</h3>
            <p data-drawer-why></p>
          </section>
          <section data-drawer-points-section hidden>
            <h3>Key details</h3>
            <ul data-drawer-points></ul>
          </section>
          <div class="daily-brief-drawer-footer">
            <span data-drawer-source></span>
            <a data-drawer-link target="_blank" rel="noopener noreferrer">Read original article ↗</a>
          </div>
        </div>
      </aside>
    `;
    document.body.append(backdrop);
    return backdrop;
  }

  function totalSlides() {
    return 1 + state.stories.length;
  }

  function activeStory() {
    if (state.index === 0) return null;
    return state.stories[state.index - 1] || null;
  }

  function renderSlide({ restart = true } = {}) {
    const story = activeStory();
    const isOverview = !story;

    overview.hidden = !isOverview;
    overview.classList.toggle("is-active", isOverview);
    storySlide.hidden = isOverview;
    storySlide.classList.toggle("is-active", !isOverview);
    card.classList.toggle("showing-news", !isOverview);

    if (story) {
      tag.textContent = `${story.category || "NEWS"} · ${story.scope || "WORLD"}`;
      tag.dataset.category = String(story.category || "GENERAL").toLowerCase();
      source.textContent = `${story.sourceName || "Trusted source"} · ${relativeTime(story.publishedAt)}`;
      headline.textContent = story.title || "Important update";
      summary.textContent = story.summary || "Open to read Joy's summary.";
      headline.dataset.storyId = story.id || "";
    }

    counter.textContent = `${state.index + 1}/${totalSlides()}`;
    controls.hidden = totalSlides() <= 1;
    progress.hidden = totalSlides() <= 1;
    if (restart) restartRotation();
  }

  function relativeTime(value) {
    const timestamp = Number(value || 0);
    if (!timestamp) return "recent";
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  function goTo(index) {
    const total = totalSlides();
    state.index = ((index % total) + total) % total;
    renderSlide();
  }

  function restartRotation() {
    window.clearTimeout(state.timer);
    progressFill.classList.remove("is-running");
    void progressFill.offsetWidth;
    if (state.paused || totalSlides() <= 1) return;
    progressFill.style.setProperty("--daily-brief-duration", `${ROTATION_MS}ms`);
    progressFill.classList.add("is-running");
    state.timer = window.setTimeout(() => goTo(state.index + 1), ROTATION_MS);
  }

  function pauseRotation() {
    state.paused = true;
    window.clearTimeout(state.timer);
    progressFill.classList.remove("is-running");
  }

  function resumeRotation() {
    state.paused = false;
    restartRotation();
  }

  async function loadStories({ silent = false } = {}) {
    if (!silent) {
      status.hidden = false;
      status.textContent = "Checking important updates…";
    }

    try {
      const response = await window.fetch("/api/daily-brief", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Daily Brief returned ${response.status}`);
      const payload = await response.json();
      const stories = Array.isArray(payload.stories) ? payload.stories : [];
      state.stories = stories.filter(validStory);
      state.loaded = true;
      if (state.index >= totalSlides()) state.index = 0;
      status.hidden = state.stories.length > 0;
      status.textContent = state.stories.length
        ? ""
        : "No major updates right now.";
      renderSlide();
    } catch (error) {
      console.warn("Joy Daily Brief could not load", error);
      state.loaded = true;
      status.hidden = false;
      status.textContent = "Daily Brief is temporarily unavailable.";
      controls.hidden = true;
      progress.hidden = true;
    }
  }

  function validStory(story) {
    return story
      && typeof story === "object"
      && String(story.title || "").trim()
      && String(story.articleUrl || "").startsWith("http")
      && Number(story.expiresAt || 0) > Date.now();
  }

  function openDrawer(story) {
    if (!story) return;
    drawer.querySelector("#daily-brief-drawer-title").textContent = story.title || "Important update";
    drawer.querySelector("[data-drawer-summary]").textContent = story.summary || "No summary available.";
    drawer.querySelector("[data-drawer-why]").textContent = story.whyItMatters || "Joy marked this as a notable development.";
    drawer.querySelector("[data-drawer-source]").textContent = `${story.sourceName || "Source"} · ${relativeTime(story.publishedAt)} ago`;
    const link = drawer.querySelector("[data-drawer-link]");
    link.href = story.articleUrl;

    const points = Array.isArray(story.keyPoints) ? story.keyPoints.filter(Boolean).slice(0, 3) : [];
    const pointsSection = drawer.querySelector("[data-drawer-points-section]");
    const pointsList = drawer.querySelector("[data-drawer-points]");
    pointsSection.hidden = !points.length;
    pointsList.replaceChildren(...points.map((point) => {
      const item = document.createElement("li");
      item.textContent = point;
      return item;
    }));

    drawer.hidden = false;
    document.body.classList.add("daily-brief-drawer-open");
    pauseRotation();
    window.setTimeout(() => drawer.querySelector("[data-brief-close]")?.focus(), 0);
  }

  function closeDrawer() {
    drawer.hidden = true;
    document.body.classList.remove("daily-brief-drawer-open");
    headline.focus({ preventScroll: true });
    resumeRotation();
  }

  controls.querySelector("[data-brief-prev]").addEventListener("click", () => goTo(state.index - 1));
  controls.querySelector("[data-brief-next]").addEventListener("click", () => goTo(state.index + 1));
  headline.addEventListener("click", () => openDrawer(activeStory()));
  drawer.querySelector("[data-brief-close]").addEventListener("click", closeDrawer);
  drawer.addEventListener("mousedown", (event) => {
    if (event.target === drawer) closeDrawer();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !drawer.hidden) closeDrawer();
  });
  card.addEventListener("mouseenter", pauseRotation);
  card.addEventListener("mouseleave", resumeRotation);
  card.addEventListener("focusin", pauseRotation);
  card.addEventListener("focusout", (event) => {
    if (!card.contains(event.relatedTarget)) resumeRotation();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      loadStories({ silent: true });
      resumeRotation();
    } else {
      pauseRotation();
    }
  });

  renderSlide({ restart: false });
  loadStories();
  window.setInterval(() => loadStories({ silent: true }), REFRESH_MS);
})();
