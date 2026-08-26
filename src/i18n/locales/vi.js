import core from "./vi-core.js";
import hardening from "./vi-hardening.js";
import cleanup from "./vi-cleanup.js";
import dynamicUi from "./vi-dynamic-ui.js";

export default Object.freeze({
  ...core,
  ...hardening,
  ...cleanup,
  ...dynamicUi,
  "dynamic.weather.yesterday": "Hôm qua",
  "dynamic.weather.today": "Hôm nay",
  "dynamic.weather.now": "Hiện tại",
  "dynamic.weather.realFeel": "Cảm giác như",
  "dynamic.weather.humidity": "Độ ẩm",
  "dynamic.weather.noRain": "Không dự kiến có mưa.",
  "dynamic.weather.sunnyDay": "Trời nắng.",
  "dynamic.weather.rainAt": "Mưa lúc {windows}.",
  "dynamic.weather.highLowAria": "Cao {high}, thấp {low}",
  "dynamic.weather.tryAgain": "Thử lại",
  "dynamic.weather.open": "Mở tổng quan thời tiết Hà Nội 7 ngày",
});
