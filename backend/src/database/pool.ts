import mysql, {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { env } from "../config/env.js";
import {
  beginConnectionWait,
  beginDatabaseOperation,
} from "../observability/metrics.js";

export const pool = mysql.createPool({
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT,
  database: env.DATABASE_NAME,
  user: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  waitForConnections: true,
  connectionLimit: env.DATABASE_CONNECTION_LIMIT,
  enableKeepAlive: true,
  charset: "utf8mb4",
  timezone: "Z",
  decimalNumbers: true,
  namedPlaceholders: false,
});

export type DbConnection = PoolConnection | typeof pool;

export async function rows<T extends RowDataPacket[]>(
  sql: string,
  params: any[] = [],
  db: DbConnection = pool,
): Promise<T> {
  const finish = beginDatabaseOperation();
  try {
    const [result] = await db.execute<T>(sql, params);
    finish();
    return result;
  } catch (error) {
    finish(true);
    throw error;
  }
}

export async function execute(
  sql: string,
  params: any[] = [],
  db: DbConnection = pool,
): Promise<ResultSetHeader> {
  const finish = beginDatabaseOperation();
  try {
    const [result] = await db.execute<ResultSetHeader>(sql, params);
    finish();
    return result;
  } catch (error) {
    finish(true);
    throw error;
  }
}

export async function transaction<T>(
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const finishWait = beginConnectionWait();
  const connection = await pool.getConnection().finally(finishWait);
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

export async function checkDatabase(): Promise<void> {
  await pool.query("SELECT 1");
}
