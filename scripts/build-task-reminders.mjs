import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tasks = resolve(root, "src", "features", "tasks");
const dist = resolve(root, "dist");

const sourceFiles = [
  "task-reminder-core.js",
  "task-repeating.js",
  "task-focus.js",
  "task-reminders.js",
];

const parts = await Promise.all(
  sourceFiles.map((file) => readFile(resolve(tasks, file), "utf8")),
);

await writeFile(resolve(dist, "task-reminders.js"), `${parts.join("\n\n")}\n`);
console.log(`Hey Joy! task reminder bundle built from ${sourceFiles.length} modules`);
