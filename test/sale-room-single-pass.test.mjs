import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Room Summary uses one Workers AI pass and reconciles dynamic services from that payload", async () => {
  const [core, wrapper, serviceGrounding] = await Promise.all([
    readFile(new URL("../worker/sale-room-summary-ai-core.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-room-summary-ai.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-room-service-items-ai.js", import.meta.url), "utf8"),
  ]);

  assert.equal((core.match(/env\.AI\.run/gu) || []).length, 1);
  assert.match(core, /serviceItems:\s*\{/u);
  assert.match(core, /"serviceItems"/u);
  assert.match(core, /serviceItems,\s*\n\s*\}\);/u);

  assert.match(wrapper, /normalizeDynamicServiceItems\(source, payload\.serviceItems\)/u);
  assert.doesNotMatch(wrapper, /extractDynamicServiceItems/u);
  assert.doesNotMatch(wrapper, /env\.AI\.run/u);

  assert.doesNotMatch(serviceGrounding, /extractDynamicServiceItems/u);
  assert.doesNotMatch(serviceGrounding, /shouldExtractDynamicServices/u);
  assert.doesNotMatch(serviceGrounding, /env\.AI\.run/u);
});

test("Room Summary frontend bounds request latency and cancels obsolete requests", async () => {
  const frontend = await readFile(
    new URL("../src/pages/sale/room-address-ai.js", import.meta.url),
    "utf8",
  );

  assert.match(frontend, /ROOM_SUMMARY_REQUEST_TIMEOUT_MS = 20000/u);
  assert.match(frontend, /new AbortController\(\)/u);
  assert.match(frontend, /signal,/u);
  assert.match(frontend, /activeRequestController\?\.abort\(\)/u);
  assert.match(frontend, /window\.setTimeout\(\(\) => controller\.abort\(\), ROOM_SUMMARY_REQUEST_TIMEOUT_MS\)/u);
});
