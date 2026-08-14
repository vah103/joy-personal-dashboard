// Legacy entrypoint kept so older Sale Assistant imports cannot activate the removed deterministic parser.
// The current Room Summary feature extracts only address plus current rooms, prices and availability.
if (typeof document !== "undefined") {
  await import("./room-address-ai.js?v=joy-room-address-ai-v2");
}
