const ROOM_SUMMARY_AI_ENDPOINT = "/api/sales/room-summary/analyze";
const ROOM_SUMMARY_MODULE = "/room-summary.js?v=joy-room-summary-v1";

const SERVICE_LABEL_KEYS = Object.freeze({
  electricity: "cleanup.sale.serviceElectricity",
  water: "cleanup.sale.serviceWater",
  internet: "cleanup.sale.serviceInternet",
  common: "cleanup.sale.serviceCommon",
  parking: "cleanup.sale.serviceParking",
  fridge: "cleanup.sale.serviceFridge",
  laundry: "cleanup.sale.serviceLaundry",
  other: "cleanup.sale.serviceOther",
});

let generation = 0;
let currentSummary = null;
let roomSummaryModulePromise = null;

function t(key, values = {}) {
  return window.JoyI18n?.t?.(key, values) || key;
}

function fold(value) {
  return String(value || "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function roomSummaryElements() {
  const modal = document.querySelector("#sales-assistant-modal");
  if (!modal) return null;
  const input = modal.querySelector("#room-summary-input");
  const output = modal.querySelector("#room-summary-card");
  const generate = modal.querySelector("#room-summary-generate");
  const clear = modal.querySelector("#room-summary-clear");
  const capture = modal.querySelector("#room-summary-capture-button");
  const captureLayer = document.querySelector("#room-summary-capture");
  const captureCard = document.querySelector("#room-summary-capture-card");
  const status = modal.querySelector(".sale-room-preview-heading strong");
  if (!input || !output || !generate || !clear || !capture || !captureLayer || !captureCard) return null;
  return { modal, input, output, generate, clear, capture, captureLayer, captureCard, status };
}

function loadRoomSummaryModule() {
  if (!roomSummaryModulePromise) roomSummaryModulePromise = import(ROOM_SUMMARY_MODULE);
  return roomSummaryModulePromise;
}

function roomCode(room) {
  return String(room?.code || "").trim();
}

function priceSortValue(value) {
  const clean = fold(value).replace(/\s+/g, "").replace(",", ".");
  const million = clean.match(/^(\d+)(?:\.(\d+))?(?:tr|trieu)(\d*)/u);
  if (million) {
    if (million[2]) return Number(`${million[1]}.${million[2]}`) * 1_000_000;
    if (million[3]) return Number(`${million[1]}.${million[3]}`) * 1_000_000;
    return Number(million[1]) * 1_000_000;
  }
  const thousand = clean.match(/^(\d+(?:\.\d+)?)k/u);
  return thousand ? Number(thousand[1]) * 1_000 : Number.POSITIVE_INFINITY;
}

function groupRoomsByPrice(rooms) {
  const groups = new Map();
  for (const room of rooms) {
    const price = String(room.price || "").trim();
    const key = fold(price) || "unknown";
    if (!groups.has(key)) groups.set(key, { price, rooms: [] });
    groups.get(key).rooms.push(roomCode(room));
  }
  return [...groups.values()]
    .filter((group) => group.rooms.length)
    .sort((a, b) => priceSortValue(a.price) - priceSortValue(b.price));
}

function availabilityMoment(value) {
  const clean = String(value || "").trim().replace(/\s*\/\s*/g, "/");
  if (!clean) return null;
  const normalized = fold(clean);
  const date = clean.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/u);
  if (date) {
    const label = t("cleanup.sale.fromDate", { date: date[1] });
    return { key: `date:${date[1]}`, label, summary: label };
  }
  if (/^(?:vao luon|o ngay|vao o ngay|co the vao o ngay)$/u.test(normalized)) {
    const label = t("cleanup.sale.availableNow");
    return { key: "now", label, summary: label };
  }
  if (/^(?:dang trong|san phong|phong dang san)$/u.test(normalized)) {
    const label = t("cleanup.sale.available");
    return { key: "available", label, summary: label };
  }
  return { key: `text:${normalized}`, label: clean, summary: clean };
}

