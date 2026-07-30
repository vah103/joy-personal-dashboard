import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../project-data/finance/finance-p1008-shopping-compact-v1.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../project-data/finance/finance-p1008-shopping-compact-v1.css", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/dashboard/index.html", import.meta.url), "utf8");

test("P1008 shopping split controls show only 6, 5 or 4", () => {
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /option\.textContent !== option\.value/);
  assert.match(source, /option\.textContent = option\.value/);
  assert.match(source, /p1008-shopping-split-cell small/);
});

test("P1008 shopping rows and member columns group 6 before 5 before 4", () => {
  assert.match(source, /right\.splitCount - left\.splitCount/);
  assert.match(source, /sortItemRows/);
  assert.match(source, /sortPeopleColumns/);
  assert.match(source, /data-shopping-split/);
});

test("P1008 shopping input table is compact and fits mobile without a forced wide canvas", () => {
  assert.match(styles, /width: min\(600px, 100%\) !important/);
  assert.match(styles, /width: 108px !important/);
  assert.match(styles, /width: 46px !important/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*min-width: 0 !important/);
  assert.doesNotMatch(styles, /min-width: 620px/);
});

test("P1008 account sync remains active but its visible labels are removed", () => {
  assert.match(source, /p1008-local-state/);
  assert.match(source, /badge\.remove\(\)/);
  assert.match(styles, /\.p1008-view \.p1008-local-state[\s\S]*display: none !important/);
});

test("shared shopping member table provides fullscreen capture and landscape lock", () => {
  assert.match(source, /data-shopping-fullscreen/);
  assert.match(source, /Toàn màn hình/);
  assert.match(source, /requestFullscreen \|\| card\.webkitRequestFullscreen/);
  assert.match(source, /orientation\.lock\("landscape"\)/);
  assert.match(source, /document\.exitFullscreen \|\| document\.webkitExitFullscreen/);
  assert.match(source, /fullscreenchange/);
  assert.match(styles, /\.p1008-shopping-people-card\.is-shopping-capture-mode/);
  assert.match(styles, /height: 100dvh !important/);
  assert.match(styles, /body\.p1008-shopping-capture-active/);
  assert.match(styles, /\.p1008-shopping-fullscreen-actions/);
});

test("canonical dashboard loads compact shopping assets after the base shopping table assets", () => {
  const tablesCss = "finance-p1008-shopping-tables-v1.css?v=joy-finance-p1008-shopping-tables-v3";
  const compactCss = "finance-p1008-shopping-compact-v1.css?v=joy-finance-p1008-shopping-compact-v1";
  const tablesJs = "finance-p1008-shopping-tables-v1.js?v=joy-finance-p1008-shopping-tables-v3";
  const compactJs = "finance-p1008-shopping-compact-v1.js?v=joy-finance-p1008-shopping-compact-v1";
  assert.ok(dashboard.indexOf(tablesCss) < dashboard.indexOf(compactCss));
  assert.ok(dashboard.indexOf(tablesJs) < dashboard.indexOf(compactJs));
});