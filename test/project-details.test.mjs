import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const projectDetails = fs.readFileSync(
  new URL("../project-details.js", import.meta.url),
  "utf8",
);

const styles = fs.readFileSync(
  new URL("../project-details.css", import.meta.url),
  "utf8",
);

const html = fs.readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8",
);

const build = fs.readFileSync(
  new URL("../scripts/build.mjs", import.meta.url),
  "utf8",
);

const turtlebotArtUrl = new URL(
  "../turtlebot4-art.webp",
  import.meta.url,
);

test("TurtleBot project contains roadmap, commands and daily log", () => {
  assert.ok(projectDetails.includes("Project roadmap"));
  assert.ok(projectDetails.includes("Important ROS 2 commands"));
  assert.ok(projectDetails.includes("23/07/2026"));
  assert.ok(
    projectDetails.includes("SLAM, Localization and Navigation"),
  );
  assert.ok(projectDetails.includes("copy-command"));
});

test("TurtleBot project links to the selected Google Docs tabs", () => {
  assert.ok(projectDetails.includes("tab=t.jg1b8ko3m1np"));
  assert.ok(projectDetails.includes("tab=t.7feamk65cnlv"));
});

test("IELTS project contains all four requested sections", () => {
  assert.ok(projectDetails.includes('["writing", "Writing"]'));
  assert.ok(projectDetails.includes('["reading", "Reading"]'));
  assert.ok(projectDetails.includes('["listening", "Listening"]'));
  assert.ok(
    projectDetails.includes('["flashcards", "Flashcards"]'),
  );
  assert.ok(projectDetails.includes("No study sessions yet"));
});

test("project cards open details without interfering with controls", () => {
  assert.ok(projectDetails.includes(".project-card-has-details"));
  assert.ok(
    projectDetails.includes(
      "button, a, input, textarea, select",
    ),
  );
  assert.ok(projectDetails.includes("aria-haspopup"));
});

test("TurtleBot art appears in both modal and dashboard card", () => {
  assert.ok(fs.existsSync(turtlebotArtUrl));
  assert.ok(fs.statSync(turtlebotArtUrl).size > 10_000);
  assert.ok(projectDetails.includes("turtlebot4-art.webp"));
  assert.ok(projectDetails.includes("turtlebot-card-visual"));
  assert.ok(projectDetails.includes("project-card-turtlebot"));
});

test("project typography is enlarged and remains responsive", () => {
  assert.ok(styles.includes("Project visual polish v2"));
  assert.ok(styles.includes(".turtlebot-card-visual"));
  assert.ok(styles.includes(".project-details-heading h2"));
  assert.ok(styles.includes("@media (max-width: 800px)"));
});

test("project detail assets are loaded and included in build output", () => {
  assert.ok(html.includes("project-details.css"));
  assert.ok(html.includes("project-details.js"));

  assert.ok(
    html.indexOf("app.js") < html.indexOf("project-details.js"),
  );

  assert.ok(build.includes('"project-details.js"'));
  assert.ok(build.includes('"project-details.css"'));
  assert.ok(build.includes('"turtlebot4-art.webp"'));
});




test("TurtleBot hero uses the complete background asset", () => {
  assert.ok(styles.includes("TurtleBot full-background hero card v7"));
  assert.ok(styles.includes("turtlebot4-card-background.webp"));
  assert.ok(styles.includes("display: none !important"));
  assert.ok(build.includes('"turtlebot4-card-background.webp"'));
});
