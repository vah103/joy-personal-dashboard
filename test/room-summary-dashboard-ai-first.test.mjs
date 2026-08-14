import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const appConfig = fs.readFileSync(new URL("src/pages/dashboard/app-config.js", root), "utf8");
const controllerPath = new URL("project-data/sales/room-summary-ai-first-dashboard.js", root);
const controller = fs.readFileSync(controllerPath, "utf8");

test("dashboard loads the AI-first Room Summary controller", () => {
  assert.match(appConfig, /project-data\/sales\/room-summary-ai-first-dashboard\.js/);
});

test("dashboard Sale Assistant sends the original listing to the semantic AI endpoint", () => {
  assert.match(controller, /\/api\/sales\/room-summary\/analyze/);
  assert.match(controller, /JSON\.stringify\(\{ source \}\)/);
  assert.match(controller, /payload\?\.applied === true && payload\?\.extraction/);
  assert.match(controller, /summaryFromExtraction\(payload\.extraction\)/);
});

test("dashboard controller blocks the old parser click and keeps it only as fallback", () => {
  assert.match(controller, /event\.stopImmediatePropagation\(\)/);
  assert.match(controller, /roomSummaryEngine = "ai-first"/);
  assert.match(controller, /roomSummaryEngine = "parser-fallback"/);
  assert.match(controller, /summarizeRoomListing\(source\)/);
});

test("dashboard semantic renderer supports area, floor and service includes", () => {
  assert.match(controller, /cleanup\.sale\.roomArea/);
  assert.match(controller, /cleanup\.sale\.roomFloor/);
  assert.match(controller, /service\.includes/);
  assert.match(controller, /cleanup\.sale\.includes/);
});

test("dashboard AI-first controller passes JavaScript syntax validation", () => {
  const result = spawnSync(process.execPath, ["--check", controllerPath.pathname], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
