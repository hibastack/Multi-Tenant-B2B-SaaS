import Link from "next/link";
import { BookingEdit } from "@/components/bookings/booking-edit";

export const metadata = { title: "Edit booking | SaaS Booking" };

export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/bookings/${id}`} className="text-sm text-indigo-600 hover:underline">
        &larr; Back to booking
      </Link>
      <h1 className="text-2xl font-bold">Edit booking</h1>
      <BookingEdit id={id} />
    </div>
  );
}