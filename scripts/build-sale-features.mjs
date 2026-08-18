import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sales = resolve(root, "src", "features", "sales");
const dist = resolve(root, "dist");

const copies = [
  [resolve(sales, "shared", "i18n.js"), resolve(dist, "shared", "i18n.js")],
  [resolve(sales, "room-summary", "formatter.js"), resolve(dist, "room-summary", "formatter.js")],
  [resolve(sales, "room-summary", "renderer.js"), resolve(dist, "room-summary", "renderer.js")],
  [resolve(sales, "room-summary", "room-summary.js"), resolve(dist, "room-summary", "room-summary.js")],
];

await mkdir(resolve(dist, "shared"), { recursive: true });
await mkdir(resolve(dist, "room-summary"), { recursive: true });
await Promise.all(copies.map(([source, destination]) => cp(source, destination)));

console.log("Built canonical Sale feature modules.");
