import { cp } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "src", "features", "notes-launcher");
const dist = resolve(root, "dist");

await Promise.all([
  cp(resolve(source, "notes-launcher.js"), resolve(dist, "notes-launcher.js")),
  cp(resolve(source, "notes-launcher.css"), resolve(dist, "notes-launcher.css")),
]);

console.log("Locked Notes wolf launcher copied to dist");
