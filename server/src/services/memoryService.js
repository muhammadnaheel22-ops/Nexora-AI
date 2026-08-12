import { query } from "../config/database.js";

export async function getConversationMemory(conversationId, limit = 12) {
  const rows = await query(
    `
      SELECT
        role,
        content,
        created_at AS createdAt
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [conversationId, Number(limit)],
  );

  return rows.reverse().map((message) => ({
    role: String(message.role).toLowerCase(),
    content: message.content,
    createdAt: message.createdAt,
  }));
}

export async function getLongTermMemory(userId, limit = 20) {
  const settingRows = await query(
    `
      SELECT
        long_term_memory_enabled AS longTermMemoryEnabled
      FROM user_settings
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  const settings = settingRows[0];

  if (settings && Number(settings.longTermMemoryEnabled) === 0) {
    return [];
  }

  const rows = await query(
    `
      SELECT
        id,
        user_id AS userId,
        memory_key AS memoryKey,
        memory_type AS memoryType,
        content,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM memories
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT ?
    `,
    [userId, Number(limit)],
  );

  return rows;
}

export async function upsertMemory({
  userId,
  key,
  value,
  category = "preference",
}) {
  await query(
    `
      INSERT INTO memories (
        user_id,
        memory_key,
        memory_type,
        content,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        memory_type = VALUES(memory_type),
        content = VALUES(content),
        updated_at = NOW()
    `,
    [userId, key, category, value],
  );

  const rows = await query(
    `
      SELECT
        id,
        user_id AS userId,
        memory_key AS memoryKey,
        memory_type AS memoryType,
        content,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM memories
      WHERE user_id = ?
        AND memory_key = ?
      LIMIT 1
    `,
    [userId, key],
  );

  return rows[0] || null;
}
