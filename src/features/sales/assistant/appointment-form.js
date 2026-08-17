import {
  formatVietnamViewingTime,
  parseSaleAppointmentInput,
} from "../appointments/appointment.js";
import { saleApi } from "../shared/api.js";
import {
  vietnamDatetimeLocal,
  vietnamLocalToIso,
} from "../shared/format.js";
import { saleText } from "../shared/i18n.js";

const APPOINTMENT_RESET_DELAY_MS = 1200;
const state = {
  resetTimer: 0,
  inputVersion: 0,
  saving: false,
  requestId: "",
  operationSeq: 0,
};

function showStatus(message, statusState = "") {
  const status = document.querySelector("#sale-appointment-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = statusState;
  status.hidden = !message;
}

function formPayload() {
  const form = document.querySelector("#sale-appointment-form");
  if (!form) return null;
  const data = new FormData(form);
  return {
    customerName: String(data.get("customerName") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    viewingAddress: String(data.get("viewingAddress") || "").trim(),
    viewingAt: vietnamLocalToIso(data.get("viewingTime")),
  };
}

function updateTimeLabel() {
  const payload = formPayload();
  const label = document.querySelector("#sale-appointment-time-label");
  if (!label) return;
  label.textContent = payload?.viewingAt
    ? formatVietnamViewingTime(payload.viewingAt)
    : saleText("saleAssistant.unknownTime", "Chưa rõ thời gian");
}

function setBusy(busy) {
  state.saving = busy;
  document.querySelector(".sales-appointment-composer")
    ?.querySelectorAll("textarea, button")
    .forEach((control) => { control.disabled = busy; });
  document.querySelector("#sale-appointment-form")
    ?.querySelectorAll("input, button")
    .forEach((control) => { control.disabled = busy; });
}

function newRequestId() {
  if (globalThis.crypto?.randomUUID) return `viewing:${globalThis.crypto.randomUUID()}`;
  return `viewing:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function markInteraction() {
  if (state.saving) return;
  state.inputVersion += 1;
  state.requestId = "";
  if (state.resetTimer) {
    window.clearTimeout(state.resetTimer);
    state.resetTimer = 0;
  }
}

function parseAppointment() {
  if (state.saving) return;
  markInteraction();
  const input = document.querySelector("#sale-appointment-input");
  const form = document.querySelector("#sale-appointment-form");
  if (!input || !form) return;
  const parsed = parseSaleAppointmentInput(input.value);
  form.hidden = false;
  form.elements.customerName.value = parsed.customerName;
  form.elements.phone.value = parsed.phone;
  form.elements.viewingAddress.value = parsed.viewingAddress;
  form.elements.viewingTime.value = vietnamDatetimeLocal(parsed.viewingAt);
  document.querySelector("#sale-appointment-save")?.removeAttribute("disabled");
  updateTimeLabel();

  if (parsed.valid) {
    showStatus(saleText("saleAssistant.appointmentParsed", "Joy đã tách thông tin. Hãy kiểm tra lại trước khi lưu."), "ready");
  } else {
    const missingLabels = {
      customerName: saleText("saleAssistant.customerName", "tên khách"),
      viewingAddress: saleText("saleAssistant.viewingAddress", "địa chỉ"),
      viewingAt: saleText("saleAssistant.viewingTime", "thời gian"),
    };
    const fields = parsed.missing.map((item) => missingLabels[item]).join(", ");
    showStatus(
      saleText(
        "saleAssistant.appointmentMissing",
        `Chưa nhận ra ${fields}. Bạn có thể điền trực tiếp bên dưới.`,
        { fields },
      ),
      "warning",
    );
  }
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function resetAppointment() {
  if (state.saving) return;
  if (state.resetTimer) {
    window.clearTimeout(state.resetTimer);
    state.resetTimer = 0;
  }
  const input = document.querySelector("#sale-appointment-input");
  const form = document.querySelector("#sale-appointment-form");
  if (input) input.value = "";
  if (form) {
    form.reset();
    form.hidden = true;
  }
  state.requestId = "";
  setBusy(false);
  showStatus("");
  input?.focus();
}

function scheduleReset() {
  const scheduledVersion = state.inputVersion;
  if (state.resetTimer) window.clearTimeout(state.resetTimer);
  state.resetTimer = window.setTimeout(() => {
    state.resetTimer = 0;
    if (scheduledVersion !== state.inputVersion || state.saving) return;
    resetAppointment();
  }, APPOINTMENT_RESET_DELAY_MS);
}

const APPOINTMENT_ERROR_KEYS = Object.freeze({
  VIEWING_ADDRESS_REQUIRED: ["saleAssistant.errorAddressRequired", "Vui lòng nhập địa chỉ xem phòng."],
  VIEWING_TIME_REQUIRED: ["saleAssistant.errorTimeRequired", "Vui lòng chọn thời gian hẹn."],
  VIEWING_TIME_IN_PAST: ["saleAssistant.errorTimePast", "Thời gian hẹn đã qua. Hãy chọn lại."],
  VIEWING_TIME_TOO_FAR: ["saleAssistant.errorTimeFar", "Joy chỉ nhận lịch trong vòng 1 năm tới."],
  VIEWING_NOT_FOUND: ["saleAssistant.errorViewingNotFound", "Không tìm thấy lịch hẹn này."],
  VIEWING_ID_REQUIRED: ["saleAssistant.errorViewingIdRequired", "Joy chưa xác định được lịch cần sửa."],
  VIEWING_ID_INVALID: ["saleAssistant.errorViewingIdInvalid", "Joy chưa tạo được mã an toàn cho lịch này. Hãy nhập lại."],
  VIEWING_ID_CONFLICT: ["saleAssistant.errorViewingIdConflict", "Mã lịch này đã được dùng cho dữ liệu khác. Hãy nhập lại lịch."],
  AUTH_REQUIRED: ["saleAssistant.errorAuthRequired", "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại Joy."],
});

function errorMessage(code) {
  const [key, fallback] = APPOINTMENT_ERROR_KEYS[code] || ["saleAssistant.appointmentSaveFailed", "Joy chưa thể lưu lịch. Hãy thử lại."];
  return saleText(key, fallback);
}

async function saveAppointment(event) {
  event.preventDefault();
  if (state.saving) return;
  const form = event.currentTarget;
  const payload = formPayload();
  if (!payload || !form.reportValidity()) return;
  state.requestId ||= newRequestId();
  payload.id = state.requestId;

  const operationId = ++state.operationSeq;
  setBusy(true);
  showStatus(saleText("saleAssistant.savingAppointment", "Đang lưu lịch vào Joy…"), "loading");

  try {
    const result = await saleApi("/api/sales/viewings", { method: "POST", body: payload });
    if (operationId !== state.operationSeq) return;
    const saved = result.viewing;
    showStatus(
      saleText(
        "saleAssistant.appointmentSaved",
        `${result.message} ${saved.customerName} · ${formatVietnamViewingTime(saved.viewingAt)}.`,
        { customer: saved.customerName, time: formatVietnamViewingTime(saved.viewingAt) },
      ),
      "success",
    );
    setBusy(false);
    window.dispatchEvent(new CustomEvent("joy:sales-changed", { detail: { kind: "viewing-created" } }));
    scheduleReset();
  } catch (error) {
    if (operationId !== state.operationSeq) return;
    showStatus(errorMessage(error.code), "error");
  } finally {
    if (operationId === state.operationSeq && state.saving) setBusy(false);
  }
}

export function isAppointmentSaving() {
  return state.saving;
}

export function installAppointmentForm() {
  const form = document.querySelector("#sale-appointment-form");
  if (!form || form.dataset.saleAppointmentInstalled === "true") return;
  form.dataset.saleAppointmentInstalled = "true";
  document.querySelector("#sale-appointment-parse")?.addEventListener("click", parseAppointment);
  document.querySelector("#sale-appointment-reset")?.addEventListener("click", resetAppointment);
  form.addEventListener("submit", saveAppointment);
  form.addEventListener("input", () => {
    markInteraction();
    updateTimeLabel();
  });
  const input = document.querySelector("#sale-appointment-input");
  input?.addEventListener("input", markInteraction);
  input?.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") parseAppointment();
  });
}
