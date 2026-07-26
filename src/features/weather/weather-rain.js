(function registerJoyWeather(root) {
  const TIME_ZONE = "Asia/Ho_Chi_Minh";

  /*
   * Conservative dashboard thresholds.
   * Weak or uncertain rain signals are intentionally not announced.
   */
  const HIGH_PROBABILITY = 70;
  const VERY_HIGH_PROBABILITY = 80;
  const SUPPORTING_AMOUNT_MM = 0.3;
  const STRONG_AMOUNT_MM = 1;

  function vietnamClock(now) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);

    const value = (type) =>
      parts.find((part) => part.type === type)?.value || "";

    return {
      dateKey: `${value("year")}-${value("month")}-${value("day")}`,
      hour: Number(value("hour")),
      minute: Number(value("minute")),
    };
  }

  function isRainWeatherCode(code) {
    return (code >= 51 && code <= 67)
      || (code >= 80 && code <= 82)
      || (code >= 95 && code <= 99);
  }

  function hourLabel(hour) {
    return `${String(Math.max(0, Math.min(24, hour))).padStart(2, "0")}:00`;
  }

  function hasStrongRainSignal({
    probability,
    amount,
    weatherCode,
  }) {
    const meaningfulHighProbability =
      probability >= HIGH_PROBABILITY
      && amount >= SUPPORTING_AMOUNT_MM;

    const strongRainAmount = amount >= STRONG_AMOUNT_MM;

    const veryHighSupportedProbability =
      probability >= VERY_HIGH_PROBABILITY
      && isRainWeatherCode(weatherCode);

    return meaningfulHighProbability
      || strongRainAmount
      || veryHighSupportedProbability;
  }

  function summarizeRainForecast(hourly, now = new Date()) {
    const times = Array.isArray(hourly?.time)
      ? hourly.time
      : [];

    const probabilities =
      Array.isArray(hourly?.precipitation_probability)
        ? hourly.precipitation_probability
        : [];

    const precipitation =
      Array.isArray(hourly?.precipitation)
        ? hourly.precipitation
        : [];

    const weatherCodes =
      Array.isArray(hourly?.weather_code)
        ? hourly.weather_code
        : [];

    if (!times.length) {
      return {
        state: "quiet",
        text: "",
      };
    }

    const current = vietnamClock(now);
    const currentMinute = current.hour * 60 + current.minute;
    const strongHours = [];

    times.forEach((time, index) => {
      const value = String(time || "");

      if (!value.startsWith(current.dateKey)) return;

      /*
       * Open-Meteo hourly precipitation belongs to the preceding hour.
       * A value stamped 20:00 describes approximately 19:00–20:00.
       */
      const endHour = Number(value.slice(11, 13));

      if (!Number.isInteger(endHour) || endHour <= 0) return;

      const startHour = endHour - 1;
      const endMinute = endHour * 60;

      if (endMinute <= currentMinute) return;

      const entry = {
        startHour,
        endHour,
        probability: Number(probabilities[index] || 0),
        amount: Number(precipitation[index] || 0),
        weatherCode: Number(weatherCodes[index]),
      };

      if (hasStrongRainSignal(entry)) {
        strongHours.push(entry);
      }
    });

    if (!strongHours.length) {
      return {
        state: "quiet",
        text: "",
      };
    }

    const groups = [];

    strongHours.forEach((entry) => {
      const currentGroup = groups.at(-1);
      const previous = currentGroup?.at(-1);

      if (!previous || entry.startHour !== previous.endHour) {
        groups.push([entry]);
      } else {
        currentGroup.push(entry);
      }
    });

    const windows = groups.map((group) => {
      const start = hourLabel(group[0].startHour);
      const end = hourLabel(group.at(-1).endHour);

      return `${start}–${end}`;
    });

    return {
      state: "rain",
      text: `Strong rain signal: ${windows.join(" and ")}`,
    };
  }

  root.JoyWeather = Object.freeze({
    summarizeRainForecast,
  });
})(typeof window !== "undefined" ? window : globalThis);
