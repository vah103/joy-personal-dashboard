export const ROLE_LAYOUT = Object.freeze({
  "Research Director": [500, 318, "anchor", "director"],
  "Research Secretary": [500, 500, "bridge", "secretary"],
  "Research Project Manager": [360, 315, "research", "project"],
  "Research Methodologist": [318, 142, "research", "method"],
  "Research Software / Experiment Engineer": [165, 365, "research", "code"],
  "Data & Evidence Analyst": [168, 510, "research", "chart"],
  "Independent Research QA": [145, 215, "research", "qa"],
  "Research Communication / Publication": [355, 505, "research", "publication"],
  "Daily Operations Manager": [672, 142, "operations", "calendar"],
  "Policy & Governance Manager": [850, 215, "operations", "policy"],
  "Research Infrastructure / Ops Engineer": [855, 345, "operations", "server"],
  "Company Systems Engineer": [846, 465, "operations", "gear"],
  "Integration + Data Steward": [690, 512, "operations", "integration"],
});

export const ROLE_LABELS = Object.freeze({
  "Research Director": "USER",
  "Research Secretary": "Secretary",
  "Research Project Manager": "Project Manager",
  "Research Methodologist": "Methodologist",
  "Research Software / Experiment Engineer": "Engineer",
  "Data & Evidence Analyst": "Data Analyst",
  "Independent Research QA": "Independent QA",
  "Research Communication / Publication": "Publication",
  "Daily Operations Manager": "Daily Ops",
  "Policy & Governance Manager": "P & G",
  "Research Infrastructure / Ops Engineer": "Infra / Ops",
  "Company Systems Engineer": "Company Systems",
  "Integration + Data Steward": "Integration + Data",
});

export function escapeMapHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function pointForRole(name, index = 0) {
  const item = ROLE_LAYOUT[name] || [895, Math.min(560, 110 + index * 76), "operations", "generic"];
  return { x: item[0], y: item[1], group: item[2], icon: item[3] };
}

export function stateForRole(role) {
  const workload = String(role?.workload || "");
  if (workload === "ACTION_NOW" || workload === "REVIEWING") return "ACTIVE";
  if (workload === "WAITING" || workload === "BLOCKED") return "WAITING";
  if (workload === "UNBOUND" && Array.isArray(role?.incomingHandoffs) && role.incomingHandoffs.length) return "WAITING";
  return "FREE";
}

export function currentTaskForRole(role) {
  for (const list of [role?.reviewingTasks, role?.actionableTasks, role?.blockedTasks, role?.waitingOwnedTasks]) {
    if (Array.isArray(list) && list.length) return String(list[0]);
  }
  return "";
}

export function canonicalRoleActor(actor, roles) {
  const value = String(actor || "").trim();
  if (value === "USER" && roles.has("Research Director")) return "Research Director";
  if (roles.has(value)) return value;
  for (const role of roles) {
    if (value.startsWith(role + " /") || value.startsWith(role + " (")) return role;
  }
  return "";
}
