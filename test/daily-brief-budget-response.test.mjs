import assert from "node:assert/strict";
import test from "node:test";

import { buildVisibleDailyBriefResponse } from "../worker/daily-brief-budget.js";

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

test("Daily Brief falls back to policy-approved stories when focus matches none", async () => {
  const response = await buildVisibleDailyBriefResponse(jsonResponse({
    updatedAt: 123,
    stories: [
      {
        id: "economy-1",
        category: "ECONOMY",
        title: "Central bank changes interest rates",
        summary: "Markets reacted to the policy announcement.",
        score: 92,
        publishedAt: 100,
      },
    ],
  }));
  const payload = await response.json();

  assert.equal(payload.focusFallback, true);
  assert.deepEqual(payload.stories.map((story) => story.id), ["economy-1"]);
  assert.deepEqual(payload.focus, ["GOLD", "BITCOIN", "ROBOTICS", "AI"]);
});

test("Daily Brief keeps focused stories when at least one focus match exists", async () => {
  const response = await buildVisibleDailyBriefResponse(jsonResponse({
    stories: [
      {
        id: "ai-1",
        category: "TECH",
        title: "OpenAI launches a new GPT model",
        summary: "The release adds a new reasoning capability.",
        score: 90,
        publishedAt: 100,
      },
      {
        id: "politics-1",
        category: "POLITICS",
        title: "Election campaign enters final week",
        summary: "Candidates held several rallies.",
        score: 99,
        publishedAt: 110,
      },
    ],
  }));
  const payload = await response.json();

  assert.equal(payload.focusFallback, undefined);
  assert.deepEqual(payload.stories.map((story) => story.id), ["ai-1"]);
  assert.equal(payload.stories[0].category, "AI");
});

test("Daily Brief preserves a genuinely empty policy result", async () => {
  const response = await buildVisibleDailyBriefResponse(jsonResponse({ stories: [] }));
  const payload = await response.json();

  assert.deepEqual(payload.stories, []);
  assert.equal(payload.focusFallback, undefined);
});
