import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  KNOWN_TASK_STATUSES,
  buildCompanyLiveBoard,
  laneForStatus,
  normalizeRuntimePresence,
  parseHandoffs,
  parseStaff,
  parseTasks,
} from "../worker/company-live-board-model.js";
import {
  renderBoardMarkup,
} from "../src/features/company-live-board/company-live-board.js";
import { isCompanyLiveBoardRoute } from "../worker/company-live-board.js";

const TASK_HEADER = `| ID | Project | Task | Primary owner position | Current action owner | Execution surface | Usage mode | Criticality | Status | Depends on | Review | Canonical | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|`;

const STAFF = `# Staff
| Position | Seat status | Default surface | Secondary / support | Current assignee |
|---|---|---|---|---|
| Company Systems Engineer | FILLED | Chat | — | CSE Chat |
| Independent Research QA | FILLED | separate Chat | — | QA Chat |
| Integration + Data Steward | FILLED | Chat | — | Steward Chat |
| Research Secretary | FILLED | Chat | — | Secretary Chat |
`;

function taskRow({
  id = "C009",
  project = "company",
  title = "Live board",
  primary = "Company Systems Engineer",
  action = "Company Systems Engineer",
  status = "ACTIVE",
  depends = "—",
  review = "Independent Research QA",
  canonical = "PROJECT_SYNC_REQUIRED/PENDING",
  next = "Implement",
} = {}) {
  return `| ${id} | ${project} | ${title} | ${primary} | ${action} | Chat | N/A | MEDIUM | ${status} | ${depends} | ${review} | ${canonical} | ${next} |`;
}

const HANDOFFS = `# Handoffs

### HO-TEST-C009 — Daily Operations Manager → Company Systems Engineer (Chat)

- Project: company
- Task: C009 — Live board
- Published at: 2026-09-28T12:28:00Z
- Sender role: Research Secretary
- Task primary owner: Company Systems Engineer
- Receiver position: Company Systems Engineer
- Pickup state: PENDING_PICKUP
- Requested action: Build read-only board
- Next gate: Independent QA

### HO-TEST-C010 — Company Systems Engineer → Independent Research QA

- Project: company
- Task: C010 — Review item
- Published at: 2026-09-28T12:40:00Z
- Sender role: Company Systems Engineer
- Task primary owner: Company Systems Engineer
- Receiver position: Independent Research QA
- Pickup state: ACKNOWLEDGED
- Requested action: Review
- Next gate: Canonical integration

### HO-OLD — Company Systems Engineer → Independent Research QA

- Project: company
- Task: C011 — Old item
- Published at: 2026-09-27T12:40:00Z
- Sender role: Company Systems Engineer
- Task primary owner: Company Systems Engineer
- Receiver position: Independent Research QA
- Pickup state: SUPERSEDED
`;

test("canonical statuses keep exact values while mapping to presentation lanes", () => {
  const expected = new Map([
    ["IDEA", "TODO"],
    ["ROUTING_REQUIRED", "TODO"],
    ["TODO", "TODO"],
    ["ACTIVE", "ACTIVE"],
    ["COMPLETE_PENDING_REVIEW", "REVIEW"],
    ["PENDING_REVIEW", "REVIEW"],
    ["BLOCKED", "BLOCKED_GATED"],
    ["BLOCKED_BY_USAGE", "BLOCKED_GATED"],
    ["RECOVERY_REQUIRED", "BLOCKED_GATED"],
    ["PENDING_USER", "BLOCKED_GATED"],
    ["PENDING_CANONICAL_SYNC", "BLOCKED_GATED"],
    ["PENDING_STRATEGIC_REVIEW", "BLOCKED_GATED"],
    ["PENDING_GOVERNANCE", "BLOCKED_GATED"],
    ["DONE", "DONE"],
    ["CANCELLED", "OTHER_ARCHIVED"],
  ]);
  assert.deepEqual(new Set(expected.keys()), new Set(KNOWN_TASK_STATUSES));
  for (const [status, lane] of expected) assert.equal(laneForStatus(status), lane);

  const markdown = [
    TASK_HEADER,
    ...KNOWN_TASK_STATUSES.map((status, index) => taskRow({ id: `C${String(index + 100).padStart(3, "0")}`, status })),
  ].join("\n");
  const tasks = parseTasks(markdown);
  assert.equal(tasks.length, KNOWN_TASK_STATUSES.length);
  assert.deepEqual(tasks.map((task) => task.status), KNOWN_TASK_STATUSES);
});

test("staff and current handoffs parse without inventing missing values", () => {
  const staff = parseStaff(STAFF);
  const handoffs = parseHandoffs(HANDOFFS);
  assert.equal(staff[0].position, "Company Systems Engineer");
  assert.equal(handoffs[0].pickupState, "PENDING_PICKUP");
  assert.equal(handoffs[1].pickupState, "ACKNOWLEDGED");
  assert.equal(handoffs[2].pickupState, "SUPERSEDED");
  assert.equal(handoffs[2].requestedAction, "");
});

