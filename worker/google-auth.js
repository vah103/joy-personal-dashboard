import { isSameOrigin, json } from "./shared/http.js";
import { getSession, readCookies, sha256Hex } from "./shared/session.js";

const SESSION_COOKIE = "__Host-joy_session";
const OAUTH_STATE_COOKIE = "__Host-joy_oauth_state";
const PKCE_COOKIE = "__Host-joy_pkce";
const OAUTH_FLOW_COOKIE = "__Host-joy_oauth_flow";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;
const OAUTH_COOKIE_MAX_AGE = 10 * 60;
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const AUTH_PATHS = new Set([
  "/login",
  "/auth/login",
  "/auth/start",
  "/auth/connect/gmail",
  "/auth/connect/sheets",
  "/auth/callback",
  "/api/session",
  "/api/signout",
  "/api/disconnect",
  "/api/integrations/gmail/disconnect",
  "/api/integrations/sheets/disconnect",
]);

export function isGoogleAuthRoute(pathname) {
  return AUTH_PATHS.has(pathname);
}

export function integrationForApiPath(pathname) {
  if (pathname === "/api/emails" || pathname.startsWith("/api/emails/")) return "gmail";
  if (
    pathname === "/api/sales/viewings"
    || pathname === "/api/sales/deals"
    || pathname.startsWith("/api/finance/")
  ) return "sheets";
  return "";
}

export async function handleGoogleAuthRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/login" && request.method === "GET") {
    const session = await getSession(request, env);
    if (session) return redirect("/");
    return serveAsset(request, env, "/login.html");
  }
  if (pathname === "/auth/login" && request.method === "GET") {
    return startGoogleAuthorization(request, env, "login");
  }
  if (pathname === "/auth/start" && request.method === "GET") {
    return startGoogleAuthorization(request, env, "connect:gmail");
  }
  if (pathname === "/auth/connect/gmail" && request.method === "GET") {
    return startGoogleAuthorization(request, env, "connect:gmail");
  }
  if (pathname === "/auth/connect/sheets" && request.method === "GET") {
    return startGoogleAuthorization(request, env, "connect:sheets");
  }
  if (pathname === "/auth/callback" && request.method === "GET") {
    return finishGoogleAuthorization(request, env);
  }
  if (pathname === "/api/session" && request.method === "GET") {
    return sessionStatus(request, env);
  }
  if (pathname === "/api/signout" && request.method === "POST") {
    return signOut(request, env);
  }
  if (
    (pathname === "/api/disconnect" || pathname === "/api/integrations/gmail/disconnect")
    && request.method === "POST"
  ) {
    return disconnectIntegration(request, env, "gmail");
  }
  if (pathname === "/api/integrations/sheets/disconnect" && request.method === "POST") {
    return disconnectIntegration(request, env, "sheets");
  }

  return json({ error: "NOT_FOUND" }, 404);
}

export async function protectJoyAsset(request, env) {
  const session = await getSession(request, env);
  if (!session) return serveAsset(request, env, "/login.html");
  return env.ASSETS.fetch(request);
}

export async function guardGoogleIntegration(request, env, service) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

  const integrations = await integrationStatus(session.user_email, env);
  if (service === "gmail" && !integrations.gmail) {
    return json({ error: "GMAIL_AUTHORIZATION_REQUIRED" }, 401);
  }
  if (service === "sheets" && !integrations.sheets) {
    return json({ error: "SHEETS_AUTHORIZATION_REQUIRED" }, 403);
  }
  return null;
}

export async function hasEnabledGmailIntegration(env) {
  await ensureIntegrationSchema(env);
  const enabled = await env.DB.prepare(`
    SELECT 1 AS enabled
    FROM google_integrations
    WHERE gmail_enabled = 1
    LIMIT 1
  `).first();
  if (enabled) return true;

  const legacy = await env.DB.prepare(`
    SELECT 1 AS enabled
    FROM oauth_tokens legacy
    WHERE NOT EXISTS (
      SELECT 1 FROM google_integrations current
      WHERE current.user_email = legacy.user_email
    )
    LIMIT 1
  `).first();
  return Boolean(legacy);
}

async function startGoogleAuthorization(request, env, flow) {
  requiredConfig(env);
  const url = new URL(request.url);
  const isLogin = flow === "login";
  const service = flow.split(":")[1] || "";

  if (!isLogin) {
    const session = await getSession(request, env);
    if (!session) return redirect("/login");
    if (!["gmail", "sheets"].includes(service)) return json({ error: "INVALID_INTEGRATION" }, 400);
  }

  const redirectUri = `${url.origin}/auth/callback`;
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = await sha256Base64Url(verifier);
  const serviceScope = service === "gmail" ? GMAIL_SCOPE : service === "sheets" ? SHEETS_SCOPE : "";
  const parameters = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: ["openid", "email", "profile", serviceScope].filter(Boolean).join(" "),
    access_type: isLogin ? "online" : "offline",
    prompt: isLogin ? "select_account" : "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const headers = new Headers({ Location: `https://accounts.google.com/o/oauth2/v2/auth?${parameters}` });
  headers.append("Set-Cookie", cookie(OAUTH_STATE_COOKIE, state, OAUTH_COOKIE_MAX_AGE));
  headers.append("Set-Cookie", cookie(PKCE_COOKIE, verifier, OAUTH_COOKIE_MAX_AGE));
  headers.append("Set-Cookie", cookie(OAUTH_FLOW_COOKIE, flow, OAUTH_COOKIE_MAX_AGE));
  return new Response(null, { status: 302, headers });
}

