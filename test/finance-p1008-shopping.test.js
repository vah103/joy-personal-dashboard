import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  isFinanceP1008ShoppingRoute,
  normalizeFinanceP1008ShoppingData,
} from "../worker/finance-p1008-shopping.js";

const source = await readFile(new URL("../project-data/finance/finance-p1008-shopping-v1.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../project-data/finance/finance-p1008-shopping-v1.css", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../worker/finance-p1008-shopping.js", import.meta.url), "utf8");
const routerSource = await readFile(new URL("../worker/router.js", import.meta.url), "utf8");
const schemaSource = await readFile(new URL("../worker/shared/schema.js", import.meta.url), "utf8");
const buildSource = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");

test("P1008 shopping module parses and provides monthly item entry", () => {
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Chia tiền mua đồ chung/);
  assert.match(source, /data-shopping-new-name/);
  assert.match(source, /data-shopping-new-amount/);
  assert.match(source, /data-shopping-new-split/);
  assert.match(source, /\+ Thêm món/);
  assert.match(source, /data-shopping-delete/);
  assert.match(source, /khoản chốt ngày 15\/8 được lưu trong Tháng 8\/2026/);
});

test("P1008 shopping applies the 6, 5 and 4 person rules", () => {
  assert.match(source, /splitCount === 5[\s\S]*person !== "Hưng"/);
  assert.match(source, /splitCount === 4[\s\S]*person !== "Hưng" && person !== "A Mạnh"/);
  assert.match(source, /6 người · chia đều tất cả/);
  assert.match(source, /5 người · không Hưng/);
  assert.match(source, /4 người · không Hưng, A Mạnh/);
  assert.match(source, /Math\.floor\(item\.amount \/ eligible\.length\)/);
  assert.match(source, /remainder > 0/);
});

test("P1008 shopping renders item totals and each member's exact monthly total", () => {
  for (const person of ["A Mạnh", "A Cường", "Vanh", "Dương", "Hưng", "Trung"]) {
    assert.match(source, new RegExp(person));
  }
  assert.match(source, /Tổng mua chung/);
  assert.match(source, /Phần của Vanh/);
  assert.match(source, /Tổng mua chung phải đóng/);
  assert.match(source, /p1008-shopping-people-grid/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /font-family: "Nunito"/);
});

test("P1008 shopping API normalizes monthly dynamic items", () => {
  assert.equal(isFinanceP1008ShoppingRoute("/api/p1008-shopping"), true);
  assert.equal(isFinanceP1008ShoppingRoute("/api/p1008"), false);

  assert.deepEqual(normalizeFinanceP1008ShoppingData({
    "2026-08": [
      { id: "soap", name: "  Nước   rửa chén  ", amount: "120000", splitCount: 6 },
      { id: "bags", name: "Túi rác", amount: 90000, splitCount: 5 },
      { id: "rack", name: "Kệ bếp", amount: 400000, splitCount: 4 },
      { id: "invalid", name: "", amount: 1, splitCount: 6 },
      { id: "wrong-split", name: "Sai", amount: 10, splitCount: 3 },
    ],
    "2027-01": [{ id: "ignored", name: "Bỏ qua", amount: 10, splitCount: 6 }],
  }), {
    "2026-08": [
      { id: "soap", name: "Nước rửa chén", amount: 120000, splitCount: 6 },
      { id: "bags", name: "Túi rác", amount: 90000, splitCount: 5 },
      { id: "rack", name: "Kệ bếp", amount: 400000, splitCount: 4 },
    ],
  });
});

test("P1008 shopping sync is account scoped and independent of Google Sheets", () => {
  assert.match(source, /const API_PATH = "\/api\/p1008-shopping"/);
  assert.match(source, /credentials: "same-origin"/);
  assert.match(source, /method: "PUT"/);
  assert.match(source, /DIRTY_KEY/);
  assert.match(source, /Đã đồng bộ tài khoản/);
  assert.match(workerSource, /getSession\(request, env\)/);
  assert.match(workerSource, /session\.user_email/);
  assert.match(workerSource, /isSameOrigin\(request\)/);
  assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS finance_p1008_shopping/);
  assert.match(schemaSource, /user_email TEXT PRIMARY KEY/);
  assert.ok(
    routerSource.indexOf("isFinanceP1008ShoppingRoute(pathname)")
      < routerSource.indexOf("integrationForApiPath(pathname)"),
  );
});

test("canonical build emits the P1008 shopping assets", () => {
  assert.match(buildSource, /finance-p1008-shopping-v1\.css\?v=joy-finance-p1008-shopping-v1/);
  assert.match(buildSource, /finance-p1008-shopping-v1\.js\?v=joy-finance-p1008-shopping-v1/);
});
