import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  gmailSearchQuery,
  isGmailMessageNew,
} from "../worker/gmail-sync.js";

test("builds a Gmail unread query from the watch start", () => {
  assert.equal(
    gmailSearchQuery(1_725_000_123_456),
    "is:unread in:inbox after:1725000123",
  );
});

test("accepts only Gmail messages received after tracking started", () => {
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

test("worker stores a persistent Gmail watch start per account", () => {
  const source = fs.readFileSync(
    new URL("../worker/index.js", import.meta.url),
    "utf8",
  );

  const migration = fs.readFileSync(
    new URL("../migrations/0005_gmail_new_mail_window.sql", import.meta.url),
    "utf8",
  );

  assert.ok(source.includes("watch_started_at"));
  assert.ok(source.includes("gmailSearchQuery(watchStartedAt)"));
  assert.ok(source.includes("isGmailMessageNew(message, watchStartedAt)"));
  assert.ok(migration.includes("ADD COLUMN watch_started_at"));
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
