import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  addressIsGroundedInSource,
  DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL,
  isSaleRoomSummaryAiRoute,
  LEGACY_SALE_ROOM_ADDRESS_AI_PATH,
  normalizeDetectedAddress,
  normalizeDetectedRooms,
  normalizeRoomSummarySource,
  roomFieldIsAssociatedInSource,
  roomFieldIsGroundedInSource,
  roomIdentifierIsGroundedInSource,
  roomIsExplicitlyUnavailableInSource,
  SALE_ROOM_SUMMARY_AI_PATH,
} from "../worker/sale-room-summary-ai.js";

test("room-summary AI route and model are explicit", () => {
  assert.equal(SALE_ROOM_SUMMARY_AI_PATH, "/api/sales/room-summary/extract");
  assert.equal(LEGACY_SALE_ROOM_ADDRESS_AI_PATH, "/api/sales/room-summary/address");
  assert.equal(isSaleRoomSummaryAiRoute("/api/sales/room-summary/extract"), true);
  assert.equal(isSaleRoomSummaryAiRoute("/api/sales/room-summary/address"), true);
  assert.equal(isSaleRoomSummaryAiRoute("/api/sales/room-summary/polish"), false);
  assert.equal(DEFAULT_SALE_ROOM_SUMMARY_AI_MODEL, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
});

test("normalizes pasted room source without flattening useful listing lines", () => {
  assert.equal(
    normalizeRoomSummarySource("  🏢Địa chỉ : Ngõ 278/20/25 Kim Giang  \n - Quận: Hoàng mai \n\n Giá: 4tr4  "),
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

test("room grounding requires the actual source token instead of a substring", () => {
  const source = "Trống P201 giá 4tr5.";
  assert.equal(roomFieldIsGroundedInSource(source, "P201"), true);
  assert.equal(roomFieldIsGroundedInSource(source, "201"), false);
});

test("does not mistake a bare numeric house number for a room", () => {
  const source = "Địa chỉ: 302 Mỹ Đình. Trống P201 giá 4tr5.";
  assert.equal(roomIdentifierIsGroundedInSource(source, "302"), false);
  assert.equal(roomIdentifierIsGroundedInSource(source, "P201"), true);

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "302", price: "", availability: "" },
    { room: "P201", price: "4tr5", availability: "" },
  ]), [
    { room: "P201", price: "4tr5", availability: "" },
  ]);
});

test("accepts a bare numeric room when the source gives it rental context", () => {
  const source = "Phòng 302 trống 1/9, giá 4tr5.";
  assert.equal(roomIdentifierIsGroundedInSource(source, "302"), true);
  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "302", price: "4tr5", availability: "1/9" },
  ]), [
    { room: "302", price: "4tr5", availability: "1/9" },
  ]);
});

test("keeps room, price and availability only when each value belongs to that room", () => {
  const source = `
    Địa chỉ: 105 Doãn Kế Thiện
    Trống: P201 1/9, P202 vào luôn
    Giá: P201 4tr5; P202 4tr8
  `;

  assert.equal(roomFieldIsAssociatedInSource(source, "P201", "4tr5", ["P201", "P202"]), true);
  assert.equal(roomFieldIsAssociatedInSource(source, "P201", "4tr8", ["P201", "P202"]), false);
  assert.equal(roomFieldIsAssociatedInSource(source, "P201", "1/9", ["P201", "P202"]), true);
  assert.equal(roomFieldIsAssociatedInSource(source, "P201", "vào luôn", ["P201", "P202"]), false);

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "P201", price: "4tr5", availability: "1/9" },
    { room: "P202", price: "4tr8", availability: "vào luôn" },
  ]), [
    { room: "P201", price: "4tr5", availability: "1/9" },
    { room: "P202", price: "4tr8", availability: "vào luôn" },
  ]);
});

test("drops cross-assigned prices and dates even when every individual value exists in the source", () => {
  const source = `
    Trống: P201 1/9, P202 vào luôn
    Giá: P201 4tr5; P202 4tr8
  `;

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "P201", price: "4tr8", availability: "vào luôn" },
    { room: "P202", price: "4tr5", availability: "1/9" },
  ]), [
    { room: "P201", price: "", availability: "" },
    { room: "P202", price: "", availability: "" },
  ]);
});

test("does not leak facts across sentence boundaries when AI omits another room", () => {
  const source = "Trống P201. P202 giá 4tr8.";

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "P201", price: "4tr8", availability: "" },
  ]), [
    { room: "P201", price: "", availability: "" },
  ]);
});

test("does not treat another omitted room's fact as a listing-wide value", () => {
  const source = `
    Trống: P201
    Giá: P202 4tr8
  `;

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "P201", price: "4tr8", availability: "" },
  ]), [
    { room: "P201", price: "", availability: "" },
  ]);
});

