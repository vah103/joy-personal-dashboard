import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBitcoinSignal,
  buildGoldSignal,
  classifyFocusedStory,
  focusDailyBriefPayload,
} from "../worker/daily-brief-focus.js";

test("Daily Brief keeps only the four requested subject types", () => {
  assert.equal(classifyFocusedStory({
    title: "Giá vàng tăng mạnh trong phiên sáng",
    summary: "Vàng miếng tăng thêm 500.000 đồng mỗi lượng.",
  }), "GOLD");

  assert.equal(classifyFocusedStory({
    title: "Bitcoin jumps 4% after a volatile session",
    summary: "BTC price moved sharply over 24 hours.",
  }), "BITCOIN");

  assert.equal(classifyFocusedStory({
    title: "Boston Dynamics unveils a new warehouse robot",
    summary: "The robot can now move heavier loads autonomously.",
  }), "ROBOTICS");

  assert.equal(classifyFocusedStory({
    title: "OpenAI launches a new GPT model",
    summary: "The release adds a new reasoning capability.",
  }), "AI");
});

test("Daily Brief rejects broad politics, finance, and generic AI discussion", () => {
  assert.equal(classifyFocusedStory({
    title: "Central bank changes interest rates",
    summary: "Markets reacted to the policy announcement.",
  }), "");

  assert.equal(classifyFocusedStory({
    title: "Government debates AI regulation",
    summary: "Lawmakers discussed future policy controls.",
  }), "");

  assert.equal(classifyFocusedStory({
    title: "Technology company reports quarterly earnings",
    summary: "Revenue increased during the period.",
  }), "");
});

test("Daily Brief payload is relabelled and filtered before reaching the UI", () => {
  const payload = focusDailyBriefPayload({
    stories: [
      {
        id: "ai-1",
        category: "TECH",
        title: "Google launches a new Gemini model",
        summary: "The model adds a multimodal feature.",
        score: 90,
        publishedAt: 20,
      },
      {
        id: "politics-1",
        category: "POLITICS",
        title: "Election campaign enters final week",
        summary: "Candidates held several rallies.",
        score: 99,
        publishedAt: 30,
      },
      {
        id: "robot-1",
        category: "TECH",
        title: "New humanoid robot begins factory testing",
        summary: "The prototype can now sort production parts.",
        score: 88,
        publishedAt: 10,
      },
    ],
  });

  assert.deepEqual(payload.focus, ["GOLD", "BITCOIN", "ROBOTICS", "AI"]);
  assert.deepEqual(payload.stories.map((story) => story.id), ["ai-1", "robot-1"]);
  assert.deepEqual(payload.stories.map((story) => story.category), ["AI", "ROBOTICS"]);
});

test("Gold signal reports an observed change without trading advice", () => {
  const story = buildGoldSignal({
    buyPricePerChi: 15_000_000,
    sellPricePerChi: 15_300_000,
    updatedAtSource: "08:30 01/08/2026",
    fetchedAt: Date.UTC(2026, 7, 1, 2, 0, 0),
  }, {
    buyPricePerChi: 14_800_000,
  }, Date.UTC(2026, 7, 1, 2, 0, 0));

  assert.equal(story.category, "GOLD");
  assert.match(story.title, /tăng/);
  assert.match(story.summary, /lần ghi nhận trước/);
  assert.match(story.whyItMatters, /không phải khuyến nghị mua hoặc bán/);
});

test("Bitcoin signal labels causal analysis as provisional", () => {
  const story = buildBitcoinSignal({
    priceUsd: 72_500,
    change24hPercent: 4.2,
    updatedAt: Date.UTC(2026, 7, 1, 2, 0, 0),
  }, "Biến động có thể liên quan đến kỳ vọng chính sách được nhắc trong các nguồn gần đây.");

  assert.equal(story.category, "BITCOIN");
  assert.match(story.title, /4,2%/);
  assert.match(story.whyItMatters, /Nguyên nhân khả dĩ/);
  assert.match(story.whyItMatters, /không phải kết luận chắc chắn/);
});
