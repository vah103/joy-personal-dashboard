import { saleText, translateSaleUiRoot } from "../shared/i18n.js";

const SERVICE_I18N_KEYS = Object.freeze({
  electricity: "saleAssistant.electricity",
  water: "saleAssistant.water",
  internet: "saleAssistant.internet",
  common: "saleAssistant.commonServices",
  parking: "saleAssistant.parking",
  fridge: "saleAssistant.fridge",
  laundry: "saleAssistant.laundry",
});

function semanticLabel(tagName, key, fallback, { className = "", suffix = "" } = {}) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  const text = document.createElement("span");
  text.dataset.i18n = key;
  text.textContent = saleText(key, fallback);
  node.append(text);
  if (suffix) node.append(document.createTextNode(suffix));
  return node;
}

function serviceLabel(service) {
  const key = SERVICE_I18N_KEYS[service?.key];
  return key ? saleText(key, service.label || "") : service?.label || "";
}

function editableText(tagName, className, text) {
  const node = document.createElement(tagName);
  node.className = className;
  node.textContent = text;
  node.contentEditable = "true";
  node.spellcheck = false;
  return node;
}

function localizeAvailabilityText(value) {
  const text = String(value || "").trim();
  let match = text.match(/^(\d+)\s+phòng\s*·\s*Trống từ\s+(.+)$/iu);
  if (match) return saleText("saleAssistant.availableCount", `${match[1]} phòng · Trống từ ${match[2]}`, { count: match[1], date: match[2] });
  match = text.match(/^(\d+)\s+phòng\s*·\s*(?:Vào luôn|Đang trống)$/iu);
  if (match) return saleText("saleAssistant.availableCountNow", `${match[1]} phòng · Vào luôn`, { count: match[1] });
  match = text.match(/^Từ\s+(.+)$/iu);
  if (match) return saleText("saleAssistant.availableFrom", `Từ ${match[1]}`, { date: match[1] });
  if (/^Vào luôn$/iu.test(text)) return saleText("saleAssistant.availableNow", "Vào luôn");
  if (/^Đang trống$/iu.test(text)) return saleText("saleAssistant.currentlyAvailable", "Đang trống");
  if (/^Chưa rõ ngày trống$/iu.test(text)) return saleText("saleAssistant.availabilityUnknown", "Chưa rõ ngày trống");
  return text;
}

function markAvailabilityText(node, sourceText) {
  node.dataset.roomAvailabilityText = sourceText;
  node.textContent = localizeAvailabilityText(sourceText);
  return node;
}

function appendDetailRow(container, key, fallbackLabel, value, editable, { availabilitySource = "" } = {}) {
  if (!value) return;
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const labelNode = semanticLabel("strong", key, fallbackLabel, { suffix: ":" });
  const valueNode = editableText("span", "room-share-detail-value", value);
  valueNode.contentEditable = String(editable);
  if (availabilitySource) markAvailabilityText(valueNode, availabilitySource);
  row.append(labelNode, document.createTextNode(" "), valueNode);
  container.append(row);
}

function appendRoomPriceList(container, groups, editable) {
  const list = document.createElement("ul");
  list.className = "room-share-price-list";
  for (const group of groups) {
    const item = document.createElement("li");
    const price = editableText("strong", "room-share-price-value", group.price);
    price.contentEditable = String(editable);
    const rooms = editableText("span", "room-share-price-rooms", group.rooms.join(", "));
    rooms.contentEditable = String(editable);
    item.append(price, document.createTextNode(": "), rooms);
    list.append(item);
  }
  container.append(list);
}

function renderRoomPresentation(container, presentation, editable) {
  if (!presentation) return false;
  if (presentation.mode === "single") {
    appendDetailRow(
      container,
      "saleAssistant.roomAvailability",
      "Phòng trống",
      localizeAvailabilityText(presentation.summary),
      editable,
      { availabilitySource: presentation.summary },
    );
    const section = document.createElement("section");
    section.className = "room-share-room-pricing";
    section.append(semanticLabel("h4", "saleAssistant.roomPriceLabel", "Giá phòng", { suffix: ":" }));
    appendRoomPriceList(section, presentation.priceGroups, editable);
    container.append(section);
    return true;
  }

  const section = document.createElement("section");
  section.className = "room-share-room-pricing room-share-room-pricing-multi";
  section.append(semanticLabel("h4", "saleAssistant.roomAvailability", "Phòng trống", { suffix: ":" }));
  for (const group of presentation.groups) {
    const block = document.createElement("div");
    block.className = "room-share-availability-group";
    const heading = markAvailabilityText(document.createElement("h5"), group.label);
    block.append(heading);
    appendRoomPriceList(block, group.priceGroups, editable);
    section.append(block);
  }
  container.append(section);
  return true;
}

