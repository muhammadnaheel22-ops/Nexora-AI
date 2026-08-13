import mysql from "mysql2/promise";
import { env } from "../config/env.js";

/**
 * Returns TLS configuration when connecting to TiDB Cloud.
 *
 * TiDB Cloud public endpoints require TLS.
 * Node.js uses its trusted CA store for certificate verification,
 * so we don't need to load a local .pem file.
 */
function getSslOptions(url) {
  const isTiDBCloud = url.hostname.endsWith("tidbcloud.com");

  if (!isTiDBCloud) {
    // Local MySQL normally does not require TLS.
    return undefined;
  }

  return {
    rejectUnauthorized: true,
  };
}

/**
 * Build MySQL connection options from DATABASE_URL.
 */
function connectionOptions() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  let url;

  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }

  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use the mysql:// protocol.");
  }

  const database = url.pathname.replace(/^\/+/, "");

  if (!url.hostname) {
    throw new Error("DATABASE_URL is missing the database host.");
  }

  if (!url.username) {
    throw new Error("DATABASE_URL is missing the database username.");
  }

  if (!database) {
    throw new Error("DATABASE_URL is missing the database name.");
  }

  return {
    host: url.hostname,
    port: Number(url.port || 3306),

    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,

    waitForConnections: true,
    connectionLimit: env.MYSQL_POOL_LIMIT || 10,
    queueLimit: 0,

    charset: "utf8mb4",

    enableKeepAlive: true,
    keepAliveInitialDelay: 0,

    ssl: getSslOptions(url),
  };
}

/**
 * Shared MySQL/TiDB connection pool.
 */
export const mysqlPool = mysql.createPool(connectionOptions());

/**
 * Execute a parameterized SQL query.
 */
export async function execute(sql, params = []) {
  const [rows] = await mysqlPool.execute(sql, params);

  return rows;
}

/**
 * Execute work inside a database transaction.
 *
 * Usage:
 *
 * await withTransaction(async (connection) => {
 *   await connection.execute(
 *     "INSERT INTO users (name, email) VALUES (?, ?)",
 *     [name, email]
 *   );
 * });
 */
export async function withTransaction(work) {
  const connection = await mysqlPool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await work(connection);

    await connection.commit();

    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Database rollback failed:", rollbackError);
    }

    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Gracefully close the connection pool.
 */
export async function closeMysqlPool() {
  await mysqlPool.end();
}
