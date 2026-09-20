import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scriptTarget = resolve(root, "dist", "daily-day.js");

let script = await readFile(scriptTarget, "utf8");
const start = script.indexOf('    "2026-09-18": {');
const end = script.indexOf('    "2026-09-19": {', start);
if (start < 0 || end < 0) throw new Error("Daily Day Friday history section not found");

let section = script.slice(start, end);

const workoutLines = [
  '        ["07:30", "đi tập (Nay lên báo cáo) · Chest-day", ["Warmup : bec deck + đẩy tạ đơn 17.5", "Đẩy tạ đơn 22.5x2 (7)", "Đẩy máy smith 25x3 (6)", "Bec deck 130x3 (8)", "Đẩy vai trước 60x3 (8)", "Bay vai 12.5x3 (10)"]],\n',
  '        ["07:30", "Back day", ["Warm-up : kéo xà x2 (6)", "Kéo dây 36x2 (10)", "Kéo lat 110x4 (8)", "Kéo trap 120x4 (8)", "Vai sau 100x3 (8)"]],\n',
  '        ["07:30", "Leg day", ["Calf raise 40x4", "Tập bụng 90x4", "Hack Squad …x3", "Leg Extension 120x3 (8)", "Leg Curl 90x3 (7)"]],\n',
];

for (const line of workoutLines) {
  if (!section.includes(line)) throw new Error(`Friday workout line missing: ${line.slice(0, 64)}`);
  section = section.replace(line, "");
}

const chestDone = '        [false, false, false, false, false, false],\n';
const fiveFalse = '        [false, false, false, false, false],\n';
if ((section.split(chestDone).length - 1) !== 1) throw new Error("Friday chest done row mismatch");
if ((section.split(fiveFalse).length - 1) !== 2) throw new Error("Friday back/leg done row mismatch");
section = section.replace(chestDone, "").replaceAll(fiveFalse, "");

if (section.includes('["07:30"')) throw new Error("Friday 07:30 workout rows still present");
script = `${script.slice(0, start)}${section}${script.slice(end)}`;
await writeFile(scriptTarget, script);

console.log("Daily Day Friday 18/09 history now has no 07:30 workout blocks");
