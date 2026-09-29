import test from "node:test";
import assert from "node:assert/strict";
import { buildMapEdges } from "../src/features/company-live-board/company-live-map-edges.js";

test("C011 draws only role-to-role durable edges", () => {
  const data = {
    roles: [{ position: "Research Methodologist" }, { position: "Independent Research QA" }],
    relationships: [{ from: "Research Methodologist", to: "Independent Research QA", taskId: "MX017" }],
    handoffs: [],
  };
  assert.deepEqual(buildMapEdges(data), [{
    from: "Research Methodologist",
    to: "Independent Research QA",
    taskId: "MX017",
    emphasis: "current",
  }]);
});
