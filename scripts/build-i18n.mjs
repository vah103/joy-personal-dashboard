import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "src", "i18n");
const target = resolve(root, "dist", "i18n");

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });

console.log("Joy shared i18n assets copied without rewriting production HTML");
