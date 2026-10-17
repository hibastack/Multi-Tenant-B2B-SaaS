export const BOOKING_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type Booking = {
  id: string;
  customerName: string;
  customerEmail: string;
  service: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};