test("heartbeat freshness follows the governed 45-minute rule and never says offline", () => {
  const now = Date.parse("2026-09-28T12:45:00Z");
  const fresh = normalizeRuntimePresence({
    host: "DELL",
    last_seen: "2026-09-28T12:10:00Z",
    source: "heartbeat-v3",
    machine_state: "ONLINE_AT_LAST_HEARTBEAT",
  }, now);
  const stale = normalizeRuntimePresence({
    host: "DELL",
    last_seen: "2026-09-28T11:59:00Z",
    source: "heartbeat-v3",
    machine_state: "ONLINE_AT_LAST_HEARTBEAT",
  }, now);
  const missing = normalizeRuntimePresence(null, now);

  assert.equal(fresh.state, "RECENTLY_CONFIRMED");
  assert.equal(stale.state, "STALE_NOT_RECENTLY_CONFIRMED");
  assert.equal(missing.state, "UNKNOWN_UNAVAILABLE");
  assert.equal(JSON.stringify([fresh, stale, missing]).includes("OFFLINE"), false);
});

test("workload and role presence remain independent", () => {
  const tasksMarkdown = [
    TASK_HEADER,
    taskRow({ id: "C009", status: "ACTIVE", action: "Company Systems Engineer" }),
  ].join("\n");
  const board = buildCompanyLiveBoard({
    tasksMarkdown,
    handoffsMarkdown: "# Handoffs",
    staffMarkdown: STAFF,
    heartbeat: {
      host: "DELL",
      last_seen: "2026-09-28T12:30:00Z",
      source: "heartbeat-v3",
      machine_state: "ONLINE_AT_LAST_HEARTBEAT",
    },
    fetchedAt: "2026-09-28T12:35:00Z",
    nowMs: Date.parse("2026-09-28T12:35:00Z"),
  });

  const cse = board.roles.find((role) => role.position === "Company Systems Engineer");
  const secretary = board.roles.find((role) => role.position === "Research Secretary");
  assert.equal(cse.workload, "ACTION_NOW");
  assert.equal(cse.presence.state, "UNKNOWN_UNAVAILABLE");
  assert.equal(secretary.workload, "FREE_FOR_NEW_WORK");
  assert.equal(secretary.presence.state, "UNKNOWN_UNAVAILABLE");
  assert.equal(board.runtimePresence.state, "RECENTLY_CONFIRMED");
});

test("waiting relationships and data-quality mismatches require durable evidence", () => {
  const tasksMarkdown = [
    TASK_HEADER,
    taskRow({ id: "C001", status: "ACTIVE", action: "Integration + Data Steward", primary: "Integration + Data Steward", review: "—", canonical: "—" }),
    taskRow({ id: "C009", status: "TODO", depends: "C001", action: "Company Systems Engineer" }),
  ].join("\n");
  const mismatchedHandoff = HANDOFFS.replace(
    "- Task primary owner: Company Systems Engineer",
    "- Task primary owner: Integration + Data Steward",
  );
  const board = buildCompanyLiveBoard({
    tasksMarkdown,
    handoffsMarkdown: mismatchedHandoff,
    staffMarkdown: STAFF,
    heartbeat: null,
    heartbeatSourceAvailable: false,
  });

  assert.ok(board.relationships.some((item) => (
    item.type === "DEPENDENCY_WAIT" && item.from === "C009" && item.to === "C001"
  )));
  assert.ok(board.warnings.some((item) => item.code === "HANDOFF_PRIMARY_OWNER_MISMATCH"));
  assert.equal(board.summary.actionableNow, 1);
});

test("rendering keeps canonical status visible and exposes only read-only controls", () => {
  const board = buildCompanyLiveBoard({
    tasksMarkdown: [TASK_HEADER, taskRow({ id: "C009", status: "PENDING_REVIEW", action: "Independent Research QA" })].join("\n"),
    handoffsMarkdown: HANDOFFS,
    staffMarkdown: STAFF,
    heartbeat: null,
    heartbeatSourceAvailable: false,
    fetchedAt: "2026-09-28T12:45:00Z",
  });
  const markup = renderBoardMarkup(board, {
    translate: (key, values = {}) => values.count === undefined ? key : `${key}:${values.count}`,
  });

  assert.match(markup, /PENDING_REVIEW/);
  assert.match(markup, /company\/operations\/TASKS\.md/);
  assert.match(markup, /company\/operations\/HANDOFFS\.md/);
  assert.match(markup, /company\/operations\/STAFF\.md/);
  assert.match(markup, /data-company-board-action="refresh"/);
  assert.doesNotMatch(markup, /data-company-board-action="(?:complete|acknowledge|assign|write|delete)"/);
  assert.doesNotMatch(markup, /method="POST"/i);
});

test("Worker route is read-only and registered under the Company API path", () => {
  assert.equal(isCompanyLiveBoardRoute("/api/company/live-board"), true);
  assert.equal(isCompanyLiveBoardRoute("/api/company/live-board/write"), false);

  const source = fs.readFileSync(new URL("../worker/company-live-board.js", import.meta.url), "utf8");
  assert.match(source, /request\.method !== "GET"/);
  assert.doesNotMatch(source, /request\.method === "POST"/);
  assert.match(source, /COMPANY_HUB_GITHUB_TOKEN/);
  assert.doesNotMatch(source, /COMPANY_HUB_GITHUB_TOKEN\s*=\s*["'][^"']+["']/);
});
