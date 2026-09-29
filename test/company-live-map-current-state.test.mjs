import test from "node:test";
import assert from "node:assert/strict";

import { buildCompanyLiveBoard, parseTasks } from "../worker/company-live-board-model.js";
import { buildMapEdges } from "../src/features/company-live-board/company-live-map-edges.js";
import { stateForRole } from "../src/features/company-live-board/company-live-map-layout.js";

const HEADER = `| ID | Project | Task | Primary owner position | Current action owner | Execution surface | Usage mode | Criticality | Status | Depends on | Review | Canonical | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|`;

const TASKS = `${HEADER}
| C006 | company | Old completed work | Research Project Manager | — | — | N/A | HIGH | DONE | — | — | — | — |

## Later task table

${HEADER}
| C012 | company | Governance review | Policy & Governance Manager | Independent Research QA | separate Chat | N/A | HIGH | PENDING_REVIEW | — | Independent Research QA | — | Review |
| MX016 | mapex | Hospital replay | Research Software / Experiment Engineer | Independent Research QA | separate Chat | N/A | HIGH | PENDING_REVIEW | — | Independent Research QA | — | Review |
| MX019 | mapex | Hospital sensitivity | Data & Evidence Analyst | Independent Research QA | separate Chat | N/A | HIGH | PENDING_REVIEW | — | Independent Research QA | — | Review |`;

const STAFF = `# Staff
| Position | Seat status | Default surface | Secondary / support | Current assignee |
|---|---|---|---|---|
| Research Director | FILLED | USER | — | USER |
| Research Project Manager | READY_TO_BIND | Work | — | — |
| Policy & Governance Manager | READY_TO_BIND | Chat | — | — |
| Independent Research QA | FILLED | Chat | — | QA |
| Data & Evidence Analyst | READY_TO_BIND | Chat | — | — |
| Research Software / Experiment Engineer | READY_TO_BIND | Codex | — | — |
| Research Methodologist | READY_TO_BIND | Chat | — | — |`;

const HANDOFFS = `# Handoffs

### HO-OLD — Independent Research QA → Research Project Manager
- Project: company
- Task: C006
- Published at: 2026-09-27T10:00:00Z
- Sender role: Independent Research QA
- Receiver position: Research Project Manager
- Pickup state: PENDING_PICKUP

### HO-C012 — Policy & Governance Manager → Independent Research QA
- Project: company
- Task: C012
- Published at: 2026-09-29T02:31:00Z
- Sender role: Policy & Governance Manager
- Receiver position: Independent Research QA
- Pickup state: PENDING_PICKUP

### HO-MX016 — Research Software / Experiment Engineer → Independent Research QA
- Project: mapex
- Task: MX016
- Published at: 2026-09-29T01:08:07Z
- Sender role: Research Software / Experiment Engineer
- Receiver position: Independent Research QA
- Pickup state: PENDING_PICKUP

### HO-MX019 — Data & Evidence Analyst → Independent Research QA
- Project: mapex
- Task: MX019
- Published at: 2026-09-29T03:25:00Z
- Sender role: Data & Evidence Analyst
- Receiver position: Independent Research QA
- Pickup state: PENDING_PICKUP
`;

test("C013 parses every canonical TASKS table in the document", () => {
  assert.deepEqual(parseTasks(TASKS).map((task) => task.id), ["C006", "C012", "MX016", "MX019"]);
});

test("C013 current snapshot colors reflect open task ownership instead of seat binding or stale handoffs", () => {
  const board = buildCompanyLiveBoard({
    tasksMarkdown: TASKS,
    handoffsMarkdown: HANDOFFS,
    staffMarkdown: STAFF,
    heartbeat: null,
    heartbeatSourceAvailable: false,
  });
  const byRole = new Map(board.roles.map((role) => [role.position, role]));

  assert.equal(stateForRole(byRole.get("Independent Research QA")), "ACTIVE");
  assert.equal(stateForRole(byRole.get("Policy & Governance Manager")), "WAITING");
  assert.equal(stateForRole(byRole.get("Research Software / Experiment Engineer")), "WAITING");
  assert.equal(stateForRole(byRole.get("Data & Evidence Analyst")), "WAITING");
  assert.equal(stateForRole(byRole.get("Research Project Manager")), "FREE");
  assert.equal(stateForRole(byRole.get("Research Director")), "FREE");

  assert.equal(
    board.relationships.some((item) => item.taskId === "C006"),
    false,
  );
});

test("C013 map edges contain only open-task relationships", () => {
  const board = buildCompanyLiveBoard({
    tasksMarkdown: TASKS,
    handoffsMarkdown: HANDOFFS,
    staffMarkdown: STAFF,
    heartbeat: null,
    heartbeatSourceAvailable: false,
  });
  const edges = buildMapEdges(board);
  assert.deepEqual(
    new Set(edges.map((edge) => edge.taskId)),
    new Set(["C012", "MX016", "MX019"]),
  );
  assert.equal(edges.some((edge) => edge.to === "Research Project Manager"), false);
});
