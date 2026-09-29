import test from "node:test";
import assert from "node:assert/strict";

import { buildCompanyLiveBoard, parseTasks } from "../worker/company-live-board-model.js";
import { buildMapEdges } from "../src/features/company-live-board/company-live-map-edges.js";
import { stateForRole } from "../src/features/company-live-board/company-live-map-layout.js";

const HEADER = `| ID | Project | Task | Primary owner position | Current action owner | Execution surface | Usage mode | Criticality | Status | Depends on | Review | Canonical | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|`;

const TASKS = `${HEADER}
| C012 | company | Governance review | Policy & Governance Manager | Independent Research QA | separate Chat | N/A | HIGH | PENDING_REVIEW | — | Independent Research QA | — | Review |

## Execution rules

HIGH requires independent QA. Important transitions reconcile immediately.
| MX014 | mapex | Strategic decision | Research Project Manager | — | — | N/A | HIGH | DONE | MX013 DONE | ACCEPT | — | Closed |
| MX015 | mapex | Hospital method | Research Methodologist | — | — | N/A | HIGH | DONE | MX013 DONE | ACCEPT | — | Closed |

| MX016 | mapex | Hospital replay | Research Software / Experiment Engineer | — | — | N/A | HIGH | PENDING_REVIEW | MX015 DONE | Independent Research QA | — | Review |`;

const STAFF = `# Staff
| Position | Seat status | Default surface | Secondary / support | Current assignee |
|---|---|---|---|---|
| Research Director | FILLED | USER | — | USER |
| Research Project Manager | READY_TO_BIND | Work | — | — |
| Policy & Governance Manager | READY_TO_BIND | Chat | — | — |
| Independent Research QA | FILLED | Chat | — | QA |
| Research Software / Experiment Engineer | READY_TO_BIND | Codex | — | — |`;

const HANDOFFS = `# Handoffs

### HO-MX014-PM — Independent Research QA → Research Project Manager
- Project: mapex
- Task: MX014
- Published at: 2026-09-28T06:45:00Z
- Sender role: Independent Research QA
- Receiver position: Research Project Manager
- Pickup state: PENDING_PICKUP

### HO-MX014-USER — Independent Research QA → Research Director / USER
- Project: mapex
- Task: MX014
- Published at: 2026-09-28T10:34:00Z
- Sender role: Independent Research QA
- Receiver position: Research Director / USER
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
`;

test("C014 parses canonical task-shaped rows after prose without a repeated header", () => {
  const tasks = parseTasks(TASKS);
  assert.deepEqual(tasks.map((task) => task.id), ["C012", "MX014", "MX015", "MX016"]);
  assert.equal(tasks.find((task) => task.id === "MX014")?.status, "DONE");
  assert.equal(tasks.find((task) => task.id === "MX016")?.status, "PENDING_REVIEW");
});

test("C014 reproduces the corrected live colors for MX014 DONE and MX016 open", () => {
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
  assert.equal(stateForRole(byRole.get("Research Project Manager")), "FREE");
  assert.equal(stateForRole(byRole.get("Research Director")), "FREE");

  assert.equal(board.relationships.some((item) => item.taskId === "MX014"), false);
  assert.equal(board.relationships.some((item) => item.taskId === "MX016"), true);
});

test("C014 live map keeps only the two open-task flows", () => {
  const board = buildCompanyLiveBoard({
    tasksMarkdown: TASKS,
    handoffsMarkdown: HANDOFFS,
    staffMarkdown: STAFF,
    heartbeat: null,
    heartbeatSourceAvailable: false,
  });
  const edges = buildMapEdges(board);
  assert.deepEqual(new Set(edges.map((edge) => edge.taskId)), new Set(["C012", "MX016"]));
  assert.equal(edges.some((edge) => edge.taskId === "MX014"), false);
});
