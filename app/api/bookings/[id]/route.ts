import { NextResponse } from "next/server";
import { pool, withTransaction } from "@/lib/db";
import { ApiError, readJson, withErrorHandling } from "@/lib/api-error";
import { getTenantId } from "@/lib/tenant";
import { mapBooking, type BookingRow } from "@/lib/bookings";
import { idSchema, updateBookingSchema, type UpdateBookingInput } from "@/lib/schemas/booking";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");

export const GET = withErrorHandling<Ctx>(async (_req, ctx) => {
  const id = idSchema.parse((await ctx.params).id);
  const tenantId = await getTenantId();

  const { rows } = await pool.query<BookingRow>(
    "select * from bookings where id = $1 and tenant_id = $2",
    [id, tenantId],
  );
  if (!rows[0]) throw notFound();
  return NextResponse.json({ data: mapBooking(rows[0]) });
});

export const PATCH = withErrorHandling<Ctx>(async (req, ctx) => {
  const id = idSchema.parse((await ctx.params).id);
  const patch = updateBookingSchema.parse(await readJson(req));
  const tenantId = await getTenantId();

  const row = await withTransaction(async (client) => {
    const current = await client.query<BookingRow>(
      "select * from bookings where id = $1 and tenant_id = $2 for update",
      [id, tenantId],
    );
    if (!current.rows[0]) throw notFound();

    const startsAt = patch.startsAt ?? current.rows[0].starts_at.toISOString();
    const endsAt = patch.endsAt ?? current.rows[0].ends_at.toISOString();
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new ApiError(400, "VALIDATION_ERROR", "The request data is not valid.", [
        { path: "endsAt", message: "endsAt must be after startsAt" },
      ]);
    }

    const columns: [keyof UpdateBookingInput, string][] = [
      ["customerName", "customer_name"],
      ["customerEmail", "customer_email"],
      ["service", "service"],
      ["startsAt", "starts_at"],
      ["endsAt", "ends_at"],
      ["status", "status"],
      ["notes", "notes"],
    ];
    const values: unknown[] = [id, tenantId];
    const sets: string[] = [];
    for (const [field, column] of columns) {
      const value = patch[field];
      if (value === undefined) continue;
      values.push(field === "notes" && value === "" ? null : value);
      sets.push(`${column} = $${values.length}`);
    }

    const updated = await client.query<BookingRow>(
      `update bookings set ${sets.join(", ")}, updated_at = now()
        where id = $1 and tenant_id = $2
        returning *`,
      values,
    );
    return updated.rows[0];
  });

  return NextResponse.json({ data: mapBooking(row) });
});

// Hamesha 204: booking ho ya pehle hi delete ho chuki ho (idempotent).
export const DELETE = withErrorHandling<Ctx>(async (_req, ctx) => {
  const id = idSchema.parse((await ctx.params).id);
  const tenantId = await getTenantId();

  await pool.query("delete from bookings where id = $1 and tenant_id = $2", [id, tenantId]);
  return new Response(null, { status: 204 });
});