import core from "./vi-core.js";
import hardening from "./vi-hardening.js";
import cleanup from "./vi-cleanup.js";
import dynamicUi from "./vi-dynamic-ui.js";

export default Object.freeze({
  ...core,
  ...hardening,
  ...cleanup,
  ...dynamicUi,
  "cleanup.sale.roomArea": "Diện tích",
  "cleanup.sale.roomFloor": "Tầng",
  "cleanup.sale.includes": "gồm",
  "cleanup.sale.roomsCount": "{count} phòng",
  "cleanup.sale.roomsCountAvailability": "{count} phòng · {availability}",
  "cleanup.sale.fromDate": "Từ {date}",
  "cleanup.sale.availableNow": "Vào luôn",
  "cleanup.sale.available": "Đang trống",
  "cleanup.sale.unknownAvailability": "Chưa rõ ngày trống",
  "cleanup.sale.yes": "Có",
  "cleanup.sale.no": "Không",
  "cleanup.sale.serviceElectricity": "Điện",
  "cleanup.sale.serviceWater": "Nước",
  "cleanup.sale.serviceInternet": "Mạng",
  "cleanup.sale.serviceCommon": "Dịch vụ chung",
  "cleanup.sale.serviceParking": "Gửi xe",
  "cleanup.sale.serviceFridge": "Tủ lạnh",
  "cleanup.sale.serviceLaundry": "Giặt sấy",
  "cleanup.sale.serviceOther": "Khác",
});