function buildRoomPresentation(rooms, fallbackAvailability) {
  if (!Array.isArray(rooms) || rooms.length < 2) return null;
  const normalizedRooms = rooms.map((room) => ({
    ...room,
    availability: String(room.availability || fallbackAvailability || "").trim(),
  }));
  const moments = new Map();
  const unknown = [];

  for (const room of normalizedRooms) {
    const moment = availabilityMoment(room.availability);
    if (!moment) {
      unknown.push(room);
      continue;
    }
    if (!moments.has(moment.key)) moments.set(moment.key, { ...moment, rooms: [] });
    moments.get(moment.key).rooms.push(room);
  }

  if (moments.size <= 1 && !unknown.length) {
    const moment = [...moments.values()][0] || null;
    return {
      mode: "single",
      summary: moment
        ? t("cleanup.sale.roomsCountAvailability", { count: normalizedRooms.length, availability: moment.summary })
        : t("cleanup.sale.roomsCount", { count: normalizedRooms.length }),
      priceGroups: groupRoomsByPrice(normalizedRooms),
    };
  }

  const groups = [...moments.values()].map((moment) => ({
    label: moment.label,
    priceGroups: groupRoomsByPrice(moment.rooms),
  }));
  if (unknown.length) {
    groups.push({
      label: t("cleanup.sale.unknownAvailability"),
      priceGroups: groupRoomsByPrice(unknown),
    });
  }

  if (groups.length < 2) {
    const moment = [...moments.values()][0] || null;
    return {
      mode: "single",
      summary: moment
        ? t("cleanup.sale.roomsCountAvailability", { count: normalizedRooms.length, availability: moment.summary })
        : t("cleanup.sale.roomsCount", { count: normalizedRooms.length }),
      priceGroups: groupRoomsByPrice(normalizedRooms),
    };
  }
  return { mode: "multi", groups };
}

function serviceLabel(key) {
  return t(SERVICE_LABEL_KEYS[key] || SERVICE_LABEL_KEYS.other);
}

function serviceValue(service) {
  const value = String(service?.value || "").trim();
  const includes = Array.isArray(service?.includes)
    ? service.includes.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  if (!includes.length) return value;
  return `${value} (${t("cleanup.sale.includes")}: ${includes.join(", ")})`;
}

