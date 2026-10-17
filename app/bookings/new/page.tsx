import Link from "next/link";
import { BookingForm } from "@/components/bookings/booking-form";

export const metadata = { title: "New booking | SaaS Booking" };

export default function NewBookingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/bookings" className="text-sm text-indigo-600 hover:underline">
        &larr; All bookings
      </Link>
      <h1 className="text-2xl font-bold">New booking</h1>
      <BookingForm />
    </div>
  );
}