import fs from "node:fs/promises";
import pg from "pg";
import { databaseUrl } from "./config.js";

const { Client } = pg;
const schema = await fs.readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
const client = new Client({ connectionString: databaseUrl });

await client.connect();
await client.query(schema);
await client.end();
console.log("Nexora PostgreSQL schema is ready");
