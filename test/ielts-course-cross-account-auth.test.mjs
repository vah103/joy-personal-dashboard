import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isAcceptedGoogleDocsIdentity } from "../worker/google-docs-auth.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("IELTS Course accepts a verified Google Docs account that differs from the Joy login", () => {
  assert.equal(isAcceptedGoogleDocsIdentity({
    aud: "joy-client-id",
    email: "course-owner@example.com",
    email_verified: true,
  }, "joy-client-id"), true);

  assert.equal(isAcceptedGoogleDocsIdentity({
    aud: "another-client-id",
    email: "course-owner@example.com",
    email_verified: true,
  }, "joy-client-id"), false);

  assert.equal(isAcceptedGoogleDocsIdentity({
    aud: "joy-client-id",
    email: "course-owner@example.com",
    email_verified: false,
  }, "joy-client-id"), false);
});

test("Docs OAuth remains bound to the active Joy session without enforcing the same email", async () => {
  const source = await read("../worker/google-docs-auth.js");

  assert.match(source, /const userEmail = normalizeEmail\(session\.user_email\)/);
  assert.match(source, /isAcceptedGoogleDocsIdentity\(identity, env\.GOOGLE_CLIENT_ID\)/);
  assert.doesNotMatch(source, /identity\.email\).*session\.user_email/);
  assert.doesNotMatch(source, /normalizeEmail\(env\.ALLOWED_EMAIL\)/);
  assert.match(source, /code_challenge_method: "S256"/);
  assert.match(source, /constantTimeEqual\(state, expectedState\)/);
});
