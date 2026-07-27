import {
  handleDailyBriefRequest as handleStoredDailyBriefRequest,
  isDailyBriefRoute,
  runDailyBriefSchedule,
} from "./daily-brief.js";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export { isDailyBriefRoute, runDailyBriefSchedule };

export async function handleDailyBriefRequest(request, env, ctx) {
  const response = await handleStoredDailyBriefRequest(request, env, ctx);
  if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) {
    return response;
  }

  const payload = await response.json();
  const now = Date.now();
  const stories = Array.isArray(payload.stories) ? payload.stories : [];

  payload.stories = stories
    .filter((story) => {
      const publishedAt = Number(story?.publishedAt || 0);
      return publishedAt > 0 && publishedAt + STORY_TTL_MS > now;
    })
    .map((story) => ({
      ...story,
      expiresAt: Number(story.publishedAt) + STORY_TTL_MS,
    }));

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), {
    status: response.status,
    headers,
  });
}
