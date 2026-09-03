import {
  gmailDiscoveryCutoff,
  gmailSearchQuery,
  isGmailMessageNew,
} from "./gmail-sync.js";
import { isSameOrigin, json, readJson } from "./shared/http.js";
import { getSession } from "./shared/session.js";

export const GMAIL_SYNC_INTERVAL_MS = 5 * 60 * 1000;

const GMAIL_RUNTIME_PATHS = new Set([
  "/api/emails",
  "/api/emails/pin",
  "/api/emails/dismiss",
  "/api/emails/restore",
]);

export function isGmailRuntimeRoute(pathname) {
  return GMAIL_RUNTIME_PATHS.has(pathname);
}

export async function handleGmailRuntimeRequest(request, env) {
  const pathname = new URL(request.url).pathname;
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return json({ error: "INVALID_ORIGIN" }, 403);
  }

  if (pathname === "/api/emails" && request.method === "GET") {
    return listEmails(session.user_email, env);
  }
  if (pathname === "/api/emails/pin" && request.method === "POST") {
    return updateEmailPin(request, session.user_email, env);
  }
  if (pathname === "/api/emails/dismiss" && request.method === "POST") {
    return dismissEmail(request, session.user_email, env);
  }
  if (pathname === "/api/emails/restore" && request.method === "POST") {
    return restoreEmails(session.user_email, env);
  }

  return json({ error: "METHOD_NOT_ALLOWED" }, 405);
}

export async function runGmailRuntimeSchedule(env) {
  requiredConfig(env);
  const users = await env.DB.prepare("SELECT user_email FROM oauth_tokens").all();
  await Promise.allSettled(
    (users.results || []).map(({ user_email: email }) => syncGmail(email, env)),
  );
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now()).run();
}

