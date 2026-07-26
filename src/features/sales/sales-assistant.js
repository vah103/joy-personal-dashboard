const ASSISTANT_HTML = `
  <div class="modal-backdrop sales-assistant-backdrop" id="sales-assistant-modal" role="presentation" hidden>
    <section class="modal sales-assistant-modal" role="dialog" aria-modal="true" aria-labelledby="sales-assistant-title">
      <div class="modal-heading sales-assistant-heading">
        <div>
          <p class="section-kicker">Sale Assistant</p>
          <h2 id="sales-assistant-title">Room summary</h2>
          <span>Paste room information, review it, then take a screenshot for the customer.</span>
        </div>
        <button type="button" aria-label="Close Room Summary Assistant" data-action="close-sales-assistant">×</button>
      </div>

      <div class="sale-room-workspace sales-assistant-workspace">
        <div class="sale-room-composer">
          <label for="room-summary-input">Source room information</label>
          <textarea id="room-summary-input" maxlength="12000" spellcheck="false" placeholder="Example: 180 Phú Mỹ còn phòng 302 giá 4tr2, vào luôn. Full nội thất, thang máy. Điện 4k, nước 100k/người, wifi 100k, xe 100k. Cọc 1 tháng..."></textarea>
          <p>Phone numbers, source names, links and commission details are removed.</p>
          <div class="sale-room-actions">
            <button class="secondary-button" id="room-summary-clear" type="button">Clear</button>
            <button class="primary-button" id="room-summary-generate" type="button">Create summary</button>
          </div>
        </div>

        <div class="sale-room-preview">
          <div class="sale-room-preview-heading">
            <div><small>Customer view</small><strong>Ready to screenshot</strong></div>
            <button class="secondary-button" id="room-summary-capture-button" type="button" disabled>Screenshot view</button>
          </div>
          <article class="room-share-card is-empty" id="room-summary-card" aria-live="polite"></article>
          <p class="sale-room-edit-note">Tap any generated text to correct it before taking a screenshot.</p>
        </div>
      </div>
    </section>
  </div>

  <div class="sale-room-capture" id="room-summary-capture" hidden aria-label="Room summary screenshot view">
    <div class="sale-room-capture-card" id="room-summary-capture-card"></div>
  </div>
`;

function createAssistantLaunchers() {
  const salesPanel = document.querySelector("#sales");
  const heading = salesPanel?.querySelector(".panel-heading");
  const salesBody = salesPanel?.querySelector(".sales-body");
  const salesSummary = salesPanel?.querySelector(".sales-summary");
  if (!salesPanel || !heading || !salesBody || !salesSummary) return false;

  const manageButton = heading.querySelector('[data-action="open-sale-manager"]:last-child');
  if (manageButton && !heading.querySelector(".sales-heading-actions")) {
    const actions = document.createElement("div");
    actions.className = "sales-heading-actions";

    const assistantButton = document.createElement("button");
    assistantButton.type = "button";
    assistantButton.className = "quiet-link sales-assistant-heading-button";
    assistantButton.dataset.action = "open-sales-assistant";
    assistantButton.textContent = "Assistant";

    manageButton.before(actions);
    actions.append(assistantButton, manageButton);
  }

  if (!salesBody.querySelector(".sales-assistant-launch")) {
    const launch = document.createElement("button");
    launch.type = "button";
    launch.className = "sales-assistant-launch";
    launch.dataset.action = "open-sales-assistant";

    const icon = document.createElement("span");
    icon.className = "sales-assistant-launch-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✦";

    const copy = document.createElement("span");
    copy.className = "sales-assistant-launch-copy";
    const title = document.createElement("strong");
    title.textContent = "Room Summary Assistant";
    const detail = document.createElement("small");
    detail.textContent = "Paste a room listing → get a clean screenshot";
    copy.append(title, detail);

    const arrow = document.createElement("span");
    arrow.className = "sales-assistant-launch-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";

    launch.append(icon, copy, arrow);
    salesSummary.after(launch);
  }

  return true;
}

function createAssistantModal() {
  if (document.querySelector("#sales-assistant-modal")) return;
  document.body.insertAdjacentHTML("beforeend", ASSISTANT_HTML);
}

function visibleModalExists() {
  return [...document.querySelectorAll(".modal-backdrop")]
    .some((modal) => !modal.hidden);
}

function openAssistant() {
  const modal = document.querySelector("#sales-assistant-modal");
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  window.setTimeout(() => document.querySelector("#room-summary-input")?.focus(), 0);
}

function closeAssistant() {
  const modal = document.querySelector("#sales-assistant-modal");
  if (!modal) return;
  modal.hidden = true;
  if (!visibleModalExists()) document.body.classList.remove("modal-open");
}

async function initializeSalesAssistant() {
  if (!createAssistantLaunchers()) return;
  createAssistantModal();

  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-action]");
    if (!control) return;
    if (control.dataset.action === "open-sales-assistant") openAssistant();
    if (control.dataset.action === "close-sales-assistant") closeAssistant();
  });

  document.querySelector("#sales-assistant-modal")?.addEventListener("mousedown", (event) => {
    if (event.target.id === "sales-assistant-modal") closeAssistant();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.querySelector("#sales-assistant-modal")?.hidden) {
      closeAssistant();
    }
  });

  await import("./room-summary.js?v=joy-room-summary-v1");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSalesAssistant, { once: true });
} else {
  initializeSalesAssistant();
}
