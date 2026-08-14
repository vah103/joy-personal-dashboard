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
    `${frontend}\nthis.__helpers = { extractExplicitServiceRateForDisplay, normalizeServiceRateForDisplay, servicesForDisplay };`,
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

test("shows 3.99-style electricity as 4k without changing other service rates", async () => {
  const { normalizeServiceRateForDisplay, servicesForDisplay } = await loadServiceDisplayHelpers();

  assert.equal(normalizeServiceRateForDisplay("3.99/số", "electricity"), "4k/số");
  assert.equal(normalizeServiceRateForDisplay("3.990/số", "electricity"), "4k/số");
  assert.equal(normalizeServiceRateForDisplay("3,99/1 số", "electricity"), "4k/số");
  assert.equal(normalizeServiceRateForDisplay("3.8/số", "electricity"), "3.8/số");

  assert.deepEqual(
    JSON.parse(JSON.stringify(servicesForDisplay("Điện 3.990/số, nước 35k/khối", {}))),
    { electricity: "4k/số", water: "35k/khối" },
  );
});

test("renders electricity and water as separate customer-view rows", async () => {
  const frontend = await readFile(
    new URL("../src/pages/sale/room-address-ai.js", import.meta.url),
    "utf8",
  );

  assert.match(frontend, /className = "room-share-service-group"/u);
  assert.match(frontend, /electricityRow\.className = "room-share-detail-row"/u);
  assert.match(frontend, /waterRow\.className = "room-share-detail-row"/u);
  assert.doesNotMatch(frontend, /if \(electricity\) row\.append\(", "\)/u);
});

test("does not turn unrelated common fees into electricity or water", async () => {
  const { servicesForDisplay } = await loadServiceDisplayHelpers();
  const source = "Dịch vụ chung 180k/ng, mạng 100k, gửi xe 100k.";

  assert.deepEqual(
    JSON.parse(JSON.stringify(servicesForDisplay(source, {}))),
    { electricity: "", water: "" },
  );
});