function renderListSection(container, key, fallbackTitle, className, items, editable, renderItem) {
  if (!items.length) return;
  const section = document.createElement("section");
  section.className = "room-share-section";
  const heading = semanticLabel("h4", key, fallbackTitle, { className: "room-share-section-title", suffix: ":" });
  const list = document.createElement("ul");
  list.className = className;
  for (const item of items) {
    const listItem = document.createElement("li");
    renderItem(listItem, item, editable);
    list.append(listItem);
  }
  section.append(heading, list);
  container.append(section);
}

export function refreshRoomSummaryLocale(container) {
  if (!container) return;
  translateSaleUiRoot(container);
  container.querySelectorAll("[data-room-availability-text]").forEach((node) => {
    node.textContent = localizeAvailabilityText(node.dataset.roomAvailabilityText || "");
  });
}

export function renderRoomSummary(container, summary, { editable = true } = {}) {
  container.replaceChildren();
  container.classList.toggle("is-empty", summary.isEmpty);
  if (summary.isEmpty) {
    const empty = document.createElement("div");
    empty.className = "room-share-empty";
    const mark = document.createElement("span");
    mark.textContent = "⌂";
    const title = document.createElement("strong");
    title.dataset.i18n = "saleAssistant.roomSummaryEmptyTitle";
    title.textContent = saleText("saleAssistant.roomSummaryEmptyTitle", "Your room summary will appear here");
    const detail = document.createElement("p");
    detail.dataset.i18n = "saleAssistant.roomSummaryEmptyDetail";
    detail.textContent = saleText("saleAssistant.roomSummaryEmptyDetail", "Paste a room listing, then create a clean customer view.");
    empty.append(mark, title, detail);
    container.append(empty);
    return;
  }

  const details = document.createElement("div");
  details.className = "room-share-details";
  appendDetailRow(
    details,
    "saleAssistant.roomAddress",
    "Địa chỉ",
    summary.address || saleText("saleAssistant.roomAddressUnknown", "Địa chỉ chưa rõ"),
    editable,
  );
  const hasRoomPresentation = renderRoomPresentation(details, summary.roomPresentation, editable);
  if (!hasRoomPresentation) {
    appendDetailRow(details, "saleAssistant.roomAvailability", "Phòng trống", summary.availability, editable);
    appendDetailRow(details, "saleAssistant.roomPriceLabel", "Giá", summary.price, editable);
  }
  appendDetailRow(details, "saleAssistant.roomType", "Dạng phòng", summary.roomType, editable);
  appendDetailRow(details, "saleAssistant.elevator", "Thang máy", summary.stairs, editable);
  appendDetailRow(details, "saleAssistant.furniture", "Nội thất", summary.furniture, editable);
  container.append(details);

  renderListSection(
    container,
    "saleAssistant.services",
    "Dịch vụ",
    "room-share-services",
    summary.services,
    editable,
    (item, service, canEdit) => {
      const label = document.createElement("strong");
      const key = SERVICE_I18N_KEYS[service?.key];
      if (key) {
        const text = document.createElement("span");
        text.dataset.i18n = key;
        text.textContent = serviceLabel(service);
        label.append(text, document.createTextNode(":"));
      } else {
        label.textContent = `${serviceLabel(service)}:`;
      }
      const value = editableText("span", "room-share-service-value", service.value);
      value.contentEditable = String(canEdit);
      item.append(label, document.createTextNode(" "), value);
    },
  );
  renderListSection(
    container,
    "saleAssistant.notes",
    "Lưu ý",
    "room-share-notes",
    summary.notes,
    editable,
    (item, note, canEdit) => {
      const value = editableText("span", "room-share-note-value", note);
      value.contentEditable = String(canEdit);
      item.append(value);
    },
  );
}
