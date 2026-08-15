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
    `${frontend}\nthis.__helpers = { normalizeServiceRateForDisplay, servicesForDisplay };`,
    sandbox,
  );
  return { helpers: sandbox.__helpers, frontend };
}

test("frontend does not recover electricity or water directly from raw source", async () => {
  const { helpers, frontend } = await loadServiceDisplayHelpers();
  const source = "Phí dịch vụ: Điện 4k, nước 135k/ng, dv chung 180k/ng.";

  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.servicesForDisplay(source, {}))),
    { electricity: "", water: "", items: [] },
  );
  assert.doesNotMatch(frontend, /extractExplicitServiceRateForDisplay/u);
});

test("normalizes backend-provided per-number and per-cubic-meter units for display", async () => {
  const { helpers } = await loadServiceDisplayHelpers();

  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.servicesForDisplay("ignored raw source", {
      electricity: "4k/1 số",
      water: "35k/m3",
    }))),
    { electricity: "4k/số", water: "35k/khối", items: [] },
  );
});

test("preserves backend-provided numeric amounts instead of rounding or adding money units", async () => {
  const { helpers } = await loadServiceDisplayHelpers();
  const { normalizeServiceRateForDisplay, servicesForDisplay } = helpers;

  assert.equal(normalizeServiceRateForDisplay("3.99/số", "electricity"), "3.99/số");
  assert.equal(normalizeServiceRateForDisplay("3.990/số", "electricity"), "3.990/số");
  assert.equal(normalizeServiceRateForDisplay("3,99/1 số", "electricity"), "3,99/số");
  assert.equal(normalizeServiceRateForDisplay("3.8/số", "electricity"), "3.8/số");
  assert.equal(normalizeServiceRateForDisplay("35/khối", "water"), "35/khối");

  assert.deepEqual(
    JSON.parse(JSON.stringify(servicesForDisplay("ignored", {
      electricity: "3.990/số",
      water: "35/khối",
    }))),
    { electricity: "3.990/số", water: "35/khối", items: [] },
  );
});

test("keeps dynamic service items while formatting backend electricity and water", async () => {
  const { helpers } = await loadServiceDisplayHelpers();

  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.servicesForDisplay("ignored", {
      electricity: "4k/số",
      water: "35k/khối",
      items: [
        { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
      ],
    }))),
    {
      electricity: "4k/số",
      water: "35k/khối",
      items: [
        { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
      ],
    },
  );
});

test("renders electricity and water as bullet items under the service heading", async () => {
  const frontend = await readFile(
    new URL("../src/pages/sale/room-address-ai.js", import.meta.url),
    "utf8",
  );

  assert.match(frontend, /className = "room-share-service-group"/u);
  assert.match(frontend, /const list = document\.createElement\("ul"\)/u);
  assert.match(frontend, /list\.className = "room-share-services"/u);
  assert.match(frontend, /const item = document\.createElement\("li"\)/u);
  assert.doesNotMatch(frontend, /electricityRow\.className = "room-share-detail-row"/u);
  assert.doesNotMatch(frontend, /waterRow\.className = "room-share-detail-row"/u);
});

test("unrelated fees remain unrelated when backend leaves electricity and water blank", async () => {
  const { helpers } = await loadServiceDisplayHelpers();
  const source = "Dịch vụ chung 180k/ng, mạng 100k, gửi xe 100k.";

  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.servicesForDisplay(source, { items: [] }))),
    { electricity: "", water: "", items: [] },
  );
});
