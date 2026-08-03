import { isSameOrigin, json } from "./shared/http.js";
import { getSession, readCookies } from "./shared/session.js";

const DOCS_SCOPE = "https://www.googleapis.com/auth/documents.readonly";
const STATE_COOKIE = "__Host-joy_docs_oauth_state";
const PKCE_COOKIE = "__Host-joy_docs_pkce";
const COOKIE_MAX_AGE = 10 * 60;
const CALLBACK_PATH = "/auth/callback";

const DIRECT_ROUTES = new Set([
  "/auth/docs/start",
  "/api/integrations/docs/status",
  "/api/integrations/docs/disconnect",
]);

export function isGoogleDocsAuthRoute(pathname, request = null) {
  if (DIRECT_ROUTES.has(pathname)) return true;
  if (pathname !== CALLBACK_PATH || !request) return false;
  const expectedState = readCookies(request)[STATE_COOKIE] || "";
  const returnedState = new URL(request.url).searchParams.get("state") || "";
  return Boolean(expectedState && returnedState && expectedState === returnedState);
}

export async function handleGoogleDocsAuthRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/auth/docs/start" && request.method === "GET") {
    return startAuthorization(request, env);
  }
  if (pathname === CALLBACK_PATH && request.method === "GET") {
    return finishAuthorization(request, env);
  }
  if (pathname === "/api/integrations/docs/status" && request.method === "GET") {
    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    return json({ connected: await hasGoogleDocsToken(session.user_email, env) });
  }
  if (pathname === "/api/integrations/docs/disconnect" && request.method === "POST") {
    if (!isSameOrigin(request)) return json({ error: "INVALID_ORIGIN" }, 403);
    const session = await getSession(request, env);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);
    await env.DB.prepare("DELETE FROM google_docs_tokens WHERE user_email = ?")
      .bind(session.user_email)
      .run();
    return json({ ok: true, connected: false });
  }

  return json({ error: "NOT_FOUND" }, 404);
}

export async function hasGoogleDocsToken(email, env) {
  const row = await env.DB.prepare(`
    SELECT 1 AS connected
    FROM google_docs_tokens
    WHERE user_email = ?
  `).bind(normalizeEmail(email)).first();
  return Boolean(row?.connected);
}

export async function getGoogleDocsAccessToken(email, env) {
  const userEmail = normalizeEmail(email);
  const row = await env.DB.prepare(`
    SELECT refresh_token_encrypted, access_token_encrypted, access_token_expires_at
    FROM google_docs_tokens
    WHERE user_email = ?
  `).bind(userEmail).first();
  if (!row?.refresh_token_encrypted) throw docsError("DOCS_AUTHORIZATION_REQUIRED", 403);

  if (row.access_token_encrypted && Number(row.access_token_expires_at) > Date.now() + 120_000) {
    return decryptSecret(row.access_token_encrypted, env.TOKEN_ENCRYPTION_SECRET);
  }

  requiredConfig(env);
  const refreshToken = await decryptSecret(row.refresh_token_encrypted, env.TOKEN_ENCRYPTION_SECRET);
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
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw docsError(
      payload.error === "invalid_grant" ? "DOCS_AUTHORIZATION_REQUIRED" : "DOCS_TOKEN_REFRESH_FAILED",
      payload.error === "invalid_grant" ? 403 : 502,
    );
  }

  const now = Date.now();
  await env.DB.prepare(`
    UPDATE google_docs_tokens
    SET access_token_encrypted = ?, access_token_expires_at = ?, updated_at = ?
    WHERE user_email = ?
  `).bind(
    await encryptSecret(payload.access_token, env.TOKEN_ENCRYPTION_SECRET),
    now + Number(payload.expires_in || 3600) * 1000,
    now,
    userEmail,
  ).run();
  return payload.access_token;
}

async function startAuthorization(request, env) {
  requiredConfig(env);
  const session = await getSession(request, env);
  if (!session) return redirect("/login");

  const url = new URL(request.url);
  const redirectUri = `${url.origin}${CALLBACK_PATH}`;
  const state = randomToken(24);
  const verifier = randomToken(48);
  const parameters = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: ["openid", "email", "profile", DOCS_SCOPE].join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: "S256",
  });

  const headers = new Headers({ Location: `https://accounts.google.com/o/oauth2/v2/auth?${parameters}` });
  headers.append("Set-Cookie", cookie(STATE_COOKIE, state, COOKIE_MAX_AGE));
  headers.append("Set-Cookie", cookie(PKCE_COOKIE, verifier, COOKIE_MAX_AGE));
  return new Response(null, { status: 302, headers });
}

