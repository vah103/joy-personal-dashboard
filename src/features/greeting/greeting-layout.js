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
      daypart.append(animatedWords[0], document.createTextNode(" "), animatedWords[1]);
      name.append(animatedWords[2]);
    } else {
      daypart.textContent = match[1];
      name.textContent = match[2];
    }

    greeting.replaceChildren(daypart, document.createTextNode(" "), name);
  }

  formatGreeting();
  new MutationObserver(formatGreeting).observe(greeting, {
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

  const ROTATION_MS = 20_000;
  const REFRESH_MS = 15 * 60 * 1000;
  const TRANSITION_MS = 220;
  const state = {
    stories: [],
    index: 0,
    timer: null,
    paused: false,
    loaded: false,
    transitioning: false,
  };

  installStyles();

  const sourceState = document.createElement("div");
  sourceState.className = "daily-brief-source-state";
  sourceState.hidden = true;
  sourceState.append(briefTitle, briefCopy);

  const storySlide = document.createElement("div");
  storySlide.className = "daily-brief-slide daily-brief-story-slide is-active";
  storySlide.innerHTML = `
    <div class="daily-brief-meta">
      <span class="daily-brief-tag" data-brief-tag>DAILY BRIEF</span>
      <span class="daily-brief-source" data-brief-source></span>
    </div>
    <button class="daily-brief-headline" type="button" data-brief-open></button>
    <p class="daily-brief-summary" data-brief-summary></p>
  `;

  const emptySlide = document.createElement("div");
  emptySlide.className = "daily-brief-empty";
  emptySlide.hidden = true;
  emptySlide.innerHTML = `
    <span>JOY DAILY BRIEF</span>
    <strong data-brief-empty-title>Checking important updates…</strong>
    <p data-brief-empty-copy>Joy only shows news that is important enough to interrupt your day.</p>
  `;

  const slideStack = document.createElement("div");
  slideStack.className = "daily-brief-stack";
  slideStack.append(storySlide, emptySlide);

  const personalStatus = document.createElement("p");
  personalStatus.className = "daily-brief-personal";
  personalStatus.hidden = true;
  message.replaceChildren(sourceState, slideStack, personalStatus);

  const controls = document.createElement("div");
  controls.className = "daily-brief-controls";
  controls.innerHTML = `
    <button type="button" class="daily-brief-arrow" data-brief-next aria-label="Next update">›</button>
  `;
  card.append(controls);

  const drawer = createDrawer();
  const tag = storySlide.querySelector("[data-brief-tag]");
  const source = storySlide.querySelector("[data-brief-source]");
  const headline = storySlide.querySelector("[data-brief-open]");
  const summary = storySlide.querySelector("[data-brief-summary]");
  const emptyTitle = emptySlide.querySelector("[data-brief-empty-title]");
  const emptyCopy = emptySlide.querySelector("[data-brief-empty-copy]");

  card.classList.add("daily-brief-enabled", "daily-brief-news-first");
  renderPersonalStatus();

  new MutationObserver(renderPersonalStatus).observe(briefCopy, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  function installStyles() {
    if (document.querySelector("#joy-daily-brief-v4-styles")) return;
    const style = document.createElement("style");
    style.id = "joy-daily-brief-v4-styles";
    style.textContent = `
      .joy-brief.daily-brief-news-first {
        min-height: 112px;
        grid-template-columns: auto minmax(0, 1fr) 18px;
        gap: 10px;
      }
      .daily-brief-news-first .joy-message {
        min-height: 78px;
        padding-bottom: 6px;
      }
      .daily-brief-news-first .daily-brief-stack {
        min-height: 76px;
        display: block;
        overflow: hidden;
      }
      .daily-brief-news-first .daily-brief-story-slide {
        position: relative;
        opacity: 1;
        transform: translateY(0);
        transition: opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease;
      }
      .daily-brief-news-first .daily-brief-story-slide.is-leaving {
        opacity: 0;
        transform: translateY(-18px);
      }
      .daily-brief-news-first .daily-brief-story-slide.is-entering {
        opacity: 0;
        transform: translateY(18px);
        transition: none;
      }
      .daily-brief-news-first .daily-brief-empty {
        min-height: 72px;
        display: grid;
        align-content: center;
      }
      .daily-brief-news-first .daily-brief-empty[hidden] { display: none !important; }
      .daily-brief-empty span {
        color: #4c6d78;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: .1em;
      }
      .daily-brief-empty strong {
        margin-top: 4px;
        color: #334248;
        font-size: 12.5px;
      }
      .daily-brief-empty p {
        margin: 3px 0 0;
        color: #6f797e;
        font-size: 9.5px;
      }
      .daily-brief-personal {
        position: absolute;
        left: 0;
        right: 0;
        bottom: -1px;
        min-height: 0;
        margin: 0;
        padding: 0;
        overflow: hidden;
        border: 0;
        color: rgba(91, 105, 111, .36);
        font-size: 6.25px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: .005em;
        text-overflow: ellipsis;
        white-space: nowrap;
        pointer-events: none;
      }
      .daily-brief-news-first .daily-brief-controls {
        width: 18px;
        justify-content: center;
        gap: 0;
        opacity: .62;
      }
      .daily-brief-news-first .daily-brief-arrow {
        width: 18px;
        height: 18px;
        min-width: 18px;
        padding: 0;
        font-size: 14px;
      }
      .daily-brief-progress,
      .daily-brief-counter { display: none !important; }
      @media (max-width: 760px) {
        .joy-brief.daily-brief-news-first {
          min-height: 108px;
          grid-template-columns: auto minmax(0, 1fr) 16px;
          gap: 8px;
        }
        .daily-brief-news-first .daily-brief-arrow {
          width: 16px;
          min-width: 16px;
          height: 18px;
        }
        .daily-brief-personal { font-size: 6px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .daily-brief-news-first .daily-brief-story-slide { transition: none !important; }
      }
    `;
    document.head.append(style);
  }

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

  function renderPersonalStatus() {
    const text = briefCopy.textContent.replace(/\s+/g, " ").trim();
    const items = [];
    const viewingMatch = text.match(/(\d+)\s+upcoming\s+viewings?/i);
    const taskMatch = text.match(/(\d+)\s+open\s+tasks?/i);
    const emailMatch = text.match(/(\d+)\s+new\s+emails?/i);
    const viewings = Number(viewingMatch?.[1] || 0);
    const tasks = Number(taskMatch?.[1] || 0);
    const emails = Number(emailMatch?.[1] || 0);

    if (viewings > 0) items.push(`${viewings} viewing${viewings === 1 ? "" : "s"}`);
    if (tasks > 0) items.push(`${tasks} task${tasks === 1 ? "" : "s"}`);
    if (emails > 0) items.push(`${emails} new email${emails === 1 ? "" : "s"}`);

    personalStatus.hidden = items.length === 0;
    personalStatus.textContent = items.length ? `Hey Joy! · ${items.join(" · ")}` : "";
  }

  function activeStory() {
    return state.stories[state.index] || null;
  }

  function populateStory(story) {
    if (!story) return;
    tag.textContent = `${story.category || "NEWS"} · ${story.scope || "WORLD"}`;
    tag.dataset.category = String(story.category || "GENERAL").toLowerCase();
    source.textContent = `${story.sourceName || "Trusted source"} · ${relativeTime(story.publishedAt)}`;
    headline.textContent = story.title || "Important update";
    summary.textContent = story.summary || "Open to read Joy's summary.";
    headline.dataset.storyId = story.id || "";
  }

  function renderCurrent({ animate = false, restart = true } = {}) {
    const story = activeStory();
    const hasStories = Boolean(story);
    storySlide.hidden = !hasStories;
    emptySlide.hidden = hasStories;
    card.classList.toggle("showing-news", hasStories);

    if (story) {
      if (animate) animateStoryChange(story);
      else populateStory(story);
    }

    controls.hidden = state.stories.length <= 1;
    if (restart) restartRotation();
  }

  function animateStoryChange(story) {
    if (state.transitioning) return;
    state.transitioning = true;
    storySlide.classList.add("is-leaving");

    window.setTimeout(() => {
      populateStory(story);
      storySlide.classList.remove("is-leaving");
      storySlide.classList.add("is-entering");
      void storySlide.offsetWidth;
      storySlide.classList.remove("is-entering");
      window.setTimeout(() => {
        state.transitioning = false;
      }, TRANSITION_MS);
    }, TRANSITION_MS);
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
    if (state.transitioning || state.stories.length <= 1) return;
    state.index = ((index % state.stories.length) + state.stories.length) % state.stories.length;
    renderCurrent({ animate: true });
  }

  function restartRotation() {
    window.clearTimeout(state.timer);
    if (state.paused || state.stories.length <= 1) return;
    state.timer = window.setTimeout(() => goTo(state.index + 1), ROTATION_MS);
  }

  function pauseRotation() {
    state.paused = true;
    window.clearTimeout(state.timer);
  }

  function resumeRotation() {
    state.paused = false;
    restartRotation();
  }

  async function loadStories({ silent = false } = {}) {
    if (!silent && !state.loaded) {
      storySlide.hidden = true;
      emptySlide.hidden = false;
      emptyTitle.textContent = "Checking important updates…";
      emptyCopy.textContent = "Joy only shows news that is important enough to interrupt your day.";
      controls.hidden = true;
    }

    try {
      const response = await window.fetch("/api/daily-brief", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Daily Brief returned ${response.status}`);
      const payload = await response.json();
      const currentId = activeStory()?.id;
      state.stories = (Array.isArray(payload.stories) ? payload.stories : []).filter(validStory);
      state.loaded = true;

      if (currentId) {
        const preservedIndex = state.stories.findIndex((story) => story.id === currentId);
        state.index = preservedIndex >= 0 ? preservedIndex : 0;
      } else if (state.index >= state.stories.length) {
        state.index = 0;
      }

      if (!state.stories.length) {
        emptyTitle.textContent = "No major updates right now.";
        emptyCopy.textContent = "Joy will add a story when it is genuinely important and worth your attention.";
      }
      renderCurrent();
    } catch (error) {
      console.warn("Joy Daily Brief could not load", error);
      state.loaded = true;
      state.stories = [];
      state.index = 0;
      storySlide.hidden = true;
      emptySlide.hidden = false;
      emptyTitle.textContent = "Daily Brief is temporarily unavailable.";
      emptyCopy.textContent = "Joy will try again automatically.";
      controls.hidden = true;
      window.clearTimeout(state.timer);
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
    drawer.querySelector("[data-drawer-link]").href = story.articleUrl;

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

  loadStories();
  window.setInterval(() => loadStories({ silent: true }), REFRESH_MS);
})();