import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { allowedOrigins, env } from "./config/env.js";

import { apiLimiter, chatLimiter } from "./middleware/rateLimits.js";
import { requireAuth } from "./middleware/auth.js";
import { requireCsrf } from "./middleware/csrf.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import memoryRoutes from "./routes/memoryRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";

export const app = express();

/*
|--------------------------------------------------------------------------
| Express Settings
|--------------------------------------------------------------------------
*/

app.set("json replacer", (_key, value) =>
  typeof value === "bigint" ? value.toString() : value
);

app.disable("x-powered-by");

/*
|--------------------------------------------------------------------------
| Security Headers
|--------------------------------------------------------------------------
*/

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "same-site",
    },
  })
);

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed by CORS"));
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PATCH",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "X-Request-Id",
    ],
  })
);

/*
|--------------------------------------------------------------------------
| Request Parsers
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "1mb",
  })
);

app.use(cookieParser());

/*
|--------------------------------------------------------------------------
| Rate Limiting
|--------------------------------------------------------------------------
*/

app.use("/api", apiLimiter);

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "nexora-api",
    database: "mysql",
    runtime: "node-express",
    orm: "none",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
*/

app.use("/api/auth", authRoutes);

/*
|--------------------------------------------------------------------------
| Conversation Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/conversations",
  requireAuth,
  requireCsrf,
  conversationRoutes
);

/*
|--------------------------------------------------------------------------
| Document Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/documents",
  requireAuth,
  requireCsrf,
  documentRoutes
);

/*
|--------------------------------------------------------------------------
| Dashboard Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/dashboard",
  requireAuth,
  requireCsrf,
  dashboardRoutes
);

/*
|--------------------------------------------------------------------------
| Agent Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/agents",
  requireAuth,
  requireCsrf,
  chatLimiter,
  agentRoutes
);

/*
|--------------------------------------------------------------------------
| AI Chat Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/chat",
  requireAuth,
  requireCsrf,
  chatLimiter,
  chatRoutes
);

/*
|--------------------------------------------------------------------------
| Memory Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/memory",
  requireAuth,
  requireCsrf,
  memoryRoutes
);

/*
|--------------------------------------------------------------------------
| Settings Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/settings",
  requireAuth,
  requireCsrf,
  settingsRoutes
);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use(notFound);

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use(errorHandler);