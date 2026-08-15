import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Sale Assistant room summary exposes the ChatGPT launcher and Joy Room Text-only copy", async () => {
  const [ui, en, vi] = await Promise.all([
    readFile(new URL("../src/features/sales/sale-english-ui.js", import.meta.url), "utf8"),
    readFile(new URL("../src/i18n/locales/en-sale-room.js", import.meta.url), "utf8"),
    readFile(new URL("../src/i18n/locales/vi-sale-room.js", import.meta.url), "utf8"),
  ]);

  assert.match(ui, /JOY_ROOM_CHATGPT_URL = "https:\/\/chatgpt\.com\/"/u);
  assert.match(ui, /id = "room-summary-chatgpt"/u);
  assert.match(ui, /input\.before\(button\)/u);
  assert.match(ui, /dynamic\.sale\.roomTextLabel/u);
  assert.match(ui, /dynamic\.sale\.roomTextHelp/u);
  assert.match(ui, /dynamic\.sale\.roomTextPlaceholder/u);
  assert.match(ui, /JOY_ROOM_TEXT_PLACEHOLDER/u);
  assert.match(en, /dynamic\.sale\.roomChatGPT/u);
  assert.match(vi, /"dynamic\.sale\.roomChatGPT": "Soạn với ChatGPT ↗"/u);
  assert.match(vi, /Joy không nhận tin nguồn thô/u);
});