async function finishAuthorization(request, env) {
  requiredConfig(env);
  const session = await getSession(request, env);
  if (!session) return redirect("/login");

  const url = new URL(request.url);
  const cookies = readCookies(request);
  const state = url.searchParams.get("state") || "";
  const expectedState = cookies[STATE_COOKIE] || "";
  const verifier = cookies[PKCE_COOKIE] || "";
  const code = url.searchParams.get("code") || "";
  if (!code || !verifier || !constantTimeEqual(state, expectedState)) {
    return htmlError("Google Docs authorization could not be verified.", 400);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}${CALLBACK_PATH}`,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const tokens = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokens.access_token || !tokens.id_token) {
    return htmlError("Google did not complete the Docs connection.", 400);
  }

  const identity = await verifyGoogleIdentity(tokens.id_token, env);
  if (!identity || normalizeEmail(identity.email) !== normalizeEmail(session.user_email)) {
    return htmlError("Connect the same Google account that is signed in to Joy.", 403);
  }

  const existing = await env.DB.prepare(`
    SELECT refresh_token_encrypted
    FROM google_docs_tokens
    WHERE user_email = ?
  `).bind(session.user_email).first();
  const refreshTokenEncrypted = tokens.refresh_token
    ? await encryptSecret(tokens.refresh_token, env.TOKEN_ENCRYPTION_SECRET)
    : existing?.refresh_token_encrypted;
  if (!refreshTokenEncrypted) {
    return htmlError("Google did not issue offline access. Try connecting again.", 400);
  }

  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO google_docs_tokens (
      user_email, refresh_token_encrypted, access_token_encrypted,
      access_token_expires_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_email) DO UPDATE SET
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      access_token_encrypted = excluded.access_token_encrypted,
      access_token_expires_at = excluded.access_token_expires_at,
      updated_at = excluded.updated_at
  `).bind(
    session.user_email,
    refreshTokenEncrypted,
    await encryptSecret(tokens.access_token, env.TOKEN_ENCRYPTION_SECRET),
    now + Number(tokens.expires_in || 3600) * 1000,
    now,
  ).run();

  const headers = new Headers({ Location: "/?ielts=1&course=1&connected=docs" });
  headers.append("Set-Cookie", clearCookie(STATE_COOKIE));
  headers.append("Set-Cookie", clearCookie(PKCE_COOKIE));
  return new Response(null, { status: 302, headers });
}

async function verifyGoogleIdentity(idToken, env) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) return null;
  const identity = await response.json();
  const verified = identity.email_verified === true || identity.email_verified === "true";
  if (
    identity.aud !== env.GOOGLE_CLIENT_ID
    || !verified
    || normalizeEmail(identity.email) !== normalizeEmail(env.ALLOWED_EMAIL)
  ) return null;
  return identity;
}

function requiredConfig(env) {
  const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ALLOWED_EMAIL", "TOKEN_ENCRYPTION_SECRET"];
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing Worker secrets: ${missing.join(", ")}`);
}

async function encryptSecret(value, secret) {
  const key = await encryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(String(value)),
  );
  return `${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

async function decryptSecret(value, secret) {
  const [ivPart, encryptedPart] = String(value).split(".");
  if (!ivPart || !encryptedPart) throw new Error("Stored token is invalid");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    await encryptionKey(secret),
    fromBase64Url(encryptedPart),
  );
  return new TextDecoder().decode(decrypted);
}

async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(secret)));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return base64Url(new Uint8Array(digest));
}

function randomToken(length) {
  return base64Url(crypto.getRandomValues(new Uint8Array(length)));
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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function docsError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name) {
  return cookie(name, "", 0);
}

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location } });
}

function htmlError(message, status) {
  const safe = String(message)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Joy</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#e9ece8;color:#22272e;font:16px Nunito,system-ui}.card{max-width:480px;margin:20px;padding:28px;border:1px solid #d2d8d2;border-radius:22px;background:#f8f7f3;box-shadow:0 24px 70px rgba(25,30,28,.12)}a{color:#405c76;font-weight:800}</style><div class="card"><h1>Joy could not continue</h1><p>${safe}</p><a href="/?ielts=1&course=1">Return to IELTS Course</a></div></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
