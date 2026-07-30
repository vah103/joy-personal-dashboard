import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  isFinanceP1008Route,
  normalizeFinanceP1008Data,
} from "../worker/finance-p1008-sync.js";

const workerSource = await readFile(new URL("../worker/finance-p1008-sync.js", import.meta.url), "utf8");
const routerSource = await readFile(new URL("../worker/router.js", import.meta.url), "utf8");
const migrationSource = await readFile(new URL("../migrations/20260731_canonical_runtime_schema.sql", import.meta.url), "utf8");

test("P1008 sync owns one account-scoped API route", () => {
  assert.equal(isFinanceP1008Route("/api/p1008"), true);
  assert.equal(isFinanceP1008Route("/api/finance/p1008"), false);
  assert.match(workerSource, /getSession\(request, env\)/);
  assert.match(workerSource, /session\.user_email/);
  assert.match(workerSource, /isSameOrigin\(request\)/);
  assert.match(workerSource, /request\.method !== "GET" && request\.method !== "PUT"/);
});

test("P1008 sync normalizes months and service amounts", () => {
  assert.deepEqual(normalizeFinanceP1008Data({
    "2026-07": {
      apartment: 570000,
      electricity: "2300000",
      water: -10,
      parking: 528000,
      wifi: 280000,
      ignored: 99,
    },
    "2027-01": { apartment: 1 },
  }), {
    "2026-07": {
      apartment: 570000,
      electricity: 2300000,
      water: 0,
      parking: 528000,
      wifi: 280000,
    },
  });
});

test("P1008 sync stores one JSON document per signed-in email", () => {
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS finance_p1008/);
  assert.match(migrationSource, /user_email TEXT PRIMARY KEY/);
  assert.match(workerSource, /INSERT INTO finance_p1008 \(user_email, data_json, updated_at\)/);
  assert.match(workerSource, /ON CONFLICT\(user_email\) DO UPDATE SET/);
  assert.match(workerSource, /SELECT data_json, updated_at[\s\S]*WHERE user_email = \?/);
  assert.doesNotMatch(workerSource, /CREATE TABLE IF NOT EXISTS/);
});

test("the main Worker router handles P1008 before Google Sheets integration guards", () => {
  assert.match(routerSource, /isFinanceP1008Route\(pathname\)[\s\S]*handleFinanceP1008Request\(request, env\)/);
  assert.ok(
    routerSource.indexOf("isFinanceP1008Route(pathname)")
      < routerSource.indexOf("integrationForApiPath(pathname)"),
  );
});
