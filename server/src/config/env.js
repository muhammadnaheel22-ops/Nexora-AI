import "dotenv/config";
import { z } from "zod";

const boolString = (defaultValue = "false") =>
  z.string().default(defaultValue).transform((value) => value === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  MYSQL_POOL_LIMIT: z.coerce.number().int().min(1).max(50).default(10),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  AI_API_KEY: z.string().optional().default(""),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_MODEL: z.string().min(1).default("gpt-5-mini"),
  AI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  AI_JSON_MODE: boolString("true"),

  SEARCH_API_KEY: z.string().optional().default(""),
  VECTOR_DATABASE_URL: z.string().optional().default(""),
  VECTOR_DATABASE_API_KEY: z.string().optional().default(""),
  VECTOR_COLLECTION: z.string().default("nexora_documents"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  FILE_STORAGE_DIR: z.string().default("uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(15),
  MAX_AGENT_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  MAX_REVIEW_RETRIES: z.coerce.number().int().min(0).max(2).default(1),
  AGENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(180000).default(60000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(6),
  RAG_CHUNK_SIZE: z.coerce.number().int().min(300).max(5000).default(1200),
  RAG_CHUNK_OVERLAP: z.coerce.number().int().min(0).max(1000).default(180),
});

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment configuration:", result.error.flatten().fieldErrors);
  throw new Error("Fix server/.env before starting Nexora AI");
}

export const env = result.data;
export const allowedOrigins = env.CORS_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean);
