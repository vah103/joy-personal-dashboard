import assert from "node:assert/strict";
import test from "node:test";
import { translateDynamicText } from "../src/i18n/dynamic-runtime.js";

test("dynamic dashboard labels localize without touching counts", () => {
  assert.equal(translateDynamicText("2 open tasks", "vi"), "2 công việc chưa xong");
  assert.equal(translateDynamicText("1 upcoming viewing", "vi"), "1 lịch xem sắp tới");
  assert.equal(translateDynamicText("3 email mới", "en"), "3 new emails");
});

test("dynamic Finance labels localize composed status and count copy", () => {
  assert.equal(translateDynamicText("4 planned entries", "vi"), "4 giao dịch dự kiến");
  assert.equal(translateDynamicText("Actual · Carryover is included in monthly income.", "vi"), "Thực tế · Số dư chuyển sang được tính trong thu nhập tháng.");
  assert.equal(translateDynamicText("August 2026 finance overview", "vi"), "Tổng quan tài chính Tháng 8 2026");
  assert.equal(translateDynamicText("Tóm tắt Tháng 9 2026", "en"), "September 2026 summary");
});

test("dynamic project, IELTS and vocabulary labels are reversible", () => {
  assert.equal(translateDynamicText("Stage 3 of 8", "vi"), "Giai đoạn 3/8");
  assert.equal(translateDynamicText("5 recorded sessions", "vi"), "5 buổi đã ghi");
  assert.equal(translateDynamicText("45 min", "vi"), "45 phút");
  assert.equal(translateDynamicText("7 saved words", "vi"), "7 từ đã lưu");
  assert.equal(translateDynamicText("Dịch sang tiếng Anh", "en"), "Translate into English");
});

test("unknown and user-like text is preserved", () => {
  assert.equal(translateDynamicText("66 Hồ Tùng Mậu", "vi"), "66 Hồ Tùng Mậu");
  assert.equal(translateDynamicText("Customer note: call after 8", "vi"), "Customer note: call after 8");
});
