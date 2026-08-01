import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  extractBaoTinManhHaiGoldQuote,
  FINANCE_GOLD_PRICE_ROUTE,
  GOLD_PRICE_PRODUCT,
  isFinanceGoldPriceRoute,
} from "../worker/finance-gold-price.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("BTMH parser extracts the Kim Gia Bao coin buy-back quote", () => {
  const html = `
    <html>
      <head><script>const noise = "${GOLD_PRICE_PRODUCT} 99.999.999 88.888.888";</script></head>
      <body>
        <section>
          <h3>${GOLD_PRICE_PRODUCT}</h3>
          <div class="sell">14.750.000</div>
          <div class="buy">14.350.000</div>
          <div class="change">0</div>
        </section>
        <p>(Cập nhật lúc 2026-07-16 16:25:08.0) Đơn vị: VNĐ/Chỉ</p>
      </body>
    </html>
  `;

  assert.deepEqual(extractBaoTinManhHaiGoldQuote(html), {
    product: GOLD_PRICE_PRODUCT,
    sellPricePerChi: 14_750_000,
    buyPricePerChi: 14_350_000,
    updatedAtSource: "2026-07-16 16:25:08.0)",
    unit: "VND_PER_CHI",
    priceType: "buy",
  });
});

test("BTMH parser fails closed when the expected product is absent", () => {
  assert.throws(
    () => extractBaoTinManhHaiGoldQuote("<html><body>No matching quote</body></html>"),
    /BTMH_GOLD_PRICE_NOT_FOUND/,
  );
});

test("Finance gold price route is narrow and explicit", () => {
  assert.equal(FINANCE_GOLD_PRICE_ROUTE, "/api/finance/gold-price");
  assert.equal(isFinanceGoldPriceRoute("/api/finance/gold-price"), true);
  assert.equal(isFinanceGoldPriceRoute("/api/finance/gold-price/other"), false);
});

test("outer Finance gold chip toggles a live buy-back valuation without opening Year-end", async () => {
  const [client, styles, build, router, worker] = await Promise.all([
    read("src/features/finance/finance-gold-live-value.js"),
    read("src/features/finance/finance-gold-live-value.css"),
    read("scripts/build-finance-bundle.mjs"),
    read("worker/router.js"),
    read("worker/finance-gold-price.js"),
  ]);

  assert.match(client, /const GOLD_PRICE_ENDPOINT = "\/api\/finance\/gold-price"/);
  assert.match(client, /const GOLD_HELD_TAEL = 0\.05/);
  assert.match(client, /const CHI_PER_TAEL = 10/);
  assert.match(client, /buyPricePerChi[\s\S]*GOLD_HELD_TAEL \* CHI_PER_TAEL/);
  assert.match(client, /displayMode === "value"/);
  assert.match(client, /credentials: "same-origin"/);
  assert.match(client, /function handleGoldChipClick\(event\)/);
  assert.match(client, /handleGoldChipClick\(event\)[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*toggleGoldValue\(\);/);
  assert.match(client, /handleGoldChipKeydown\(event\)[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*toggleGoldValue\(\);/);
  assert.match(client, /asset\.addEventListener\("click", handleGoldChipClick\)/);
  assert.match(client, /asset\.addEventListener\("keydown", handleGoldChipKeydown\)/);
  assert.match(client, /financeValuesHidden/);
  assert.doesNotMatch(client, /sellPricePerChi/);

  assert.match(styles, /finance-year-end-gold\[role="button"\]/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion/);

  assert.match(build, /finance-gold-live-value\.js/);
  assert.match(build, /finance-gold-live-value\.css/);
  assert.match(build, /dashboardGoldLiveSource\.trim\(\)/);

  assert.match(router, /handleFinanceGoldPriceRequest/);
  assert.match(router, /isFinanceGoldPriceRoute\(pathname\)/);
  assert.match(worker, /getSession\(request, env\)/);
  assert.match(worker, /priceType: "buy"/);
  assert.match(worker, /cacheTtl/);
  assert.match(worker, /GOLD_PRICE_UNAVAILABLE/);
});
