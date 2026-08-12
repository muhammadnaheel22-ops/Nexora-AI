import { Router } from "express";
import { z } from "zod";

import { query } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authLimiter } from "../middleware/rateLimits.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

import {
  authenticateUser,
  clearAuthCookies,
  newCsrfToken,
  publicUser,
  registerUser,
  setAuthCookies,
  signSession,
} from "../services/authService.js";

const router = Router();

const credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

const registration = credentials.extend({
  name: z.string().min(2).max(100),
});

router.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const user = await registerUser(registration.parse(req.body));

    const csrf = newCsrfToken();

    setAuthCookies(res, signSession(user), csrf);

    res.status(201).json({
      user,
      csrfToken: csrf,
    });
  }),
);

router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const user = await authenticateUser(credentials.parse(req.body));

    const csrf = newCsrfToken();

    setAuthCookies(res, signSession(user), csrf);

    res.json({
      user,
      csrfToken: csrf,
    });
  }),
);

router.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.status(204).end();
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: req.user,
  });
});

router.patch(
  "/profile",
  requireAuth,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const { name } = z
      .object({
        name: z.string().min(2).max(100),
      })
      .parse(req.body);

    await query(
      `
        UPDATE users
        SET
          name = ?,
          updated_at = NOW()
        WHERE id = ?
      `,
      [name.trim(), req.user.id],
    );

    const rows = await query(
      `
        SELECT
          id,
          name,
          email,
          role,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [req.user.id],
    );

    const user = rows[0];

    res.json({
      user: publicUser(user),
    });
  }),
);

export default router;
