"use client";

import Link from "next/link";
import { useBooking } from "@/components/bookings/use-booking";
import { BookingForm } from "@/components/bookings/booking-form";
import { ErrorState, Spinner, btnSecondary, cardClass } from "@/components/ui";

export function BookingEdit({ id }: { id: string }) {
  const { booking, loading, error, reload } = useBooking(id);

  if (loading) return <Spinner label="Loading booking..." />;
  if (error) {
    return error.notFound ? (
      <div className={`${cardClass} text-center`}>
        <p className="font-medium text-zinc-900 dark:text-zinc-100">Booking not found</p>
        <Link href="/bookings" className={`${btnSecondary} mt-4`}>
          Back to bookings
        </Link>
      </div>
    ) : (
      <ErrorState message={error.message} onRetry={reload} />
    );
  }
  if (!booking) return null;

  return <BookingForm key={booking.id} booking={booking} />;
}