async function finishGoogleAuthorization(request, env) {
  requiredConfig(env);
  const url = new URL(request.url);
  const cookies = readCookies(request);
  const state = url.searchParams.get("state") || "";
  const expectedState = cookies[OAUTH_STATE_COOKIE] || "";
  const verifier = cookies[PKCE_COOKIE] || "";
  const flow = cookies[OAUTH_FLOW_COOKIE] || "";
  const code = url.searchParams.get("code");

  if (!code || !verifier || !flow || !constantTimeEqual(state, expectedState)) {
    return htmlError("Google sign-in could not be verified. Return to Joy and try again.", 400);
  }

  const redirectUri = `${url.origin}/auth/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.access_token || !tokens.id_token) {
    console.error("Google token exchange failed", tokens.error);
    return htmlError("Google did not complete the request. Return to Joy and try again.", 400);
  }

  const identity = await verifyGoogleIdentity(tokens.id_token, env);
  if (!identity) return htmlError("This Google account is not allowed to open Joy.", 403);
  const email = identity.email.toLowerCase();
  const headers = new Headers({ Location: "/" });

  if (flow === "login") {
    const sessionToken = await createSession(email, env);
    headers.append("Set-Cookie", cookie(SESSION_COOKIE, sessionToken, SESSION_MAX_AGE));
  } else {
    const session = await getSession(request, env);
    if (!session) return redirect("/login");
    if (session.user_email.toLowerCase() !== email) {
      return htmlError("Choose the same Google account that is signed in to Joy.", 403);
    }

    const service = flow.split(":")[1];
    if (!["gmail", "sheets"].includes(service)) return htmlError("The Google integration was not recognized.", 400);
    await saveGoogleIntegrationTokens(email, tokens, service, env);
    headers.set("Location", `/?connected=${encodeURIComponent(service)}`);
  }

  headers.append("Set-Cookie", clearCookie(OAUTH_STATE_COOKIE));
  headers.append("Set-Cookie", clearCookie(PKCE_COOKIE));
  headers.append("Set-Cookie", clearCookie(OAUTH_FLOW_COOKIE));
  return new Response(null, { status: 302, headers });
}

async function saveGoogleIntegrationTokens(email, tokens, service, env) {
  await ensureIntegrationSchema(env);
  const existing = await env.DB.prepare(`
    SELECT refresh_token_encrypted
    FROM oauth_tokens
    WHERE user_email = ?
  `).bind(email).first();

  const refreshTokenEncrypted = tokens.refresh_token
    ? await encryptSecret(tokens.refresh_token, env.TOKEN_ENCRYPTION_SECRET)
    : existing?.refresh_token_encrypted;
  if (!refreshTokenEncrypted) {
    throw new Error("Google did not issue offline access");
  }

  const now = Date.now();
  const accessTokenEncrypted = await encryptSecret(tokens.access_token, env.TOKEN_ENCRYPTION_SECRET);
  const gmailEnabled = service === "gmail" ? 1 : 0;
  const sheetsEnabled = service === "sheets" ? 1 : 0;

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO oauth_tokens (
        user_email, refresh_token_encrypted, access_token_encrypted,
        access_token_expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET
        refresh_token_encrypted = excluded.refresh_token_encrypted,
        access_token_encrypted = excluded.access_token_encrypted,
        access_token_expires_at = excluded.access_token_expires_at,
        updated_at = excluded.updated_at
    `).bind(
      email,
      refreshTokenEncrypted,
      accessTokenEncrypted,
      now + Number(tokens.expires_in || 3600) * 1000,
      now,
    ),
    env.DB.prepare(`
      INSERT INTO google_integrations (
        user_email, gmail_enabled, sheets_enabled, updated_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET
        gmail_enabled = MAX(google_integrations.gmail_enabled, excluded.gmail_enabled),
        sheets_enabled = MAX(google_integrations.sheets_enabled, excluded.sheets_enabled),
        updated_at = excluded.updated_at
    `).bind(email, gmailEnabled, sheetsEnabled, now),
  ]);
}