function uniqueText(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const clean = String(value || "").trim();
    const key = fold(clean);
    if (!clean || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function summaryFromExtraction(extraction) {
  const rooms = (Array.isArray(extraction?.rooms) ? extraction.rooms : [])
    .map((room) => ({
      code: String(room?.code || "").trim(),
      title: String(room?.code || "").trim(),
      price: String(room?.price || "").trim(),
      availability: String(room?.availability || "").trim(),
      note: String(room?.availability || "").trim(),
    }))
    .filter((room) => room.code);
  const availability = String(extraction?.availability?.value || "").trim();
  const price = String(extraction?.price?.value || "").trim()
    || (rooms.length === 1 ? rooms[0].price : "");
  const furniture = uniqueText(
    (Array.isArray(extraction?.furniture) ? extraction.furniture : []).map((item) => item?.value),
  ).join(", ");
  const services = (Array.isArray(extraction?.services) ? extraction.services : [])
    .map((service) => ({
      key: service?.key || "other",
      label: serviceLabel(service?.key || "other"),
      value: serviceValue(service),
    }))
    .filter((service) => service.value);
  const notes = uniqueText([
    extraction?.payment?.value,
    extraction?.contract?.value,
    ...(Array.isArray(extraction?.notes) ? extraction.notes.map((item) => item?.value) : []),
  ]);
  const address = String(extraction?.address?.value || "").trim();
  const area = String(extraction?.area?.value || "").trim();
  const floor = String(extraction?.floor?.value || "").trim();
  const roomType = String(extraction?.roomType?.value || "").trim();
  const stairs = extraction?.elevator?.value === "yes"
    ? t("cleanup.sale.yes")
    : extraction?.elevator?.value === "no"
      ? t("cleanup.sale.no")
      : "";
  const roomPresentation = buildRoomPresentation(rooms, availability);
  const isEmpty = !address && !area && !floor && !availability && !price && !roomType
    && !stairs && !furniture && !rooms.length && !services.length && !notes.length;

  return {
    address,
    area,
    floor,
    availability,
    price,
    rooms,
    roomPresentation,
    roomType,
    stairs,
    furniture,
    services,
    notes,
    isEmpty,
  };
}

function extraDetailRow(label, value) {
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const strong = document.createElement("strong");
  strong.textContent = `${label}:`;
  const text = document.createElement("span");
  text.className = "room-share-detail-value";
  text.textContent = value;
  text.contentEditable = "true";
  text.spellcheck = false;
  row.append(strong, document.createTextNode(" "), text);
  return row;
}

function addAreaAndFloor(output, summary) {
  const details = output.querySelector(".room-share-details");
  if (!details) return;
  const addressRow = details.querySelector(".room-share-detail-row");
  const anchor = addressRow?.nextSibling || details.firstChild;
  if (summary.area) details.insertBefore(extraDetailRow(t("cleanup.sale.roomArea"), summary.area), anchor);
  if (summary.floor) details.insertBefore(extraDetailRow(t("cleanup.sale.roomFloor"), summary.floor), anchor);
}

function setPreviewState(elements, key, engine, reason = "") {
  if (elements.status) elements.status.textContent = t(key);
  elements.output.dataset.roomSummaryEngine = engine;
  if (reason) elements.output.dataset.roomSummaryFallbackReason = reason;
  else delete elements.output.dataset.roomSummaryFallbackReason;
}

async function renderSemantic(elements, extraction) {
  const module = await loadRoomSummaryModule();
  const summary = summaryFromExtraction(extraction);
  module.renderRoomSummary(elements.output, summary);
  addAreaAndFloor(elements.output, summary);
  currentSummary = summary;
  elements.capture.disabled = summary.isEmpty;
  setPreviewState(elements, "cleanup.sale.aiAnalysisComplete", "ai-first");
  elements.output.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function renderFallback(elements, source, reason = "") {
  const module = await loadRoomSummaryModule();
  const summary = module.summarizeRoomListing(source);
  module.renderRoomSummary(elements.output, summary);
  currentSummary = summary;
  elements.capture.disabled = summary.isEmpty;
  setPreviewState(elements, "cleanup.sale.parserFallback", "parser-fallback", reason);
  elements.output.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function analyze(elements, source, requestGeneration) {
  try {
    const response = await fetch(ROOM_SUMMARY_AI_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    });
    const payload = await response.json().catch(() => ({}));
    if (requestGeneration !== generation) return;
    if (response.ok && payload?.applied === true && payload?.extraction) {
      await renderSemantic(elements, payload.extraction);
    } else {
      await renderFallback(elements, source, String(payload?.reason || "ai-not-applied"));
    }
  } catch (error) {
    if (requestGeneration === generation) {
      await renderFallback(elements, source, String(error?.message || "ai-request-failed"));
    }
  } finally {
    if (requestGeneration === generation) elements.generate.removeAttribute("aria-busy");
  }
}

function start(elements) {
  const source = String(elements.input.value || "").trim();
  const requestGeneration = ++generation;
  if (!source) {
    void renderFallback(elements, "", "empty-source");
    return;
  }
  elements.generate.setAttribute("aria-busy", "true");
  void analyze(elements, source, requestGeneration);
}

function captureSummary(elements) {
  if (!currentSummary || currentSummary.isEmpty) return;
  const clone = elements.output.cloneNode(true);
  clone.removeAttribute("id");
  clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
  elements.captureCard.replaceChildren(clone);
  elements.captureLayer.hidden = false;
  document.body.classList.add("sale-room-capture-open");
}

document.addEventListener("click", (event) => {
  const elements = roomSummaryElements();
  if (!elements || !event.target.closest("#sales-assistant-modal")) return;

  if (event.target.closest("#room-summary-generate")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    start(elements);
    return;
  }

  if (event.target.closest("#room-summary-clear")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    generation += 1;
    elements.input.value = "";
    elements.generate.removeAttribute("aria-busy");
    void renderFallback(elements, "", "empty-source");
    elements.input.focus();
    return;
  }

  if (event.target.closest("#room-summary-capture-button")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    captureSummary(elements);
  }
}, true);

document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
  const elements = roomSummaryElements();
  if (!elements || event.target !== elements.input) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  start(elements);
}, true);

document.addEventListener("input", (event) => {
  const elements = roomSummaryElements();
  if (!elements || event.target !== elements.input) return;
  generation += 1;
  elements.generate.removeAttribute("aria-busy");
}, true);
