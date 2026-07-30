import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

const TASK_ENGLISH_PATH = "/api/tasks/english";
const DEFAULT_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

export function isTaskEnglishRoute(pathname) {
  return pathname === TASK_ENGLISH_PATH;
}

export async function handleTaskEnglishRequest(request, env) {
  try {
    if (request.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
    }
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);

    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

    const body = await readJson(request);
    const original = cleanTaskText(body.text);
    if (!original || original.length > 500) {
      return json({ error: "INVALID_TASK_TEXT" }, 400);
    }

    if (!env?.AI?.run) {
      return json({ title: original, changed: false, ai: false });
    }

    const messages = [
      {
        role: "system",
        content: `Translate one personal to-do item into natural English.

The input may be Vietnamese or imperfect English. Return one concise, grammatically correct English task sentence. Begin with a clear action verb when it is an action. Use sentence case and suitable punctuation.

Preserve the exact meaning, names, project names, acronyms, URLs, dates, times, quantities, and technical terms. Do not add details, explanations, advice, labels, markdown, quotation marks, or a second task. If the input explicitly asks for a reminder, retain a natural "Remind me to ..." structure.

Examples:
ăn cơm -> Eat a meal.
cắt móng tay -> Trim your nails.
mua kem đánh răng Sensodyne -> Buy Sensodyne toothpaste.
hoàn thành báo cáo TurtleBot4 -> Complete the TurtleBot4 report.

Return only the final English task sentence.`,
      },
      {
        role: "user",
        content: original,
      },
    ];

    const result = await env.AI.run(env.TASK_ENGLISH_AI_MODEL || DEFAULT_AI_MODEL, {
      messages,
      temperature: 0,
      max_tokens: 64,
    });

    const title = normalizeEnglishTitle(extractAiText(result), original);

    return json({
      title,
      changed: title !== original,
      ai: true,
    });
  } catch (error) {
    console.error("Joy task English rewrite failed", error);
    return json({ error: "TASK_ENGLISH_FAILED" }, 500);
  }
}

function extractAiText(result) {
  const value = result?.response ?? result?.result ?? result?.text ?? "";
  if (value && typeof value === "object") {
    return value.title ?? value.response ?? value.text ?? "";
  }

  const text = String(value || "").trim();
  if (!text) return "";

  const unfenced = text
    .replace(/^```(?:json|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(unfenced);
    if (parsed && typeof parsed === "object") {
      return parsed.title ?? parsed.response ?? parsed.text ?? unfenced;
    }
  } catch {
    // Plain text is the preferred response format.
  }

  return unfenced
    .replace(/^\s*(?:title|task|answer|translation)\s*:\s*/i, "")
    .trim();
}

function normalizeEnglishTitle(value, fallback) {
  const title = cleanTaskText(value)
    .replace(/^[-*•]+\s*/, "")
    .replace(/^(["'`])([\s\S]*)\1$/, "$2")
    .trim();
  return title && title.length <= 500 ? title : fallback;
}

function cleanTaskText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
