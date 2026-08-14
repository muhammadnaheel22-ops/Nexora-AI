import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "./config.js";

const SESSION_COOKIE = "nexora_session";
const CSRF_COOKIE = "nexora_csrf";

export function sessionFor(user) {
  return jwt.sign({ sub: String(user.id), email: user.email, role: user.role }, env.JWT_SECRET, {
    expiresIn: "7d",
    issuer: "nexora-ai",
    audience: "nexora-web",
  });
}
export function setSession(res, user) {
  const secure = env.NODE_ENV === "production";
  const csrf = crypto.randomBytes(24).toString("hex");
  res.cookie(SESSION_COOKIE, sessionFor(user), { httpOnly: true, secure, sameSite: "lax", maxAge: 604800000, path: "/" });
  res.cookie(CSRF_COOKIE, csrf, { httpOnly: false, secure, sameSite: "lax", maxAge: 604800000, path: "/" });
}

export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.clearCookie(CSRF_COOKIE, { path: "/" });
}

export function requireAuth(req, res, next) {
  try {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return res.status(401).json({ error: { message: "Authentication required" } });
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: "nexora-ai", audience: "nexora-web" });
    req.user = { id: Number(payload.sub), email: payload.email, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: { message: "Session expired" } });
  }
}

export function requireCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const cookie = req.cookies[CSRF_COOKIE];
  const header = req.get("X-CSRF-Token");
  if (!cookie || !header || cookie !== header) return res.status(403).json({ error: { message: "Invalid CSRF token" } });
  return next();
}
