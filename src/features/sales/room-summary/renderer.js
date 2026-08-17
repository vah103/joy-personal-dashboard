import { saleText } from "../shared/i18n.js";

const SERVICE_I18N_KEYS = Object.freeze({
  electricity: "saleAssistant.electricity",
  water: "saleAssistant.water",
  internet: "saleAssistant.internet",
  common: "saleAssistant.commonServices",
  parking: "saleAssistant.parking",
  fridge: "saleAssistant.fridge",
  laundry: "saleAssistant.laundry",
});

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

function appendDetailRow(container, key, fallbackLabel, value, editable) {
  if (!value) return;
  const row = document.createElement("p");
  row.className = "room-share-detail-row";
  const labelNode = document.createElement("strong");
  labelNode.textContent = `${saleText(key, fallbackLabel)}:`;
  const valueNode = editableText("span", "room-share-detail-value", value);
  valueNode.contentEditable = String(editable);
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
    appendDetailRow(container, "saleAssistant.roomAvailability", "Phòng trống", presentation.summary, editable);
    const section = document.createElement("section");
    section.className = "room-share-room-pricing";
    const title = document.createElement("h4");
    title.textContent = `${saleText("saleAssistant.roomPriceLabel", "Giá phòng")}:`;
    section.append(title);
    appendRoomPriceList(section, presentation.priceGroups, editable);
    container.append(section);
    return true;
  }

  const section = document.createElement("section");
  section.className = "room-share-room-pricing room-share-room-pricing-multi";
  const title = document.createElement("h4");
  title.textContent = `${saleText("saleAssistant.roomAvailability", "Phòng trống")}:`;
  section.append(title);
  for (const group of presentation.groups) {
    const block = document.createElement("div");
    block.className = "room-share-availability-group";
    const heading = document.createElement("h5");
    heading.textContent = group.label;
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
  const heading = document.createElement("h4");
  heading.className = "room-share-section-title";
  heading.textContent = `${saleText(key, fallbackTitle)}:`;
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

export function renderRoomSummary(container, summary, { editable = true } = {}) {
  container.replaceChildren();
  container.classList.toggle("is-empty", summary.isEmpty);
  if (summary.isEmpty) {
    const empty = document.createElement("div");
    empty.className = "room-share-empty";
    const mark = document.createElement("span");
    mark.textContent = "⌂";
    const title = document.createElement("strong");
    title.textContent = saleText("saleAssistant.roomSummaryEmptyTitle", "Your room summary will appear here");
    const detail = document.createElement("p");
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
      label.textContent = `${serviceLabel(service)}:`;
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
