(function registerJoyWeather(root) {
  const TIME_ZONE = "Asia/Ho_Chi_Minh";
  const RAIN_PROBABILITY_THRESHOLD = 40;
  const RAIN_AMOUNT_THRESHOLD = 0.1;

  function vietnamClock(now) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);

    const value = (type) => parts.find((part) => part.type === type)?.value || "";

    return {
      dateKey: `${value("year")}-${value("month")}-${value("day")}`,
      hour: Number(value("hour")),
    };
  }

  function isRainWeatherCode(code) {
    return (code >= 51 && code <= 67)
      || (code >= 80 && code <= 82)
      || (code >= 95 && code <= 99);
  }

  function hourLabel(hour) {
    return `${String(Math.min(24, Math.max(0, hour))).padStart(2, "0")}:00`;
  }

  function summarizeRainForecast(hourly, now = new Date()) {
    const times = Array.isArray(hourly?.time) ? hourly.time : [];
    const probabilities = Array.isArray(hourly?.precipitation_probability)
      ? hourly.precipitation_probability
      : [];
    const precipitation = Array.isArray(hourly?.precipitation)
      ? hourly.precipitation
      : [];
    const weatherCodes = Array.isArray(hourly?.weather_code)
      ? hourly.weather_code
      : [];

    if (!times.length) {
      return {
        state: "unavailable",
        text: "Rain forecast unavailable",
      };
    }

    const current = vietnamClock(now);
    const rainyHours = [];

    times.forEach((time, index) => {
      const value = String(time || "");
      if (!value.startsWith(current.dateKey)) return;

      const hour = Number(value.slice(11, 13));
      if (!Number.isInteger(hour) || hour < current.hour) return;

      const probability = Number(probabilities[index] || 0);
      const amount = Number(precipitation[index] || 0);
      const weatherCode = Number(weatherCodes[index]);

      const likelyRain = probability >= RAIN_PROBABILITY_THRESHOLD
        || amount >= RAIN_AMOUNT_THRESHOLD
        || isRainWeatherCode(weatherCode);

      if (likelyRain) rainyHours.push({ hour, probability });
    });

    if (!rainyHours.length) {
      return {
        state: "clear",
        text: "No significant rain expected today",
      };
    }

    const groups = [];

    rainyHours.forEach((entry) => {
      const currentGroup = groups.at(-1);
      const previous = currentGroup?.at(-1);

      if (!previous || entry.hour !== previous.hour + 1) {
        groups.push([entry]);
      } else {
        currentGroup.push(entry);
      }
    });

    const windows = groups.map((group) => ({
      start: hourLabel(group[0].hour),
      end: hourLabel(group.at(-1).hour + 1),
    }));

    const visibleWindows = windows
      .slice(0, 2)
      .map((window) => `${window.start}–${window.end}`);

    const suffix = windows.length > 2 ? "…" : "";

    return {
      state: "rain",
      text: `Rain possible: ${visibleWindows.join(" and ")}${suffix}`,
    };
  }

  root.JoyWeather = Object.freeze({
    summarizeRainForecast,
  });
})(typeof window !== "undefined" ? window : globalThis);
