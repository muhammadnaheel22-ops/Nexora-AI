import pg from "pg";
import { databaseUrl } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

function postgresSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function query(sql, params = []) {
  const result = await pool.query(postgresSql(sql), params);
  return result.rows;
}

export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const connection = {
      execute: async (sql, params = []) => {
        const result = await client.query(postgresSql(sql), params);
        return [{ insertId: result.rows[0]?.id, rows: result.rows, rowCount: result.rowCount }];
      },
    };
    const result = await work(connection);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
