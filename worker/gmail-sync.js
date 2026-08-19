export function gmailDiscoveryCutoff(watchStartedAt, lastSyncedAt) {
  const watch = Math.max(0, Math.floor(Number(watchStartedAt) || 0));
  if (!watch) return 0;
  const lastSync = Math.max(0, Math.floor(Number(lastSyncedAt) || 0));
  return Math.max(watch, lastSync);
}

export function gmailSearchQuery(cutoffAt) {
  const cutoff = Math.max(0, Math.floor(Number(cutoffAt) || 0));
  if (!cutoff) return "is:unread in:inbox";
  return `is:unread in:inbox after:${Math.floor(cutoff / 1000)}`;
}

export function isGmailMessageNew(message, cutoffAt) {
  const cutoff = Number(cutoffAt);
  const receivedAt = Number(message?.internalDate);
  return Number.isFinite(cutoff)
    && cutoff > 0
    && Number.isFinite(receivedAt)
    && receivedAt >= cutoff;
}