test("preserves decimal-comma and decimal-dot prices while validating association", () => {
  const commaSource = "Trống P201 vào luôn, giá P201 3,8tr";
  assert.equal(roomFieldIsAssociatedInSource(commaSource, "P201", "3,8tr", ["P201"]), true);
  assert.deepEqual(normalizeDetectedRooms(commaSource, [
    { room: "P201", price: "3,8tr", availability: "vào luôn" },
  ]), [
    { room: "P201", price: "3,8tr", availability: "vào luôn" },
  ]);

  const dotSource = "Trống P202 vào luôn. Giá P202 5.1tr.";
  assert.deepEqual(normalizeDetectedRooms(dotSource, [
    { room: "P202", price: "5.1tr", availability: "vào luôn" },
  ]), [
    { room: "P202", price: "5.1tr", availability: "vào luôn" },
  ]);
});

test("allows clearly listing-wide price and availability values for several rooms", () => {
  const source = `
    Trống: P201, P202
    Giá: 4tr5
    Ngày trống: 1/9
  `;

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "P201", price: "4tr5", availability: "1/9" },
    { room: "P202", price: "4tr5", availability: "1/9" },
  ]), [
    { room: "P201", price: "4tr5", availability: "1/9" },
    { room: "P202", price: "4tr5", availability: "1/9" },
  ]);
});

test("filters only the room explicitly marked unavailable when statuses share one line", () => {
  const source = "P201 đã cọc, P202 trống 1/9 giá 4tr8";

  assert.equal(roomIsExplicitlyUnavailableInSource(source, "P201"), true);
  assert.equal(roomIsExplicitlyUnavailableInSource(source, "P202"), false);
  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "P201", price: "", availability: "" },
    { room: "P202", price: "4tr8", availability: "1/9" },
  ]), [
    { room: "P202", price: "4tr8", availability: "1/9" },
  ]);
});

test("merges duplicate AI rows for the same room and blanks conflicting facts", () => {
  const source = `
    P201 trống 1/9
    Giá P201 4tr5
    Giá cũ P201 4tr3
  `;

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "P201", price: "4tr5", availability: "" },
    { room: "P201", price: "", availability: "1/9" },
    { room: "P201", price: "4tr3", availability: "" },
  ]), [
    { room: "P201", price: "", availability: "1/9" },
  ]);
});

test("drops invented room details instead of displaying AI guesses", () => {
  const source = "Địa chỉ: 180 Phú Mỹ. Trống P201. Giá 4tr5.";

  assert.deepEqual(normalizeDetectedRooms(source, [
    { room: "P201", price: "5tr9", availability: "15/9" },
    { room: "P999", price: "4tr5", availability: "" },
  ]), [
    { room: "P201", price: "", availability: "" },
  ]);
});

test("Room Summary exposes the current staged AI fields without legacy parser categories", async () => {
  const [html, build, router, frontend, legacyBridge, assistant, dashboardBootstrap] = await Promise.all([
    readFile(new URL("../src/pages/sale/index.html", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/sale/room-address-ai.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/sale/room-summary.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/sales-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/dashboard/app-bootstrap.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /room-address-ai\.js\?v=joy-room-address-ai-v2/);
  assert.doesNotMatch(html, /src="room-summary\.js/);
  assert.match(build, /room-address-ai\.js/);
  assert.match(build, /room-summary\.js/);
  assert.match(router, /isSaleRoomSummaryAiRoute/);
  assert.match(router, /SALE_ROOM_AI_ASSETS/);
  assert.match(router, /noStoreResponse\(await env\.ASSETS\.fetch\(request\)\)/);

  assert.match(frontend, /ROOM_SUMMARY_AI_PATH = "\/api\/sales\/room-summary\/extract"/);
  assert.match(frontend, /summary\.address/);
  assert.match(frontend, /room\.room/);
  assert.match(frontend, /room\.price/);
  assert.match(frontend, /room\.availability/);
  assert.match(frontend, /summary\.roomType/);
  assert.match(frontend, /summary\.elevator/);
  assert.match(frontend, /summary\.furniture/);
  assert.match(frontend, /summary\.services/);
  assert.match(frontend, /servicesForDisplay\(source, payload\.services\)/);
  assert.match(frontend, /services\?\.electricity/);
  assert.match(frontend, /services\?\.water/);
  assert.match(frontend, /appendServices\(details, summary\.services\)/);
  assert.doesNotMatch(frontend, /Lưu ý|SERVICE_DEFINITIONS|FURNITURE_KEYWORDS|NOTE_KEYWORDS/);
  assert.doesNotMatch(frontend, /`#\$\{index \+ 1\}`/);

  assert.match(legacyBridge, /room-address-ai\.js\?v=joy-room-address-ai-v2/);
  assert.doesNotMatch(legacyBridge, /summarizeRoomListing|SERVICE_DEFINITIONS|FURNITURE_KEYWORDS|NOTE_KEYWORDS/);

  assert.match(assistant, /import\("\.\/room-summary\.js\?v=joy-room-summary-v1"\)/);
  assert.doesNotMatch(dashboardBootstrap, /room-summary\/polish|SALE_ROOM_SUMMARY_AI_ENDPOINT|SALE_ROOM_SERVICE_KEYS|runSaleRoomAiPolish/);
});
