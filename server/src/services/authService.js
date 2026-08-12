import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { query, transaction } from "../config/database.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

const COOKIE_NAME = "nexora_session";
const CSRF_COOKIE = "nexora_csrf";

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: String(user.role || "user").toLowerCase(),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerUser({ name, email, password }) {
  const normalized = email.toLowerCase().trim();
  const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [normalized]);
  if (existing.length) throw new AppError("Email is already registered", 409, "EMAIL_EXISTS");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await transaction(async (connection) => {
    const [result] = await connection.query(
      `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, 'user', NOW(), NOW())`,
      [name.trim(), normalized, passwordHash],
    );
    await connection.query(
      `INSERT INTO user_settings (user_id, created_at, updated_at) VALUES (?, NOW(), NOW())`,
      [result.insertId],
    );
    const [rows] = await connection.query(
      `SELECT id, name, email, role, created_at AS createdAt, updated_at AS updatedAt
       FROM users WHERE id = ? LIMIT 1`,
      [result.insertId],
    );
    return rows[0];
  });
  return publicUser(user);
}

export async function authenticateUser({ email, password }) {
  const rows = await query(
    `SELECT id, name, email, password_hash AS passwordHash, role,
            created_at AS createdAt, updated_at AS updatedAt
     FROM users WHERE email = ? LIMIT 1`,
    [email.toLowerCase().trim()],
  );
  const user = rows[0];
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }
  return publicUser(user);
}

export function signSession(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role, type: "session" },
    env.JWT_SECRET,
    { expiresIn: "7d", issuer: "nexora-ai", audience: "nexora-web" },
  );
}

export function verifySession(token) {
  return jwt.verify(token, env.JWT_SECRET, { issuer: "nexora-ai", audience: "nexora-web" });
}

export function newCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function setAuthCookies(res, token, csrfToken) {
  const secure = env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, { httpOnly: true, secure, sameSite: "lax", maxAge: 604800000, path: "/" });
  res.cookie(CSRF_COOKIE, csrfToken, { httpOnly: false, secure, sameSite: "lax", maxAge: 604800000, path: "/" });
}

export function clearAuthCookies(res) {
  const secure = env.NODE_ENV === "production";
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure, sameSite: "lax", path: "/" });
  res.clearCookie(CSRF_COOKIE, { httpOnly: false, secure, sameSite: "lax", path: "/" });
}

export const sessionCookieName = COOKIE_NAME;
export const csrfCookieName = CSRF_COOKIE;
