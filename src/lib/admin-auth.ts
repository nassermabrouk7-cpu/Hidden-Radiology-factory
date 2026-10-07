import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "hr_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getSecret(name: "ADMIN_PASSWORD" | "ADMIN_SESSION_SECRET") {
  const value = process.env[name];
  if (!value || value.length < 32) return null;
  return value;
}

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function adminAuthConfigured() {
  return Boolean(getSecret("ADMIN_PASSWORD") && getSecret("ADMIN_SESSION_SECRET"));
}

export function verifyAdminPassword(password: unknown) {
  const expected = getSecret("ADMIN_PASSWORD");
  return typeof password === "string" && Boolean(expected) && safeEqual(password, expected!);
}

export function createAdminSession() {
  const secret = getSecret("ADMIN_SESSION_SECRET");
  if (!secret) return null;
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ expires })).toString("base64url");
  return { token: `${payload}.${signature(payload, secret)}`, expires, maxAge: SESSION_TTL_SECONDS };
}

export function isValidAdminSession(cookieHeader: string | null) {
  const secret = getSecret("ADMIN_SESSION_SECRET");
  if (!secret || !cookieHeader) return false;

  const cookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`));
  if (!cookie) return false;

  const token = cookie.slice(ADMIN_COOKIE_NAME.length + 1);
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return false;

  const expectedSignature = signature(payload, secret);
  if (!safeEqual(suppliedSignature, expectedSignature)) return false;

  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof decoded === "object" && decoded !== null && "expires" in decoded &&
      typeof decoded.expires === "number" && decoded.expires > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin === new URL(request.url).origin;
}

export function adminCookieHeader(token: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE_NAME}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
