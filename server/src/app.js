import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { ZodError } from "zod";
import { env } from "./config.js";
import { router } from "./routes.js";

export const app = express();
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((value) => value.trim()), credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api", router);
app.use((_req, res) => res.status(404).json({ error: { message: "Route not found" } }));
app.use((error, _req, res, _next) => {
  if (error instanceof ZodError) return res.status(400).json({ error: { message: "Invalid request", details: error.flatten() } });
  console.error(error);
  return res.status(500).json({ error: { message: error.message || "Internal server error" } });
});

export default app;
