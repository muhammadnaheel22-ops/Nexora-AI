import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "./config.js";

const url = new URL(env.DATABASE_URL);
const database = url.pathname.slice(1);
const options = { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), multipleStatements: true };
const bootstrap = await mysql.createConnection(options);
await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database.replaceAll("`", "``")}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await bootstrap.end();
const connection = await mysql.createConnection({ ...options, database });
const schema = await fs.readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
await connection.query(schema);
await connection.end();
console.log(`Nexora database ready: ${database}`);
