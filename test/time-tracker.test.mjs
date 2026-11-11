import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  intersectDuration,
  summarizeTimeTracker,
  TIME_TRACKER_BUDGETS,
  vietnamDayBounds,
} from "../worker/time-tracker-core.js";
import { handleTimeTrackerRequest, isTimeTrackerRoute } from "../worker/time-tracker.js";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function mockEnvironment() {
  const sqlite = new DatabaseSync(":memory:");
  const sessionToken = "unit-test-session";
  const email = "tester@example.invalid";
  sqlite.exec(`
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_email TEXT NOT NULL, expires_at INTEGER NOT NULL);
  `);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const db = {
    prepare(query) {
      const prepared = sqlite.prepare(query);
      let values = [];
      const statement = {
        bind(...args) { values = args; return statement; },
        async first() { return prepared.get(...values) ?? null; },
        async all() { return { results: prepared.all(...values) }; },
        async run() { return { meta: { changes: prepared.run(...values).changes } }; },
        runInBatch() { return { meta: { changes: prepared.run(...values).changes } }; },
      };
      return statement;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const result = statements.map((statement) => statement.runInBatch());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const hash = createHash("sha256").update(sessionToken).digest("hex");
  sqlite.prepare("INSERT INTO sessions VALUES (?, ?, ?)")
    .run(hash, email, Date.now() + 60_000);

  const request = (path, method = "GET", data = undefined, overrides = {}) => new Request(`https://joy.example.invalid${path}`, {
    method,
    headers: {
      Cookie: `__Host-joy_session=${sessionToken}`,
      Origin: "https://joy.example.invalid",
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      ...overrides,
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { env: { DB: db }, sqlite, email, request };
}

test("budgets sum to 24 hours and study sub-timers sum to eight", () => {
  assert.equal(Object.values(TIME_TRACKER_BUDGETS).reduce((a, b) => a + b, 0), 24);
  assert.equal(["thesis", "english", "ai", "career"].reduce((a, id) => a + TIME_TRACKER_BUDGETS[id], 0), 8);
});

test("Vietnam midnight separates a running session without overlapping other timers", () => {
  const now = Date.parse("2026-11-11T17:30:00Z");
  const day = vietnamDayBounds(now);
  assert.equal(day.date, "2026-11-12");
  assert.equal(day.start, Date.parse("2026-11-11T17:00:00Z"));
  assert.equal(day.end, Date.parse("2026-11-12T17:00:00Z"));
  assert.equal(intersectDuration(Date.parse("2026-11-11T16:30:00Z"), now, day.start, day.end), 1_800_000);

  const summary = summarizeTimeTracker({
    rows: [{ activity: "english", duration_ms: 600_000 }],
    active: { active_activity: "thesis", active_started_at: Date.parse("2026-11-11T16:30:00Z"), version: 3 },
    now,
  });
  assert.equal(summary.studyMs, 2_400_000);
  assert.equal(summary.recordedMs, 2_400_000);
  assert.equal(summary.activeActivity, "thesis");
  assert.equal(summary.version, 3);
});

test("authenticated switching closes the previous session and rejects stale devices", async () => {
  const { env, sqlite, email, request } = mockEnvironment();
  sqlite.exec(await source("migrations/20261111_daily_time_tracker.sql"));
  try {
    assert.equal(isTimeTrackerRoute("/api/time-tracker"), true);
    assert.equal(isTimeTrackerRoute("/api/time-tracker/switch"), true);
    assert.equal((await handleTimeTrackerRequest(request("/api/time-tracker"), env)).status, 200);

    const started = await handleTimeTrackerRequest(request("/api/time-tracker/switch", "POST", {
      activity: "thesis", expectedVersion: 0,
    }), env);
    assert.equal(started.status, 200);
    assert.equal((await started.json()).activeActivity, "thesis");

    sqlite.prepare("UPDATE daily_time_tracker_state SET active_started_at = ? WHERE user_email = ?")
      .run(Date.now() - 600_000, email);
    const beforeSwitch = await (await handleTimeTrackerRequest(request("/api/time-tracker"), env)).json();
    assert.ok(beforeSwitch.totals.thesis >= 590_000);

    const switched = await handleTimeTrackerRequest(request("/api/time-tracker/switch", "POST", {
      activity: "english", expectedVersion: 1,
    }), env);
    assert.equal(switched.status, 200);
    const switchedData = await switched.json();
    assert.equal(switchedData.activeActivity, "english");
    assert.equal(switchedData.version, 2);
    assert.ok(switchedData.totals.thesis >= 590_000);
    assert.equal(switchedData.history[0].activity, "thesis");

    const stale = await handleTimeTrackerRequest(request("/api/time-tracker/switch", "POST", {
      activity: "gym", expectedVersion: 1,
    }), env);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).snapshot.activeActivity, "english");

    const paused = await handleTimeTrackerRequest(request("/api/time-tracker/switch", "POST", {
      activity: null, expectedVersion: 2,
    }), env);
    assert.equal(paused.status, 200);
    assert.equal((await paused.json()).activeActivity, null);
    const sessions = sqlite.prepare("SELECT activity FROM daily_time_tracker_sessions WHERE user_email = ? ORDER BY id").all(email);
    assert.deepEqual(sessions.map(({ activity }) => activity), ["thesis", "english"]);
  } finally {
    sqlite.close();
  }
});

test("time tracker requires a session, a same-origin write, and valid activity/version", async () => {
  const { env, sqlite, request } = mockEnvironment();
  sqlite.exec(await source("migrations/20261111_daily_time_tracker.sql"));
  try {
    const unauthenticated = await handleTimeTrackerRequest(request("/api/time-tracker", "GET", undefined, { Cookie: "" }), env);
    assert.equal(unauthenticated.status, 401);
    const foreignOrigin = await handleTimeTrackerRequest(request("/api/time-tracker/switch", "POST", {
      activity: "thesis", expectedVersion: 0,
    }, { Origin: "https://elsewhere.example.invalid" }), env);
    assert.equal(foreignOrigin.status, 403);
    const invalid = await handleTimeTrackerRequest(request("/api/time-tracker/switch", "POST", {
      activity: "unknown", expectedVersion: 0,
    }), env);
    assert.equal(invalid.status, 400);
    const missingVersion = await handleTimeTrackerRequest(request("/api/time-tracker/switch", "POST", {
      activity: "thesis",
    }), env);
    assert.equal(missingVersion.status, 400);
  } finally {
    sqlite.close();
  }
});

test("dashboard and build wire the isolated timer without changing Daily Day", async () => {
  const [html, build, router] = await Promise.all([
    source("src/pages/dashboard/index.html"),
    source("scripts/build.mjs"),
    source("worker/router.js"),
  ]);
  assert.match(html, /data-tt-main/);
  assert.match(html, /data-tt-thesis/);
  assert.match(html, /data-tt-minis/);
  assert.match(html, /time-tracker\.js\?v=/);
  assert.match(build, /time-tracker", "time-tracker\.js"/);
  assert.match(router, /isTimeTrackerRoute\(pathname\)/);
});
