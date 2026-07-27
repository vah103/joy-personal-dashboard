import { lstat, mkdir, rm, symlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const compatibilityPaths = [
  ["index.html", "src/pages/dashboard/index.html"],
  ["app.js", "src/pages/dashboard/app.js"],
  ["styles.css", "src/pages/dashboard/styles.css"],
  ["login.html", "src/pages/login/index.html"],
  ["login.css", "src/pages/login/login.css"],
  ["sale-manager.html", "src/pages/sale/index.html"],
  ["sale-manager.js", "src/pages/sale/sale-manager.js"],
  ["sale-manager.css", "src/pages/sale/sale-manager.css"],
  ["room-summary.js", "src/pages/sale/room-summary.js"],
  ["room-summary.css", "src/pages/sale/room-summary.css"],
  ["sales-assistant.js", "src/features/sales/sales-assistant.js"],
  ["sales-assistant.css", "src/features/sales/sales-assistant.css"],
  ["sale-appointment.js", "src/features/sales/sale-appointment.js"],
  ["project-details.js", "src/features/project-details/project-details.js"],
  ["project-details.css", "src/features/project-details/project-details.css"],
  ["turtlebot4-art.webp", "src/features/project-details/turtlebot4-art.webp"],
  ["finance-demo.js", "src/features/finance/finance.js"],
  ["finance-demo.css", "src/features/finance/finance.css"],
  ["weather-rain.js", "src/features/weather/weather-rain.js"],
  ["todo-visibility.js", "src/features/tasks/todo-visibility.js"],
  ["task-english.js", "src/features/tasks/task-english.js"],
  ["task-reminders-events.js", "src/features/tasks/task-reminders-events.js"],
  ["task-reminders.js", "src/features/tasks/task-reminders.js"],
  ["task-reminders.css", "src/features/tasks/task-reminders.css"],
  ["auth-ui.js", "src/features/auth/auth-ui.js"],
  ["auth-ui.css", "src/features/auth/auth-ui.css"],
  ["push-notifications.js", "src/features/notifications/push-notifications.js"],
  ["mobile-notifications.css", "src/features/notifications/mobile-notifications.css"],
  ["weather-status-ui.js", "src/features/notifications/weather-status-ui.js"],
  ["project-hub-performance.js", "src/features/project-hub/project-hub-performance.js"],
  ["project-hub-core.js", "src/features/project-hub/project-hub-core.js"],
  ["project-hub-render.js", "src/features/project-hub/project-hub-render.js"],
  ["project-hub-actions.js", "src/features/project-hub/project-hub-actions.js"],
  ["project-hub.css", "src/features/project-hub/project-hub.css"],
  ["turtlebot-card-art.css", "src/features/project-hub/turtlebot-card-art.css"],
  ["turtlebot4-card-background.webp", "src/features/project-hub/turtlebot4-card-background.webp"],
  ["app-icon-64.png", "src/assets/icons/app-icon-64.png"],
  ["app-icon-192.png", "src/assets/icons/app-icon-192.png"],
  ["joy-blue-icon.png", "src/assets/icons/joy-blue-icon.png"],
  ["joy-web-favicon.svg", "src/assets/icons/joy-web-favicon.svg"],
  ["wolf-mark.svg", "src/assets/icons/wolf-mark.svg"],
  ["site.webmanifest", "src/pwa/site.webmanifest"],
  ["sw.js", "src/pwa/sw.js"],
  ["modules", "src/features"],
  ["sale-fonts", "src/assets/fonts/nunito"],
];

const syntaxChecks = [
  "worker/task-reminders.js",
  "worker/reminder-delivery.js",
  "worker/push.js",
  "worker/push-subscription-cleanup.js",
  "worker/sale-viewing-create.js",
  "worker/router.js",
  "worker/ielts-core.js",
  "worker/ielts-diagnostic-review.js",
  "worker/task-delete.js",
  "worker/task-english.js",
  "src/pages/sale/room-summary.js",
  "src/features/sales/sale-appointment.js",
  "src/features/sales/sales-assistant.js",
  "src/features/weather/weather-rain.js",
  "src/features/tasks/task-english.js",
  "src/features/tasks/task-reminders-events.js",
  "src/features/tasks/task-reminders.js",
  "src/features/notifications/push-notifications.js",
  "src/features/notifications/weather-status-ui.js",
  "src/features/ielts/card.js",
  "src/features/ielts/core-model.js",
  "src/features/ielts/core-ui.js",
  "src/features/ielts/core-actions.js",
  "src/features/ielts/core-diagnostic.js",
  "src/features/ielts/core-writing-review.js",
  "src/features/ielts/core-writing-rewrite.js",
  "src/pwa/sw.js",
  "scripts/build.mjs",
  "scripts/validate-ielts-sources.mjs",
];

const created = [];

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function runNode(args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
  });
  return new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Test process ended with signal ${signal}`));
      else resolveExit(code ?? 1);
    });
  });
}

try {
  for (const [legacyPath, sourcePath] of compatibilityPaths) {
    const legacy = resolve(root, legacyPath);
    const source = resolve(root, sourcePath);
    if (await exists(legacy)) continue;
    await mkdir(dirname(legacy), { recursive: true });
    const target = relative(dirname(legacy), source) || ".";
    const type = legacyPath === "modules" || legacyPath === "sale-fonts" ? "dir" : "file";
    await symlink(target, legacy, type);
    created.push(legacy);
  }

  for (const path of syntaxChecks) {
    const exitCode = await runNode(["--check", path]);
    if (exitCode !== 0) {
      process.exitCode = exitCode;
      break;
    }
  }

  if (!process.exitCode) {
    process.exitCode = await runNode(["--test"]);
  }
} finally {
  await Promise.allSettled(created.reverse().map((path) => rm(path, { recursive: true, force: true })));
}
