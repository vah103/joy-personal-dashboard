import test from "node:test";
import assert from "node:assert/strict";
import {
  extractDynamicServiceItems,
  normalizeDynamicServiceItems,
  serviceEvidenceIsGroundedInSource,
  shouldExtractDynamicServices,
} from "../worker/sale-room-summary-ai.js";

test("a bundled common fee stays one package instead of becoming duplicated member fees", () => {
  const source = "DV chung 180k/ng gồm vệ sinh, rác, mạng, điện chung, máy giặt.";
  const evidence = "DV chung 180k/ng gồm vệ sinh, rác, mạng, điện chung, máy giặt";

  assert.equal(serviceEvidenceIsGroundedInSource(source, evidence), true);
  assert.deepEqual(normalizeDynamicServiceItems(source, [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "180k/ng",
      includes: ["vệ sinh", "rác", "mạng", "điện chung", "máy giặt"],
      evidence,
    },
  ]), [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "180k/người",
      includes: ["Vệ sinh", "Rác", "Mạng", "Điện chung", "Máy giặt chung"],
    },
  ]);
});

test("individually priced services stay as independent items", () => {
  const source = "Mạng 100k/phòng; vệ sinh 30k/ng; máy giặt chung 50k/ng; gửi xe 100k/xe.";

  assert.deepEqual(normalizeDynamicServiceItems(source, [
    {
      kind: "internet",
      name: "Mạng",
      value: "100k/phòng",
      includes: [],
      evidence: "Mạng 100k/phòng",
    },
    {
      kind: "cleaning",
      name: "Vệ sinh",
      value: "30k/ng",
      includes: [],
      evidence: "vệ sinh 30k/ng",
    },
    {
      kind: "washing",
      name: "Máy giặt chung",
      value: "50k/ng",
      includes: [],
      evidence: "máy giặt chung 50k/ng",
    },
    {
      kind: "parking",
      name: "Gửi xe",
      value: "100k/xe",
      includes: [],
      evidence: "gửi xe 100k/xe",
    },
  ]), [
    { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
    { kind: "cleaning", name: "Vệ sinh", value: "30k/người", includes: [] },
    { kind: "washing", name: "Máy giặt chung", value: "50k/người", includes: [] },
    { kind: "parking", name: "Gửi xe", value: "100k/xe", includes: [] },
  ]);
});

test("a package and a separately priced service can coexist", () => {
  const source = "DV 180k/ng gồm vệ sinh, mạng, máy giặt. Xe máy 100k/xe.";

  assert.deepEqual(normalizeDynamicServiceItems(source, [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "180k/ng",
      includes: ["vệ sinh", "mạng", "máy giặt"],
      evidence: "DV 180k/ng gồm vệ sinh, mạng, máy giặt",
    },
    {
      kind: "parking",
      name: "Gửi xe",
      value: "100k/xe",
      includes: [],
      evidence: "Xe máy 100k/xe",
    },
  ]), [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "180k/người",
      includes: ["Vệ sinh", "Mạng", "Máy giặt chung"],
    },
    { kind: "parking", name: "Gửi xe", value: "100k/xe", includes: [] },
  ]);
});

test("a package member is not duplicated when AI assigns the package fee to that member", () => {
  const source = "DV chung 180k/ng gồm vệ sinh, mạng, máy giặt.";
  const evidence = "DV chung 180k/ng gồm vệ sinh, mạng, máy giặt";

  assert.deepEqual(normalizeDynamicServiceItems(source, [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "180k/ng",
      includes: ["vệ sinh", "mạng", "máy giặt"],
      evidence,
    },
    {
      kind: "internet",
      name: "Mạng",
      value: "180k/ng",
      includes: [],
      evidence,
    },
  ]), [
    {
      kind: "common",
      name: "Dịch vụ chung",
      value: "180k/người",
      includes: ["Vệ sinh", "Mạng", "Máy giặt chung"],
    },
  ]);
});

test("invented evidence or a swapped service value is rejected", () => {
  const source = "Mạng 100k/phòng, gửi xe 80k/xe.";

  assert.deepEqual(normalizeDynamicServiceItems(source, [
    {
      kind: "internet",
      name: "Mạng",
      value: "80k/xe",
      includes: [],
      evidence: "Mạng 100k/phòng, gửi xe 80k/xe",
    },
    {
      kind: "other",
      name: "Phí quản lý",
      value: "200k/tháng",
      includes: [],
      evidence: "Phí quản lý 200k/tháng",
    },
  ]), []);
});

test("new service types can use other without changing the schema", () => {
  const source = "Thẻ thang máy 50k/tháng.";

  assert.equal(shouldExtractDynamicServices(source), true);
  assert.deepEqual(normalizeDynamicServiceItems(source, [
    {
      kind: "other",
      name: "Thẻ thang máy",
      value: "50k/tháng",
      includes: [],
      evidence: "Thẻ thang máy 50k/tháng",
    },
  ]), [
    { kind: "other", name: "Thẻ thang máy", value: "50k/tháng", includes: [] },
  ]);
});

test("electricity and water are not duplicated into dynamic service items", () => {
  const source = "Phí dịch vụ: Điện 4k/số, nước 35k/khối.";

  assert.deepEqual(normalizeDynamicServiceItems(source, [
    {
      kind: "other",
      name: "Điện",
      value: "4k/số",
      includes: [],
      evidence: "Điện 4k/số",
    },
    {
      kind: "other",
      name: "Nước",
      value: "35k/khối",
      includes: [],
      evidence: "nước 35k/khối",
    },
  ]), []);
});

test("semantic service AI pass uses structured output and grounds the returned items", async () => {
  const source = "Mạng 100k/phòng. Gửi xe 80k/xe.";
  const calls = [];
  const env = {
    AI: {
      run: async (model, options) => {
        calls.push({ model, options });
        return {
          response: {
            items: [
              {
                kind: "internet",
                name: "Mạng",
                value: "100k/phòng",
                includes: [],
                evidence: "Mạng 100k/phòng",
              },
              {
                kind: "parking",
                name: "Gửi xe",
                value: "80k/xe",
                includes: [],
                evidence: "Gửi xe 80k/xe",
              },
            ],
          },
        };
      },
    },
  };

  assert.deepEqual(await extractDynamicServiceItems(source, env, "test-model"), [
    { kind: "internet", name: "Mạng", value: "100k/phòng", includes: [] },
    { kind: "parking", name: "Gửi xe", value: "80k/xe", includes: [] },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "test-model");
  assert.equal(calls[0].options.temperature, 0);
  assert.equal(calls[0].options.response_format.type, "json_schema");
});

test("semantic service AI pass is skipped when the source has no service cues", async () => {
  let called = false;
  const env = {
    AI: {
      run: async () => {
        called = true;
        return { response: { items: [] } };
      },
    },
  };

  assert.deepEqual(await extractDynamicServiceItems("Phòng P201 giá 4tr5", env, "test-model"), []);
  assert.equal(called, false);
});