async function sessionStatus(request, env) {
  const session = await getSession(request, env);
  if (!session) {
    return json({
      connected: false,
      signedIn: false,
      email: "",
      integrations: { gmail: false, sheets: false },
    });
  }

  const integrations = await integrationStatus(session.user_email, env);
  return json({
    connected: true,
    signedIn: true,
    email: session.user_email,
    integrations,
  });
}

async function integrationStatus(email, env) {
  await ensureIntegrationSchema(env);
  let row = await env.DB.prepare(`
    SELECT gmail_enabled, sheets_enabled
    FROM google_integrations
    WHERE user_email = ?
  `).bind(email).first();

  if (!row) {
    const legacy = await env.DB.prepare(`
      SELECT 1 AS connected FROM oauth_tokens WHERE user_email = ?
    `).bind(email).first();
    if (legacy) {
      await env.DB.prepare(`
        INSERT INTO google_integrations (
          user_email, gmail_enabled, sheets_enabled, updated_at
        ) VALUES (?, 1, 1, ?)
      `).bind(email, Date.now()).run();
      row = { gmail_enabled: 1, sheets_enabled: 1 };
    }
  }

  return {
    gmail: Boolean(row?.gmail_enabled),
    sheets: Boolean(row?.sheets_enabled),
  };
}

async function disconnectIntegration(request, env, service) {
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
  const session = await getSession(request, env);
  if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
  await integrationStatus(session.user_email, env);

  const column = service === "gmail" ? "gmail_enabled" : "sheets_enabled";
  await env.DB.prepare(`
    UPDATE google_integrations
    SET ${column} = 0, updated_at = ?
    WHERE user_email = ?
  `).bind(Date.now(), session.user_email).run();

  if (service === "gmail") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM email_cache WHERE user_email = ?").bind(session.user_email),
      env.DB.prepare("DELETE FROM email_preferences WHERE user_email = ?").bind(session.user_email),
      env.DB.prepare("DELETE FROM gmail_sync WHERE user_email = ?").bind(session.user_email),
    ]);
  }

  const integrations = await integrationStatus(session.user_email, env);
  if (!integrations.gmail && !integrations.sheets) {
    await revokeAndDeleteGoogleToken(session.user_email, env);
  }
  return json({ ok: true, integrations });
}

async function signOut(request, env) {
  if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
  const token = readCookies(request)[SESSION_COOKIE];
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
  return new Response(JSON.stringify({ ok: true }), { headers });
}

async function revokeAndDeleteGoogleToken(email, env) {
  const row = await env.DB.prepare(`
    SELECT refresh_token_encrypted FROM oauth_tokens WHERE user_email = ?
  `).bind(email).first();
  if (row?.refresh_token_encrypted) {
    try {
      const refreshToken = await decryptSecret(row.refresh_token_encrypted, env.TOKEN_ENCRYPTION_SECRET);
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
      });
    } catch {
      // Local disconnection still completes if Google revocation is unavailable.
    }
  }
  await env.DB.prepare("DELETE FROM oauth_tokens WHERE user_email = ?").bind(email).run();
}

async function ensureIntegrationSchema() {
  // google_integrations is provisioned by migrations/20260731_canonical_runtime_schema.sql.
}

async function createSession(email, env) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare(`
      INSERT INTO sessions (token_hash, user_email, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(tokenHash, email, now + SESSION_MAX_AGE * 1000, now),
  ]);
  return token;
}

async function verifyGoogleIdentity(idToken, env) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) return null;
  const identity = await response.json();
  const verified = identity.email_verified === true || identity.email_verified === "true";
  const allowedEmail = String(env.ALLOWED_EMAIL).trim().toLowerCase();
  if (
    identity.aud !== env.GOOGLE_CLIENT_ID
    || !verified
    || identity.email?.toLowerCase() !== allowedEmail
  ) return null;
  return identity;
}

function requiredConfig(env) {
  const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ALLOWED_EMAIL", "TOKEN_ENCRYPTION_SECRET"];
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing Worker secrets: ${missing.join(", ")}`);
}

async function serveAsset(request, env, pathname) {
  const url = new URL(pathname, request.url);
  return env.ASSETS.fetch(new Request(url, request));
}

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location } });
}

async function encryptSecret(value, secret) {
  const key = await encryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(String(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
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
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(secret)));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function randomToken(length) {
  return base64Url(crypto.getRandomValues(new Uint8Array(length)));
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name) {
  return cookie(name, "", 0);
}

function htmlError(message, status) {
  const safeMessage = String(message)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Joy</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#e9ece8;color:#22272e;font:16px Nunito,system-ui}.card{max-width:480px;margin:20px;padding:28px;border:1px solid #d2d8d2;border-radius:22px;background:#f8f7f3;box-shadow:0 24px 70px rgba(25,30,28,.12)}a{color:#405c76;font-weight:800}</style><div class="card"><h1>Joy could not continue</h1><p>${safeMessage}</p><a href="/">Return to Joy</a></div></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
