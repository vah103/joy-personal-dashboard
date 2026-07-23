const MAX_TITLE_LENGTH = 500;
const MAX_ID_LENGTH = 100;

export function normalizeTaskInput(value) {
  const id = String(value?.id || "").trim();
  const title = String(value?.title || "").trim();
  if (!id || id.length > MAX_ID_LENGTH) return { ok: false, error: "INVALID_TASK_ID" };
  if (!title) return { ok: false, error: "TASK_TITLE_REQUIRED" };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: "TASK_TITLE_TOO_LONG" };

  const parsedCreatedAt = Date.parse(value?.createdAt || "");
  const createdAt = Number.isFinite(parsedCreatedAt) ? parsedCreatedAt : Date.now();
  const parsedUpdatedAt = Date.parse(value?.completedAt || value?.updatedAt || "");
  const updatedAt = Number.isFinite(parsedUpdatedAt) ? Math.max(createdAt, parsedUpdatedAt) : createdAt;
  return {
    ok: true,
    task: { id, title, done: Boolean(value?.done), createdAt, updatedAt },
  };
}

export function vietnamDateKey(timestamp) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(Number(timestamp))).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function taskRowToApi(row) {
  const createdAt = Number(row.created_at);
  const updatedAt = Number(row.updated_at);
  const done = Boolean(row.done);
  return {
    id: String(row.id),
    title: String(row.title),
    createdDate: vietnamDateKey(createdAt),
    createdAt: new Date(createdAt).toISOString(),
    done,
    completedAt: done ? new Date(updatedAt).toISOString() : null,
  };
}
