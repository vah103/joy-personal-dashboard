import assert from "node:assert/strict";
import test from "node:test";

import {
  JOY_IELTS_ACTIONS_OPENAPI,
  JOY_TURTLEBOT4_ACTIONS_OPENAPI,
} from "../worker/joy-actions-openapi-extended.js";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);

function operationCount(schema) {
  return Object.values(schema.paths).reduce((total, pathItem) => (
    total + Object.keys(pathItem).filter((key) => HTTP_METHODS.has(key)).length
  ), 0);
}

function visit(value, callback, path = []) {
  if (!value || typeof value !== "object") return;
  callback(value, path);
  if (Array.isArray(value)) {
    value.forEach((child, index) => visit(child, callback, [...path, index]));
    return;
  }
  Object.entries(value).forEach(([key, child]) => visit(child, callback, [...path, key]));
}

function assertBuilderSafe(schema) {
  const componentNames = new Set(Object.keys(schema.components?.schemas || {}));
  visit(schema, (value, path) => {
    if (value.type === "object") {
      assert.equal(
        Object.hasOwn(value, "properties"),
        true,
        `object schema missing properties at ${path.join(".")}`,
      );
    }
    if (typeof value.$ref === "string" && value.$ref.startsWith("#/components/schemas/")) {
      const name = value.$ref.slice("#/components/schemas/".length);
      assert.equal(componentNames.has(name), true, `unknown component ${name}`);
    }
  });
}

test("specialized GPT schemas fit the Builder operation limit", () => {
  assert.ok(operationCount(JOY_IELTS_ACTIONS_OPENAPI) <= 30);
  assert.ok(operationCount(JOY_TURTLEBOT4_ACTIONS_OPENAPI) <= 30);
  assert.equal(
    JOY_IELTS_ACTIONS_OPENAPI.paths["/api/joy/v1/projects/{projectId}"],
    undefined,
  );
  assert.ok(JOY_IELTS_ACTIONS_OPENAPI.paths["/api/joy/v1/ielts/today"]);
  assert.ok(JOY_IELTS_ACTIONS_OPENAPI.paths["/api/joy/v1/dev/changes"]);
  assert.ok(JOY_TURTLEBOT4_ACTIONS_OPENAPI.paths["/api/joy/v1/projects/{projectId}"]);
});

test("specialized GPT schemas contain Builder-safe object schemas and valid refs", () => {
  assertBuilderSafe(JOY_IELTS_ACTIONS_OPENAPI);
  assertBuilderSafe(JOY_TURTLEBOT4_ACTIONS_OPENAPI);
});
