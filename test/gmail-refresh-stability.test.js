import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../src/pages/dashboard/app-config.js", import.meta.url),
  "utf8",
);

function createHarness() {
  const gmail = {
    status: "connected",
    error: "",
    hiddenCount: 0,
    messages: [],
    syncedAt: 0,
  };
  const renders = { brief: 0, email: 0 };
  let nextMessages = [];

  const context = {
    console,
    Date,
    JSON,
    Number,
    String,
    Boolean,
    Object,
    document: {
      querySelector: () => null,
    },
    gmail,
    renderBrief() {
      renders.brief += 1;
    },
    renderEmail() {
      renders.email += 1;
    },
    async fetchCloudEmails() {
      gmail.messages = nextMessages.map((message) => ({ ...message }));
      gmail.syncedAt = Date.now();
      context.renderBrief();
      context.renderEmail();
    },
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(source, context);

  return {
    context,
    gmail,
    renders,
    setMessages(messages) {
      nextMessages = messages;
    },
  };
}

test("silent Gmail refresh does not rerender an unchanged mailbox", async () => {
  const harness = createHarness();

  await harness.context.fetchCloudEmails({ silent: true });
  assert.deepEqual(harness.renders, { brief: 0, email: 0 });

  harness.setMessages([{
    id: "mail-1",
    threadId: "thread-1",
    sender: "Sender",
    subject: "Subject",
    snippet: "Snippet",
    date: "Today",
    unread: true,
    pinned: false,
  }]);

  await harness.context.fetchCloudEmails({ silent: true });
  assert.deepEqual(harness.renders, { brief: 1, email: 1 });

  await harness.context.fetchCloudEmails({ silent: true });
  assert.deepEqual(harness.renders, { brief: 1, email: 1 });
});

test("visible Gmail refresh keeps the existing loading and render flow", async () => {
  const harness = createHarness();

  await harness.context.fetchCloudEmails();
  assert.deepEqual(harness.renders, { brief: 1, email: 1 });
});

test("Gmail refresh signature tracks message state but ignores sync timestamps", () => {
  assert.match(source, /function gmailRenderSignature\(\)/);
  assert.match(source, /hiddenCount: Number\(gmail\.hiddenCount \|\| 0\)/);
  assert.doesNotMatch(source, /syncedAt:/);
});
