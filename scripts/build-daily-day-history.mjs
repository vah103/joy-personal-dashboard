import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");
const appTarget = resolve(root, "dist", "app.js");

let script = await readFile(scriptTarget, "utf8");

const historicalSource = String.raw`
  const HISTORICAL_DAYS = Object.freeze({
    "2026-09-16": {
      label: "Ngoại lệ lịch sử · 16/09",
      streak: { "no-snacks": true, "no-masturbate": true, finasteride: true },
      blocks: [
        ["07:00", "dậy (8h)", ["luộc trứng", "đánh răng", "ăn trứng", "pha trà", "cho quần áo giặt"]],
        ["07:30", "đi tập (9h) · Chest-day", ["Warmup : bec deck + đẩy tạ đơn 17.5", "Đẩy tạ đơn 22.5x2 (8)", "Đẩy máy smith 25x3 (8)", "Bec deck 130x3 (8)", "Đẩy vai trước 60x3 (8)", "Bay vai 12.5x3 (10)"]],
        ["09:00", "về (10h)", ["uống trà", "cắm cơm", "tắm gội", "chuẩn bị thức ăn", "phơi quần áo"]],
        ["10:30", "ăn (11h15)", ["không xem gì khi ăn", "uống dht", "đánh răng"]],
        ["11:30", "đến trường làm đồ án (12h15)", []],
        ["16:30", "về đến nhà", ["cắm cơm", "chuẩn bị đồ ăn", "tắm gội", "rửa mặt", "ăn"]],
        ["18:00", "học tiếng anh qua AI", []],
        ["19:00", "học ngoại khoá (tuỳ chọn)", ["soạn timeline cho ngày mai", "Uống finas", "xịt minoxidil"]],
        ["22:00", "giải trí", []],
      ],
      done: [
        [true, true, true, true, true],
        [true, true, true, true, false, false],
        [true, true, true, true, true],
        [false, true, true],
        [],
        [true, true, true, false, false],
        [],
        [false, true, true],
        [],
      ],
    },
    "2026-09-17": {
      label: "Ngoại lệ lịch sử · 17/09",
      streak: { "no-snacks": true, "no-masturbate": true, finasteride: true },
      blocks: [
        ["07:00", "dậy", ["luộc trứng", "đánh răng", "ăn trứng", "pha trà", "cho quần áo giặt", "ngâm nồi cơm"]],
        ["07:30", "đi tập (Nay mưa nên 8-9h làm đồ án) · Back day", ["Warm-up : kéo xà x2 (6)", "Kéo dây 36x2 (10)", "Kéo lat 110x4 (8)", "Kéo trap 120x4 (8)", "Vai sau 100x3 (8)"]],
        ["09:00", "", ["uống trà", "cắm cơm", "tắm gội", "chuẩn bị thức ăn", "phơi quần áo"]],
        ["10:30", "ăn", ["không xem gì khi ăn", "uống dht", "đánh răng", "ngâm nồi cơm", "Giặt quần áo tiếp"]],
        ["11:30", "làm đồ án", []],
        ["16:30", "xong đồ án", ["cắm cơm", "chuẩn bị đồ ăn", "tắm gội", "rửa mặt", "ăn"]],
        ["18:00", "học tiếng anh qua AI", []],
        ["19:00", "học ngoại khoá (tuỳ chọn)", ["soạn timeline cho ngày mai", "Uống finas", "xịt minoxidil", "đánh răng"]],
        ["22:00", "giải trí", []],
      ],
      done: [
        [true, true, true, true, true, true],
        [false, false, false, false, false],
        [true, true, true, true, true],
        [false, true, true, true, true],
        [],
        [true, true, true, true, true],
        [],
        [false, true, true, false],
        [],
      ],
    },
    "2026-09-18": {
      label: "Ngoại lệ lịch sử · 18/09",
      streak: { "no-snacks": true, "no-masturbate": true, finasteride: true },
      blocks: [
        ["06:00", "dậy", ["luộc trứng", "đánh răng", "ăn trứng", "pha trà", "cho quần áo giặt", "ngâm nồi cơm"]],
        ["07:30", "đi tập (Nay lên báo cáo) · Chest-day", ["Warmup : bec deck + đẩy tạ đơn 17.5", "Đẩy tạ đơn 22.5x2 (7)", "Đẩy máy smith 25x3 (6)", "Bec deck 130x3 (8)", "Đẩy vai trước 60x3 (8)", "Bay vai 12.5x3 (10)"]],
        ["07:30", "Back day", ["Warm-up : kéo xà x2 (6)", "Kéo dây 36x2 (10)", "Kéo lat 110x4 (8)", "Kéo trap 120x4 (8)", "Vai sau 100x3 (8)"]],
        ["07:30", "Leg day", ["Calf raise 40x4", "Tập bụng 90x4", "Hack Squad …x3", "Leg Extension 120x3 (8)", "Leg Curl 90x3 (7)"]],
        ["09:00", "về", ["uống trà", "cắm cơm", "tắm gội", "chuẩn bị thức ăn", "phơi quần áo"]],
        ["10:30", "ăn", ["không xem gì khi ăn", "uống dht", "đánh răng", "ngâm nồi cơm"]],
        ["11:30", "đến trường làm đồ án", []],
        ["16:30", "về đến nhà", ["cắm cơm", "chuẩn bị đồ ăn", "tắm gội", "rửa mặt", "ăn"]],
        ["18:00", "học tiếng anh qua AI", []],
        ["19:00", "học ngoại khoá (tuỳ chọn)", ["soạn timeline cho ngày mai", "Uống finas", "xịt minoxidil", "rã đông thịt"]],
        ["22:00", "giải trí", []],
      ],
      done: [
        [false, true, false, true, true, true],
        [false, false, false, false, false, false],
        [false, false, false, false, false],
        [false, false, false, false, false],
        [true, true, true, true, true],
        [false, false, false, false],
        [],
        [true, true, true, true, true],
        [],
        [false, true, true, true],
        [],
      ],
    },
    "2026-09-19": {
      label: "Ngoại lệ lịch sử · 19/09",
      streak: { "no-snacks": true, "no-masturbate": true, finasteride: true },
      blocks: [
        ["07:00", "dậy", ["luộc trứng", "đánh răng", "ăn trứng", "pha trà", "cho quần áo giặt", "ngâm nồi cơm"]],
        ["07:30", "đi tập · Back day", ["Warm-up : kéo xà x2 (6)", "Kéo dây 30x2 (10)", "Kéo lat 110x4 (8)", "Kéo trap 120x3 (8)", "Vai sau 100x3 (8)"]],
        ["09:00", "", ["uống trà", "cắm cơm", "tắm gội", "chuẩn bị thức ăn", "phơi quần áo"]],
        ["10:30", "ăn", ["không xem gì khi ăn", "uống dht", "đánh răng", "ngâm nồi cơm", "Giặt quần áo tiếp"]],
        ["11:30", "làm đồ án", []],
        ["16:30", "xong đồ án", ["cắm cơm", "chuẩn bị đồ ăn", "tắm gội", "rửa mặt", "ăn"]],
        ["18:00", "học tiếng anh qua AI", []],
        ["19:00", "học ngoại khoá (tuỳ chọn)", ["soạn timeline cho ngày mai", "Uống finas", "xịt minoxidil", "đánh răng"]],
        ["22:00", "giải trí", []],
      ],
      done: [
        [false, true, false, true, true, true],
        [true, true, true, true, true],
        [true, true, true, true, true],
        [false, false, false, false, false],
        [],
        [false, false, false, false, false],
        [],
        [false, false, false, false],
        [],
      ],
    },
  });
  const historicalDay = (dateKey) => HISTORICAL_DAYS[dateKey] || null;
  const blocksForDate = (dateKey, templateId) => historicalDay(dateKey)?.blocks || blocks(templateId);
  const itemIdForDate = (dateKey, templateId, blockIndex, itemIndex) => historicalDay(dateKey)
    ? \`history:\${dateKey}:\${blockIndex}:\${itemIndex}\`
    : itemId(templateId, blockIndex, itemIndex);
  window.__JOY_DAILY_DAY_HISTORY__ = HISTORICAL_DAYS;
`;

