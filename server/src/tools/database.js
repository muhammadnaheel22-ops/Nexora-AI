import { execute } from "../services/mysqlService.js";

export const databaseTool = {
  name: "database",
  description: "Read safe aggregate application metadata for the authenticated user. Arbitrary SQL is never accepted from an agent.",
  async execute({ operation }, ctx) {
    const userId = String(ctx.userId);
    if (operation === "conversation_stats") {
      const rows = await execute(
        `SELECT
           COUNT(DISTINCT c.id) AS conversations,
           COUNT(DISTINCT m.id) AS messages,
           COUNT(DISTINCT t.id) AS tasks
         FROM users u
         LEFT JOIN conversations c ON c.user_id = u.id
         LEFT JOIN messages m ON m.conversation_id = c.id
         LEFT JOIN agent_tasks t ON t.conversation_id = c.id
         WHERE u.id = ?`,
        [userId]
      );
      const row = rows[0] || {};
      return { conversations: Number(row.conversations || 0), messages: Number(row.messages || 0), tasks: Number(row.tasks || 0) };
    }
    if (operation === "document_stats") {
      const rows = await execute(
        `SELECT COUNT(*) AS documents, COALESCE(SUM(chunk_count), 0) AS chunks FROM documents WHERE user_id = ?`,
        [userId]
      );
      return { documents: Number(rows[0]?.documents || 0), chunks: Number(rows[0]?.chunks || 0) };
    }
    throw new Error("Unsupported database operation");
  }
};
