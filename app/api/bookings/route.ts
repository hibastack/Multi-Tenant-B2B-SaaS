import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { pool, withTransaction } from "@/lib/db";
import { ApiError, readJson, withErrorHandling } from "@/lib/api-error";
import { getTenantId } from "@/lib/tenant";
import { mapBooking, type BookingRow } from "@/lib/bookings";
import { createBookingSchema, listQuerySchema } from "@/lib/schemas/booking";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req) => {
  const query = listQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const tenantId = await getTenantId();

  const { rows } = await pool.query<BookingRow>(
    `select * from bookings
      where tenant_id = $1
        and ($2::timestamptz is null or starts_at >= $2)
        and ($3::timestamptz is null or starts_at < $3)
        and ($4::text is null or status = $4)
      order by starts_at asc
      limit $5 offset $6`,
    [tenantId, query.from ?? null, query.to ?? null, query.status ?? null, query.limit, query.offset],
  );

  return NextResponse.json({
    data: rows.map(mapBooking),
    meta: { limit: query.limit, offset: query.offset, count: rows.length },
  });
});

// Idempotent: Idempotency-Key header zaroori hai. Wahi key dobara aaye to
// purana response wapis milta hai, nayi booking nahi banti.
export const POST = withErrorHandling(async (req) => {
  const key = req.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 8 || key.length > 255) {
    throw new ApiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Send an Idempotency-Key header (8-255 characters, e.g. a UUID) with this request.",
    );
  }

  const input = createBookingSchema.parse(await readJson(req));
  const tenantId = await getTenantId();
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");

  const result = await withTransaction(async (client) => {
    const claim = await client.query(
      `insert into idempotency_keys (tenant_id, key, request_hash)
       values ($1, $2, $3)
       on conflict (tenant_id, key) do nothing
       returning key`,
      [tenantId, key, requestHash],
    );

    if (claim.rowCount === 0) {
      const { rows } = await client.query<{
        request_hash: string;
        response_status: number | null;
        response_body: unknown;
      }>(
        `select request_hash, response_status, response_body
           from idempotency_keys where tenant_id = $1 and key = $2`,
        [tenantId, key],
      );
      const saved = rows[0];
      if (!saved || saved.response_status === null) {
        throw new ApiError(409, "REQUEST_IN_PROGRESS", "A request with this key is still being processed. Try again shortly.");
      }
      if (saved.request_hash !== requestHash) {
        throw new ApiError(
          422,
          "IDEMPOTENCY_KEY_REUSED",
          "This Idempotency-Key was already used with a different request body.",
        );
      }
      return { status: saved.response_status, body: saved.response_body, replayed: true };
    }

    const { rows } = await client.query<BookingRow>(
      `insert into bookings
         (tenant_id, customer_name, customer_email, service, starts_at, ends_at, notes)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [
        tenantId,
        input.customerName,
        input.customerEmail,
        input.service,
        input.startsAt,
        input.endsAt,
        input.notes || null,
      ],
    );

    const body = { data: mapBooking(rows[0]) };
    await client.query(
      `update idempotency_keys
          set response_status = 201, response_body = $3
        where tenant_id = $1 and key = $2`,
      [tenantId, key, JSON.stringify(body)],
    );
    return { status: 201, body, replayed: false };
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.replayed ? { "Idempotent-Replayed": "true" } : undefined,
  });
});