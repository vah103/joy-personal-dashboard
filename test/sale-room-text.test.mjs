import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { prepareRoomDisplayText } from "../src/pages/sale/room-address-ai.js";

test("room composer accepts arbitrary prepared text without a schema", () => {
  const source = `
Địa chỉ: Số 5 ngách 2 ngõ 43 Doãn Kế Thiện - Cầu Giấy

Phòng trống:
P101, P103, P104 — 3tr3/tháng
Nhận phòng từ 1/9

Nội thất: Như hình
`;

  assert.equal(
    prepareRoomDisplayText(source),
    "Địa chỉ: Số 5 ngách 2 ngõ 43 Doãn Kế Thiện - Cầu Giấy\n\nPhòng trống:\nP101, P103, P104 — 3tr3/tháng\nNhận phòng từ 1/9\n\nNội thất: Như hình",
  );
});

test("room composer only normalizes line endings and outer whitespace", () => {
  assert.equal(prepareRoomDisplayText("  A\r\n\r\nB  \r\n"), "A\n\nB");
  assert.equal(prepareRoomDisplayText(""), "");
});

test("room composer renders locally with no parser, AI or network request", async () => {
  const frontend = await readFile(
    new URL("../src/pages/sale/room-address-ai.js", import.meta.url),
    "utf8",
  );

  assert.match(frontend, /body\.textContent = text/u);
  assert.match(frontend, /body\.contentEditable = "true"/u);
  assert.match(frontend, /body\.style\.whiteSpace = "pre-wrap"/u);
  assert.doesNotMatch(frontend, /parseJoyRoomText|headerMatch|parseRoomLine|parseServiceLine/u);
  assert.doesNotMatch(frontend, /fetch\(|\/api\/sales\/room-summary\/extract|env\.AI/u);
});
