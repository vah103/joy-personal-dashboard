import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync(
  new URL("../worker/gmail-runtime.js", import.meta.url),
  "utf8",
);
const router = fs.readFileSync(
  new URL("../worker/router.js", import.meta.url),
  "utf8",
);

test("Gmail keeps the one-minute Worker cron but only schedules inbox sync every five minutes", () => {
  assert.match(runtime, /GMAIL_SYNC_INTERVAL_MS = 5 \* 60 \* 1000/);
  assert.match(runtime, /lastSyncedAt > now - GMAIL_SYNC_INTERVAL_MS/);
  assert.match(router, /GMAIL_SCHEDULE_INTERVAL_MINUTES = 5/);
  assert.match(router, /getUTCMinutes\(\) % GMAIL_SCHEDULE_INTERVAL_MINUTES === 0/);
  assert.match(router, /runGmailRuntimeSchedule\(env\)/);
});

test("Gmail cache refresh is incremental instead of delete-and-reinsert", () => {
  const broadDelete = 'env.DB.prepare("DELETE FROM email_cache WHERE user_email = ?").bind(email)';
  const broadDeleteCount = runtime.split(broadDelete).length - 1;

  // One broad clear remains only for the first-connect baseline. Normal syncs
  // use row-level insert/update/delete mutations and preserve unchanged rows.
  assert.equal(broadDeleteCount, 1);
  assert.match(runtime, /const cachedById = new Map/);
  assert.match(runtime, /function gmailCacheRowMatches\(row, message\)/);
  assert.match(runtime, /UPDATE email_cache[\s\S]*WHERE user_email = \? AND message_id = \?/);
  assert.match(
    runtime,
    /DELETE FROM email_cache WHERE user_email = \? AND message_id = \?/,
  );
  assert.match(runtime, /cacheWrites: Math\.max\(0, statements\.length - 1\)/);
});

test("all Gmail inbox routes are intercepted by the low-write runtime", () => {
  assert.match(runtime, /"\/api\/emails"/);
  assert.match(runtime, /"\/api\/emails\/pin"/);
  assert.match(runtime, /"\/api\/emails\/dismiss"/);
  assert.match(runtime, /"\/api\/emails\/restore"/);
  assert.match(router, /if \(isGmailRuntimeRoute\(pathname\)\)/);
  assert.match(router, /guardGoogleIntegration\(request, env, "gmail"\)/);
  assert.match(router, /handleGmailRuntimeRequest\(request, env\)/);
});
