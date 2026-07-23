const MAX_SCRATCHPAD_LENGTH = 100_000;
const MAX_PROJECT_ID_LENGTH = 100;
const MAX_PROJECT_NAME_LENGTH = 160;
const MAX_PROJECT_TEXT_LENGTH = 800;

export function normalizeScratchpadInput(value) {
  const content = String(value?.content ?? "");
  const baseVersion = Number(value?.baseVersion);

  if (content.length > MAX_SCRATCHPAD_LENGTH) {
    return { ok: false, error: "SCRATCHPAD_TOO_LONG" };
  }
  if (!Number.isInteger(baseVersion) || baseVersion < 0) {
    return { ok: false, error: "INVALID_SCRATCHPAD_VERSION" };
  }

  return {
    ok: true,
    value: { content, baseVersion },
  };
}

export function scratchpadRowToApi(row) {
  if (!row) {
    return {
      exists: false,
      content: "",
      version: 0,
      updatedAt: 0,
    };
  }

  return {
    exists: true,
    content: String(row.content || ""),
    version: Number(row.version || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

export function normalizeProjectInput(value) {
  const id = String(value?.id ?? "").trim();
  const name = String(value?.name ?? "").trim();
  const focus = String(value?.focus ?? "").trim();
  const next = String(value?.next ?? value?.nextAction ?? "").trim();
  const rawProgress = Number(value?.progress);
  const progress = Number.isFinite(rawProgress)
    ? Math.min(100, Math.max(0, Math.round(rawProgress)))
    : 0;
  const accent = value?.accent === "blue" ? "blue" : "slate";

  if (!id || id.length > MAX_PROJECT_ID_LENGTH) {
    return { ok: false, error: "INVALID_PROJECT_ID" };
  }
  if (!name || name.length > MAX_PROJECT_NAME_LENGTH) {
    return { ok: false, error: "INVALID_PROJECT_NAME" };
  }
  if (!focus || focus.length > MAX_PROJECT_TEXT_LENGTH) {
    return { ok: false, error: "INVALID_PROJECT_FOCUS" };
  }
  if (!next || next.length > MAX_PROJECT_TEXT_LENGTH) {
    return { ok: false, error: "INVALID_PROJECT_NEXT_ACTION" };
  }

  const parsedCreatedAt = Date.parse(value?.createdAt || "");
  const createdAt = Number.isFinite(parsedCreatedAt) ? parsedCreatedAt : Date.now();
  const parsedUpdatedAt = Date.parse(value?.updatedAt || "");
  const updatedAt = Number.isFinite(parsedUpdatedAt)
    ? Math.max(createdAt, parsedUpdatedAt)
    : createdAt;

  return {
    ok: true,
    project: {
      id,
      name,
      focus,
      next,
      progress,
      accent,
      archived: Boolean(value?.archived),
      createdAt,
      updatedAt,
    },
  };
}

export function projectRowToApi(row) {
  return {
    id: String(row.id),
    name: String(row.name),
    focus: String(row.focus),
    next: String(row.next_action),
    progress: Number(row.progress || 0),
    accent: row.accent === "blue" ? "blue" : "slate",
    archived: Boolean(row.archived),
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
  };
}
