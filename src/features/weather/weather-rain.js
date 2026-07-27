(function registerJoyWeather(root) {
  const TIME_ZONE = "Asia/Ho_Chi_Minh";
  const RAIN_PROBABILITY_THRESHOLD = 80;

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

  function hourLabel(hour) {
    return `${String(Math.max(0, Math.min(24, hour))).padStart(2, "0")}:00`;
  }

  function hasRainSignal({ probability }) {
    return Number(probability || 0) >= RAIN_PROBABILITY_THRESHOLD;
  }

  function summarizeRainForecast(hourly, now = new Date()) {
    const times = Array.isArray(hourly?.time)
      ? hourly.time
      : [];

    const probabilities =
      Array.isArray(hourly?.precipitation_probability)
        ? hourly.precipitation_probability
        : [];

    if (!times.length) {
      return {
        state: "quiet",
        text: "No rain is expected.",
      };
    }

    const current = vietnamClock(now);
    const currentMinute = current.hour * 60 + current.minute;
    const rainHours = [];

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
      };

      if (hasRainSignal(entry)) {
        rainHours.push(entry);
      }
    });

    if (!rainHours.length) {
      return {
        state: "quiet",
        text: "No rain is expected.",
      };
    }

    const groups = [];

    rainHours.forEach((entry) => {
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
      text: `Rain is expected in Hanoi at ${windows.join(" and ")}.`,
    };
  }

  root.JoyWeather = Object.freeze({
    summarizeRainForecast,
  });
})(typeof window !== "undefined" ? window : globalThis);
