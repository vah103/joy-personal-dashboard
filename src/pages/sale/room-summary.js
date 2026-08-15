// Legacy entrypoint kept for older Sale Assistant imports.
// Room Summary now renders the prepared text directly and makes no AI/network request.
if (typeof document !== "undefined") {
  await import("./room-address-ai.js?v=joy-room-basic-v1");
}
