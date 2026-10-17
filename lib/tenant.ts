import { pool } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/api-error";

let cachedTenantId: string | undefined;

// Abhi login nahi hai, is liye har request DEFAULT_TENANT_SLUG wali company ke liye chalti hai.
// Auth banne ke baad sirf yeh function badlega (session se tenant padhna).
export async function getTenantId(): Promise<string> {
  if (cachedTenantId) return cachedTenantId;

  const { rows } = await pool.query<{ id: string }>("select id from tenants where slug = $1", [
    env.DEFAULT_TENANT_SLUG,
  ]);
  if (!rows[0]) {
    throw new ApiError(
      500,
      "TENANT_NOT_FOUND",
      `Tenant "${env.DEFAULT_TENANT_SLUG}" does not exist. Run "npm run db:migrate" and "npm run db:seed".`,
    );
  }
  cachedTenantId = rows[0].id;
  return cachedTenantId;
}