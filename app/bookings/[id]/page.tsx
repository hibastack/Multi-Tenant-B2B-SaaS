import { BookingDetail } from "@/components/bookings/booking-detail";

export const metadata = { title: "Booking | SaaS Booking" };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl">
      <BookingDetail id={id} />
    </div>
  );
}