import mysql from "mysql2/promise";
import { env } from "../config/env.js";

function connectionOptions() {
  const url = new URL(env.DATABASE_URL);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must use mysql://");

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    waitForConnections: true,
    connectionLimit: env.MYSQL_POOL_LIMIT,
    queueLimit: 0,
    charset: "utf8mb4",
  };
}

export const mysqlPool = mysql.createPool(connectionOptions());

export async function execute(sql, params = []) {
  const [rows] = await mysqlPool.query(sql, params);
  return rows;
}

export async function withTransaction(work) {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function closeMysqlPool() {
  await mysqlPool.end();
}
