"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatDate, formatDuration, formatTimeRange, minutesBetween } from "@/lib/dates";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useBooking } from "@/components/bookings/use-booking";
import { ErrorState, Spinner, StatusBadge, btnDanger, btnPrimary, btnSecondary, cardClass } from "@/components/ui";

export function BookingDetail({ id }: { id: string }) {
  const router = useRouter();
  const { booking, loading, error, reload } = useBooking(id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiFetch<void>(`/api/bookings/${id}`, { method: "DELETE" });
      toast.success("Booking deleted");
      router.push("/bookings");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  if (loading) return <Spinner label="Loading booking..." />;

  if (error) {
    return error.notFound ? (
      <div className={`${cardClass} text-center`}>
        <p className="font-medium text-zinc-900 dark:text-zinc-100">Booking not found</p>
        <p className="mt-1 text-sm text-zinc-500">It may have been deleted.</p>
        <Link href="/bookings" className={`${btnSecondary} mt-4`}>
          Back to bookings
        </Link>
      </div>
    ) : (
      <ErrorState message={error.message} onRetry={reload} />
    );
  }
  if (!booking) return null;

  const rows: [string, React.ReactNode][] = [
    ["Customer", booking.customerName],
    ["Email", <a key="e" href={`mailto:${booking.customerEmail}`} className="text-indigo-600 hover:underline">{booking.customerEmail}</a>],
    ["Service", booking.service],
    ["Date", formatDate(booking.startsAt)],
    ["Time", `${formatTimeRange(booking.startsAt, booking.endsAt)} (${formatDuration(minutesBetween(booking.startsAt, booking.endsAt))})`],
    ["Notes", booking.notes ?? "None"],
    ["Created", new Date(booking.createdAt).toLocaleString()],
    ["Last updated", new Date(booking.updatedAt).toLocaleString()],
  ];

  return (
    <div className="space-y-6">
      <Link href="/bookings" className="text-sm text-indigo-600 hover:underline">
        &larr; All bookings
      </Link>

      <div className={cardClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{booking.service}</h1>
            <p className="text-zinc-500">for {booking.customerName}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <dl className="mt-6 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="break-words text-zinc-900 dark:text-zinc-100 sm:col-span-2">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btnDanger} onClick={() => setConfirmOpen(true)}>
            Delete
          </button>
          <Link href={`/bookings/${booking.id}/edit`} className={btnPrimary}>
            Edit booking
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this booking?"
        message={`The booking for ${booking.customerName} will be permanently removed. This can't be undone.`}
        confirmLabel="Delete booking"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}