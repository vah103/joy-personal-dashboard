export function gmailSearchQuery(watchStartedAt) {
  const cutoff = Math.max(0, Math.floor(Number(watchStartedAt) || 0));
  if (!cutoff) return "is:unread in:inbox";
  return `is:unread in:inbox after:${Math.floor(cutoff / 1000)}`;
}

export function isGmailMessageNew(message, watchStartedAt) {
  const cutoff = Number(watchStartedAt);
  const receivedAt = Number(message?.internalDate);
  return Number.isFinite(cutoff)
    && cutoff > 0
    && Number.isFinite(receivedAt)
    && receivedAt >= cutoff;
}
