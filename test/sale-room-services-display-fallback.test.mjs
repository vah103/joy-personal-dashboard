import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

async function loadServiceDisplayHelpers() {
  const frontend = await readFile(
    new URL("../src/pages/sale/room-address-ai.js", import.meta.url),
    "utf8",
  );
  const sandbox = {
    document: {
      readyState: "loading",
      addEventListener() {},
    },
  };
  vm.runInNewContext(
    `${frontend}\nthis.__helpers = { extractExplicitServiceRateForDisplay, servicesForDisplay };`,
    sandbox,
  );
  return sandbox.__helpers;
}

test("recovers explicit electricity and water when AI leaves service fields blank", async () => {
  const { servicesForDisplay } = await loadServiceDisplayHelpers();
  const source = "Phí dịch vụ: Điện 4k, nước 135k/ng, dv chung 180k/ng.";

  assert.deepEqual(
    JSON.parse(JSON.stringify(servicesForDisplay(source, {}))),
    { electricity: "4k", water: "135k/người" },
  );
});

test("normalizes explicit per-number and per-cubic-meter units in fallback", async () => {
  const { servicesForDisplay } = await loadServiceDisplayHelpers();
  const source = "Điện: 4k/1 số; Nước: 35k/m3";

  assert.deepEqual(
    JSON.parse(JSON.stringify(servicesForDisplay(source, {}))),
    { electricity: "4k/số", water: "35k/khối" },
  );
});

test("does not turn unrelated common fees into electricity or water", async () => {
  const { servicesForDisplay } = await loadServiceDisplayHelpers();
  const source = "Dịch vụ chung 180k/ng, mạng 100k, gửi xe 100k.";

  assert.deepEqual(
    JSON.parse(JSON.stringify(servicesForDisplay(source, {}))),
    { electricity: "", water: "" },
  );
});