const blocksAnchor = '  const blocks = (id) => templates[id] || [];\n';
if (!script.includes(blocksAnchor)) throw new Error("Daily Day history: blocks anchor missing");
script = script.replace(blocksAnchor, `${blocksAnchor}${historicalSource}`);

script = script.replace(
  'blocks(templateId).forEach((block, blockIndex) => visibleBlockItems(dateKey, templateId, block).forEach(({ index }) => { total += 1; if (checked(dateKey, itemId(templateId, blockIndex, index))) complete += 1; }));',
  'blocksForDate(dateKey, templateId).forEach((block, blockIndex) => visibleBlockItems(dateKey, templateId, block).forEach(({ index }) => { total += 1; if (checked(dateKey, itemIdForDate(dateKey, templateId, blockIndex, index))) complete += 1; }));',
);
script = script.replace(
  'const templateId = resolvedTemplate(view.date); const dayBlocks = blocks(templateId); const summary = stats(view.date, templateId);',
  'const templateId = resolvedTemplate(view.date); const history = historicalDay(view.date); const dayBlocks = blocksForDate(view.date, templateId); const summary = stats(view.date, templateId);',
);
script = script.replace(
  'const options = TEMPLATE_IDS.map((id) => `<option value="${id}" ${id === templateId ? "selected" : ""}>${esc(t(templateKey(id)))}</option>`).join("");',
  'const options = history ? `<option value="${templateId}" selected>${esc(history.label)}</option>` : TEMPLATE_IDS.map((id) => `<option value="${id}" ${id === templateId ? "selected" : ""}>${esc(t(templateKey(id)))}</option>`).join("");',
);
script = script.replaceAll(
  'checked(view.date, itemId(templateId, bi, entry.index))',
  'checked(view.date, itemIdForDate(view.date, templateId, bi, entry.index))',
);
script = script.replaceAll(
  'const id = itemId(templateId, bi, index);',
  'const id = itemIdForDate(view.date, templateId, bi, index);',
);
script = script.replace(
  '<strong>${esc(t(templateKey(templateId)))}</strong>',
  '<strong>${esc(history?.label || t(templateKey(templateId)))}</strong>',
);

