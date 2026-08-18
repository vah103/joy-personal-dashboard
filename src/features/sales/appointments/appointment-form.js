import {
  formatVietnamViewingTime,
  parseSaleAppointmentInput,
} from "./parser.js";
import {
  vietnamDatetimeLocal,
  vietnamLocalToIso,
} from "../shared/dates.js";

function showAppointmentStatus(message, state = "", doc = document) {
  const status = doc.querySelector("#sale-appointment-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;
}

function appointmentFormPayload(doc = document) {
  const form = doc.querySelector("#sale-appointment-form");
  if (!form) return null;
  const data = new FormData(form);
  return {
    customerName: String(data.get("customerName") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    viewingAddress: String(data.get("viewingAddress") || "").trim(),
    viewingAt: vietnamLocalToIso(data.get("viewingTime")),
  };
}

function updateAppointmentTimeLabel(doc = document) {
  const payload = appointmentFormPayload(doc);
  const label = doc.querySelector("#sale-appointment-time-label");
  if (label) label.textContent = payload?.viewingAt ? formatVietnamViewingTime(payload.viewingAt) : "Chưa rõ thời gian";
}

function parseAppointment(doc = document) {
  const input = doc.querySelector("#sale-appointment-input");
  const form = doc.querySelector("#sale-appointment-form");
  if (!input || !form) return;
  const parsed = parseSaleAppointmentInput(input.value);
  form.hidden = false;
  form.elements.customerName.value = parsed.customerName;
  form.elements.phone.value = parsed.phone;
  form.elements.viewingAddress.value = parsed.viewingAddress;
  form.elements.viewingTime.value = vietnamDatetimeLocal(parsed.viewingAt);
  updateAppointmentTimeLabel(doc);

  if (parsed.valid) {
    showAppointmentStatus("Joy đã tách thông tin. Hãy kiểm tra lại trước khi lưu.", "ready", doc);
  } else {
    const missingLabels = {
      customerName: "tên khách",
      viewingAddress: "địa chỉ",
      viewingAt: "thời gian",
    };
    showAppointmentStatus(`Chưa nhận ra ${parsed.missing.map((item) => missingLabels[item]).join(", ")}. Bạn có thể điền trực tiếp bên dưới.`, "warning", doc);
  }
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function resetAppointment(doc = document) {
  const input = doc.querySelector("#sale-appointment-input");
  const form = doc.querySelector("#sale-appointment-form");
  if (input) input.value = "";
  if (form) {
    form.reset();
    form.hidden = true;
  }
  showAppointmentStatus("", "", doc);
  input?.focus();
}

export function appointmentErrorMessage(code) {
  const messages = {
    VIEWING_ADDRESS_REQUIRED: "Vui lòng nhập địa chỉ xem phòng.",
    VIEWING_TIME_REQUIRED: "Vui lòng chọn thời gian hẹn.",
    VIEWING_TIME_IN_PAST: "Thời gian hẹn đã qua. Hãy chọn lại.",
    VIEWING_TIME_TOO_FAR: "Joy chỉ nhận lịch trong vòng 1 năm tới.",
    VIEWING_NOT_FOUND: "Không tìm thấy lịch hẹn này.",
    VIEWING_ID_REQUIRED: "Joy chưa xác định được lịch cần sửa.",
    AUTH_REQUIRED: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại Joy.",
  };
  return messages[code] || "Joy chưa thể lưu lịch. Hãy thử lại.";
}

async function saveAppointment(event, onSaved, doc = document) {
  event.preventDefault();
  const form = event.currentTarget;
  const save = doc.querySelector("#sale-appointment-save");
  const payload = appointmentFormPayload(doc);
  if (!payload || !form.reportValidity()) return;
  save.disabled = true;
  showAppointmentStatus("Đang lưu lịch vào Joy…", "loading", doc);

  try {
    const response = await fetch("/api/sales/viewings", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || "VIEWING_CREATE_FAILED"), { code: result.error });
    onSaved?.();
    showAppointmentStatus(`${result.message} ${result.viewing.customerName} · ${formatVietnamViewingTime(result.viewing.viewingAt)}.`, "success", doc);
    window.setTimeout(() => window.location.reload(), 1200);
  } catch (error) {
    showAppointmentStatus(appointmentErrorMessage(error.code), "error", doc);
    save.disabled = false;
  }
}

export function installAppointmentForm({ onSaved } = {}, doc = document) {
  doc.querySelector("#sale-appointment-parse")?.addEventListener("click", () => parseAppointment(doc));
  doc.querySelector("#sale-appointment-reset")?.addEventListener("click", () => resetAppointment(doc));
  doc.querySelector("#sale-appointment-form")?.addEventListener("submit", (event) => saveAppointment(event, onSaved, doc));
  doc.querySelector("#sale-appointment-form")?.addEventListener("input", () => updateAppointmentTimeLabel(doc));
  doc.querySelector("#sale-appointment-input")?.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") parseAppointment(doc);
  });
}
