import { query } from "../config/database.js";
import { AppError } from "../utils/errors.js";
import { parseId } from "../utils/ids.js";
import { sessionCookieName, verifySession } from "../services/authService.js";

export async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.[sessionCookieName];

    if (!token) {
      throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }

    const payload = verifySession(token);

    const userId = parseId(payload.sub, "session user id");

    const rows = await query(
      `
      SELECT
        id,
        name,
        email,
        role,
        created_at AS createdAt
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId],
    );

    const user = rows[0];

    if (!user) {
      throw new AppError(
        "Session user no longer exists",
        401,
        "UNAUTHENTICATED",
      );
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: String(user.role).toLowerCase(),
      createdAt: user.createdAt,
    };

    next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }

    next(new AppError("Invalid or expired session", 401, "INVALID_SESSION"));
  }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== "admin") {
    return next(
      new AppError("Administrator access required", 403, "FORBIDDEN"),
    );
  }

  next();
}
