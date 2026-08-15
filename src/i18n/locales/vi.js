import core from "./vi-core.js";
import hardening from "./vi-hardening.js";
import cleanup from "./vi-cleanup.js";
import dynamicUi from "./vi-dynamic-ui.js";
import saleRoom from "./vi-sale-room.js";

export default Object.freeze({
  ...core,
  ...hardening,
  ...cleanup,
  ...dynamicUi,
  ...saleRoom,
  "dynamic.sale.joyRoomEmptyHelp": "Soạn Joy Room Text trong ChatGPT, sau đó dán nguyên bản vào đây.",
  "dynamic.sale.joyRoomFormatErrorTitle": "Joy Room Text chưa đúng format",
  "dynamic.sale.joyRoomFormatErrorHelp": "Hãy quay lại ChatGPT, chỉnh bản soạn theo Joy Room Text v1 rồi dán lại toàn bộ.",
});
