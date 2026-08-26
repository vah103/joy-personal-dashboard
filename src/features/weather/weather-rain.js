(function registerJoyWeather(root) {
  const TIME_ZONE = "Asia/Ho_Chi_Minh";
  const RAIN_PROBABILITY_THRESHOLD = 85;
  const WEATHER_WEEK_ENDPOINT = "https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&current=apparent_temperature,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&hourly=precipitation_probability,weather_code&timezone=Asia%2FHo_Chi_Minh&past_days=1&forecast_days=6";
  const WEATHER_WEEK_CACHE_MS = 30 * 60_000;

  const weekState = {
    status: "idle",
    days: [],
    current: { apparentTemperature: Number.NaN, humidity: Number.NaN },
    fetchedAt: 0,
    error: "",
  };

  function translate(key, fallback, values = {}) {
    const translated = typeof root.JoyI18n?.t === "function" ? root.JoyI18n.t(key, values) : "";
    return translated && translated !== key ? translated : fallback;
  }

  function formatUiDate(value, options) {
    if (typeof root.JoyI18n?.formatDate === "function") {
      return root.JoyI18n.formatDate(value, { ...options, timeZone: TIME_ZONE });
    }
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: TIME_ZONE }).format(value);
  }

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

  function hasRainSignal({ probability }) {
    return Number(probability || 0) >= RAIN_PROBABILITY_THRESHOLD;
  }

  function groupRainWindows(rainHours) {
    const groups = [];
    rainHours.forEach((entry) => {
      const currentGroup = groups.at(-1);
      const previous = currentGroup?.at(-1);
      if (!previous || entry.startHour !== previous.endHour) groups.push([entry]);
      else currentGroup.push(entry);
    });
    return groups.map((group) => `${hourLabel(group[0].startHour)}–${hourLabel(group.at(-1).endHour)}`);
  }

  function summarizeRainForecast(hourly, now = new Date()) {
    const times = Array.isArray(hourly?.time) ? hourly.time : [];
    const probabilities = Array.isArray(hourly?.precipitation_probability)
      ? hourly.precipitation_probability
      : [];
    if (!times.length) return { state: "quiet", text: "No rain is expected." };

    const current = vietnamClock(now);
    const currentMinute = current.hour * 60 + current.minute;
    const rainHours = [];
    times.forEach((time, index) => {
      const value = String(time || "");
      if (!value.startsWith(current.dateKey)) return;
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

    if (!rainHours.length) return { state: "quiet", text: "No rain is expected." };
    return {
      state: "rain",
      text: `Rain is expected in Hanoi at ${groupRainWindows(rainHours).join(" and ")}.`,
    };
  }

  function weatherDetails(code) {
    if (code === 0) return { label: "Clear sky", kind: "sunny" };
    if (code === 1) return { label: "Mostly clear", kind: "sunny" };
    if (code === 2) return { label: "Partly cloudy", kind: "partly-cloudy" };
    if (code === 3) return { label: "Overcast", kind: "cloudy" };
    if ([45, 48].includes(code)) return { label: "Foggy", kind: "fog" };
    if (code >= 51 && code <= 57) return { label: "Light drizzle", kind: "rain" };
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", kind: "rain" };
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return { label: "Snow", kind: "snow" };
    if (code >= 95) return { label: "Thunderstorm", kind: "thunder" };
    return { label: "Mixed weather", kind: "cloudy" };
  }

  function summarizeDayStatus(hourly, dateKey, now = new Date()) {
    const times = Array.isArray(hourly?.time) ? hourly.time : [];
    const probabilities = Array.isArray(hourly?.precipitation_probability)
      ? hourly.precipitation_probability
      : [];
    const weatherCodes = Array.isArray(hourly?.weather_code) ? hourly.weather_code : [];
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
      if (startHour >= 6 && startHour < 18) daylightHours.push({ startHour, endHour, weatherCode });
      if (isToday && endHour * 60 <= currentMinute) return;
      const entry = { startHour, endHour, probability: Number(probabilities[index] || 0) };
      if (hasRainSignal(entry)) rainHours.push(entry);
    });

    if (rainHours.length) {
      const windows = groupRainWindows(rainHours).join(" and ");
      return {
        state: "rain",
        text: translate("dynamic.weather.rainAt", `Rain at ${windows}.`, { windows }),
      };
    }

    const sunnyHours = daylightHours.filter(({ weatherCode }) => weatherCode === 0 || weatherCode === 1).length;
    const isSunny = daylightHours.length >= 4 && sunnyHours >= Math.ceil(daylightHours.length / 2);
    return isSunny
      ? { state: "sunny", text: translate("dynamic.weather.sunnyDay", "It’s a sunny day.") }
      : { state: "quiet", text: translate("dynamic.weather.noRain", "No rain is expected.") };
  }

  function normalizeWeekWeather(payload, now = new Date()) {
    const daily = payload?.daily || {};
    const dates = Array.isArray(daily.time) ? daily.time : [];
    return dates.map((date, index) => {
      const dateKey = String(date || "");
      const code = Number(daily.weather_code?.[index]);
      return {
        date: dateKey,
        code,
        maximum: Number(daily.temperature_2m_max?.[index]),
        minimum: Number(daily.temperature_2m_min?.[index]),
        status: summarizeDayStatus(payload?.hourly, dateKey, now),
        fallback: weatherDetails(code),
      };
    }).filter((day) => day.date);
  }

  function normalizeCurrentWeather(payload) {
    return {
      apparentTemperature: Number(payload?.current?.apparent_temperature),
      humidity: Number(payload?.current?.relative_humidity_2m),
    };
  }

  function dateFromKey(dateKey) {
    return new Date(`${dateKey}T00:00:00+07:00`);
  }

  function dayLabel(day, index) {
    if (index === 0) return translate("dynamic.weather.yesterday", "Yesterday");
    if (index === 1) return translate("dynamic.weather.today", "Today");
    return formatUiDate(dateFromKey(day.date), { weekday: "short" });
  }

  function shortDate(dateKey) {
    return formatUiDate(dateFromKey(dateKey), { month: "short", day: "numeric" });
  }

  function rounded(value) {
    return Number.isFinite(value) ? `${Math.round(value)}°` : "—";
  }

  function percentage(value) {
    return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
  }

  function weatherKind(day) {
    if (day?.status?.state === "rain") return "rain";
    if (day?.status?.state === "sunny") return "sunny";
    return day?.fallback?.kind || weatherDetails(Number(day?.code)).kind;
  }

  function weatherArt(day, idSuffix) {
    const kind = weatherKind(day);
    const suffix = String(idSuffix || day?.date || "weather").replace(/[^a-zA-Z0-9]/g, "");
    const sunId = `joyWeatherSun${suffix}`;
    const cloudId = `joyWeatherCloud${suffix}`;
    const rainId = `joyWeatherRain${suffix}`;
    const defs = `
      <defs>
        <radialGradient id="${sunId}" cx="36%" cy="28%" r="72%"><stop offset="0" stop-color="#fff7c6"/><stop offset=".42" stop-color="#ffd965"/><stop offset="1" stop-color="#efa934"/></radialGradient>
        <linearGradient id="${cloudId}" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#dbe8ec"/><stop offset=".48" stop-color="#9db6c1"/><stop offset="1" stop-color="#5f7d8b"/></linearGradient>
        <linearGradient id="${rainId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#72b8df"/><stop offset="1" stop-color="#3f789e"/></linearGradient>
      </defs>`;
    const sun = `
      <g><g stroke="#efb23b" stroke-width="4" stroke-linecap="round" opacity=".9"><path d="M48 8v10M48 78v10M8 48h10M78 48h10M20 20l7 7M69 69l7 7M76 20l-7 7M27 69l-7 7"/></g><circle cx="48" cy="48" r="22" fill="url(#${sunId})"/><circle cx="41" cy="40" r="7" fill="#fff" opacity=".26"/></g>`;
    const cloud = `
      <g><ellipse cx="52" cy="63" rx="33" ry="18" fill="url(#${cloudId})"/><circle cx="38" cy="55" r="17" fill="url(#${cloudId})"/><circle cx="56" cy="48" r="22" fill="url(#${cloudId})"/><circle cx="73" cy="58" r="15" fill="url(#${cloudId})"/><path d="M29 58c9-13 24-19 39-11" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".18"/></g>`;
    const drops = `<g fill="none" stroke="url(#${rainId})" stroke-width="4" stroke-linecap="round"><path d="M35 79l-4 8M53 81l-4 8M70 78l-4 8"/></g>`;
    let body = cloud;
    if (kind === "sunny") body = sun;
    if (kind === "partly-cloudy") body = `<g transform="translate(-12 -12) scale(.78)">${sun}</g>${cloud}`;
    if (kind === "rain") body = `${cloud}${drops}`;
    if (kind === "thunder") body = `${cloud}<path d="M54 73h12l-10 13h8L46 101l6-15h-8z" fill="#d49a31"/>`;
    if (kind === "fog") body = `${cloud}<g stroke="#77929e" stroke-width="3" stroke-linecap="round" opacity=".72"><path d="M22 83h52M31 92h43"/></g>`;
    if (kind === "snow") body = `${cloud}<g fill="#d8edf7"><circle cx="35" cy="84" r="3"/><circle cx="52" cy="89" r="3"/><circle cx="69" cy="83" r="3"/></g>`;
    return `<svg class="joy-weather-art" viewBox="0 0 104 104" aria-hidden="true" focusable="false">${defs}${body}</svg>`;
  }

  function statusGlyph(state) {
    if (state === "rain") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c3.8 4.7 6 7.6 6 10.4a6 6 0 0 1-12 0c0-2.8 2.2-5.7 6-10.4Z"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M7.5 6.5A8 8 0 0 0 18 17M6 11.8A6 6 0 0 0 12.2 18"/></svg>`;
  }

  function thermometerIcon() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 4a2.5 2.5 0 0 1 5 0v9.2a4.5 4.5 0 1 1-5 0V4Z"/><path d="M12 7v8"/></svg>`;
  }

  function humidityIcon() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c4.1 5 6.2 7.9 6.2 10.6a6.2 6.2 0 0 1-12.4 0C5.8 11.4 7.9 8.5 12 3.5Z"/></svg>`;
  }

  function createWeekModal(documentRef) {
    const backdrop = documentRef.createElement("div");
    backdrop.className = "joy-weather-week-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="joy-weather-week-modal" role="dialog" aria-modal="true" aria-labelledby="joy-weather-week-title">
        <header class="joy-weather-week-heading">
          <div>
            <p data-i18n="dynamic.weather.title">Hanoi weather</p>
            <h2 id="joy-weather-week-title" data-i18n="dynamic.weather.weekly">Weekly forecast</h2>
            <span data-i18n="dynamic.weather.range">Yesterday, today, and the next five days</span>
          </div>
          <button type="button" aria-label="${translate("dynamic.weather.close", "Close weather overview")}">×</button>
        </header>
        <div class="joy-weather-week-content" aria-live="polite"></div>
      </section>`;
    documentRef.body.append(backdrop);
    return backdrop;
  }

  function injectWeekStyles(documentRef) {
    if (documentRef.querySelector("#joy-weather-week-styles")) return;
    const style = documentRef.createElement("style");
    style.id = "joy-weather-week-styles";
    style.textContent = `
      .weather-card.joy-weather-week-trigger{position:relative;cursor:pointer;transition:transform 180ms ease,border-color 180ms ease,box-shadow 180ms ease}
      .weather-card.joy-weather-week-trigger::after{content:"7 days ↗";position:absolute;right:11px;bottom:6px;color:#58717b;font-size:8px;font-weight:800;letter-spacing:.04em}
      .weather-card.joy-weather-week-trigger:hover{border-color:rgba(52,75,83,.34);transform:translateY(-1px)}
      .weather-card.joy-weather-week-trigger:focus-visible{outline:3px solid rgba(61,94,109,.28);outline-offset:3px}
      .joy-weather-week-backdrop{position:fixed;inset:0;z-index:95;display:grid;place-items:center;padding:22px;background:rgba(18,21,23,.58);backdrop-filter:blur(14px)}
      .joy-weather-week-backdrop[hidden]{display:none!important}
      .joy-weather-week-modal{width:min(1140px,100%);max-height:min(90vh,760px);overflow:auto;padding:27px 28px 26px;border:1px solid rgba(255,255,255,.16);border-radius:29px;background:radial-gradient(circle at 92% 0%,rgba(171,197,207,.24),transparent 26rem),linear-gradient(180deg,#f8f5f0 0%,#f1ede7 100%);box-shadow:0 36px 100px rgba(14,17,19,.34),inset 0 1px rgba(255,255,255,.76);color:#292f32;font-family:"Nunito",ui-rounded,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .joy-weather-week-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:23px}.joy-weather-week-heading p,.joy-weather-week-heading h2,.joy-weather-week-heading span{margin:0}.joy-weather-week-heading p{color:#54727d;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.joy-weather-week-heading h2{margin-top:4px;font-family:"Newsreader",Georgia,serif;font-size:34px;font-weight:500;letter-spacing:-.025em}.joy-weather-week-heading span{display:block;margin-top:5px;color:#7a8184;font-size:11px}.joy-weather-week-heading button{width:40px;height:40px;flex:0 0 40px;border:1px solid #d6d1ca;border-radius:12px;background:rgba(255,255,255,.58);color:#6f7478;font:inherit;font-size:22px;line-height:1;cursor:pointer;transition:background 160ms ease,transform 160ms ease}.joy-weather-week-heading button:hover{background:rgba(255,255,255,.88);transform:translateY(-1px)}
      .joy-weather-week-layout{display:grid;grid-template-columns:minmax(330px,.93fr) minmax(0,1.7fr);gap:17px;align-items:stretch}.joy-weather-today,.joy-weather-mini{border:1px solid rgba(81,95,99,.14);box-shadow:inset 0 1px rgba(255,255,255,.86),0 10px 24px rgba(76,92,98,.07)}
      .joy-weather-today{min-height:366px;padding:21px 22px 19px;display:grid;grid-template-rows:auto 1fr auto auto;gap:13px;border-color:rgba(79,110,122,.34);border-radius:24px;background:radial-gradient(circle at 10% 22%,rgba(255,255,255,.7),transparent 15rem),radial-gradient(circle at 93% 0%,rgba(158,186,198,.34),transparent 17rem),linear-gradient(150deg,rgba(244,249,250,.98),rgba(229,239,243,.93));box-shadow:inset 0 1px rgba(255,255,255,.92),0 18px 36px rgba(76,92,98,.11)}
      .joy-weather-today-header,.joy-weather-mini-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.joy-weather-day-labels{display:grid;gap:3px}.joy-weather-day-labels strong{font-size:14px;line-height:1.15}.joy-weather-today .joy-weather-day-labels strong{font-family:"Newsreader",Georgia,serif;font-size:24px;font-weight:500}.joy-weather-day-labels span{color:#858c8f;font-size:10px}.joy-weather-today .joy-weather-day-labels span{font-size:11px}.joy-weather-day-badge{display:inline-flex;align-items:center;justify-content:center;min-height:23px;padding:0 9px;border-radius:999px;background:rgba(78,112,126,.12);color:#46697a;font-size:9px;font-style:normal;font-weight:800;letter-spacing:.02em}
      .joy-weather-today-main{display:grid;grid-template-columns:148px minmax(0,1fr);align-items:center;gap:12px}.joy-weather-art-wrap{display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.7),rgba(113,151,166,.07) 67%,transparent 68%)}.joy-weather-today .joy-weather-art-wrap{width:142px;height:142px}.joy-weather-mini .joy-weather-art-wrap{width:62px;height:62px}.joy-weather-art{width:84%;height:84%;overflow:visible;filter:drop-shadow(0 8px 8px rgba(62,86,97,.17))}
      .joy-weather-today-temperature{min-width:0;display:flex;align-items:baseline;gap:10px}.joy-weather-today-temperature strong{color:#2d3437;font-family:"Newsreader",Georgia,serif;font-size:64px;font-weight:500;letter-spacing:-.035em;line-height:.95}.joy-weather-today-temperature span{color:#748087;font-size:27px}
      .joy-weather-today-condition{min-height:48px;margin:0;padding:12px 2px;display:flex;align-items:center;gap:10px;border-top:1px solid rgba(72,92,99,.12);color:#657177;font-size:12px;line-height:1.35}.joy-weather-today-condition>svg,.joy-weather-mini-condition>svg{width:17px;height:17px;flex:0 0 17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.joy-weather-today[data-weather-state="rain"] .joy-weather-today-condition,.joy-weather-mini[data-weather-state="rain"] .joy-weather-mini-condition{color:#3f6679;font-weight:700}
      .joy-weather-today-stats{padding-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid rgba(72,92,99,.12)}.joy-weather-today-stat{min-width:0;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:10px;padding:0 10px}.joy-weather-today-stat+.joy-weather-today-stat{border-left:1px solid rgba(72,92,99,.11)}.joy-weather-today-stat>svg{width:26px;height:26px;fill:none;stroke:#6f858e;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round}.joy-weather-today-stat small,.joy-weather-today-stat strong{display:block}.joy-weather-today-stat small{color:#778286;font-size:10px}.joy-weather-today-stat strong{margin-top:1px;color:#2f393d;font-family:"Newsreader",Georgia,serif;font-size:22px;font-weight:500;line-height:1}
      .joy-weather-secondary-grid{min-width:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:13px}.joy-weather-mini{min-width:0;min-height:176px;padding:15px 17px 13px;display:grid;grid-template-rows:auto 1fr auto;gap:7px;border-radius:20px;background:radial-gradient(circle at 100% 0%,rgba(176,196,204,.16),transparent 10rem),rgba(255,255,255,.57);transition:transform 180ms ease,box-shadow 180ms ease,border-color 180ms ease}.joy-weather-mini:hover{transform:translateY(-2px);box-shadow:inset 0 1px rgba(255,255,255,.9),0 15px 28px rgba(76,92,98,.10)}.joy-weather-mini.is-yesterday{opacity:.78}.joy-weather-mini-main{min-width:0;display:grid;grid-template-columns:70px minmax(0,1fr);align-items:center;gap:8px}.joy-weather-mini-temperature{min-width:0;display:flex;align-items:baseline;gap:7px}.joy-weather-mini-temperature strong{color:#2d3437;font-family:"Newsreader",Georgia,serif;font-size:34px;font-weight:500;line-height:1}.joy-weather-mini-temperature span{color:#818789;font-size:14px}.joy-weather-mini-condition{min-height:28px;margin:0;padding-top:9px;display:flex;align-items:center;gap:7px;border-top:1px solid rgba(79,92,96,.10);color:#666e71;font-size:10px;line-height:1.25}
      .joy-weather-week-state{min-height:360px;display:grid;place-items:center;align-content:center;gap:6px;color:#747879;text-align:center}.joy-weather-week-state strong{color:#292f32;font-size:14px}.joy-weather-week-state span{font-size:11px}.joy-weather-week-state button{min-height:36px;margin-top:8px;padding:0 13px;border:1px solid #c8c2ba;border-radius:10px;background:#fbfaf7;color:#4f5862;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
      @media(max-width:920px){.joy-weather-week-layout{grid-template-columns:1fr}.joy-weather-today{min-height:330px}.joy-weather-secondary-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:none}}
      @media(max-width:760px){.weather-card.joy-weather-week-trigger::after{content:"7d ↗"}.joy-weather-week-backdrop{align-items:end;padding:10px}.joy-weather-week-modal{width:100%;max-height:88vh;padding:18px 15px 20px;border-radius:24px}.joy-weather-week-heading{margin-bottom:16px}.joy-weather-week-heading h2{font-size:28px}.joy-weather-today{min-height:316px;padding:18px}.joy-weather-today-main{grid-template-columns:120px minmax(0,1fr)}.joy-weather-today .joy-weather-art-wrap{width:116px;height:116px}.joy-weather-today-temperature strong{font-size:54px}.joy-weather-today-temperature span{font-size:22px}.joy-weather-mini{min-height:168px}}
      @media(max-width:520px){.joy-weather-secondary-grid{grid-template-columns:1fr}.joy-weather-today-main{grid-template-columns:102px minmax(0,1fr);gap:6px}.joy-weather-today .joy-weather-art-wrap{width:96px;height:96px}.joy-weather-today-temperature strong{font-size:48px}.joy-weather-today-temperature span{font-size:19px}.joy-weather-today-stat{padding-inline:4px}}
      @media(prefers-reduced-motion:reduce){.weather-card.joy-weather-week-trigger,.joy-weather-mini,.joy-weather-week-heading button{transition:none}}
    `;
    documentRef.head.append(style);
  }

  function dayStatus(day) {
    return day.status || { state: "quiet", text: day.fallback.label };
  }

  function renderTodayHero(day) {
    const status = dayStatus(day);
    const high = rounded(day.maximum);
    const low = rounded(day.minimum);
    return `
      <article class="joy-weather-today" data-weather-state="${status.state}" data-weather-role="today-hero">
        <header class="joy-weather-today-header">
          <div class="joy-weather-day-labels"><strong>${dayLabel(day, 1)}</strong><span>${shortDate(day.date)}</span></div>
          <em class="joy-weather-day-badge">${translate("dynamic.weather.now", "Now")}</em>
        </header>
        <div class="joy-weather-today-main">
          <div class="joy-weather-art-wrap">${weatherArt(day, `today${day.date}`)}</div>
          <div class="joy-weather-today-temperature" aria-label="${translate("dynamic.weather.highLowAria", `High ${high}, low ${low}`, { high, low })}"><strong>${high}</strong><span>${low}</span></div>
        </div>
        <p class="joy-weather-today-condition">${statusGlyph(status.state)}<span>${status.text}</span></p>
        <div class="joy-weather-today-stats">
          <div class="joy-weather-today-stat">${thermometerIcon()}<span><small>${translate("dynamic.weather.realFeel", "Real feel")}</small><strong>${rounded(weekState.current.apparentTemperature)}</strong></span></div>
          <div class="joy-weather-today-stat">${humidityIcon()}<span><small>${translate("dynamic.weather.humidity", "Humidity")}</small><strong>${percentage(weekState.current.humidity)}</strong></span></div>
        </div>
      </article>`;
  }

  function renderMiniDay(day, index) {
    const status = dayStatus(day);
    const modifier = index === 0 ? " is-yesterday" : "";
    const high = rounded(day.maximum);
    const low = rounded(day.minimum);
    return `
      <article class="joy-weather-mini${modifier}" data-weather-state="${status.state}" data-weather-role="secondary-day">
        <header class="joy-weather-mini-header"><div class="joy-weather-day-labels"><strong>${dayLabel(day, index)}</strong><span>${shortDate(day.date)}</span></div></header>
        <div class="joy-weather-mini-main">
          <div class="joy-weather-art-wrap">${weatherArt(day, `mini${index}${day.date}`)}</div>
          <div class="joy-weather-mini-temperature" aria-label="${translate("dynamic.weather.highLowAria", `High ${high}, low ${low}`, { high, low })}"><strong>${high}</strong><span>${low}</span></div>
        </div>
        <p class="joy-weather-mini-condition">${statusGlyph(status.state)}<span>${status.text}</span></p>
      </article>`;
  }

  function renderWeek(content) {
    if (weekState.status === "loading") {
      content.innerHTML = `<div class="joy-weather-week-state"><strong>${translate("dynamic.weather.checking", "Checking the seven-day weather…")}</strong><span>${translate("dynamic.weather.loading", "Joy is loading the latest Hanoi forecast.")}</span></div>`;
      return;
    }
    if (weekState.status === "error") {
      content.innerHTML = `<div class="joy-weather-week-state"><strong>${translate("dynamic.weather.unavailable", "Forecast unavailable")}</strong><span>${translate("dynamic.weather.retry", "Please check again in a moment.")}</span><button type="button" data-weather-week-retry>${translate("dynamic.weather.tryAgain", "Try again")}</button></div>`;
      content.querySelector("[data-weather-week-retry]")?.addEventListener("click", () => loadWeek(content, { force: true }));
      return;
    }

    const today = weekState.days[1];
    const secondaryDays = weekState.days.filter((_, index) => index !== 1);
    if (!today || secondaryDays.length !== 6) {
      weekState.status = "error";
      renderWeek(content);
      return;
    }

    content.innerHTML = `
      <div class="joy-weather-week-layout">
        ${renderTodayHero(today)}
        <div class="joy-weather-secondary-grid">${secondaryDays.map((day) => renderMiniDay(day, weekState.days.indexOf(day))).join("")}</div>
      </div>`;
  }

  async function loadWeek(content, { force = false } = {}) {
    const cacheIsFresh = weekState.days.length === 7 && Date.now() - weekState.fetchedAt < WEATHER_WEEK_CACHE_MS;
    if (!force && cacheIsFresh) {
      weekState.status = "ready";
      renderWeek(content);
      return;
    }

    weekState.status = "loading";
    renderWeek(content);
    try {
      const response = await root.fetch(WEATHER_WEEK_ENDPOINT, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
      const payload = await response.json();
      const days = normalizeWeekWeather(payload, new Date());
      if (days.length !== 7) throw new Error("Seven-day weather data is incomplete");
      weekState.status = "ready";
      weekState.days = days;
      weekState.current = normalizeCurrentWeather(payload);
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
    card.title = translate("dynamic.weather.open", "Open the seven-day Hanoi weather overview");

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
    modal.addEventListener("mousedown", (event) => { if (event.target === modal) close(); });
    documentRef.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.hidden) close(); });
  }

  root.JoyWeather = Object.freeze({ summarizeRainForecast });

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => initializeWeekPopup(document), { once: true });
    } else {
      initializeWeekPopup(document);
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
