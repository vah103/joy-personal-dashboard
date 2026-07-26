(() => {
  const notice = document.querySelector("#weather-rain-notice");
  if (!notice) return;

  const ENDPOINT = "https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&hourly=precipitation_probability,precipitation,weather_code&timezone=Asia%2FHo_Chi_Minh&forecast_days=1";
  const REFRESH_MS = 15 * 60_000;
  const HIGH_PROBABILITY = 70;
  const VERY_HIGH_PROBABILITY = 80;
  const SUPPORTING_AMOUNT_MM = 0.3;
  const STRONG_AMOUNT_MM = 1;

  let currentStatus = null;

  const observer = new MutationObserver(() => {
    if (!currentStatus) return;
    if (
      notice.hidden
      || notice.textContent !== currentStatus.text
      || notice.dataset.state !== currentStatus.state
    ) {
      applyStatus(currentStatus);
    }
  });

  startObserving();
  refreshStatus();
  window.setInterval(refreshStatus, REFRESH_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshStatus();
  });

  async function refreshStatus() {
    try {
      const response = await fetch(ENDPOINT, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
      const payload = await response.json();
      currentStatus = summarizeWeather(payload?.hourly, new Date());
      applyStatus(currentStatus);
    } catch {
      // Keep the existing dashboard weather UI when the forecast service is unavailable.
    }
  }

  function applyStatus(status) {
    observer.disconnect();
    notice.hidden = false;
    notice.textContent = status.text;
    notice.dataset.state = status.state;
    startObserving();
  }

  function startObserving() {
    observer.observe(notice, {
      attributes: true,
      attributeFilter: ["hidden", "data-state"],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function summarizeWeather(hourly, now) {
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
    const current = vietnamClock(now);
    const currentMinute = current.hour * 60 + current.minute;
    const strongHours = [];
    const daylightHours = [];

    times.forEach((time, index) => {
      const value = String(time || "");
      if (!value.startsWith(current.dateKey)) return;

      const endHour = Number(value.slice(11, 13));
      if (!Number.isInteger(endHour) || endHour <= 0) return;
      const startHour = endHour - 1;
      const entry = {
        startHour,
        endHour,
        probability: Number(probabilities[index] || 0),
        amount: Number(precipitation[index] || 0),
        weatherCode: Number(weatherCodes[index]),
      };

      if (startHour >= 6 && startHour < 18) daylightHours.push(entry);
      if (endHour * 60 <= currentMinute) return;
      if (hasStrongRainSignal(entry)) strongHours.push(entry);
    });

    if (strongHours.length) {
      const groups = [];
      strongHours.forEach((entry) => {
        const group = groups.at(-1);
        const previous = group?.at(-1);
        if (!previous || entry.startHour !== previous.endHour) groups.push([entry]);
        else group.push(entry);
      });
      const windows = groups.map((group) => (
        `${hourLabel(group[0].startHour)}–${hourLabel(group.at(-1).endHour)}`
      ));
      return {
        state: "rain",
        text: `Heavy rain is expected in Hanoi at ${windows.join(" and ")}.`,
      };
    }

    const sunnyHours = daylightHours.filter(({ weatherCode }) => (
      weatherCode === 0 || weatherCode === 1
    )).length;
    const isSunny = daylightHours.length >= 4
      && sunnyHours >= Math.ceil(daylightHours.length / 2);

    return isSunny
      ? { state: "sunny", text: "It’s a sunny day." }
      : { state: "chill", text: "No rain is expected, just chill." };
  }

  function hasStrongRainSignal({ probability, amount, weatherCode }) {
    return (probability >= HIGH_PROBABILITY && amount >= SUPPORTING_AMOUNT_MM)
      || amount >= STRONG_AMOUNT_MM
      || (probability >= VERY_HIGH_PROBABILITY && isRainWeatherCode(weatherCode));
  }

  function isRainWeatherCode(code) {
    return (code >= 51 && code <= 67)
      || (code >= 80 && code <= 82)
      || (code >= 95 && code <= 99);
  }

  function vietnamClock(now) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const value = (type) => parts.find((part) => part.type === type)?.value || "";
    return {
      dateKey: `${value("year")}-${value("month")}-${value("day")}`,
      hour: Number(value("hour")),
      minute: Number(value("minute")),
    };
  }

  function hourLabel(hour) {
    return `${String(Math.max(0, Math.min(24, hour))).padStart(2, "0")}:00`;
  }
})();
