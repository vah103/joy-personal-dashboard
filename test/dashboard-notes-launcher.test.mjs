import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dashboard mounts a visual-only Notes launcher in place of the legacy compact nav", async () => {
  const source = await readFile(new URL("../src/pages/dashboard/app-config.js", import.meta.url), "utf8");

  assert.match(source, /const canMountNotes =/);
  assert.match(source, /document\.querySelector\("\.compact-nav"\)/);
  assert.match(source, /button\.className = "notes-app-launcher"/);
  assert.match(source, /image\.src = "\/project-data\/notes-wolf\.svg\?v=joy-notes-wolf-v1"/);
  assert.match(source, /nav\.replaceChildren\(button\)/);
  assert.match(source, /@keyframes joy-notes-logo-float/);
  assert.match(source, /@keyframes joy-notes-aura/);
  assert.match(source, /@keyframes joy-notes-spark/);
  assert.doesNotMatch(source, /notes-app-launcher[\s\S]{0,400}addEventListener\("click"/);
});

test("Notes launcher stays safe in minimal non-browser test harnesses", async () => {
  const source = await readFile(new URL("../src/pages/dashboard/app-config.js", import.meta.url), "utf8");
  assert.match(source, /typeof document\.createElement === "function"/);
  assert.match(source, /if \(!canMountNotes\) return;/);
});

test("Notes launcher uses a restrained animated graph layer", async () => {
  const source = await readFile(new URL("../src/features/motion/dashboard-entry.css", import.meta.url), "utf8");

  assert.match(source, /@keyframes joy-notes-graph-drift/);
  assert.match(source, /4-node graph sits behind the wolf/);
  assert.match(source, /stroke-dashoffset/);
  assert.match(source, /dur='5\.6s'/);
  assert.match(source, /dur='6\.8s'/);
  assert.match(source, /dur='5\.2s'/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /\.notes-app-launcher::before[\s\S]*display: none !important/);
});
