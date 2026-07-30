import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const financeSourcePath = resolve(root, "src", "features", "finance", "finance-amount-core.js");
const financeBundlePath = resolve(root, "dist", "finance-demo.js");
const indexPath = resolve(root, "dist", "index.html");

function replaceExact(source, search, replacement, expectedCount, label) {
  const count = source.split(search).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} match(es), found ${count}`);
  }
  return source.split(search).join(replacement);
}

export function browserAmountCore(amountCoreSource) {
  return String(amountCoreSource || "").replace(/^export\s+/gm, "").trim();
}

export function patchFinanceCore(financeCoreSource, amountCoreSource) {
  let source = String(financeCoreSource || "");
  const amountCore = browserAmountCore(amountCoreSource);
  if (!amountCore.includes("function parseFinanceAmount")) {
    throw new Error("Finance amount parser source is incomplete");
  }

  const parserAnchor = "const FINANCE_REVEAL_MS = 60_000;";
  source = replaceExact(
    source,
    parserAnchor,
    `${parserAnchor}\n\n${amountCore}`,
    1,
    "Finance amount parser injection",
  );

  const legacyInput = '<input name="amount" type="number" min="1" step="1000" inputmode="numeric" placeholder="0" required>';
  const safeInput = '<input name="amount" type="text" inputmode="numeric" autocomplete="off" placeholder="50 = 50.000 ₫" required>';
  source = replaceExact(source, legacyInput, safeInput, 2, "Finance amount inputs");

  source = replaceExact(
    source,
    "  const amount = Number(form.elements.amount?.value || 0);",
    "  const amount = parseFinanceAmount(form.elements.amount?.value);",
    1,
    "Inline Finance amount parser",
  );

  source = replaceExact(
    source,
    '  form.elements.amount.value = transaction?.amount || "";',
    '  form.elements.amount.value = transaction ? financeAmountInputValue(transaction.amount) : "";',
    1,
    "Finance edit amount display",
  );

  const legacyModalBlock = `  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;
  const payload = Object.fromEntries(new FormData(form));
  payload.amount = Number(payload.amount);
  delete payload.id;
  const wasEditing = Boolean(editingTransactionId);`;

  const safeModalBlock = `  const submit = form.querySelector("button[type='submit']");
  const payload = Object.fromEntries(new FormData(form));
  payload.amount = parseFinanceAmount(payload.amount);
  if (!Number.isFinite(payload.amount)) {
    showFinanceToast("Enter a valid amount.");
    form.elements.amount?.focus();
    return;
  }
  submit.disabled = true;
  delete payload.id;
  const wasEditing = Boolean(editingTransactionId);`;

  source = replaceExact(
    source,
    legacyModalBlock,
    safeModalBlock,
    1,
    "Modal Finance amount parser",
  );

  if (source.includes('name="amount" type="number"') || source.includes('step="1000"')) {
    throw new Error("Finance production bundle still contains native number-step validation");
  }
  if (source.includes("Number(form.elements.amount?.value") || source.includes("payload.amount = Number(payload.amount)")) {
    throw new Error("Finance production bundle still bypasses the canonical amount parser");
  }

  return source;
}

export function patchFinanceIndex(indexSource) {
  const source = String(indexSource || "");
  const pattern = /finance-demo\.js\?v=[^"']+/g;
  const matches = source.match(pattern) || [];
  if (matches.length !== 1) {
    throw new Error(`Finance core asset: expected 1 reference, found ${matches.length}`);
  }
  return source.replace(pattern, "finance-demo.js?v=joy-finance-core-v8");
}

async function main() {
  const [financeCoreSource, amountCoreSource, indexSource] = await Promise.all([
    readFile(financeBundlePath, "utf8"),
    readFile(financeSourcePath, "utf8"),
    readFile(indexPath, "utf8"),
  ]);

  const financeCore = patchFinanceCore(financeCoreSource, amountCoreSource);
  const index = patchFinanceIndex(indexSource);

  await Promise.all([
    writeFile(financeBundlePath, financeCore),
    writeFile(indexPath, index),
  ]);

  console.log("Finance core amount handling patched to v8");
}

const isDirectRun = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) await main();
