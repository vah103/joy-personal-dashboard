(() => {
  const TURTLEBOT_ROADMAP_URL =
    "https://docs.google.com/document/d/16tNFhp4qvS8rlGTzL_8DQ_3fGJJoasrL1hJAQ16xPkk/edit?tab=t.jg1b8ko3m1np";

  const TURTLEBOT_LOG_URL =
    "https://docs.google.com/document/d/16tNFhp4qvS8rlGTzL_8DQ_3fGJJoasrL1hJAQ16xPkk/edit?tab=t.7feamk65cnlv";

  const PROJECTS = {
    turtlebot4: {
      title: "TurtleBot 4",
      subtitle: "Semantic exploration graduation project",
      status: "Stage 2 · Validation in progress",
      next: "Validate a fixed Nav2 goal set and record failures.",
      tabs: [
        ["overview", "Roadmap"],
        ["commands", "Important commands"],
        ["log", "Robot log"],
      ],
      roadmap: [
        ["complete", "1", "Platform and input data"],
        ["current", "2", "Localization and Nav2"],
        ["upcoming", "3", "Navigation benchmark"],
        ["upcoming", "4", "Simulation"],
        ["upcoming", "5", "Frontier exploration"],
        ["upcoming", "6", "RGB-D perception"],
        ["upcoming", "7", "Semantic mapping"],
        ["upcoming", "8", "Semantic-risk-aware exploration"],
        ["upcoming", "9", "Mission and evaluation"],
      ],
      commands: [
        {
          group: "Connection",
          title: "SSH into TurtleBot",
          code: "ssh ubuntu@10.11.103.148",
        },
        {
          group: "Status",
          title: "Check battery",
          code: "ros2 topic echo --once /bot1/battery_state",
        },
        {
          group: "LiDAR",
          title: "Start LiDAR motor",
          code: 'ros2 service call /bot1/start_motor std_srvs/srv/Empty "{}"',
        },
        {
          group: "SLAM",
          title: "Launch SLAM",
          code: "ros2 launch turtlebot4_navigation slam.launch.py namespace:=bot1",
        },
        {
          group: "SLAM",
          title: "Open navigation RViz",
          code: "ros2 launch turtlebot4_viz view_navigation.launch.py namespace:=bot1",
        },
        {
          group: "Map",
          title: "Save the lab map",
          code: String.raw`ros2 run nav2_map_server map_saver_cli \
  -f ~/maps/lab_2026_07_23 \
  --ros-args \
  -p map_subscribe_transient_local:=true \
  -r __ns:=/bot1`,
        },
        {
          group: "Localization",
          title: "Launch AMCL localization",
          code: String.raw`ros2 launch turtlebot4_navigation localization.launch.py \
  map:=/home/dell/maps/lab_2026_07_23.yaml \
  namespace:=/bot1`,
        },
        {
          group: "Navigation",
          title: "Launch Nav2",
          code: "ros2 launch turtlebot4_navigation nav2.launch.py namespace:=/bot1",
        },
        {
          group: "Recovery",
          title: "Restart navigation lifecycle",
          code: String.raw`ros2 service call /bot1/lifecycle_manager_navigation/manage_nodes \
  nav2_msgs/srv/ManageLifecycleNodes \
  "{command: 3}"

ros2 service call /bot1/lifecycle_manager_navigation/manage_nodes \
  nav2_msgs/srv/ManageLifecycleNodes \
  "{command: 0}"`,
        },
      ],
    },
  };

  let activeProjectKey = "";
  let activeTab = "";
  let lastTrigger = null;

  function projectKeyFromName(value) {
    const name = String(value || "").toLowerCase();

    if (name.includes("turtlebot") || name.includes("turtle bot")) {
      return "turtlebot4";
    }

    return "";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function externalLink(url, label, className = "project-detail-link") {
    return `<a
      class="${className}"
      href="${escapeHtml(url)}"
      target="_blank"
      rel="noopener noreferrer"
    >${escapeHtml(label)} ↗</a>`;
  }

  function createModal() {
    if (document.querySelector("#project-details-modal")) return;

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop project-details-backdrop";
    backdrop.id = "project-details-modal";
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section
        class="modal project-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-details-title"
      >
        <header class="project-details-heading">
          <div>
            <p class="section-kicker">Active Project</p>
            <h2 id="project-details-title"></h2>
            <p id="project-details-subtitle"></p>
          </div>

          <button
            class="project-details-close"
            type="button"
            aria-label="Close project details"
            data-project-detail-action="close"
          >×</button>
        </header>

        <div class="project-details-status">
          <span id="project-details-status"></span>
          <p id="project-details-next"></p>
        </div>

        <nav
          class="project-details-tabs"
          id="project-details-tabs"
          aria-label="Project detail sections"
        ></nav>

        <div
          class="project-details-content"
          id="project-details-content"
        ></div>
      </section>
    `;

    document.body.append(backdrop);
  }

  function elements() {
    return {
      modal: document.querySelector("#project-details-modal"),
      title: document.querySelector("#project-details-title"),
      subtitle: document.querySelector("#project-details-subtitle"),
      status: document.querySelector("#project-details-status"),
      next: document.querySelector("#project-details-next"),
      tabs: document.querySelector("#project-details-tabs"),
      content: document.querySelector("#project-details-content"),
      close: document.querySelector(
        "[data-project-detail-action='close']",
      ),
    };
  }

  function renderTabs(project) {
    const ui = elements();

    ui.tabs.innerHTML = project.tabs
      .map(([key, label]) => `
        <button
          type="button"
          class="${key === activeTab ? "active" : ""}"
          aria-selected="${key === activeTab}"
          data-project-detail-action="tab"
          data-tab="${escapeHtml(key)}"
        >${escapeHtml(label)}</button>
      `)
      .join("");
  }

  function renderTurtleBotOverview() {
    const project = PROJECTS.turtlebot4;

    return `
      <div class="project-detail-hero turtlebot-hero">
        <div class="turtlebot-visual">
          <img
            src="turtlebot4-art.webp?v=turtlebot-integrated-v3"
            alt="Stylised illustration of a TurtleBot 4 mobile robot"
          >
        </div>

        <div class="project-detail-hero-copy">
          <p class="project-detail-label">Current milestone</p>
          <h3>Validate the Nav2 baseline</h3>
          <p>
            SLAM, map saving, AMCL localization and navigation have
            all worked on the real robot. The next step is to make
            navigation measurable and repeatable.
          </p>

          <div class="project-detail-checks">
            <span>✓ SLAM</span>
            <span>✓ Localization</span>
            <span>✓ Navigation</span>
            <span class="current">◐ Nav2 validation</span>
          </div>
        </div>
      </div>

      <section class="project-detail-section">
        <div class="project-detail-section-heading">
          <div>
            <p class="project-detail-label">17–20 week plan</p>
            <h3>Project roadmap</h3>
          </div>
          ${externalLink(TURTLEBOT_ROADMAP_URL, "Open full roadmap")}
        </div>

        <div class="roadmap-list">
          ${project.roadmap
            .map(([state, number, title]) => `
              <article class="roadmap-item ${state}">
                <span class="roadmap-marker">
                  ${state === "complete" ? "✓" : state === "current" ? "◐" : number}
                </span>
                <div>
                  <small>Stage ${escapeHtml(number)}</small>
                  <strong>${escapeHtml(title)}</strong>
                </div>
                <em>
                  ${state === "complete"
                    ? "Complete"
                    : state === "current"
                      ? "In progress"
                      : "Upcoming"}
                </em>
              </article>
            `)
            .join("")}
        </div>
      </section>

      <section class="current-stage-card">
        <div>
          <p class="project-detail-label">Stage 2 completion check</p>
          <h3>Localization and Nav2</h3>
        </div>

        <ul>
          <li>Load the saved lab map and set the initial pose.</li>
          <li>Confirm that LaserScan remains aligned with the walls.</li>
          <li>Complete at least three consecutive safe goals.</li>
          <li>Record planning, controller and recovery failures.</li>
        </ul>

        <p class="project-location-note">
          <strong>At home:</strong> prepare launch files, goal sets and
          logging tools. <strong>At the lab:</strong> run goals and collect
          robot data.
        </p>
      </section>
    `;
  }

  function renderTurtleBotCommands() {
    const commands = PROJECTS.turtlebot4.commands;

    return `
      <section class="project-detail-section">
        <div class="project-detail-section-heading">
          <div>
            <p class="project-detail-label">Quick reference</p>
            <h3>Important ROS 2 commands</h3>
          </div>
          ${externalLink(TURTLEBOT_LOG_URL, "Open original log")}
        </div>

        <p class="project-detail-intro">
          These are the commands that were actually used during the
          23/07 robot session. Copy one command at a time.
        </p>

        <div class="command-list">
          ${commands
            .map((command, index) => `
              <article class="command-card">
                <div class="command-heading">
                  <div>
                    <small>${escapeHtml(command.group)}</small>
                    <strong>${escapeHtml(command.title)}</strong>
                  </div>

                  <button
                    type="button"
                    data-project-detail-action="copy-command"
                    data-command-index="${index}"
                  >Copy</button>
                </div>

                <pre><code>${escapeHtml(command.code)}</code></pre>
              </article>
            `)
            .join("")}
        </div>
      </section>
    `;
  }

  function renderTurtleBotLog() {
    return `
      <section class="project-detail-section">
        <div class="project-detail-section-heading">
          <div>
            <p class="project-detail-label">Daily robot notebook</p>
            <h3>Robot log</h3>
          </div>
          ${externalLink(TURTLEBOT_LOG_URL, "Open full entry")}
        </div>

        <article class="robot-log-entry">
          <header>
            <div>
              <time datetime="2026-07-23">23/07/2026</time>
              <h3>SLAM, Localization and Navigation</h3>
            </div>
            <span>Successful</span>
          </header>

          <div class="robot-log-summary">
            <p>
              Connected to TurtleBot 4, restored the LiDAR motor,
              created and saved a lab map, localized with AMCL and
              navigated successfully to multiple goals.
            </p>
          </div>

          <div class="robot-log-columns">
            <section>
              <h4>Completed</h4>
              <ul class="success-list">
                <li>SSH and ROS 2 connection confirmed.</li>
                <li>LiDAR restored at approximately 7.58 Hz.</li>
                <li>Map saved as YAML and PGM.</li>
                <li>AMCL localization confirmed.</li>
                <li>Nav2 lifecycle activated.</li>
                <li>Multiple navigation goals succeeded.</li>
              </ul>
            </section>

            <section>
              <h4>Issues and follow-up</h4>
              <ul class="issue-list">
                <li>One navigation goal returned status 6.</li>
                <li>Camera, mouse and joystick diagnostics need review.</li>
                <li>Automatic docking was not yet verified.</li>
                <li>Build a fixed goal set for repeatable testing.</li>
              </ul>
            </section>
          </div>
        </article>
      </section>
    `;
  }

  function renderContent() {
    const ui = elements();

    if (activeProjectKey === "turtlebot4") {
      if (activeTab === "commands") {
        ui.content.innerHTML = renderTurtleBotCommands();
      } else if (activeTab === "log") {
        ui.content.innerHTML = renderTurtleBotLog();
      } else {
        ui.content.innerHTML = renderTurtleBotOverview();
      }
      return;
    }

    ui.content.innerHTML = "";
  }

  function renderProject() {
    const project = PROJECTS[activeProjectKey];
    const ui = elements();

    ui.title.textContent = project.title;
    ui.subtitle.textContent = project.subtitle;
    ui.status.textContent = project.status;
    ui.next.textContent = `Next: ${project.next}`;

    renderTabs(project);
    renderContent();
  }

  function openProject(key, trigger) {
    const project = PROJECTS[key];
    if (!project) return;

    const ui = elements();

    activeProjectKey = key;
    activeTab = project.tabs[0][0];
    lastTrigger = trigger || null;

    renderProject();

    ui.modal.hidden = false;
    document.body.classList.add("modal-open");

    window.setTimeout(() => {
      ui.close?.focus();
    }, 0);
  }

  function closeProject() {
    const ui = elements();

    ui.modal.hidden = true;
    activeProjectKey = "";
    activeTab = "";

    const anotherModalOpen = [
      ...document.querySelectorAll(".modal-backdrop"),
    ].some((modal) => modal !== ui.modal && !modal.hidden);

    if (!anotherModalOpen) {
      document.body.classList.remove("modal-open");
    }

    lastTrigger?.focus?.();
    lastTrigger = null;
  }

  function switchTab(tab) {
    const project = PROJECTS[activeProjectKey];

    if (!project?.tabs.some(([key]) => key === tab)) return;

    activeTab = tab;
    renderTabs(project);
    renderContent();

    elements().content.scrollTop = 0;
  }

  async function copyCommand(index, button) {
    const command = PROJECTS.turtlebot4.commands[index];
    if (!command) return;

    try {
      await navigator.clipboard.writeText(command.code);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = command.code;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    const oldText = button.textContent;
    button.textContent = "Copied";

    window.setTimeout(() => {
      button.textContent = oldText;
    }, 1400);
  }

  function enhanceProjectCards() {
    document.querySelectorAll(".project-card").forEach((card) => {
      const name =
        card.querySelector(".project-top strong")?.textContent
        || card.querySelector("strong")?.textContent
        || "";

      const key = projectKeyFromName(name);
      if (!key || key === "turtlebot4") return;

      card.dataset.projectDetailKey = key;
      card.classList.add("project-card-has-details");
      card.tabIndex = 0;
      card.setAttribute("aria-haspopup", "dialog");

      if (key === "turtlebot4") {
        card.classList.add("project-card-turtlebot");

        if (!card.querySelector(".turtlebot-card-visual")) {
          const visual = document.createElement("span");
          visual.className = "turtlebot-card-visual";
          visual.setAttribute("aria-hidden", "true");

          const image = document.createElement("img");
          image.src = "turtlebot4-art.webp?v=turtlebot-integrated-v3";
          image.alt = "";
          image.loading = "lazy";
          image.decoding = "async";

          visual.append(image);
          card.prepend(visual);
        }
      }

      card.setAttribute(
        "aria-label",
        `Open ${PROJECTS[key].title} project details`,
      );
    });
  }

  document.addEventListener("click", (event) => {
    const actionControl = event.target.closest(
      "[data-project-detail-action]",
    );

    if (actionControl) {
      const action = actionControl.dataset.projectDetailAction;

      if (action === "close") {
        closeProject();
      }

      if (action === "tab") {
        switchTab(actionControl.dataset.tab || "");
      }

      if (action === "copy-command") {
        copyCommand(
          Number(actionControl.dataset.commandIndex),
          actionControl,
        );
      }

      return;
    }

    const card = event.target.closest(".project-card");
    if (!card) return;

    if (
      event.target.closest(
        "button, a, input, textarea, select, [role='button']",
      )
    ) {
      return;
    }

    const key =
      card.dataset.projectDetailKey
      || projectKeyFromName(
        card.querySelector(".project-top strong")?.textContent,
      );

    if (key && key !== "turtlebot4") {
      openProject(key, card);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const modal = document.querySelector("#project-details-modal");
      if (modal && !modal.hidden) {
        closeProject();
      }
      return;
    }

    if (!["Enter", " "].includes(event.key)) return;

    const card = event.target.closest(".project-card-has-details");
    if (!card || event.target !== card) return;

    const key = card.dataset.projectDetailKey;
    if (!key || key === "turtlebot4") return;

    event.preventDefault();
    openProject(key, card);
  });

  document.addEventListener("mousedown", (event) => {
    const modal = document.querySelector("#project-details-modal");

    if (event.target === modal) {
      closeProject();
    }
  });

  createModal();
  enhanceProjectCards();

  const projectList = document.querySelector("#project-list");

  if (projectList) {
    new MutationObserver(enhanceProjectCards).observe(projectList, {
      childList: true,
      subtree: true,
    });
  }
})();
