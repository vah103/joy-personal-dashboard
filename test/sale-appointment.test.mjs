import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatVietnamViewingTime,
  parseSaleAppointmentInput,
} from "../src/features/sales/appointments/appointment.js";
import { isSaleViewingRoute } from "../worker/sale-viewings.js";

const NOW = Date.parse("2026-07-27T02:00:00.000Z"); // 09:00 in Vietnam

test("parses a Vietnamese viewing appointment for tomorrow evening", () => {
  const parsed = parseSaleAppointmentInput(
    "8h tối mai chị Lan 0987 654 321 xem phòng 180 Phú Mỹ",
    NOW,
  );

  assert.equal(parsed.customerName, "chị Lan");
  assert.equal(parsed.phone, "0987654321");
  assert.equal(parsed.viewingAddress, "180 Phú Mỹ");
  assert.equal(parsed.viewingAt, "2026-07-28T13:00:00.000Z");
  assert.equal(parsed.valid, true);
  assert.equal(formatVietnamViewingTime(parsed.viewingAt), "Th 3, 28/07/2026 · 20:00");
});

test("parses relative appointments and treats giờ khách qua as now", () => {
  const relative = parseSaleAppointmentInput(
    "30p nữa anh Nam 0912345678 xem phòng 25 ngõ 10 Mỹ Đình",
    NOW,
  );
  assert.equal(relative.customerName, "anh Nam");
  assert.equal(relative.viewingAt, "2026-07-27T02:30:00.000Z");

  const immediate = parseSaleAppointmentInput(
    "chị Mai 0901234567 giờ khách qua xem phòng 12 Cầu Giấy",
    NOW,
  );
  assert.equal(immediate.customerName, "chị Mai");
  assert.equal(immediate.viewingAt, "2026-07-27T02:00:00.000Z");
  assert.equal(immediate.viewingAddress, "12 Cầu Giấy");
});

test("matches GPT Sale defaults for dayparts and unnamed customers", () => {
  const morning = parseSaleAppointmentInput(
    "Sáng mai khách xem phòng 180 Phú Mỹ",
    NOW,
  );
  assert.equal(morning.viewingAt, "2026-07-28T02:00:00.000Z");

  const immediate = parseSaleAppointmentInput(
    "Giờ bạn qua xem phòng 180 Phú Mỹ ạ",
    NOW,
  );
  assert.equal(immediate.customerName, "Khách xem phòng 180 Phú Mỹ");
  assert.equal(immediate.viewingAddress, "180 Phú Mỹ");
  assert.equal(immediate.viewingAt, "2026-07-27T02:00:00.000Z");
});

test("finds an absolute time even when the phone number comes first", () => {
  const parsed = parseSaleAppointmentInput(
    "chị Hương 0988123456 mai 9h30 sáng xem phòng 45 Trần Bình",
    NOW,
  );
  assert.equal(parsed.customerName, "chị Hương");
  assert.equal(parsed.viewingAt, "2026-07-28T02:30:00.000Z");
  assert.equal(parsed.viewingAddress, "45 Trần Bình");
});

test("parses labeled multiline Sale forms without treating the source as the customer", () => {
  const parsed = parseSaleAppointmentInput(`
    🏆TL21House🏆
    🍀Địa chỉ : 66 hồ tùng mậu
    🍀Giá : 4tr5
    🍀Sđt : 0366823628
    🍀Thời gian xem : chiều mai
    🍀CTV : Vanh
    🍀MÃ PHÒNG : 590
  `, NOW);

  assert.equal(parsed.customerName, "Khách 0366823628");
  assert.equal(parsed.phone, "0366823628");
  assert.equal(parsed.viewingAddress, "66 hồ tùng mậu");
  assert.equal(parsed.viewingAt, "2026-07-28T08:00:00.000Z");
  assert.deepEqual(parsed.missing, []);
  assert.equal(parsed.valid, true);
});

test("uses a leading standalone customer name before the Sale source header", () => {
  const parsed = parseSaleAppointmentInput(`
    Thùy Dương
    🏆TL21House🏆
    🍀Địa chỉ : 66 hồ tùng mậu
    🍀Giá : 4tr5
    🍀Sđt : 0366823628
    🍀Thời gian xem : chiều mai
    🍀CTV : Vanh
  `, NOW);

  assert.equal(parsed.customerName, "Thùy Dương");
  assert.equal(parsed.phone, "0366823628");
  assert.equal(parsed.viewingAddress, "66 hồ tùng mậu");
  assert.equal(parsed.viewingAt, "2026-07-28T08:00:00.000Z");
  assert.equal(parsed.valid, true);
});

test("prefers an explicit customer label in multiline Sale forms", () => {
  const parsed = parseSaleAppointmentInput(`
    Tên khách: chị Lan
    Địa chỉ xem phòng: 180 Phú Mỹ
    Số điện thoại: 0987654321
    Thời gian xem: mai 8h tối
  `, NOW);

  assert.equal(parsed.customerName, "chị Lan");
  assert.equal(parsed.phone, "0987654321");
  assert.equal(parsed.viewingAddress, "180 Phú Mỹ");
  assert.equal(parsed.viewingAt, "2026-07-28T13:00:00.000Z");
  assert.equal(parsed.valid, true);
});

test("Sale viewing route is owned by the D1 module", () => {
  assert.equal(isSaleViewingRoute("/api/sales/viewings"), true);
  assert.equal(isSaleViewingRoute("/api/sales/deals"), false);
});

test("dashboard builds D1-backed viewing history and schedules Sale pushes", async () => {
  const [assistantView, appointmentForm, router, worker, migration] = await Promise.all([
    readFile(new URL("../src/features/sales/assistant/assistant-view.js", import.meta.url), "utf8"),
    readFile(new URL("../src/features/sales/assistant/appointment-form.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/router.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/sale-viewings.js", import.meta.url), "utf8"),
    readFile(new URL("../migrations/20260811_sale_viewings.sql", import.meta.url), "utf8"),
  ]);

  assert.match(assistantView, /data-assistant-mode="history"/);
  assert.match(assistantView, /Lịch sử hẹn khách/);
  assert.match(appointmentForm, /Đang lưu lịch vào Joy/);
  assert.doesNotMatch(appointmentForm, /Appointments Sheet|Google Sheets trước khi lưu lịch/);

  assert.match(router, /handleSaleViewingRequest/);
  assert.match(router, /runSaleViewingSchedule/);
  assert.doesNotMatch(router, /handleSaleViewingCreate/);

  assert.match(worker, /INSERT INTO sale_viewings/);
  assert.match(worker, /REMINDER_LEAD_MS = 30 \* 60 \* 1000/);
  assert.match(worker, /FOLLOWUP_DELAY_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(worker, /Lịch xem phòng sắp tới/);
  assert.match(worker, /Theo dõi khách xem phòng/);
  assert.doesNotMatch(worker, /sheets\.googleapis|SALE_SPREADSHEET_ID|Appointments!/);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS sale_viewings/);
  assert.match(migration, /reminder_notified_at/);
  assert.match(migration, /followup_notified_at/);
});