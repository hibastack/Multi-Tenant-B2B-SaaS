import { z } from "zod";
import { BOOKING_STATUSES } from "@/lib/booking-types";

const isoDateTime = z.string().datetime({ offset: true, message: "Must be an ISO 8601 date-time" });

const bookingFields = z.object({
  customerName: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  customerEmail: z.string().trim().email("Enter a valid email address").max(255),
  service: z.string().trim().min(2, "Service must be at least 2 characters").max(100),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  notes: z.string().trim().max(1000, "Notes must be 1000 characters or fewer").optional(),
});

const endAfterStart = (d: { startsAt?: string; endsAt?: string }) =>
  !d.startsAt || !d.endsAt || new Date(d.endsAt) > new Date(d.startsAt);

export const createBookingSchema = bookingFields.refine(endAfterStart, {
  message: "endsAt must be after startsAt",
  path: ["endsAt"],
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const updateBookingSchema = bookingFields
  .partial()
  .extend({
    status: z.enum(BOOKING_STATUSES).optional(),
    notes: z.string().trim().max(1000, "Notes must be 1000 characters or fewer").nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
  })
  .refine(endAfterStart, { message: "endsAt must be after startsAt", path: ["endsAt"] });
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

export const listQuerySchema = z.object({
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const idSchema = z.string().uuid("Booking id must be a valid UUID");