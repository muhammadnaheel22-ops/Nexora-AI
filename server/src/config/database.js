import { execute, withTransaction, closeMysqlPool } from "../services/mysqlService.js";

export async function connectDatabase() {
  await execute("SELECT 1 AS connected");
  console.log("MySQL connected");
}

export async function disconnectDatabase() {
  await closeMysqlPool();
}

export async function query(sql, params = []) {
  return execute(sql, params);
}

export async function transaction(work) {
  return withTransaction(work);
}
