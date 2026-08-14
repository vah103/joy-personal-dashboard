// Legacy entrypoint kept only so older Sale Assistant imports cannot activate the old parser.
// The current Room Summary feature is intentionally address-only.
if (typeof document !== "undefined") {
  await import("./room-address-ai.js?v=joy-room-address-ai-v1");
}
