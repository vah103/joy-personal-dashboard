import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  gmailDiscoveryCutoff,
  gmailSearchQuery,
  isGmailMessageNew,
} from "../worker/gmail-sync.js";

test("Gmail discovery advances from the last successful sync", () => {
  const watchStartedAt = 1_725_000_000_000;
  const lastSyncedAt = 1_725_000_123_456;

  assert.equal(gmailDiscoveryCutoff(watchStartedAt, lastSyncedAt), lastSyncedAt);
  assert.equal(gmailDiscoveryCutoff(watchStartedAt, 0), watchStartedAt);
  assert.equal(gmailDiscoveryCutoff(0, lastSyncedAt), 0);
});

test("builds a Gmail unread query from the discovery cutoff", () => {
  assert.equal(
    gmailSearchQuery(1_725_000_123_456),
    "is:unread in:inbox after:1725000123",
  );
});

test("accepts only Gmail messages received after the requested cutoff", () => {
  const cutoff = 1_725_000_123_456;

  assert.equal(
    isGmailMessageNew({ internalDate: String(cutoff) }, cutoff),
    true,
  );

  assert.equal(
    isGmailMessageNew({ internalDate: String(cutoff - 1) }, cutoff),
    false,
  );

  assert.equal(
    isGmailMessageNew({}, cutoff),
    false,
  );
});

test("worker keeps visible mail but never rediscovers the old watch window", () => {
  const source = fs.readFileSync(
    new URL("../worker/index.js", import.meta.url),
    "utf8",
  );

  const migration = fs.readFileSync(
    new URL("../migrations/0005_gmail_new_mail_window.sql", import.meta.url),
    "utf8",
  );

  assert.ok(source.includes("SELECT watch_started_at, last_synced_at FROM gmail_sync"));
  assert.ok(source.includes("gmailDiscoveryCutoff(watchStartedAt, lastSyncedAt)"));
  assert.ok(source.includes("gmailSearchQuery(discoveryCutoff)"));
  assert.ok(source.includes("isGmailMessageNew(message, discoveryCutoff)"));
  assert.ok(source.includes("FROM email_cache"));
  assert.ok(source.includes("...existingIds"));
  assert.ok(!source.includes("gmailSearchQuery(watchStartedAt)"));
  assert.ok(migration.includes("ADD COLUMN watch_started_at"));
});

test("worker rejects stale overlapping Gmail syncs", () => {
  const source = fs.readFileSync(
    new URL("../worker/index.js", import.meta.url),
    "utf8",
  );

  assert.ok(source.includes("SELECT last_synced_at FROM gmail_sync WHERE user_email = ?"));
  assert.ok(source.includes("Number(latestSyncState?.last_synced_at || 0) > lastSyncedAt"));
});

test("frontend removes completed mail and uses the SVG pin icon", () => {
  const app = fs.readFileSync(
    new URL("../app.js", import.meta.url),
    "utf8",
  );

  const styles = fs.readFileSync(
    new URL("../styles.css", import.meta.url),
    "utf8",
  );

  assert.ok(app.includes("gmail-pin-icon"));
  assert.ok(styles.includes(".gmail-pin-icon"));
  assert.ok(app.includes("Done · removed from Joy"));
  assert.ok(!app.includes('makeButton("Restore", "restore-dismissed-emails"'));
  assert.ok(!app.includes('action === "restore-dismissed-emails"'));
});
