import bcrypt from "bcryptjs";
import { transaction, connectDatabase, disconnectDatabase } from "../config/database.js";
import { ensureAgentConfigs } from "../services/agentConfigService.js";

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const name = process.env.ADMIN_NAME?.trim() || "Nexora Admin";
  const passwordHash = await bcrypt.hash(password, 12);

  await transaction(async (connection) => {
    const [rows] = await connection.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    let userId;
    if (rows.length) {
      userId = rows[0].id;
      await connection.query(
        "UPDATE users SET name = ?, password_hash = ?, role = 'admin', updated_at = NOW() WHERE id = ?",
        [name, passwordHash, userId],
      );
    } else {
      const [result] = await connection.query(
        "INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'admin', NOW(), NOW())",
        [name, email, passwordHash],
      );
      userId = result.insertId;
    }
    await connection.query(
      "INSERT IGNORE INTO user_settings (user_id, created_at, updated_at) VALUES (?, NOW(), NOW())",
      [userId],
    );
  });
  console.log(`Admin ready: ${email}`);
}

try {
  await connectDatabase();
  await ensureAgentConfigs();
  await seedAdmin();
  console.log("Seed completed");
} finally {
  await disconnectDatabase();
}
