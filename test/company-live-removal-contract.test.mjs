import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("removed Company Live Board is absent from UI, bundle, Worker and locales", () => {
  assert.doesNotMatch(read("src/pages/dashboard/app-config.js"), /company-live-map|companyBoard/);
  assert.doesNotMatch(read("scripts/build.mjs"), /company-live-board|company-live-map/);
  assert.doesNotMatch(read("worker/router.js"), /company-live-board|isCompanyLiveBoardRoute|handleCompanyLiveBoardRequest/);
  for (const lang of ["en", "vi"]) {
    assert.doesNotMatch(read("src/i18n/locales/" + lang + ".js"), /"companyBoard\./);
  }
  for (const path of [
    "src/features/company-live-board",
    "worker/company-live-board.js",
    "worker/company-live-board-model.js",
    "docs/COMPANY_LIVE_BOARD.md",
  ]) {
    assert.equal(existsSync(resolve(root, path)), false, path);
  }
});
