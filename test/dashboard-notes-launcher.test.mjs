import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const manifestUrl = new URL("./fixtures/notes-wolf-v1.lock.json", import.meta.url);

async function readText(path) {
  return readFile(new URL(path, root), "utf8");
}

async function gitBlobSha(path) {
  const bytes = await readFile(new URL(path, root));
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

test("Notes wolf launcher has one isolated frontend owner", async () => {
  const [appConfig, launcher, styles, motion, buildScript, packageSource] = await Promise.all([
    readText("src/pages/dashboard/app-config.js"),
    readText("src/features/notes-launcher/notes-launcher.js"),
    readText("src/features/notes-launcher/notes-launcher.css"),
    readText("src/features/motion/dashboard-entry.css"),
    readText("scripts/build-notes-launcher.mjs"),
    readText("package.json"),
  ]);

  assert.match(appConfig, /import\("\/notes-launcher\.js\?v=joy-notes-launcher-v1"\)/);
  assert.doesNotMatch(appConfig, /notes-app-launcher|joy-notes-logo-float|joy-notes-graph-drift/);
  assert.doesNotMatch(motion, /joy-notes-|notes-app-launcher/);

  assert.match(launcher, /document\.querySelector\("\.compact-nav"\)/);
  assert.match(launcher, /button\.className = "notes-app-launcher"/);
  assert.match(launcher, /image\.src = "\/project-data\/notes-wolf\.svg\?v=joy-notes-wolf-v1"/);
  assert.match(launcher, /nav\.replaceChildren\(button\)/);
  assert.match(launcher, /notes-launcher\.css\?v=joy-notes-launcher-v1/);
  assert.doesNotMatch(launcher, /notes-app-launcher[\s\S]{0,400}addEventListener\("click"/);

  assert.match(styles, /@keyframes joy-notes-logo-float/);
  assert.match(styles, /@keyframes joy-notes-aura/);
  assert.match(styles, /@keyframes joy-notes-spark/);
  assert.match(styles, /@keyframes joy-notes-graph-drift/);
  assert.match(styles, /stroke-dashoffset/);
  assert.match(styles, /dur='5\.6s'/);
  assert.match(styles, /dur='6\.8s'/);
  assert.match(styles, /dur='5\.2s'/);
  assert.match(styles, /prefers-reduced-motion/);

  assert.match(buildScript, /src", "features", "notes-launcher"/);
  assert.match(buildScript, /notes-launcher\.js/);
  assert.match(buildScript, /notes-launcher\.css/);
  assert.match(packageSource, /node scripts\/build\.mjs && node scripts\/build-notes-launcher\.mjs/);
});

test("Notes wolf v1 golden files cannot drift silently", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  assert.equal(manifest.version, "notes-wolf-v1");

  for (const [path, expectedSha] of Object.entries(manifest.files)) {
    assert.equal(
      await gitBlobSha(path),
      expectedSha,
      `${path} changed. If this is intentional, update test/fixtures/notes-wolf-v1.lock.json in the same PR.`,
    );
  }
});

test("Notes wolf asset remains the original embedded obsidian artwork", async () => {
  const source = await readText("project-data/notes-wolf.svg");
  assert.match(source, /Notes obsidian wolf/);
  assert.match(source, /data:image\/webp;base64,/);
});
