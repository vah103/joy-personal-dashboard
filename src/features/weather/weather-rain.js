(function registerJoyWeather(root) {
  const TIME_ZONE = "Asia/Ho_Chi_Minh";
  const RAIN_PROBABILITY_THRESHOLD = 80;
  const WEATHER_WEEK_ENDPOINT = "https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=precipitation_probability,weather_code&timezone=Asia%2FHo_Chi_Minh&past_days=1&forecast_days=6";
  const WEATHER_WEEK_CACHE_MS = 30 * 60_000;

  const weekState = {
    status: "idle",
    days: [],
    fetchedAt: 0,
    error: "",
  };

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

  function groupRainWindows(rainHours) {
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

    return groups.map((group) => (
      `${hourLabel(group[0].startHour)}–${hourLabel(group.at(-1).endHour)}`
    ));
  }

  function summarizeRainForecast(hourly, now = new Date()) {
    const times = Array.isArray(hourly?.time) ? hourly.time : [];
    const probabilities = Array.isArray(hourly?.precipitation_probability)
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

      const entry = {
        startHour: endHour - 1,
        endHour,
        probability: Number(probabilities[index] || 0),
      };

      if (endHour * 60 <= currentMinute) return;
      if (hasRainSignal(entry)) rainHours.push(entry);
    });

    if (!rainHours.length) {
      return {
        state: "quiet",
        text: "No rain is expected.",
      };
    }

    return {
      state: "rain",
      text: `Rain is expected in Hanoi at ${groupRainWindows(rainHours).join(" and ")}.`,
    };
  }

  function weatherDetails(code) {
    if (code === 0) return { label: "Clear sky", icon: "☀" };
    if (code === 1) return { label: "Mostly clear", icon: "☀" };
    if (code === 2) return { label: "Partly cloudy", icon: "☁" };
    if (code === 3) return { label: "Overcast", icon: "☁" };
    if ([45, 48].includes(code)) return { label: "Foggy", icon: "≋" };
    if (code >= 51 && code <= 57) return { label: "Light drizzle", icon: "☂" };
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
      return { label: "Rain", icon: "☂" };
    }
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
      return { label: "Snow", icon: "❄" };
    }
    if (code >= 95) return { label: "Thunderstorm", icon: "ϟ" };
    return { label: "Mixed weather", icon: "◌" };
  }

  function summarizeDayStatus(hourly, dateKey, now = new Date()) {
    const times = Array.isArray(hourly?.time) ? hourly.time : [];
    const probabilities = Array.isArray(hourly?.precipitation_probability)
      ? hourly.precipitation_probability
      : [];
    const weatherCodes = Array.isArray(hourly?.weather_code)
      ? hourly.weather_code
      : [];
    const current = vietnamClock(now);
    const currentMinute = current.hour * 60 + current.minute;
    const isToday = dateKey === current.dateKey;
    const rainHours = [];
    const daylightHours = [];

    times.forEach((time, index) => {
      const value = String(time || "");
      if (!value.startsWith(dateKey)) return;

      const endHour = Number(value.slice(11, 13));
      if (!Number.isInteger(endHour) || endHour <= 0) return;

      const startHour = endHour - 1;
      const weatherCode = Number(weatherCodes[index]);

      if (startHour >= 6 && startHour < 18) {
        daylightHours.push({ startHour, endHour, weatherCode });
      }

      if (isToday && endHour * 60 <= currentMinute) return;

      const entry = {
        startHour,
        endHour,
        probability: Number(probabilities[index] || 0),
      };
      if (hasRainSignal(entry)) rainHours.push(entry);
    });

    if (rainHours.length) {
      return {
        state: "rain",
        icon: "☂",
        text: `Rain is expected at ${groupRainWindows(rainHours).join(" and ")}.`,
      };
    }

    const sunnyHours = daylightHours.filter(({ weatherCode }) => (
      weatherCode === 0 || weatherCode === 1
    )).length;
    const isSunny = daylightHours.length >= 4
      && sunnyHours >= Math.ceil(daylightHours.length / 2);

    return isSunny
      ? { state: "sunny", icon: "☀", text: "It’s a sunny day." }
      : { state: "quiet", icon: "☁", text: "No rain is expected." };
  }

  function normalizeWeekWeather(payload, now = new Date()) {
    const daily = payload?.daily || {};
    const dates = Array.isArray(daily.time) ? daily.time : [];

    return dates.map((date, index) => {
      const dateKey = String(date || "");
      const code = Number(daily.weather_code?.[index]);
      const status = summarizeDayStatus(payload?.hourly, dateKey, now);

      return {
        date: dateKey,
        code,
        maximum: Number(daily.temperature_2m_max?.[index]),
        minimum: Number(daily.temperature_2m_min?.[index]),
        status,
        fallback: weatherDetails(code),
      };
    }).filter((day) => day.date);
  }

  function dateFromKey(dateKey) {
    return new Date(`${dateKey}T00:00:00+07:00`);
  }

  function dayLabel(day, index) {
    if (index === 0) return "Yesterday";
    if (index === 1) return "Today";

    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: TIME_ZONE,
    }).format(dateFromKey(day.date));
  }

  function shortDate(dateKey) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: TIME_ZONE,
    }).format(dateFromKey(dateKey));
  }

  function rounded(value) {
    return Number.isFinite(value) ? `${Math.round(value)}°` : "—";
  }

  function createWeekModal(documentRef) {
    const backdrop = documentRef.createElement("div");
    backdrop.className = "joy-weather-week-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="joy-weather-week-modal" role="dialog" aria-modal="true" aria-labelledby="joy-weather-week-title">
        <header class="joy-weather-week-heading">
          <div>
            <p>Hanoi weather</p>
            <h2 id="joy-weather-week-title">7-day weather</h2>
            <span>Yesterday, today, and the next five days</span>
          </div>
          <button type="button" aria-label="Close weather overview">×</button>
        </header>
        <div class="joy-weather-week-content" aria-live="polite"></div>
      </section>
    `;
    documentRef.body.append(backdrop);
    return backdrop;
  }

  function injectWeekStyles(documentRef) {
    if (documentRef.querySelector("#joy-weather-week-styles")) return;

    const style = documentRef.createElement("style");
    style.id = "joy-weather-week-styles";
    style.textContent = `
      .weather-card.joy-weather-week-trigger {
        position: relative;
        cursor: pointer;
        transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
      }
      .weather-card.joy-weather-week-trigger::after {
        content: "7 days ↗";
        position: absolute;
        right: 11px;
        bottom: 6px;
        color: #58717b;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: .04em;
      }
      .weather-card.joy-weather-week-trigger:hover {
        border-color: rgba(52, 75, 83, .34);
        transform: translateY(-1px);
      }
      .weather-card.joy-weather-week-trigger:focus-visible {
        outline: 3px solid rgba(61, 94, 109, .28);
        outline-offset: 3px;
      }
      .joy-weather-week-backdrop {
        position: fixed;
        inset: 0;
        z-index: 95;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(18, 21, 23, .62);
        backdrop-filter: blur(12px);
      }
      .joy-weather-week-backdrop[hidden] { display: none !important; }
      .joy-weather-week-modal {
        width: min(1080px, 100%);
        max-height: min(88vh, 720px);
        overflow: auto;
        padding: 22px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 24px;
        background: #f3f0eb;
        box-shadow: 0 34px 100px rgba(14, 17, 19, .42);
        color: #292f32;
        font-family: "Nunito", ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .joy-weather-week-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 18px;
      }
      .joy-weather-week-heading p,
      .joy-weather-week-heading h2,
      .joy-weather-week-heading span { margin: 0; }
      .joy-weather-week-heading p {
        color: #3f6573;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .11em;
        text-transform: uppercase;
      }
      .joy-weather-week-heading h2 {
        margin-top: 3px;
        font-family: "Newsreader", Georgia, serif;
        font-size: 30px;
        font-weight: 500;
        letter-spacing: -.02em;
      }
      .joy-weather-week-heading span {
        display: block;
        margin-top: 3px;
        color: #747879;
        font-size: 11px;
      }
      .joy-weather-week-heading button {
        width: 36px;
        height: 36px;
        flex: 0 0 36px;
        border: 1px solid #cec9c1;
        border-radius: 11px;
        background: #fbfaf7;
        color: #6f7478;
        font: inherit;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
      }
      .joy-weather-week-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(122px, 1fr));
        gap: 10px;
        overflow-x: auto;
        padding: 2px 1px 8px;
      }
      .joy-weather-day {
        min-width: 0;
        min-height: 205px;
        padding: 14px 12px;
        display: grid;
        grid-template-rows: auto 1fr auto;
        border: 1px solid rgba(66, 78, 81, .17);
        border-radius: 16px;
        background:
          radial-gradient(circle at 100% 0%, rgba(164, 190, 199, .22), transparent 8rem),
          rgba(249, 247, 242, .82);
        box-shadow: inset 0 1px rgba(255,255,255,.68);
      }
      .joy-weather-day.is-yesterday { opacity: .66; }
      .joy-weather-day.is-today {
        border-color: rgba(61, 94, 109, .44);
        background:
          radial-gradient(circle at 90% 0%, rgba(164, 190, 199, .44), transparent 8rem),
          rgba(244, 243, 238, .96);
      }
      .joy-weather-day header { display: grid; gap: 1px; }
      .joy-weather-day header strong { font-size: 12px; }
      .joy-weather-day header span { color: #747879; font-size: 9px; }
      .joy-weather-day-main {
        display: grid;
        place-items: center;
        align-content: center;
        gap: 8px;
        padding: 8px 0;
        text-align: center;
      }
      .joy-weather-day-icon {
        display: grid;
        place-items: center;
        color: #486a77;
        font-size: 27px;
      }
      .joy-weather-day-temperature {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 6px;
      }
      .joy-weather-day-temperature strong {
        font-family: "Newsreader", Georgia, serif;
        font-size: 27px;
        font-weight: 500;
        line-height: 1;
      }
      .joy-weather-day-temperature span {
        color: #747879;
        font-size: 13px;
      }
      .joy-weather-day-condition {
        min-height: 38px;
        margin: 0;
        display: grid;
        place-items: center;
        color: #596365;
        font-size: 10px;
        line-height: 1.35;
        text-align: center;
      }
      .joy-weather-day[data-weather-state="rain"] .joy-weather-day-condition {
        color: #385f70;
        font-weight: 700;
      }
      .joy-weather-day[data-weather-state="sunny"] .joy-weather-day-icon {
        color: #927443;
      }
      .joy-weather-week-state {
        min-height: 210px;
        display: grid;
        place-items: center;
        align-content: center;
        gap: 6px;
        color: #747879;
        text-align: center;
      }
      .joy-weather-week-state strong { color: #292f32; font-size: 14px; }
      .joy-weather-week-state span { font-size: 11px; }
      .joy-weather-week-state button {
        min-height: 36px;
        margin-top: 8px;
        padding: 0 13px;
        border: 1px solid #c8c2ba;
        border-radius: 10px;
        background: #fbfaf7;
        color: #4f5862;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }
      @media (max-width: 760px) {
        .weather-card.joy-weather-week-trigger::after { content: "7d ↗"; }
        .joy-weather-week-backdrop { align-items: end; padding: 10px; }
        .joy-weather-week-modal {
          width: 100%;
          max-height: 86vh;
          padding: 18px 15px 20px;
          border-radius: 22px;
        }
        .joy-weather-week-heading h2 { font-size: 27px; }
        .joy-weather-week-grid { grid-template-columns: repeat(7, minmax(136px, 1fr)); }
      }
      @media (prefers-reduced-motion: reduce) {
        .weather-card.joy-weather-week-trigger { transition: none; }
      }
    `;
    documentRef.head.append(style);
  }

  function renderWeek(content) {
    if (weekState.status === "loading") {
      content.innerHTML = `
        <div class="joy-weather-week-state">
          <strong>Checking the seven-day weather…</strong>
          <span>Joy is loading the latest Hanoi forecast.</span>
        </div>
      `;
      return;
    }

    if (weekState.status === "error") {
      content.innerHTML = `
        <div class="joy-weather-week-state">
          <strong>Forecast unavailable</strong>
          <span>Please check again in a moment.</span>
          <button type="button" data-weather-week-retry>Try again</button>
        </div>
      `;
      content.querySelector("[data-weather-week-retry]")?.addEventListener("click", () => {
        loadWeek(content, { force: true });
      });
      return;
    }

    content.innerHTML = `
      <div class="joy-weather-week-grid">
        ${weekState.days.map((day, index) => {
          const status = day.status || {
            state: "quiet",
            icon: day.fallback.icon,
            text: day.fallback.label,
          };
          const modifier = index === 0 ? " is-yesterday" : index === 1 ? " is-today" : "";

          return `
            <article class="joy-weather-day${modifier}" data-weather-state="${status.state}">
              <header>
                <strong>${dayLabel(day, index)}</strong>
                <span>${shortDate(day.date)}</span>
              </header>
              <div class="joy-weather-day-main">
                <div class="joy-weather-day-icon" aria-hidden="true">${status.icon}</div>
                <div class="joy-weather-day-temperature" aria-label="High ${rounded(day.maximum)}, low ${rounded(day.minimum)}">
                  <strong>${rounded(day.maximum)}</strong>
                  <span>${rounded(day.minimum)}</span>
                </div>
              </div>
              <p class="joy-weather-day-condition">${status.text}</p>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  async function loadWeek(content, { force = false } = {}) {
    const cacheIsFresh = weekState.days.length === 7
      && Date.now() - weekState.fetchedAt < WEATHER_WEEK_CACHE_MS;

    if (!force && cacheIsFresh) {
      weekState.status = "ready";
      renderWeek(content);
      return;
    }

    weekState.status = "loading";
    renderWeek(content);

    try {
      const response = await root.fetch(WEATHER_WEEK_ENDPOINT, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Weather service returned ${response.status}`);

      const payload = await response.json();
      const days = normalizeWeekWeather(payload, new Date());
      if (days.length !== 7) throw new Error("Seven-day weather data is incomplete");

      weekState.status = "ready";
      weekState.days = days;
      weekState.fetchedAt = Date.now();
      weekState.error = "";
    } catch (error) {
      console.error("Joy seven-day weather failed", error);
      weekState.status = "error";
      weekState.error = String(error?.message || "WEATHER_WEEK_FAILED");
    }

    renderWeek(content);
  }

  function initializeWeekPopup(documentRef) {
    const card = documentRef.querySelector(".weather-card");
    if (!card || card.dataset.weatherWeekReady === "true") return;

    injectWeekStyles(documentRef);
    const modal = createWeekModal(documentRef);
    const content = modal.querySelector(".joy-weather-week-content");
    const closeButton = modal.querySelector(".joy-weather-week-heading button");

    card.dataset.weatherWeekReady = "true";
    card.classList.add("joy-weather-week-trigger");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-expanded", "false");
    card.title = "Open the seven-day Hanoi weather overview";

    const open = () => {
      modal.hidden = false;
      card.setAttribute("aria-expanded", "true");
      documentRef.body.classList.add("modal-open");
      loadWeek(content);
      root.setTimeout(() => closeButton?.focus(), 0);
    };

    const close = () => {
      modal.hidden = true;
      card.setAttribute("aria-expanded", "false");
      const anotherModalIsOpen = [...documentRef.querySelectorAll(".modal-backdrop, .joy-weather-week-backdrop")]
        .some((item) => item !== modal && !item.hidden);
      if (!anotherModalIsOpen) documentRef.body.classList.remove("modal-open");
      card.focus({ preventScroll: true });
    };

    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      open();
    });
    closeButton?.addEventListener("click", close);
    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) close();
    });
    documentRef.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) close();
    });
  }

  root.JoyWeather = Object.freeze({
    summarizeRainForecast,
  });

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => initializeWeekPopup(document), { once: true });
    } else {
      initializeWeekPopup(document);
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
