import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";

const url = new URL(env.DATABASE_URL);
if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must use mysql://");

const database = url.pathname.replace(/^\//, "");
if (!/^[a-zA-Z0-9_]+$/.test(database)) {
  throw new Error("Database name may contain only letters, numbers and underscores");
}

const baseOptions = {
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  multipleStatements: true,
};

let connection;
try {
  connection = await mysql.createConnection({ ...baseOptions, database });
} catch (error) {
  if (error.code !== "ER_BAD_DB_ERROR") throw error;
  connection = await mysql.createConnection(baseOptions);
  await connection.query(
    `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.query(`USE \`${database}\``);
}

try {
  const schemaPath = path.resolve(process.cwd(), "database/schema.sql");
  const schema = await fs.readFile(schemaPath, "utf8");
  await connection.query(schema);
  console.log(`MySQL schema ready: ${database}`);
} finally {
  await connection.end();
}
