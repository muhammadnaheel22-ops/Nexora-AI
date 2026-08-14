import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { clearSession, requireAuth, requireCsrf, setSession } from "./auth.js";
import { generateReply } from "./ai.js";
import { query, transaction } from "./db.js";
import { env } from "./config.js";

export const router = Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) });
const publicUser = (user) => ({ id: Number(user.id), name: user.name, email: user.email, role: user.role });

router.get("/health", (_req, res) => res.json({ status: "ok", service: "nexora-api", database: "mysql", version: "2.0.0" }));

router.post("/auth/register", asyncRoute(async (req, res) => {
  const input = credentials.extend({ name: z.string().trim().min(2).max(100) }).parse(req.body);
  const email = input.email.trim().toLowerCase();
  const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (existing.length) return res.status(409).json({ error: { message: "Email is already registered" } });
  const hash = await bcrypt.hash(input.password, 12);
  const user = await transaction(async (connection) => {
    const [result] = await connection.execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", [input.name, email, hash]);
    await connection.execute("INSERT INTO user_settings (user_id, ai_model) VALUES (?, ?)", [result.insertId, env.AI_MODEL]);
    return { id: result.insertId, name: input.name, email, role: "user" };
  });
  setSession(res, user);
  return res.status(201).json({ user: publicUser(user) });
}));
router.post("/auth/login", asyncRoute(async (req, res) => {
  const input = credentials.parse(req.body);
  const users = await query("SELECT id, name, email, role, password_hash FROM users WHERE email = ? LIMIT 1", [input.email.trim().toLowerCase()]);
  const user = users[0];
  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) return res.status(401).json({ error: { message: "Invalid email or password" } });
  setSession(res, user);
  return res.json({ user: publicUser(user) });
}));

router.post("/auth/logout", (_req, res) => { clearSession(res); res.status(204).end(); });
router.get("/auth/me", requireAuth, asyncRoute(async (req, res) => {
  const users = await query("SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1", [req.user.id]);
  if (!users[0]) return res.status(401).json({ error: { message: "User no longer exists" } });
  return res.json({ user: publicUser(users[0]) });
}));

router.use(requireAuth, requireCsrf);

router.get("/conversations", asyncRoute(async (req, res) => {
  const rows = await query("SELECT id, title, created_at AS createdAt, updated_at AS updatedAt FROM conversations WHERE user_id = ? ORDER BY updated_at DESC", [req.user.id]);
  res.json({ conversations: rows });
}));

