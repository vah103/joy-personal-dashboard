import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUpcomingViewings, parseSheetViewingTime } from "../worker/sales.js";

test("parses a Sheet viewing time in Vietnam time", () => {
  assert.equal(
    parseSheetViewingTime("23/07/2026 15:00"),
    Date.parse("2026-07-23T08:00:00.000Z"),
  );
});

test("rejects invalid Sheet dates", () => {
  assert.equal(parseSheetViewingTime("31/02/2026 15:00"), null);
  assert.equal(parseSheetViewingTime("2026-07-23 15:00"), null);
});

test("keeps upcoming appointments in Sheet row order", () => {
  const now = Date.parse("2026-07-22T08:00:00.000Z");
  const rows = [
    ["Tomorrow first", "0901", "Room A", "23/07/2026 15:00", "BEFORE_PENDING", "AFTER_PENDING"],
    [],
    ["Already passed", "0902", "Room B", "22/07/2026 14:59", "", ""],
    ["Current minute", "0903", "Room C", "22/07/2026 15:00", "", ""],
    ["Later but lower in Sheet", "0904", "Room D", "24/07/2026 09:00", "", ""],
  ];

  assert.deepEqual(
    normalizeUpcomingViewings(rows, now).map(({ sourceRow, customerName }) => ({ sourceRow, customerName })),
    [
      { sourceRow: 2, customerName: "Tomorrow first" },
      { sourceRow: 5, customerName: "Current minute" },
      { sourceRow: 6, customerName: "Later but lower in Sheet" },
    ],
  );
});
