// Legacy entrypoint kept for older Sale Assistant imports.
// Room Summary formats prepared text locally and makes no AI/network request.
if (typeof document !== "undefined") {
  await import("./room-address-ai.js?v=joy-room-format-v2");
}
