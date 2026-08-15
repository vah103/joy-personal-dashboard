import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseRoomDisplayBlocks,
  prepareRoomDisplayText,
} from "../src/pages/sale/room-address-ai.js";

const SAMPLE = `
Địa chỉ: Số 5 ngách 2 ngõ 43 Doãn Kế Thiện - Cầu Giấy

Phòng trống:

* Tầng 1, 2: P101, P103, P104 — 3tr3/tháng
* Tầng 3, 4: P304, P305, P401 — 3tr2/tháng
* Nhận phòng từ 1/9

Dạng phòng: Gác xép
Thang: Bộ

Nội thất: Đồ cơ bản

Dịch vụ:

* Điện: 4k/số
* Nước: 120k/người
* Dịch vụ: 200k/người, gồm máy giặt chung, vệ sinh, wifi, đổ rác

Lưu ý:

* Đóng 1 cọc 1
* Giới hạn 2 người
`;

test("room composer accepts arbitrary prepared text without a schema", () => {
  assert.equal(
    prepareRoomDisplayText("  A\r\n\r\nB  \r\n"),
    "A\n\nB",
  );
  assert.equal(prepareRoomDisplayText(""), "");
});

test("light formatter recognizes fields, section headings and bullet groups", () => {
  const blocks = parseRoomDisplayBlocks(SAMPLE);

  assert.deepEqual(blocks[0], {
    type: "field",
    label: "Địa chỉ",
    value: "Số 5 ngách 2 ngõ 43 Doãn Kế Thiện - Cầu Giấy",
    spaced: false,
  });
  assert.deepEqual(blocks[1], {
    type: "section",
    title: "Phòng trống",
    spaced: true,
  });
  assert.equal(blocks[2].type, "list");
  assert.deepEqual(blocks[2].items[0], {
    label: "Tầng 1, 2",
    value: "P101, P103, P104 — 3tr3/tháng",
  });
  assert.deepEqual(blocks[2].items[2], {
    label: "",
    value: "Nhận phòng từ 1/9",
  });
  assert.ok(blocks.some((block) => block.type === "field" && block.label === "Dạng phòng" && block.value === "Gác xép"));
  assert.ok(blocks.some((block) => block.type === "section" && block.title === "Dịch vụ"));
  assert.ok(blocks.some((block) => block.type === "section" && block.title === "Lưu ý"));
});

test("room composer formats locally with no AI or network request", async () => {
  const frontend = await readFile(
    new URL("../src/pages/sale/room-address-ai.js", import.meta.url),
    "utf8",
  );

  assert.match(frontend, /parseRoomDisplayBlocks/u);
  assert.match(frontend, /room-share-rich-text/u);
  assert.match(frontend, /room-share-format-section/u);
  assert.match(frontend, /room-share-format-list/u);
  assert.match(frontend, /room-share-format-label/u);
  assert.match(frontend, /body\.contentEditable = "true"/u);
  assert.doesNotMatch(frontend, /parseJoyRoomText|parseRoomLine|parseServiceLine/u);
  assert.doesNotMatch(frontend, /fetch\(|\/api\/sales\/room-summary\/extract|env\.AI/u);
});
