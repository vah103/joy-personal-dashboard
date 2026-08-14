import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  addressIsGroundedInSource,
  DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL,
  isSaleRoomSummaryAiRoute,
  normalizeDetectedAddress,
  normalizeRoomAddressSource,
  SALE_ROOM_SUMMARY_AI_PATH,
} from "../worker/sale-room-summary-ai.js";

test("room-address AI route and model are explicit", () => {
  assert.equal(SALE_ROOM_SUMMARY_AI_PATH, "/api/sales/room-summary/address");
  assert.equal(isSaleRoomSummaryAiRoute("/api/sales/room-summary/address"), true);
  assert.equal(isSaleRoomSummaryAiRoute("/api/sales/room-summary/polish"), false);
  assert.equal(DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
});

test("normalizes pasted room source without flattening useful address lines", () => {
  assert.equal(
    normalizeRoomAddressSource("  🏢Địa chỉ : Ngõ 278/20/25 Kim Giang  \n - Quận: Hoàng mai \n\n Giá: 4tr4  "),
    "🏢Địa chỉ : Ngõ 278/20/25 Kim Giang\n- Quận: Hoàng mai\n\nGiá: 4tr4",
  );
});

test("normalizes AI address output to the value shown after the Địa chỉ label", () => {
  assert.equal(
    normalizeDetectedAddress("🏢 Địa chỉ: Ngõ 278/20/25 Kim Giang - Quận: Hoàng Mai."),
    "Ngõ 278/20/25 Kim Giang - Quận: Hoàng Mai",
  );
});

test("accepts an address grounded in the source even when capitalization and accents differ", () => {
  const source = `
    🏢Địa chỉ : SỐ 9 ngõ 63/53 Trần Quốc Vượng- Cầu Giấy
    Giá: 5tr1
  `;
  assert.equal(
    addressIsGroundedInSource(source, "Số 9 ngõ 63/53 Trần Quốc Vượng - Cầu Giấy"),
    true,
  );
});

test("rejects an AI address that invents a location not present in the source", () => {
  const source = "Địa chỉ: 180 Phú Mỹ. Phòng 302 giá 4tr2.";
  assert.equal(addressIsGroundedInSource(source, "180 Phú Mỹ, Hà Nội"), false);
});

test("Sale page uses the address-only AI frontend and the build ships it", async () => {
  const [html, build, router] = await Promise.all([
    readFile(new URL("../src/pages/sale/index.html", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /room-address-ai\.js/);
  assert.doesNotMatch(html, /src="room-summary\.js/);
  assert.match(build, /room-address-ai\.js/);
  assert.match(router, /isSaleRoomSummaryAiRoute/);
});
