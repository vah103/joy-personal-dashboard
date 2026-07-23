const MAX_SCRATCHPAD_LENGTH = 100_000;

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
