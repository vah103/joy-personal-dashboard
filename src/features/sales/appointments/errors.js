import { saleText } from "../shared/i18n.js";

export const APPOINTMENT_ERROR_KEYS = Object.freeze({
  VIEWING_ADDRESS_REQUIRED: ["saleAssistant.errorAddressRequired", "Vui lòng nhập địa chỉ xem phòng."],
  VIEWING_TIME_REQUIRED: ["saleAssistant.errorTimeRequired", "Vui lòng chọn thời gian hẹn."],
  VIEWING_TIME_IN_PAST: ["saleAssistant.errorTimePast", "Thời gian hẹn đã qua. Hãy chọn lại."],
  VIEWING_TIME_TOO_FAR: ["saleAssistant.errorTimeFar", "Joy chỉ nhận lịch trong vòng 1 năm tới."],
  VIEWING_NOT_FOUND: ["saleAssistant.errorViewingNotFound", "Không tìm thấy lịch hẹn này."],
  VIEWING_ID_REQUIRED: ["saleAssistant.errorViewingIdRequired", "Joy chưa xác định được lịch cần sửa."],
  VIEWING_ID_INVALID: ["saleAssistant.errorViewingIdInvalid", "Joy chưa tạo được mã an toàn cho lịch này. Hãy nhập lại."],
  VIEWING_ID_CONFLICT: ["saleAssistant.errorViewingIdConflict", "Mã lịch này đã được dùng cho dữ liệu khác. Hãy nhập lại lịch."],
  VIEWING_ALREADY_CLOSED: ["saleAssistant.errorViewingClosed", "Deal đã được lưu. Lịch hẹn này không thể sửa hoặc xóa nữa."],
  SALE_DEAL_SAVE_IN_PROGRESS: ["saleAssistant.dealSaveProgressHelp", "Deal đang được lưu. Hãy chờ trạng thái cập nhật."],
  SALE_DEAL_SAVE_REVIEW_REQUIRED: ["saleAssistant.reviewResolveHelp", "Trạng thái lưu deal cần được kiểm tra trước khi thao tác tiếp."],
  AUTH_REQUIRED: ["saleAssistant.errorAuthRequired", "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại Joy."],
});

export function appointmentErrorMessage(
  code,
  fallbackKey = "saleAssistant.appointmentSaveFailed",
  fallback = "Joy chưa thể lưu lịch. Hãy thử lại.",
) {
  const [key, message] = APPOINTMENT_ERROR_KEYS[code] || [fallbackKey, fallback];
  return saleText(key, message);
}
