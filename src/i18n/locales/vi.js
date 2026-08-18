import core from "./vi-core.js";
import hardening from "./vi-hardening.js";
import cleanup from "./vi-cleanup.js";
import dynamicUi from "./vi-dynamic-ui.js";

export default Object.freeze({
  ...core,
  ...hardening,
  ...cleanup,
  ...dynamicUi,
  "sales.reminder30": "Đúng giờ hẹn",
  "saleAssistant.savedReminder": "Đã lưu lịch. Joy sẽ nhắc bạn đúng giờ hẹn và hỏi lại sau buổi xem.",
  "saleAssistant.savedTooClose": "Đã lưu lịch. Joy sẽ nhắc bạn đúng giờ hẹn và hỏi lại sau buổi xem.",
});
