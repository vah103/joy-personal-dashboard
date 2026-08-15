// Legacy entrypoint kept so older Sale Assistant imports cannot activate the removed deterministic parser.
// The current Room Summary feature extracts only the customer-facing rental facts supported by the source.
if (typeof document !== "undefined") {
  await import("./room-address-ai.js?v=joy-room-address-ai-text-v1");
}
