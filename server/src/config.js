import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  OPENROUTER_API_KEY: z.string().default(""),
  AI_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  AI_MODEL: z.string().default("openai/gpt-5-mini"),
  AI_MODELS: z.string().default([
    "openrouter/free",
    "~deepseek/deepseek-v4-flash-latest",
    "~google/gemini-flash-latest",
    "openai/gpt-oss-20b:free",
    "~openai/gpt-mini-latest",
    "openrouter/auto",
  ].join(",")),
  AI_MAX_TOKENS: z.coerce.number().int().min(1).max(16384).default(1024),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid server configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Fix server/.env before starting Nexora AI");
}

export const env = parsed.data;

export const aiModels = env.AI_MODELS
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

if (!aiModels.length) aiModels.push(env.AI_MODEL);

const modelNames = {
  "openrouter/free": "Free models (recommended)",
  "~deepseek/deepseek-v4-flash-latest": "DeepSeek V4 Flash",
  "~google/gemini-flash-latest": "Gemini Flash",
  "openai/gpt-oss-20b:free": "GPT-OSS 20B (free)",
  "~openai/gpt-mini-latest": "GPT Mini",
  "openrouter/auto": "OpenRouter Auto",
};

export const availableModels = aiModels.map((id) => ({
  id,
  name: modelNames[id] || id,
  free: id === "openrouter/free" || id.endsWith(":free"),
}));

export const databaseUrl = env.DATABASE_URL.replace(
  /([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/,
  "$1sslmode=verify-full",
);
