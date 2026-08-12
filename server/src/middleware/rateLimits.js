import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const base = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
};

export const apiLimiter = rateLimit({ ...base, limit: env.RATE_LIMIT_MAX });
export const authLimiter = rateLimit({
  ...base,
  limit: 20,
  message: { error: { code: "RATE_LIMITED", message: "Too many authentication attempts" } },
});
export const chatLimiter = rateLimit({
  ...base,
  limit: 30,
  message: { error: { code: "RATE_LIMITED", message: "Too many AI requests" } },
});