const backfillScript = String.raw`
;(() => {
  const BACKFILL_ID = "history-20260916-v1";
  const CORE_KEY = "joy-daily-day-v1";
  const STREAK_KEY = "joy-daily-day-streak-v1";
  const history = window.__JOY_DAILY_DAY_HISTORY__;
  if (!history) return;

  const parse = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  };

  const backfill = { core: { checks: {}, backfills: { [BACKFILL_ID]: true } }, workoutValues: {}, streak: { days: {} } };
  Object.entries(history).forEach(([dateKey, day]) => {
    const checks = {};
    day.blocks.forEach((block, blockIndex) => {
      const flags = Array.isArray(day.done?.[blockIndex]) ? day.done[blockIndex] : [];
      block[2].forEach((_, itemIndex) => {
        checks[\`history:\${dateKey}:\${blockIndex}:\${itemIndex}\`] = Boolean(flags[itemIndex]);
      });
    });
    backfill.core.checks[dateKey] = checks;
    backfill.streak.days[dateKey] = { ...day.streak };
  });

  window.__JOY_DAILY_DAY_HISTORY_BACKFILL__ = { id: BACKFILL_ID, data: backfill };

  const core = parse(CORE_KEY);
  core.backfills ||= {};
  if (!core.backfills[BACKFILL_ID]) {
    core.checks ||= {};
    Object.entries(backfill.core.checks).forEach(([dateKey, checks]) => {
      core.checks[dateKey] = { ...(core.checks[dateKey] || {}), ...checks };
    });
    core.backfills[BACKFILL_ID] = true;
    localStorage.setItem(CORE_KEY, JSON.stringify(core));

    const streak = parse(STREAK_KEY);
    streak.days ||= {};
    Object.entries(backfill.streak.days).forEach(([dateKey, values]) => {
      streak.days[dateKey] = { ...(streak.days[dateKey] || {}), ...values };
    });
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  }
})();
`;
script += backfillScript;

for (const required of [
  '"2026-09-16"',
  '"2026-09-19"',
  'Kéo dây 30x2 (10)',
  'history-20260916-v1',
  'blocksForDate(view.date, templateId)',
  'itemIdForDate(view.date, templateId',
]) {
  if (!script.includes(required)) throw new Error(`Daily Day history transform missing: ${required}`);
}

await writeFile(scriptTarget, script);

let app = await readFile(appTarget, "utf8");
const oldLoader = 'import("/daily-day.js?v=joy-daily-day-v24").catch(() => {});';
const newLoader = 'import("/daily-day.js?v=joy-daily-day-v25").catch(() => {});';
if (!app.includes(oldLoader)) throw new Error("Daily Day history: v24 loader anchor missing");
app = app.replace(oldLoader, newLoader);
await writeFile(appTarget, app);

console.log("Daily Day history for 16-19 Sep backfilled as exact historical exceptions");
