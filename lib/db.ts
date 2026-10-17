import { Pool, type PoolClient } from "pg";
import { env } from "@/lib/env";

const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ?? new Pool({ connectionString: env.DATABASE_URL, max: 10 });

if (env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}