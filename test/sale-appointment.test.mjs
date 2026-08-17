import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseSaleAppointmentInput } from "../src/features/sales/appointments/appointment.js";
import { isSaleViewingRoute } from "../worker/sale-viewings.js";

const NOW = new Date("2026-07-27T12:00:00.000Z");

test("parses a Vietnamese viewing appointment for tomorrow evening", () => {
  const parsed = parseSaleAppointmentInput("mai 8h tối chị Lan 0987654321 xem phòng 180 Phú Mỹ", NOW);
  assert.equal(parsed.customerName, "chị Lan");
  assert.equal(parsed.phone, "0987654321");
  assert.equal(parsed.viewingAddress, "180 Phú Mỹ");
  assert.equal(parsed.viewingAt, "2026-07-28T13:00:00.000Z");
  assert.equal(parsed.valid, true);
});

test("parses relative appointments and treats giờ khách qua as now", () => {
  const relative = parseSaleAppointmentInput("30p nữa anh Nam 0912345678 xem 25 Mỹ Đình", NOW);
  assert.equal(relative.viewingAt, "2026-07-27T12:30:00.000Z");
  assert.equal(relative.customerName, "anh Nam");
  assert.equal(relative.phone, "0912345678");
  assert.equal(relative.viewingAddress, "25 Mỹ Đình");

  const now = parseSaleAppointmentInput("giờ khách qua chị Mai xem 90 Cầu Giấy", NOW);
  assert.equal(now.viewingAt, NOW.toISOString());
  assert.equal(now.customerName, "chị Mai");
  assert.equal(now.viewingAddress, "90 Cầu Giấy");
});

test("matches GPT Sale defaults for dayparts and unnamed customers", () => {
  const morning = parseSaleAppointmentInput("sáng mai xem 12 Trần Duy Hưng", NOW);
  assert.equal(morning.viewingAt, "2026-07-28T02:00:00.000Z");
  assert.equal(morning.customerName, "Khách");

  const afternoon = parseSaleAppointmentInput("chiều mai anh Tú xem 54 Hồ Tùng Mậu", NOW);
  assert.equal(afternoon.viewingAt, "2026-07-28T08:00:00.000Z");

  const evening = parseSaleAppointmentInput("tối mai chị Hoa xem 180 Phú Mỹ", NOW);
  assert.equal(evening.viewingAt, "2026-07-28T13:00:00.000Z");
});

test("finds an absolute time even when the phone number comes first", () => {
  const parsed = parseSaleAppointmentInput("0987654321 chị Lan 20h ngày mai xem 180 Phú Mỹ", NOW);
  assert.equal(parsed.customerName, "chị Lan");
  assert.equal(parsed.phone, "0987654321");
  assert.equal(parsed.viewingAt, "2026-07-28T13:00:00.000Z");
  assert.equal(parsed.viewingAddress, "180 Phú Mỹ");
});

test("parses labeled multiline Sale forms without treating the source as the customer", () => {
  const parsed = parseSaleAppointmentInput(`
    Khách xem phòng
    Địa chỉ: 180 Phú Mỹ
    Nguồn: chị Linh
    SĐT: 0987654321
    Thời gian: mai 8h tối
  `, NOW);

  assert.equal(parsed.customerName, "Khách");
  assert.equal(parsed.phone, "0987654321");
  assert.equal(parsed.viewingAddress, "180 Phú Mỹ");
  assert.equal(parsed.viewingAt, "2026-07-28T13:00:00.000Z");
  assert.equal(parsed.valid, true);
});

test("uses a leading standalone customer name before the Sale source header", () => {
  const parsed = parseSaleAppointmentInput(`
    chị Lan
    Nguồn: chị Linh
    Địa chỉ: 180 Phú Mỹ
    SĐT: 0987654321
    Thời gian: mai 8h tối
  `, NOW);

  assert.equal(parsed.customerName, "chị Lan");
  assert.equal(parsed.phone, "0987654321");
  assert.equal(parsed.viewingAddress, "180 Phú Mỹ");
  assert.equal(parsed.viewingAt, "2026-07-28T13:00:00.000Z");
});

test("prefers an explicit customer label in multiline Sale forms", () => {
  const parsed = parseSaleAppointmentInput(`
    Khách: chị Lan
    Nguồn: chị Linh
    Địa chỉ: 180 Phú Mỹ
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
