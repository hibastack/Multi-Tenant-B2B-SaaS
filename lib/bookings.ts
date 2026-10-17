import type { Booking, BookingStatus } from "@/lib/booking-types";

export type BookingRow = {
  id: string;
  tenant_id: string;
  customer_name: string;
  customer_email: string;
  service: string;
  starts_at: Date;
  ends_at: Date;
  status: BookingStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export function mapBooking(r: BookingRow): Booking {
  return {
    id: r.id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    service: r.service,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}