router.get("/conversations/:id/messages", asyncRoute(async (req, res) => {
  const owners = await query("SELECT id FROM conversations WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (!owners.length) return res.status(404).json({ error: { message: "Conversation not found" } });
  const messages = await query("SELECT id, role, content, created_at AS createdAt FROM messages WHERE conversation_id = ? ORDER BY id", [req.params.id]);
  return res.json({ messages });
}));

router.delete("/conversations/:id", asyncRoute(async (req, res) => {
  await query("DELETE FROM conversations WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  res.status(204).end();
}));

router.post("/chat", asyncRoute(async (req, res) => {
  const input = z.object({ conversationId: z.coerce.number().int().positive().optional(), message: z.string().trim().min(1).max(12000) }).parse(req.body);
  let conversationId = input.conversationId;
  if (conversationId) {
    const owned = await query("SELECT id FROM conversations WHERE id = ? AND user_id = ?", [conversationId, req.user.id]);
    if (!owned.length) return res.status(404).json({ error: { message: "Conversation not found" } });
  } else {
    const result = await query("INSERT INTO conversations (user_id, title) VALUES (?, ?)", [req.user.id, input.message.slice(0, 80)]);
    conversationId = result.insertId;
  }
  const history = await query("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 12", [conversationId]);
  await query("INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)", [conversationId, input.message]);
  await query("INSERT INTO agent_events (user_id, conversation_id, agent, status, detail) VALUES (?, ?, 'Nexora Core', 'running', 'Preparing response')", [req.user.id, conversationId]);
  try {
    const reply = await generateReply({ message: input.message, history: history.reverse() });
    const result = await query("INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)", [conversationId, reply]);
    await query("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [conversationId]);
    await query("INSERT INTO agent_events (user_id, conversation_id, agent, status, detail) VALUES (?, ?, 'Nexora Core', 'completed', 'Response delivered')", [req.user.id, conversationId]);
    return res.json({ conversationId, message: { id: result.insertId, role: "assistant", content: reply } });
  } catch (error) {
    await query("INSERT INTO agent_events (user_id, conversation_id, agent, status, detail) VALUES (?, ?, 'Nexora Core', 'failed', ?)", [req.user.id, conversationId, error.message.slice(0, 255)]);
    throw error;
  }
}));

router.get("/dashboard", asyncRoute(async (req, res) => {
  const [[conversationCount], [messageCount], [documentCount], recent, agents] = await Promise.all([
    query("SELECT COUNT(*) AS value FROM conversations WHERE user_id = ?", [req.user.id]),
    query("SELECT COUNT(*) AS value FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.user_id = ?", [req.user.id]),
    query("SELECT COUNT(*) AS value FROM documents WHERE user_id = ?", [req.user.id]),
    query("SELECT id, title, updated_at AS updatedAt FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5", [req.user.id]),
    query("SELECT agent, status, COUNT(*) AS value FROM agent_events WHERE user_id = ? GROUP BY agent, status", [req.user.id]),
  ]);
  res.json({ metrics: { conversations: conversationCount.value, messages: messageCount.value, documents: documentCount.value }, recent, agents });
}));

const team = [
  ["Nexora Core", "Orchestrator", "Plans and delivers final responses"],
  ["Nexora Scout", "Research", "Finds and verifies information"],
  ["Nexora Logic", "Analysis", "Reasons through complex decisions"],
  ["Nexora Forge", "Builder", "Designs technical solutions"],
  ["Nexora Scribe", "Writer", "Creates polished deliverables"],
  ["Nexora Memory", "Context", "Maintains useful continuity"],
  ["Nexora Sentinel", "Review", "Checks quality and safety"],
].map(([name, role, description]) => ({ name, role, description }));

router.get("/agents", asyncRoute(async (req, res) => {
  const events = await query("SELECT id, agent, status, detail, created_at AS createdAt FROM agent_events WHERE user_id = ? ORDER BY id DESC LIMIT 30", [req.user.id]);
  res.json({ team, events });
}));

router.get("/documents", asyncRoute(async (req, res) => {
  const documents = await query("SELECT id, name, mime_type AS mimeType, size_bytes AS sizeBytes, created_at AS createdAt FROM documents WHERE user_id = ? ORDER BY id DESC", [req.user.id]);
  res.json({ documents });
}));

router.post("/documents", asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().trim().min(1).max(255), content: z.string().max(500000), mimeType: z.string().max(120).default("text/plain") }).parse(req.body);
  const size = Buffer.byteLength(input.content, "utf8");
  const result = await query("INSERT INTO documents (user_id, name, mime_type, size_bytes, content) VALUES (?, ?, ?, ?, ?)", [req.user.id, input.name, input.mimeType, size, input.content]);
  res.status(201).json({ document: { id: result.insertId, name: input.name, mimeType: input.mimeType, sizeBytes: size } });
}));

router.delete("/documents/:id", asyncRoute(async (req, res) => {
  await query("DELETE FROM documents WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  res.status(204).end();
}));

router.get("/settings", asyncRoute(async (req, res) => {
  const rows = await query("SELECT theme, ai_model AS aiModel, system_prompt AS systemPrompt FROM user_settings WHERE user_id = ?", [req.user.id]);
  res.json({ settings: rows[0] || { theme: "dark", aiModel: env.AI_MODEL, systemPrompt: "" } });
}));

router.put("/settings", asyncRoute(async (req, res) => {
  const input = z.object({ theme: z.enum(["dark", "light", "system"]), aiModel: z.string().trim().min(1).max(100), systemPrompt: z.string().max(5000).default("") }).parse(req.body);
  await query("INSERT INTO user_settings (user_id, theme, ai_model, system_prompt) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE theme = VALUES(theme), ai_model = VALUES(ai_model), system_prompt = VALUES(system_prompt)", [req.user.id, input.theme, input.aiModel, input.systemPrompt]);
  res.json({ settings: input });
}));
