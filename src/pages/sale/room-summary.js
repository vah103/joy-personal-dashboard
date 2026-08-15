// Legacy entrypoint kept for older Sale Assistant imports.
// Room Summary now accepts only prepared Joy Room Text and does not call the room-summary AI endpoint.
if (typeof document !== "undefined") {
  await import("./room-address-ai.js?v=joy-room-text-only-v1");
}