function requiredConfig(env) {
  const keys = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "ALLOWED_EMAIL",
    "TOKEN_ENCRYPTION_SECRET",
  ];
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing Worker secrets: ${missing.join(", ")}`);
}

async function getAccessToken(email, env) {
  const row = await env.DB.prepare(`
    SELECT refresh_token_encrypted, access_token_encrypted, access_token_expires_at
    FROM oauth_tokens WHERE user_email = ?
  `).bind(email).first();
  if (!row) throw new Error("Gmail is not connected");

  if (
    row.access_token_encrypted
    && Number(row.access_token_expires_at) > Date.now() + 120_000
  ) {
    return decryptSecret(row.access_token_encrypted, env.TOKEN_ENCRYPTION_SECRET);
  }

  const refreshToken = await decryptSecret(
    row.refresh_token_encrypted,
    env.TOKEN_ENCRYPTION_SECRET,
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await response.json();
  if (!response.ok || !tokens.access_token) {
    throw new Error(`Google refresh failed: ${tokens.error || response.status}`);
  }

  const encrypted = await encryptSecret(
    tokens.access_token,
    env.TOKEN_ENCRYPTION_SECRET,
  );
  const now = Date.now();
  await env.DB.prepare(`
    UPDATE oauth_tokens
    SET access_token_encrypted = ?, access_token_expires_at = ?, updated_at = ?
    WHERE user_email = ?
  `).bind(
    encrypted,
    now + Number(tokens.expires_in || 3600) * 1000,
    now,
    email,
  ).run();
  return tokens.access_token;
}

async function gmailApi(accessToken, path) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me${path}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    const error = new Error(`Gmail API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function syncGmail(email, env, { force = false } = {}) {
  const now = Date.now();

  try {
    const syncState = await env.DB.prepare(
      "SELECT watch_started_at, last_synced_at FROM gmail_sync WHERE user_email = ?",
    ).bind(email).first();

    const watchStartedAt = Number(syncState?.watch_started_at || 0);
    const lastSyncedAt = Number(syncState?.last_synced_at || 0);

    // Keep the every-minute Worker cron for reminders, but make Gmail itself
    // a five-minute job. This also prevents a visible-page poll from racing a
    // recent scheduled sync and producing another D1 write cycle.
    if (
      !force
      && watchStartedAt
      && lastSyncedAt > now - GMAIL_SYNC_INTERVAL_MS
    ) {
      return { skipped: true, reason: "gmail-sync-window" };
    }

    // The first sync establishes a clean baseline. Mail that already existed
    // before Joy started tracking must never be surfaced as new.
    if (!watchStartedAt) {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM email_cache WHERE user_email = ?").bind(email),
        env.DB.prepare("DELETE FROM email_preferences WHERE user_email = ?").bind(email),
        env.DB.prepare(`
          INSERT INTO gmail_sync (
            user_email, last_synced_at, last_error, watch_started_at
          ) VALUES (?, ?, NULL, ?)
          ON CONFLICT(user_email) DO UPDATE SET
            last_synced_at = excluded.last_synced_at,
            last_error = NULL,
            watch_started_at = CASE
              WHEN gmail_sync.watch_started_at > 0
                THEN gmail_sync.watch_started_at
              ELSE excluded.watch_started_at
            END
        `).bind(email, now, now),
      ]);
      return { skipped: false, baseline: true };
    }

    const accessToken = await getAccessToken(email, env);
    const [preferences, cached] = await Promise.all([
      env.DB.prepare(`
        SELECT message_id, pinned, dismissed, updated_at
        FROM email_preferences
        WHERE user_email = ?
        ORDER BY updated_at DESC
      `).bind(email).all(),
      env.DB.prepare(`
        SELECT message_id, thread_id, sender, subject, snippet, message_date,
               unread, pinned, fetched_at
        FROM email_cache
        WHERE user_email = ?
        ORDER BY pinned DESC, fetched_at DESC
      `).bind(email).all(),
    ]);

    const dismissed = new Set(
      (preferences.results || [])
        .filter((row) => row.dismissed)
        .map((row) => String(row.message_id)),
    );

    const pinnedIds = (preferences.results || [])
      .filter((row) => row.pinned && !row.dismissed)
      .map((row) => String(row.message_id));
    const pinnedIdSet = new Set(pinnedIds);

    const existingIds = (cached.results || [])
      .map((row) => String(row.message_id || ""))
      .filter((id) => id && !dismissed.has(id));
    const existingIdSet = new Set(existingIds);
    const cachedById = new Map(
      (cached.results || [])
        .map((row) => [String(row.message_id || ""), row])
        .filter(([id]) => id),
    );

    const discoveryCutoff = gmailDiscoveryCutoff(watchStartedAt, lastSyncedAt);
    const listQuery = new URLSearchParams({
      maxResults: "25",
      q: gmailSearchQuery(discoveryCutoff),
    });

    const list = await gmailApi(accessToken, `/messages?${listQuery}`);
    const unreadIds = (list.messages || [])
      .map((message) => String(message.id))
      .filter((id) => (
        !dismissed.has(id)
        && !pinnedIdSet.has(id)
        && !existingIdSet.has(id)
      ))
      .slice(0, 5);

    // Pinned mail stays first, genuinely new mail comes next, and already
    // visible mail remains until it is read or explicitly dismissed.
    const ids = [...new Set([...pinnedIds, ...unreadIds, ...existingIds])];

    const messages = (await Promise.all(ids.map(async (id) => {
      try {
        const detailsQuery = new URLSearchParams({ format: "metadata" });
        ["From", "Subject", "Date"].forEach((name) => {
          detailsQuery.append("metadataHeaders", name);
        });

        const message = await gmailApi(
          accessToken,
          `/messages/${encodeURIComponent(id)}?${detailsQuery}`,
        );

        const pinned = pinnedIdSet.has(id);
        const alreadyVisible = existingIdSet.has(id);
        const unread = !Array.isArray(message.labelIds)
          || message.labelIds.includes("UNREAD");

        if (pinned || alreadyVisible) {
          if (!isGmailMessageNew(message, watchStartedAt)) return null;
          if (!pinned && !unread) return null;
        } else if (!unread || !isGmailMessageNew(message, discoveryCutoff)) {
          return null;
        }

        return normalizeGmailMessage(message, pinned);
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    }))).filter(Boolean);

    // A scheduled sync and a visible-page refresh can overlap. A stale sync
    // must not write over a newer result.
    const latestSyncState = await env.DB.prepare(
      "SELECT last_synced_at FROM gmail_sync WHERE user_email = ?",
    ).bind(email).first();
    if (Number(latestSyncState?.last_synced_at || 0) > lastSyncedAt) {
      return { skipped: true, reason: "stale-overlap" };
    }

    const visibleIds = new Set(messages.map((message) => String(message.id)));
    const statements = [];

    messages.forEach((message, index) => {
      const cachedRow = cachedById.get(String(message.id));
      if (!cachedRow) {
        statements.push(env.DB.prepare(`
          INSERT INTO email_cache (
            user_email, message_id, thread_id, sender, subject, snippet,
            message_date, unread, pinned, fetched_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          email,
          message.id,
          message.threadId,
          message.sender,
          message.subject,
          message.snippet,
          message.date,
          message.unread ? 1 : 0,
          message.pinned ? 1 : 0,
          now - index,
        ));
        return;
      }

      if (!gmailCacheRowMatches(cachedRow, message)) {
        statements.push(env.DB.prepare(`
          UPDATE email_cache
          SET thread_id = ?, sender = ?, subject = ?, snippet = ?,
              message_date = ?, unread = ?, pinned = ?
          WHERE user_email = ? AND message_id = ?
        `).bind(
          message.threadId,
          message.sender,
          message.subject,
          message.snippet,
          message.date,
          message.unread ? 1 : 0,
          message.pinned ? 1 : 0,
          email,
          message.id,
        ));
      }
    });

    existingIds
      .filter((id) => !visibleIds.has(id))
      .forEach((id) => {
        statements.push(
          env.DB.prepare(
            "DELETE FROM email_cache WHERE user_email = ? AND message_id = ?",
          ).bind(email, id),
        );
      });

    // One sync-state write remains necessary so the next discovery window can
    // advance. Unchanged cache rows are no longer deleted and reinserted.
    statements.push(env.DB.prepare(`
      INSERT INTO gmail_sync (
        user_email, last_synced_at, last_error, watch_started_at
      ) VALUES (?, ?, NULL, ?)
      ON CONFLICT(user_email) DO UPDATE SET
        last_synced_at = excluded.last_synced_at,
        last_error = NULL,
        watch_started_at = CASE
          WHEN gmail_sync.watch_started_at > 0
            THEN gmail_sync.watch_started_at
          ELSE excluded.watch_started_at
        END
    `).bind(email, now, watchStartedAt));

    await env.DB.batch(statements);
    return {
      skipped: false,
      visible: messages.length,
      cacheWrites: Math.max(0, statements.length - 1),
    };
  } catch (error) {
    await env.DB.prepare(`
      INSERT INTO gmail_sync (user_email, last_synced_at, last_error)
      VALUES (?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET
        last_error = excluded.last_error
    `).bind(email, 0, String(error.message || error).slice(0, 300)).run();
    throw error;
  }
}

function gmailCacheRowMatches(row, message) {
  return (
    String(row.thread_id || "") === String(message.threadId || "")
    && String(row.sender || "") === String(message.sender || "")
    && String(row.subject || "") === String(message.subject || "")
    && String(row.snippet || "") === String(message.snippet || "")
    && String(row.message_date || "") === String(message.date || "")
    && Boolean(row.unread) === Boolean(message.unread)
    && Boolean(row.pinned) === Boolean(message.pinned)
  );
}

function normalizeGmailMessage(message, pinned) {
  const headers = message.payload?.headers || [];
  const header = (name) => headers.find(
    (item) => String(item.name).toLowerCase() === name.toLowerCase(),
  )?.value || "";
  return {
    id: String(message.id),
    threadId: String(message.threadId || message.id),
    sender: senderName(header("From")),
    subject: header("Subject") || "(No subject)",
    snippet: message.snippet || "",
    date: header("Date"),
    unread: Array.isArray(message.labelIds)
      ? message.labelIds.includes("UNREAD")
      : true,
    pinned,
  };
}

function senderName(from) {
  const value = String(from || "Unknown sender");
  const withoutAddress = value
    .replace(/\s*<[^>]+>\s*$/, "")
    .replace(/^"|"$/g, "")
    .trim();
  return withoutAddress || value.split("@")[0];
}

async function listEmails(email, env) {
  const sync = await env.DB.prepare(`
    SELECT last_synced_at, last_error, watch_started_at
    FROM gmail_sync
    WHERE user_email = ?
  `).bind(email).first();

  let syncError = sync?.last_error || null;
  if (
    !sync
    || !Number(sync.watch_started_at)
    || Number(sync.last_synced_at) < Date.now() - GMAIL_SYNC_INTERVAL_MS
  ) {
    try {
      await syncGmail(email, env);
      syncError = null;
    } catch (error) {
      syncError = String(error.message || error);
    }
  }

  const [cache, hidden, updated] = await Promise.all([
    env.DB.prepare(`
      SELECT message_id, thread_id, sender, subject, snippet, message_date,
             unread, pinned
      FROM email_cache
      WHERE user_email = ?
      ORDER BY pinned DESC, fetched_at DESC
    `).bind(email).all(),
    env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM email_preferences
      WHERE user_email = ? AND dismissed = 1
    `).bind(email).first(),
    env.DB.prepare(`
      SELECT last_synced_at, watch_started_at
      FROM gmail_sync
      WHERE user_email = ?
    `).bind(email).first(),
  ]);

  return json({
    messages: (cache.results || []).map((row) => ({
      id: row.message_id,
      threadId: row.thread_id,
      sender: row.sender,
      subject: row.subject,
      snippet: row.snippet,
      date: row.message_date,
      unread: Boolean(row.unread),
      pinned: Boolean(row.pinned),
    })),
    hiddenCount: Number(hidden?.count || 0),
    syncedAt: Number(updated?.last_synced_at || 0),
    watchStartedAt: Number(updated?.watch_started_at || 0),
    syncError,
  });
}

async function updateEmailPin(request, email, env) {
  const body = await readJson(request);
  const id = String(body.id || "");
  if (!id) return json({ error: "MESSAGE_ID_REQUIRED" }, 400);
  const pinned = body.pinned ? 1 : 0;
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO email_preferences (
        user_email, message_id, pinned, dismissed, updated_at
      ) VALUES (?, ?, ?, 0, ?)
      ON CONFLICT(user_email, message_id) DO UPDATE SET
        pinned = excluded.pinned,
        dismissed = 0,
        updated_at = excluded.updated_at
    `).bind(email, id, pinned, now),
    env.DB.prepare(`
      UPDATE email_cache
      SET pinned = ?
      WHERE user_email = ? AND message_id = ?
    `).bind(pinned, email, id),
  ]);
  return json({ ok: true, pinned: Boolean(pinned) });
}

async function dismissEmail(request, email, env) {
  const body = await readJson(request);
  const id = String(body.id || "");
  if (!id) return json({ error: "MESSAGE_ID_REQUIRED" }, 400);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO email_preferences (
        user_email, message_id, pinned, dismissed, updated_at
      ) VALUES (?, ?, 0, 1, ?)
      ON CONFLICT(user_email, message_id) DO UPDATE SET
        pinned = 0,
        dismissed = 1,
        updated_at = excluded.updated_at
    `).bind(email, id, now),
    env.DB.prepare(
      "DELETE FROM email_cache WHERE user_email = ? AND message_id = ?",
    ).bind(email, id),
  ]);
  return json({ ok: true });
}

async function restoreEmails(email, env) {
  await env.DB.prepare(`
    UPDATE email_preferences
    SET dismissed = 0, updated_at = ?
    WHERE user_email = ? AND dismissed = 1
  `).bind(Date.now(), email).run();
  await syncGmail(email, env, { force: true });
  return json({ ok: true });
}

async function encryptSecret(value, secret) {
  const key = await encryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(String(value));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  return `${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

async function decryptSecret(value, secret) {
  const [ivPart, encryptedPart] = String(value).split(".");
  if (!ivPart || !encryptedPart) throw new Error("Stored token is invalid");
  const key = await encryptionKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(encryptedPart),
  );
  return new TextDecoder().decode(decrypted);
}

async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(secret)),
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function base64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
