import { cp } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "src", "features", "daily-day", "daily-day.js");
const target = resolve(root, "dist", "daily-day.js");

await cp(source, target);
console.log("Joy Daily Day frontend copied to dist");
